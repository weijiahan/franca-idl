import * as path from 'path';
import { ExtensionContext, workspace, Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, RequestType } from 'vscode-languageclient/node';

let client: LanguageClient;

// Custom request types for file operations
namespace ReadFileRequest {
    export const type = new RequestType<{ uri: string }, { content: string } | null, void>('franca/readFile');
}

namespace FindFilesRequest {
    export const type = new RequestType<{ pattern: string }, string[], void>('franca/findFiles');
}

export function activate(context: ExtensionContext) {
    const serverModule = context.asAbsolutePath(path.join('out', 'server.js'));
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'franca' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.fidl')
        }
    };

    client = new LanguageClient(
        'francaLanguageServer',
        'FRANCA Language Server',
        serverOptions,
        clientOptions
    );

    // Register custom request handlers for file operations
    client.onRequest(ReadFileRequest.type, async (params): Promise<{ content: string } | null> => {
        try {
            const uri = Uri.parse(params.uri);
            const content = await workspace.fs.readFile(uri);
            return { content: new TextDecoder().decode(content) };
        } catch (error) {
            return null;
        }
    });

    client.onRequest(FindFilesRequest.type, async (params): Promise<string[]> => {
        try {
            const pattern = params.pattern;
            const uris = await workspace.findFiles(pattern, '**/node_modules/**');
            return uris.map(u => u.toString());
        } catch (error) {
            return [];
        }
    });

    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
}
