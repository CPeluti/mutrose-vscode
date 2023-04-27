import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GoalModel, Node } from './GoalModel';

// It's suposed that all goal models are inside the "gm" folder
export class GoalModelProvider implements vscode.TreeDataProvider<Mission | Node>{
    private _onDidChangeTreeData: vscode.EventEmitter<Mission | Node |undefined | void> = new vscode.EventEmitter<Mission | Node |undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<void | Mission | Node | undefined> = this._onDidChangeTreeData.event;
    
    constructor(private workspaceRoot: string | undefined){}

    refresh(): void{
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Mission): vscode.TreeItem {
        return element;
    }

    // GetChildren should be triggered by the click on the mission to get the goals;
    getChildren(element?: Mission | undefined): Thenable<Mission[] | Node[]> {
        if(!this.workspaceRoot){
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if(element){
            // TODO: implement goal recursive getter
            // return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
            return Promise.resolve(this.getNodesFromMission(element));
            return Promise.resolve([]);
        } else {
            const gmFolderPath = path.join(this.workspaceRoot, 'gm');
            if(this.pathExists(gmFolderPath)){
                return Promise.resolve(this.getMissionsInGoalModelFolder(gmFolderPath));
            }   
            return Promise.resolve([]);
        }
    }
    private getNodesFromMission(mission: Mission): Node[]{
        return [];
    }
    // Should return all the missions inside a GoalModel
    // TODO: parse the goal model in a hierarchical way
    private getMissionsInGoalModelFolder(gmFolderPath: string): Mission[]{
        const workspaceRoot = this.workspaceRoot;
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            const gmList = fs.readdirSync(gmFolderPath);

            const toMission = (goalModelJson: GoalModel, filePath: string): Mission => {
                const actors = goalModelJson.actors;
                const info = actors.map(actor=>{
                    const parsedText = actor.text.split(': ');
                    return {name: parsedText[1], missionNumber: parsedText[0], id: actor.id, nodes: actor.nodes};
                });
                
                return new Mission(info[0].name, info[0].missionNumber, vscode.TreeItemCollapsibleState.Collapsed, filePath, info[0].id, info[0].nodes);
            };
            const gms: {gm:GoalModel,filePath:string}[] = gmList.map(gm=>{
                return {gm:JSON.parse(fs.readFileSync(path.join(gmFolderPath, gm), 'utf-8')) as GoalModel, filePath: path.join(gmFolderPath, gm)};
            });
            // console.log(gms);
            const res = gms.map((gm:{gm:GoalModel, filePath:string})=>toMission(gm.gm, gm.filePath));
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
        public readonly filePath: string,
        public readonly missionId: string,
        public readonly nodes: Node[],
        public readonly command?: vscode.Command
    ){
        super(name, collapsibleState);
        this.tooltip = `${missionNumber}-${this.name}`;
        this.description = this.missionNumber;
    }
    contextValue = 'Mission';
}