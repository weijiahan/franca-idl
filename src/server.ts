import {
    createConnection,
    TextDocuments,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    DocumentSymbol,
    SymbolKind,
    Location,
    Position,
    Range,
    DefinitionParams,
    ReferenceParams,
    RequestType
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server
export const connection = createConnection();

// Create a simple document manager
const documents = new TextDocuments(TextDocument);

export function getDocuments(): TextDocuments<TextDocument> {
    return documents;
}

// Symbol location info with type
interface SymbolRef {
    name: string;
    uri: string;
    range: Range;
    isDefinition: boolean;
}

// Store all symbol references indexed by name
const symbolIndex: Map<string, SymbolRef[]> = new Map();

// Track file dependencies for cross-file resolution
const fileDependencies: Map<string, string[]> = new Map();

// Track loaded files to avoid reloading
const loadedFiles: Set<string> = new Set();

// Custom request types for file operations
namespace ReadFileRequest {
    export const type = new RequestType<{ uri: string }, { content: string } | null, void>('franca/readFile');
}

namespace FindFilesRequest {
    export const type = new RequestType<{ pattern: string }, string[], void>('franca/findFiles');
}

// Check if a line is a definition (starts with a type keyword)
function isDefinitionLine(line: string): boolean {
    const defPattern = /^(interface|struct|union|enumeration|typedef|array|map)\s+\w+/;
    const methodPattern = /^(?:readonly\s+)?method\s+\w+/;
    const broadcastPattern = /^broadcast\s+\w+/;
    return defPattern.test(line.trim()) || methodPattern.test(line.trim()) || broadcastPattern.test(line.trim());
}

// Parse import statements to get dependencies
function parseImports(content: string): string[] {
    const imports: string[] = [];
    const importPattern = /import\s+(.+?)\s*;/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
        const importPath = match[1].trim();
        imports.push(importPath);
    }

    return imports;
}

// Parse document and extract all symbol references (definitions and usages)
function parseDocumentRefs(content: string, uri: string): SymbolRef[] {
    const refs: SymbolRef[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const isDef = isDefinitionLine(trimmedLine);

        // Find all identifiers (words) in the line
        const identifierPattern = /\b([A-Za-z_]\w*)\b/g;
        let match;

        while ((match = identifierPattern.exec(line)) !== null) {
            const name = match[1];
            const startChar = match.index;
            const endChar = startChar + name.length;

            // Skip keywords
            const keywords = ['interface', 'struct', 'union', 'enumeration', 'typedef', 'array', 'map', 'method', 'broadcast', 'readonly', 'in', 'out', 'error'];
            if (keywords.includes(name)) continue;

            refs.push({
                name,
                uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: endChar }
                },
                isDefinition: isDef
            });
        }
    }

    return refs;
}

// Update symbol index for a document
function updateSymbolIndex(uri: string, content: string): void {
    const refs = parseDocumentRefs(content, uri);
    const imports = parseImports(content);

    // Remove old refs for this URI
    for (const [name, list] of symbolIndex.entries()) {
        const filtered = list.filter(r => r.uri !== uri);
        if (filtered.length > 0) {
            symbolIndex.set(name, filtered);
        } else {
            symbolIndex.delete(name);
        }
    }

    // Add new refs
    for (const ref of refs) {
        const list = symbolIndex.get(ref.name) || [];
        list.push(ref);
        symbolIndex.set(ref.name, list);
    }

    // Update dependencies
    fileDependencies.set(uri, imports);

    // Mark as loaded
    loadedFiles.add(uri);
}

// Resolve imported file URI
function resolveImportUri(importPath: string, currentUri: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('./')) {
        const currentDir = currentUri.substring(0, currentUri.lastIndexOf('/') + 1);
        const relativePath = importPath.substring(2); // Remove './'
        const resolvedUri = currentDir + relativePath;
        return resolvedUri.endsWith('.fidl') ? resolvedUri : resolvedUri + '.fidl';
    }

    if (importPath.startsWith('../')) {
        let currentDir = currentUri.substring(0, currentUri.lastIndexOf('/') + 1);
        let relativePath = importPath;

        // Handle multiple parent directory levels
        while (relativePath.startsWith('../')) {
            currentDir = currentDir.substring(0, currentDir.lastIndexOf('/', currentDir.length - 2) + 1);
            relativePath = relativePath.substring(3);
        }
        const resolvedUri = currentDir + relativePath;
        return resolvedUri.endsWith('.fidl') ? resolvedUri : resolvedUri + '.fidl';
    }

    return null;
}

// Load and index an imported file
async function loadAndIndexFile(uri: string): Promise<void> {
    if (loadedFiles.has(uri)) {
        return; // Already loaded
    }

    try {
        const response = await connection.sendRequest(ReadFileRequest.type, { uri });
        if (response && response.content) {
            updateSymbolIndex(uri, response.content);
        }
    } catch (error) {
        // File not found or cannot be read
    }
}

// Load all imported files recursively
async function loadImportedFiles(uri: string): Promise<void> {
    const imports = fileDependencies.get(uri) || [];

    for (const importPath of imports) {
        const resolvedUri = resolveImportUri(importPath, uri);
        if (resolvedUri) {
            await loadAndIndexFile(resolvedUri);
            // Recursively load imports of the imported file
            await loadImportedFiles(resolvedUri);
        }
    }
}

// Search for files matching a pattern in the workspace
async function searchWorkspaceFiles(pattern: string): Promise<string[]> {
    try {
        return await connection.sendRequest(FindFilesRequest.type, { pattern });
    } catch (error) {
        return [];
    }
}

// Load all fidl files in the workspace
async function loadAllWorkspaceFiles(): Promise<void> {
    const files = await searchWorkspaceFiles('**/*.fidl');
    for (const uri of files) {
        if (!loadedFiles.has(uri)) {
            await loadAndIndexFile(uri);
        }
    }
}

// Helper function to parse Franca IDL document (for document symbols)
function parseDocument(content: string): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match interface definitions
        const interfaceMatch = line.match(/^interface\s+(\w+)/);
        if (interfaceMatch) {
            symbols.push({
                name: interfaceMatch[1],
                kind: SymbolKind.Interface,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
            continue;
        }

        // Match method definitions (inside interfaces)
        const methodMatch = line.match(/^(?:readonly\s+)?method\s+(\w+)/);
        if (methodMatch) {
            symbols.push({
                name: methodMatch[1],
                kind: SymbolKind.Method,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
            continue;
        }

        // Match broadcast definitions
        const broadcastMatch = line.match(/^broadcast\s+(\w+)/);
        if (broadcastMatch) {
            symbols.push({
                name: broadcastMatch[1],
                kind: SymbolKind.Event,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
            continue;
        }

        // Match struct definitions
        const structMatch = line.match(/^struct\s+(\w+)/);
        if (structMatch) {
            symbols.push({
                name: structMatch[1],
                kind: SymbolKind.Struct,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
            continue;
        }

        // Match union definitions
        const unionMatch = line.match(/^union\s+(\w+)/);
        if (unionMatch) {
            symbols.push({
                name: unionMatch[1],
                kind: SymbolKind.EnumMember,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
            continue;
        }

        // Match enumeration definitions
        const enumMatch = line.match(/^enumeration\s+(\w+)/);
        if (enumMatch) {
            symbols.push({
                name: enumMatch[1],
                kind: SymbolKind.Enum,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
            continue;
        }

        // Match type definitions
        const typeMatch = line.match(/^typedef\s+(\w+)/);
        if (typeMatch) {
            symbols.push({
                name: typeMatch[1],
                kind: SymbolKind.TypeParameter,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
            continue;
        }

        // Match array/map definitions
        const arrayMatch = line.match(/^(?:array|map)\s+(\w+)/);
        if (arrayMatch) {
            symbols.push({
                name: arrayMatch[1],
                kind: SymbolKind.Variable,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                selectionRange: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                }
            });
        }
    }

    return symbols;
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            documentSymbolProvider: true,
            definitionProvider: true,
            referencesProvider: true
        }
    };
});

connection.onDocumentSymbol((params: { textDocument: { uri: string } }): DocumentSymbol[] => {
    const document = documents.get(params.textDocument.uri);
    if (document) {
        return parseDocument(document.getText());
    }
    return [];
});

// Go to Definition - find the definition location for a symbol
connection.onDefinition(async (params: DefinitionParams): Promise<Location | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const word = getWordAtPosition(document.getText(), params.position);
    if (!word) return null;

    // First, ensure all workspace files are loaded
    await loadAllWorkspaceFiles();

    // Then, load imported files for current document
    await loadImportedFiles(params.textDocument.uri);

    const refs = symbolIndex.get(word);
    if (!refs) return null;

    // Find the definition reference (where isDefinition is true)
    const definition = refs.find(r => r.isDefinition);
    if (definition) {
        return Location.create(definition.uri, definition.range);
    }

    // If no definition found, return first occurrence
    return Location.create(refs[0].uri, refs[0].range);
});

// Find All References - find all references including usages across all files
connection.onReferences(async (params: ReferenceParams): Promise<Location[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const word = getWordAtPosition(document.getText(), params.position);
    if (!word) return [];

    // First, ensure all workspace files are loaded
    await loadAllWorkspaceFiles();

    // Then, load imported files for current document
    await loadImportedFiles(params.textDocument.uri);

    const refs = symbolIndex.get(word);
    if (!refs) return [];

    // Return all references from all indexed documents
    return refs.map(ref => Location.create(ref.uri, ref.range));
});

// Find word at position
function getWordAtPosition(content: string, position: Position): string {
    const lines = content.split('\n');
    if (position.line >= lines.length) return '';

    const line = lines[position.line];

    // Find word boundaries
    let start = position.character;
    let end = position.character;

    // Expand backwards
    while (start > 0 && /\w/.test(line[start - 1])) {
        start--;
    }
    // Expand forwards
    while (end < line.length && /\w/.test(line[end])) {
        end++;
    }

    return line.substring(start, end);
}

// Track document changes
documents.onDidChangeContent((change) => {
    updateSymbolIndex(change.document.uri, change.document.getText());
});

// Handle document opening - index the new document
documents.onDidOpen(async (event) => {
    updateSymbolIndex(event.document.uri, event.document.getText());
    // Load imported files and all workspace files
    await loadAllWorkspaceFiles();
    await loadImportedFiles(event.document.uri);
});

// Handle document closing - remove symbols from closed document
documents.onDidClose((event) => {
    const uri = event.document.uri;
    for (const [name, list] of symbolIndex.entries()) {
        const filtered = list.filter(r => r.uri !== uri);
        if (filtered.length > 0) {
            symbolIndex.set(name, filtered);
        } else {
            symbolIndex.delete(name);
        }
    }
    fileDependencies.delete(uri);
    loadedFiles.delete(uri);
});

// Initialize index for all existing documents and load workspace files
documents.all().forEach(doc => {
    updateSymbolIndex(doc.uri, doc.getText());
});

documents.listen(connection);

connection.listen();
