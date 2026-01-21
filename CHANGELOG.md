# Change Log

All notable changes to the "franca-idl" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.0.1] - 2025-01-21

### Fixed

- Extension packaging configuration to include LSP server files in published package
- Removed redundant activationEvents (VS Code 1.75+ auto-generates from contributes declarations)

## [1.0.0] - 2025-01-21

### Added

- Language Server Protocol (LSP) support with full language server implementation
- Document symbols provider for outlining Franca IDL structures
- Go to Definition (`F12`) support for navigating to symbol definitions
- Find All References (`Shift+F12`) support for finding all symbol usages
- Cross-file symbol indexing with import resolution
- Workspace file search for automatic project-wide analysis
- Custom RPC requests for file reading and workspace file searching

### Changed

- Migrated from pure syntax highlighting extension to full LSP client-server architecture
- Added TypeScript compilation with proper project setup

## [0.0.6] - 2020-02-11

### Fixed

- Icon file.

## [0.0.5] - 2020-02-11

### Added

- Icon file.

## [0.0.4] - 2020-02-11

### Fixed

- Fix whitespace.
- Fix spelling `ByteBuffe` => `ByteBuffer`.
- Fix structured comment trailing.

## [0.0.3] - 2019-12-19

### Added

- Version keyword support.
- Snippets support.

## [0.0.2] - 2019-12-17

### Changed

- Structured comments only support built-in tags.

## [0.0.1] - 2019-12-16

- Initial release
