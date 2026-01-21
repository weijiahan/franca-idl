const path = require('path');
const webpack = require('webpack');

module.exports = [
    // Extension client bundle
    {
        mode: 'production',
        entry: './src/extension.ts',
        target: 'node',
        output: {
            path: path.resolve(__dirname, 'out'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        externals: {
            vscode: 'commonjs vscode'
        },
        resolve: {
            extensions: ['.ts', '.js'],
            mainFields: ['main'],
            aliasFields: []
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader',
                            options: {
                                transpileOnly: true
                            }
                        }
                    ]
                }
            ]
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.platform': JSON.stringify('node'),
                'process.env': '{}'
            })
        ]
    },
    // Language server bundle
    {
        mode: 'production',
        entry: './src/server.ts',
        target: 'node',
        output: {
            path: path.resolve(__dirname, 'out'),
            filename: 'server.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        externals: {
            vscode: 'commonjs vscode'
        },
        resolve: {
            extensions: ['.ts', '.js'],
            mainFields: ['main'],
            aliasFields: []
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader',
                            options: {
                                transpileOnly: true
                            }
                        }
                    ]
                }
            ]
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.platform': JSON.stringify('node'),
                'process.env': '{}'
            })
        ]
    }
];
