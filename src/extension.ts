// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {convertDIOXML2GM, convertGM2DIOXML} from "./parser";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gm-parser" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let command = vscode.commands.registerCommand('gm-parser.gm2DIO', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const text = vscode.window.activeTextEditor?.document.getText();
		let res: string;
		if(text){
			res = convertGM2DIOXML(text);
		}
		vscode.window.activeTextEditor?.edit(builder => {
			const doc = vscode.window.activeTextEditor?.document;
			if(doc){
				builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
			}
		});
	});
	context.subscriptions.push(command);
	command = vscode.commands.registerCommand('gm-parser.DIO2gm', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const text = vscode.window.activeTextEditor?.document.getText();
		let res: string;
		if(text){
			res = convertDIOXML2GM(text);
		}
		vscode.window.activeTextEditor?.edit(builder => {
			const doc = vscode.window.activeTextEditor?.document;
			if(doc){
				builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), res);
			}
		});
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
