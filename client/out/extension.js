"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const path = require("path");
const child_process = require("child_process");
const parser_1 = require("./parser");
const goalModel_1 = require("./goalModel");
const node_1 = require("vscode-languageclient/node");
let client;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "gm-parser" is now active!');
    const debugOptions = {};
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'plaintext' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    client = new node_1.LanguageClient('languageServerExample', 'Language Server Example', serverOptions, clientOptions);
    client.start();
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const gm2DIO = vscode.commands.registerCommand('gm-parser.gm2DIO', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        const text = vscode.window.activeTextEditor?.document.getText();
        let res;
        if (text) {
            res = (0, parser_1.convertGM2DIOXML)(text);
        }
        vscode.window.activeTextEditor?.edit(builder => {
            const doc = vscode.window.activeTextEditor?.document;
            if (doc) {
                builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
            }
        });
    });
    context.subscriptions.push(gm2DIO);
    const DIO2gm = vscode.commands.registerCommand('gm-parser.DIO2gm', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        const text = vscode.window.activeTextEditor?.document.getText();
        let res;
        if (text) {
            res = (0, parser_1.convertDIOXML2GM)(text);
        }
        vscode.window.activeTextEditor?.edit(builder => {
            const doc = vscode.window.activeTextEditor?.document;
            if (doc) {
                builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
            }
        });
    });
    context.subscriptions.push(DIO2gm);
    const executeMutRose = vscode.commands.registerCommand('gm-parser.execMutRose', () => {
        child_process.exec('mutrose', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${stdout}`);
                return;
            }
            vscode.window.showInformationMessage(`Output: ${stdout}`);
        });
        // const terminal = vscode.window.createTerminal(`Ext Terminal #1`);
        // terminal.sendText("touch test.txt");
        // terminal.dispose();
    });
    context.subscriptions.push(executeMutRose);
    const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    const gmProvider = new goalModel_1.GoalModelProvider(rootPath);
    vscode.window.registerTreeDataProvider('goalModel', gmProvider);
    const command2 = vscode.commands.registerCommand('goalModel.refreshModels', () => {
        gmProvider.refresh();
    });
    context.subscriptions.push(command2);
    const command3 = vscode.commands.registerCommand('goalModel.createNewMission', () => {
        console.log("TODO");
    });
    context.subscriptions.push(command3);
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
// This method is called when your extension is deactivated
//# sourceMappingURL=extension.js.map