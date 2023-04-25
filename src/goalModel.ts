import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class GoalModelProvider implements vscode.TreeDataProvider<GoalModel>{
    private _onDidChangeTreeData: vscode.EventEmitter<GoalModel | undefined | void> = new vscode.EventEmitter<GoalModel | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<void | GoalModel | undefined> = this._onDidChangeTreeData.event;
    
    constructor(private workspaceRoot: string | undefined){}

    getTreeItem(element: GoalModel): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GoalModel | undefined): Thenable<GoalModel[]> {
        if(!this.workspaceRoot){
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if(element){
            return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
        }
    }
    private getGoalModelsInGoalModelFolder(gmFolderPath: string): GoalModel[]{
        const workspaceRoot = this.workspaceRoot;
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            const gmList = JSON.parse(fs.readdirSync(gmFolderPath));
        }
    }
    private pathExists(path: string): boolean{
        try{
            fs.accessSync(path);
        }catch(err){
            return false;
        }
        return true;
    }
}

export class GoalModel extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        private readonly missionNumber: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ){
        super(name, collapsibleState);
        this.tooltip = `${missionNumber}-${this.name}`;
        this.description = this.missionNumber;
    }
    contextValue = 'goalModel';
}