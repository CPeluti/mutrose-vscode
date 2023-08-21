// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as child_process from 'child_process';
import { convertDIOXML2GM, convertGM2DIOXML } from "./parser";
import { GoalModelProvider } from './goalModel';
import { SidebarProvider } from './panels/SidebarProvider';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

import { HelloWorldPanel } from './panels/helloWordPanel';

let client: LanguageClient;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gm-parser" is now active!');

	const debugOptions = {};

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'plaintext' }],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	client.start();


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	const gmProvider = new GoalModelProvider(rootPath);

	vscode.window.registerTreeDataProvider('goalModel', gmProvider);

	

	const commands: Array<vscode.Disposable> = []

	commands.push(
		vscode.commands.registerCommand('goalModel.refreshModels', () => {
			gmProvider.refresh();
		})
	);
	// const provider = new GoalModelProvider(context.extensionUri, rootPath);

	// context.subscriptions.push(
	// 	vscode.window.registerWebviewViewProvider(GoalModelProvider.viewType, provider)
	// );


	// convert goalmodel to draw.io xml command
	commands.push(
			vscode.commands.registerCommand('gm-parser.gm2DIO', () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			const text = vscode.window.activeTextEditor?.document.getText();
			let res: string;
			if (text) {
				res = convertGM2DIOXML(text);
			}
			vscode.window.activeTextEditor?.edit(builder => {
				const doc = vscode.window.activeTextEditor?.document;
				if (doc) {
					builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
				}
			});
		})
	);

	// convert from draw.io xml to goal model command
	commands.push(
		vscode.commands.registerCommand('gm-parser.DIO2gm', () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			const text = vscode.window.activeTextEditor?.document.getText();
			let res: string;
			if (text) {
				res = JSON.stringify(convertDIOXML2GM(text));
			}
			vscode.window.activeTextEditor?.edit(builder => {
				const doc = vscode.window.activeTextEditor?.document;
				if (doc) {
					builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
				}
			});
		})
	)

	// execute mutrose command
	commands.push(
		vscode.commands.registerCommand('gm-parser.execMutRose', (element) => {
			const cfg: {hddlPath: string, configPath: string} = vscode.workspace.getConfiguration().get('gmParser');
			const showInfo = vscode.window.showInformationMessage;
			if (!fs.existsSync(cfg.hddlPath)) {
				showInfo("hddl file doesn't exists!");
				return;
			} else if (!fs.existsSync(cfg.configPath)) {
				showInfo("config file doesn't exists");
				return;
			}
			const xml: string = fs.readFileSync(element.filePath).toString()
			const gmJson = JSON.stringify(convertDIOXML2GM(xml));
			fs.writeFileSync('./temp.txt',gmJson);
			child_process.exec(`mutrose ${cfg.hddlPath} ./temp.txt ${cfg.configPath} -p` , (error, stdout, stderr) => {
				if(error){
					showInfo(`Error: ${error}`);
				} else {
					showInfo(`GM decomposto com sucesso`);
					let mutrose = vscode.window.createOutputChannel('Mutrose')
					mutrose.append(stdout)
					mutrose.show()
				}
				// fs.unlinkSync('./temp.txt');
			});
			// const terminal = vscode.window.createTerminal(`Ext Terminal #1`);
			// terminal.sendText("touch test.txt");
			// terminal.dispose();
		})
	)

	// create new mission command
	commands.push(
		vscode.commands.registerCommand('goalModel.createNewMission', () => {
			console.log("TODO");
		})
	)

	// rename mission command
	commands.push(
		vscode.commands.registerCommand('goalModel.rename', async (element) => {
			const newName = await vscode.window.showInputBox({
				placeHolder: "Type new name",
				prompt: "Rename selected mission",
				value: ""
			});
			let file = fs.readFileSync(element.filePath).toString()
			let gm = convertDIOXML2GM(file)
			let name = gm.actors[0].text.split(": ")
			name[1] = newName
			gm.actors[0].text = name.join(": ")
			let xml = convertGM2DIOXML(JSON.stringify(gm))
			fs.writeFileSync(element.filePath, xml)
		})
	);

	// add property to node command
	commands.push(
		vscode.commands.registerCommand('goalModel.addProperty', async (element) => {
			let items: vscode.QuickPickItem[]
			switch(element.nodeType){
				case 'Goal':
					items = [
						{
							label: "teste",
							description: "goal"
						}
					]
					break
				case 'Task':
					items = [
						{
							label: "teste",
							description: "task"
						}
					]
					break
			}
			try{
				const selected = await vscode.window.showQuickPick(items)
				element.addAttribute(selected.label, "")
				element.mission.goalModel.saveGoalModel()
			} catch (e){
				console.log(e, "erro ao adicionar property")
			}
			
		})
	);

	// delete property from node command
	commands.push(
		vscode.commands.registerCommand('goalModel.deleteProperty', async (element) => {
			const node = element.node;
			node.removeAttribute(element)
		})
	);

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	
	const webviewProvider = vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
	
	commands.push(webviewProvider);

	commands.push(
		vscode.commands.registerCommand('goalModel.openVue', () => {
			HelloWorldPanel.render(context.extensionUri)
		})
	)

	commands.forEach(command=>context.subscriptions.push(command))
	
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

// This method is called when your extension is deactivated
