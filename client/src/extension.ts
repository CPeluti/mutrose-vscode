// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as child_process from 'child_process';
import { convertDIOXML2GM, convertGM2DIOXML } from "./parser";
import { GoalModelProvider } from './goalModel';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

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
	const gm2DIO = vscode.commands.registerCommand('gm-parser.gm2DIO', () => {
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
	});
	context.subscriptions.push(gm2DIO);

	const DIO2gm = vscode.commands.registerCommand('gm-parser.DIO2gm', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const text = vscode.window.activeTextEditor?.document.getText();
		let res: string;
		if (text) {
			res = convertDIOXML2GM(text);
		}
		vscode.window.activeTextEditor?.edit(builder => {
			const doc = vscode.window.activeTextEditor?.document;
			if (doc) {
				builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
			}
		});
	});
	context.subscriptions.push(DIO2gm);

	const executeMutRose = vscode.commands.registerCommand('gm-parser.execMutRose', (element) => {
		console.log(element)
		const cfg: {hddlPath: string, configPath: string} = vscode.workspace.getConfiguration().get('gmParser');
		const showInfo = vscode.window.showInformationMessage;
		if (!fs.existsSync(cfg.hddlPath)) {
			showInfo("hddl file doesn't exists");
			return;
		} else if (!fs.existsSync(cfg.configPath)) {
			showInfo("config file doesn't exists");
			return;
		}
		const xml: string = fs.readFileSync(element.filePath).toString()
		const gmJson = convertDIOXML2GM(xml);
		fs.writeFileSync('./temp.txt',gmJson);
		child_process.exec(`mutrose ${cfg.hddlPath} ./temp.txt ${cfg.configPath}` , (error, stdout, stderr) => {
			if(error){
				showInfo(`Error: ${stdout}`);
			} else {
				showInfo(`GM decomposto com sucesso`);
			}
			fs.unlinkSync('./temp.txt');
		});
		// const terminal = vscode.window.createTerminal(`Ext Terminal #1`);
		// terminal.sendText("touch test.txt");
		// terminal.dispose();
	});
	context.subscriptions.push(executeMutRose);

	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	const gmProvider = new GoalModelProvider(rootPath);

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

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

// This method is called when your extension is deactivated
