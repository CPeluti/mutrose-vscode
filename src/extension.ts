// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as child_process from 'child_process';
import { GoalModelProvider, NodeRefinement, Refinement } from './goalModel';
import { PistarEditorProvider } from './pistarEditor';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gm-parser" is now active!');

	const debugOptions = {};

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	const gmProvider = new GoalModelProvider(rootPath);
	const treeView = vscode.window.createTreeView('goalModel',{treeDataProvider: gmProvider});

	// vscode.window.registerTreeDataProvider('goalModel', gmProvider);

	context.subscriptions.push(PistarEditorProvider.register(context));

	const commands: Array<vscode.Disposable> = [];

	commands.push(
		vscode.commands.registerCommand('goalModel.refreshModels', () => {
			gmProvider.refresh();
		})
	);
	// const provider = new GoalModelProvider(context.extensionUri, rootPath);

	// context.subscriptions.push(
	// 	vscode.window.registerWebviewViewProvider(GoalModelProvider.viewType, provider)
	// );

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
			const json: string = fs.readFileSync(element.filePath).toString();
			fs.writeFileSync('./temp.txt',json);
			child_process.exec(`mutrose ${cfg.hddlPath} ./temp.txt ${cfg.configPath} -p` , (error, stdout, stderr) => {
				if(error){
					showInfo(`Error: ${error}`);
				} else {
					showInfo(`GM decomposto com sucesso`);
					const mutrose = vscode.window.createOutputChannel('Mutrose');
					mutrose.append(stdout);
					mutrose.show();
				}
				// fs.unlinkSync('./temp.txt');
			});
			// const terminal = vscode.window.createTerminal(`Ext Terminal #1`);
			// terminal.sendText("touch test.txt");
			// terminal.dispose();
		})
	);

	// create new mission command
	commands.push(
		vscode.commands.registerCommand('goalModel.createNewMission', () => {
			console.log("TODO");
		})
	);

	// rename mission command
	commands.push(
		vscode.commands.registerCommand('goalModel.rename', async (element) => {
			const newName = await vscode.window.showInputBox({
				placeHolder: "Type new name",
				prompt: "Rename selected mission",
				value: ""
			});
			element.name = newName;
			element.goalModel.saveGoalModel();
		})
	);

	// add node to mission command

	commands.push(
		vscode.commands.registerCommand('goalModel.addNode', async (element) => {
			const items: vscode.QuickPickItem[] = [
				{
					label: "Goal",
					description: "goal"
				}, {
					label: "Task",
					description: "Task"
				}
			];
			try{
				const type = await vscode.window.showQuickPick(items);
				const title = await vscode.window.showInputBox({
					placeHolder: "Type node title",
					prompt: "Node Title",
					value: ''
				});
				element.addNewNode(type.label, title);
				element.goalModel.saveGoalModel();
			} catch (e){
				console.log(e, "erro ao adicionar property");
			}
		})
	);

	// add property to node command
	commands.push(
		vscode.commands.registerCommand('goalModel.addProperty', async (element) => {
			let items: vscode.QuickPickItem[];
			switch(element.nodeType){
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
			try{
				const selected = await vscode.window.showQuickPick(items);
				element.addAttribute(selected.label, "");
				element.mission.goalModel.saveGoalModel();
			} catch (e){
				console.log(e, "erro ao adicionar property");
			}
			
		})
	);

	commands.push(
		vscode.commands.registerCommand('goalModel.editProperty', async (element) => {
			// TODO: add logic to different types of attributes
			const newContent = await vscode.window.showInputBox({
				placeHolder: "Type new content",
				prompt: "Edit property content",
				value: element.attrValue
			});
			element.attrValue=newContent;
			element.node.mission.goalModel.saveGoalModel();
		})
	);

	// delete node from mission command
	commands.push(
		vscode.commands.registerCommand('goalModel.deleteNode', async (element) => {
			element.remove();
			element.mission.goalModel.saveGoalModel();
		})
	);

	commands.push(
		vscode.commands.registerCommand('goalModel.focusElement', async (targetId: string, parentId:string) => {
			const element = gmProvider.findChildren(parentId,targetId);
			treeView.reveal(element);
		})
	);
	// add refinements to a node command

	commands.push(
		vscode.commands.registerCommand('goalModel.addRefinementToNode', async (element)=>{
			const types: vscode.QuickPickItem[] = [
				{
					label: "and",
					description: "and"
				},
				{
					label: "or",
					description: "or"
				}
			];
			const targetNode = element;
			const gm = targetNode.mission.goalModel;
			const type = await vscode.window.showQuickPick(types);
			const items: vscode.QuickPickItem[] = targetNode.mission.nodes.filter(e=> e!=targetNode).map(node=>{
				return {
					label: node.name,
					description: node.customId
				};
			});
			const selected = await vscode.window.showQuickPick(items);
			element.addRefinement(type,selected.description, selected.label, gm.generateNewId());
			gm.saveGoalModel();
		})
	);

	// delete property from node command
	commands.push(
		vscode.commands.registerCommand('goalModel.deleteProperty', async (element) => {
			const node = element.node;
			node.removeAttribute(element);
		})
	);
	commands.push(
		vscode.commands.registerCommand('goalModel.addRefinement', async (element: NodeRefinement) => {
			const targetNode = element.parent;
			const gm = targetNode.parent.parent;
			const items: vscode.QuickPickItem[] = targetNode.parent.nodes.filter(e=> e!=targetNode).map(node=>{
				return {
					label: node.name,
					description: node.customId
				};
			});
			const selected = await vscode.window.showQuickPick(items);
			element.addRefinement(selected.description, selected.label, gm.generateNewId());
			gm.saveGoalModel();
		})
	);
	commands.push(
		vscode.commands.registerCommand('goalModel.deleteRefinement', async (element: Refinement)=> {
			element.parent.removeRefinement(element);
			element.parent.parent.parent.parent.saveGoalModel();
		})
	);

	

	commands.forEach(command=>context.subscriptions.push(command));
	
}

// This method is called when your extension is deactivated
