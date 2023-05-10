import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GoalModel } from './GoalModel';
import { convertDIOXML2GM, convertGM2DIOXML } from './parser';

// It's suposed that all goal models are inside the "gm" folder
export class GoalModelProvider implements vscode.TreeDataProvider<Mission | Node | NodeAttr>{
    private _onDidChangeTreeData: vscode.EventEmitter<Mission | Node | NodeAttr |undefined | void> = new vscode.EventEmitter<Mission | Node | NodeAttr | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<void | Mission | Node | NodeAttr | undefined> = this._onDidChangeTreeData.event;
    
    constructor(private workspaceRoot: string | undefined){}

    refresh(): void{
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Mission): vscode.TreeItem {
        return element;
    }

    // GetChildren should be triggered by the click on the mission to get the goals;
    getChildren(element?: Mission | Node | undefined): Thenable<Mission[] | Node[] | NodeAttr[]> {
        if(!this.workspaceRoot){
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if(element){
            if(element instanceof Node){
                return Promise.resolve(element.attributes);
            } else {

                return Promise.resolve(element.nodes);
            }
            // TODO: implement goal recursive getter
            // return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
        } else {
            const gmFolderPath = path.join(this.workspaceRoot, 'gm');
            if(this.pathExists(gmFolderPath)){
                return Promise.resolve(this.getMissionsInGoalModelFolder(gmFolderPath));
            }   
            return Promise.resolve([]);
        }
    }
    // private getNodesFromMission(mission: Mission): Node[]{
    //     return [];
    // }
    // Should return all the missions inside a GoalModel
    // TODO: parse the goal model in a hierarchical way
    private getMissionsInGoalModelFolder(gmFolderPath: string): Mission[]{
        const workspaceRoot = this.workspaceRoot;
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.drawio'))
            
            const toMission = (goalModelJson: GoalModel, filePath: string): Mission => {
                const actors = goalModelJson.actors;
                const info = actors.map(actor=>{
                    const parsedText = actor.text.split(': ');
                    return {name: parsedText[1], missionNumber: parsedText[0], id: actor.id, nodes: actor.nodes};
                });
                const nodes = info[0].nodes.map(node=>{
                    console.log(node);
                    const [name,tag] = node.text.split(': ');
                    const customProperties = Object.keys(node.customProperties).map(key => {
                        return {[key]: node.customProperties[key]};
                    });
                    const attributes = [...customProperties, {type: node.type}].map((attribute) => new NodeAttr(Object.keys(attribute)[0],Object.values(attribute)[0],vscode.TreeItemCollapsibleState.None));
                    return new Node(name, attributes, vscode.TreeItemCollapsibleState.Collapsed, tag);
                });
                return new Mission(info[0].name, info[0].missionNumber, vscode.TreeItemCollapsibleState.Collapsed, filePath, info[0].id, nodes);
            };
            const gmsDIO: {gm:string,filePath:string}[] = gmList.map(gm=>{
                return {gm:fs.readFileSync(path.join(gmFolderPath, gm)).toString(), filePath: path.join(gmFolderPath, gm)};
            });
            console.log(gmsDIO);
            const gms: {gm: GoalModel, filePath}[] = gmsDIO.map(({gm,filePath}) => {
                const res = JSON.parse((convertDIOXML2GM(gm)));
                return {gm: res as GoalModel, filePath}
            });
            const res = gms.map((gm:{gm:GoalModel, filePath:string})=>toMission(gm.gm, gm.filePath));
            // const res = [];
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

export class NodeAttr extends vscode.TreeItem {
    constructor(
        public readonly attrName: string,
        public readonly attrValue: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ){
        super(attrValue==="" ? "\"\"" : attrValue, collapsibleState);
        this.tooltip = `${this.attrName}-${this.attrValue}`;
        this.description = attrName;
    }
}

export class Node extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly attributes: NodeAttr[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly tag: string,
        public readonly command?: vscode.Command
    ){
        super(name, collapsibleState);
        this.tooltip = `${this.tag}-${this.name}`;
        this.description = tag;
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