import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GoalModel } from './GoalModel';
// It's suposed that all goal models are inside the "gm" folder
export class GoalModelProvider implements vscode.TreeDataProvider<Mission>{
    private _onDidChangeTreeData: vscode.EventEmitter<Mission | undefined | void> = new vscode.EventEmitter<Mission | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<void | Mission | undefined> = this._onDidChangeTreeData.event;
    
    constructor(private workspaceRoot: string | undefined){}

    refresh(): void{
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Mission): vscode.TreeItem {
        return element;
    }

    // GetChildren should be triggered by the click on the mission to get the goals;
    getChildren(element?: Mission | undefined): Thenable<Mission[]> {
        if(!this.workspaceRoot){
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if(element){
            return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
        } else {
            const gmFolderPath = path.join(this.workspaceRoot, 'gm');
            if(this.pathExists(gmFolderPath)){
                return Promise.resolve(this.getGoalModelsInGoalModelFolder(gmFolderPath));
            }   
            return Promise.resolve([]);
        }
    }
    // Should return all the missions inside a GoalModel
    private getGoalModelsInGoalModelFolder(gmFolderPath: string): Mission[]{
        const workspaceRoot = this.workspaceRoot;
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            const gmList = fs.readdirSync(gmFolderPath);

            const toMission = (goalModelJson: GoalModel): Mission => {
                const actors = goalModelJson.actors;
                const info = actors.map(actor=>{
                    const parsedText = actor.text.split(': ');
                    return {name: parsedText[1], missionNumber: parsedText[0]};
                });
                
                return new Mission(info[0].name, info[0].missionNumber, vscode.TreeItemCollapsibleState.Collapsed);
            };
            const gms: GoalModel[] = gmList.map(gm=>{
                return JSON.parse(fs.readFileSync(path.join(gmFolderPath, gm), 'utf-8'));
            });
            // console.log(gms);
            const res = gms.map(gm=>toMission(gm));
            return res;
        }
        return [];
    }
    // Check if path exists
    private pathExists(path: string): boolean{
        try{
            fs.accessSync(path);
        }catch(err){
            return false;
        }
        return true;
    }
}

export class Mission extends vscode.TreeItem {
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
    contextValue = 'Mission';
}