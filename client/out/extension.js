"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const parser_1 = require("./parser");
const goalModel_1 = require("./goalModel");
const SidebarProvider_1 = require("./panels/SidebarProvider");
const node_1 = require("vscode-languageclient/node");
const helloWorldPanel_1 = require("./panels/helloWorldPanel");
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
    const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    const gmProvider = new goalModel_1.GoalModelProvider(rootPath);
    vscode.window.registerTreeDataProvider('goalModel', gmProvider);
    const commands = [];
    commands.push(vscode.commands.registerCommand('goalModel.refreshModels', () => {
        gmProvider.refresh();
    }));
    // const provider = new GoalModelProvider(context.extensionUri, rootPath);
    // context.subscriptions.push(
    // 	vscode.window.registerWebviewViewProvider(GoalModelProvider.viewType, provider)
    // );
    // convert goalmodel to draw.io xml command
    commands.push(vscode.commands.registerCommand('gm-parser.gm2DIO', () => {
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
    }));
    // convert from draw.io xml to goal model command
    commands.push(vscode.commands.registerCommand('gm-parser.DIO2gm', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        const text = vscode.window.activeTextEditor?.document.getText();
        let res;
        if (text) {
            res = JSON.stringify((0, parser_1.convertDIOXML2GM)(text));
        }
        vscode.window.activeTextEditor?.edit(builder => {
            const doc = vscode.window.activeTextEditor?.document;
            if (doc) {
                builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
            }
        });
    }));
    // execute mutrose command
    commands.push(vscode.commands.registerCommand('gm-parser.execMutRose', (element) => {
        const cfg = vscode.workspace.getConfiguration().get('gmParser');
        const showInfo = vscode.window.showInformationMessage;
        if (!fs.existsSync(cfg.hddlPath)) {
            showInfo("hddl file doesn't exists!");
            return;
        }
        else if (!fs.existsSync(cfg.configPath)) {
            showInfo("config file doesn't exists");
            return;
        }
        const xml = fs.readFileSync(element.filePath).toString();
        const gmJson = JSON.stringify((0, parser_1.convertDIOXML2GM)(xml));
        fs.writeFileSync('./temp.txt', gmJson);
        child_process.exec(`mutrose ${cfg.hddlPath} ./temp.txt ${cfg.configPath} -p`, (error, stdout, stderr) => {
            if (error) {
                showInfo(`Error: ${error}`);
            }
            else {
                showInfo(`GM decomposto com sucesso`);
                let mutrose = vscode.window.createOutputChannel('Mutrose');
                mutrose.append(stdout);
                mutrose.show();
            }
            // fs.unlinkSync('./temp.txt');
        });
        // const terminal = vscode.window.createTerminal(`Ext Terminal #1`);
        // terminal.sendText("touch test.txt");
        // terminal.dispose();
    }));
    // create new mission command
    commands.push(vscode.commands.registerCommand('goalModel.createNewMission', () => {
        console.log("TODO");
    }));
    // rename mission command
    commands.push(vscode.commands.registerCommand('goalModel.rename', async (element) => {
        const newName = await vscode.window.showInputBox({
            placeHolder: "Type new name",
            prompt: "Rename selected mission",
            value: ""
        });
        element.name = newName;
        element.goalModel.saveGoalModel();
    }));
    // add property to node command
    commands.push(vscode.commands.registerCommand('goalModel.addProperty', async (element) => {
        let items;
        switch (element.nodeType) {
            case 'Goal':
                items = [
                    {
                        label: "teste",
                        description: "goal"
                    }
                ];
                break;
            case 'Task':
                items = [
                    {
                        label: "teste",
                        description: "task"
                    }
                ];
                break;
        }
        try {
            const selected = await vscode.window.showQuickPick(items);
            element.addAttribute(selected.label, "");
            element.mission.goalModel.saveGoalModel();
        }
        catch (e) {
            console.log(e, "erro ao adicionar property");
        }
    }));
    commands.push(vscode.commands.registerCommand('goalModel.editProperty', async (element) => {
        // TODO: add logic to different types of attributes
        const newContent = await vscode.window.showInputBox({
            placeHolder: "Type new content",
            prompt: "Edit property content",
            value: element.attrValue
        });
        element.attrValue = newContent;
        element.node.mission.goalModel.saveGoalModel();
    }));
    // delete property from node command
    commands.push(vscode.commands.registerCommand('goalModel.deleteProperty', async (element) => {
        const node = element.node;
        node.removeAttribute(element);
    }));
    commands.push(vscode.commands.registerCommand('goalModel.addRefinement', async (element) => {
        const targetNode = element.node;
        const gm = targetNode.mission.goalModel;
        const items = targetNode.mission.nodes.filter(e => e != targetNode).map(node => {
            return {
                label: node.name,
                description: node.customId
            };
        });
        const selected = await vscode.window.showQuickPick(items);
        element.addRefinement(selected.description, selected.label, gm.generateNewId());
        gm.saveGoalModel();
    }));
    commands.push(vscode.commands.registerCommand('goalModel.deleteRefinement', async (element) => {
        element.refinements.removeRefinement(element);
        element.refinements.node.mission.goalModel.saveGoalModel();
    }));
    const sidebarProvider = new SidebarProvider_1.SidebarProvider(context.extensionUri);
    const webviewProvider = vscode.window.registerWebviewViewProvider(SidebarProvider_1.SidebarProvider.viewType, sidebarProvider);
    commands.push(webviewProvider);
    commands.push(vscode.commands.registerCommand('goalModel.openVue', () => {
        helloWorldPanel_1.HelloWorldPanel.render(context.extensionUri);
    }));
    commands.forEach(command => context.subscriptions.push(command));
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