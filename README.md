# FRANCA IDL Language Support for VS Code

A Visual Studio Code language extension providing comprehensive support for the Franca IDL (Interface Definition Language). See [Franca](https://github.com/franca/franca) for more information about the Franca project.

## Features

### Language Server (LSP)

- **Document Symbols** - Outline view showing all Franca structures (interfaces, methods, broadcasts, structs, unions, enumerations, etc.)
- **Go to Definition** (`F12`) - Navigate to symbol definitions across your project
- **Find All References** (`Shift+F12`) - Find all usages of any symbol
- **Cross-file Support** - Automatically indexes all `.fidl` files in your workspace
- **Import Resolution** - Resolves `import` statements for cross-file navigation

### Editor Features

- **Syntax Highlighting** - Full highlighting for Franca 0.12.0 syntax
- **Code Snippets** - Quick insertion templates for common Franca constructs
- **Comment Support** - Line comments (`//`) and block comments (`/* */`)

## Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on macOS) to open Extensions
3. Search for "FRANCA IDL"
4. Click Install

## Usage

Open any `.fidl` file to activate the extension.

### LSP Features

1. **Document Outline** - Press `Ctrl+Shift+O` (or `Cmd+Shift+O` on macOS) to see all symbols
2. **Go to Definition** - Place cursor on a symbol and press `F12`
3. **Find References** - Place cursor on a symbol and press `Shift+F12`

## Supported Franca Constructs

| Construct | Keywords |
|-----------|----------|
| Interfaces | `interface` |
| Methods | `method`, `readonly method` |
| Broadcasts | `broadcast` |
| Structs | `struct` |
| Unions | `union` |
| Enumerations | `enumeration` |
| Type Definitions | `typedef` |
| Collections | `array`, `map` |

## Requirements

- VS Code 1.40.0 or higher
- Node.js 18+ (for development)

## Disclaimer

This extension is independent of and not related to the official Franca development team.

## License

Apache License 2.0
