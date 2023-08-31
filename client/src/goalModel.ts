import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as gmTypes from './GoalModel';
import { convertDIOXML2GM, convertGM2DIOXML } from './parser';
import { getVSCodeDownloadUrl } from '@vscode/test-electron/out/util';

// It's suposed that all goal models are inside the "gm" folder
export class GoalModelProvider implements vscode.TreeDataProvider<GoalModel | Mission | Node | NodeAttr | Decomposition | NodeDecompositions>{
    private _onDidChangeTreeData: vscode.EventEmitter<GoalModel | Mission | Node | NodeAttr | NodeDecompositions | Decomposition | undefined | void> = new vscode.EventEmitter<Mission | Node | NodeAttr | NodeDecompositions | Decomposition | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<void | GoalModel | Mission | Node | NodeAttr | NodeDecompositions | Decomposition | undefined> = this._onDidChangeTreeData.event;
    
    constructor(private workspaceRoot: string | undefined){
        const gmFolderPath = path.join(this.workspaceRoot, 'gm');
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.drawio'));
            gmList.forEach(gm=>{
                let fileWatcher = vscode.workspace.createFileSystemWatcher(path.join(gmFolderPath, gm))
                fileWatcher.onDidChange(()=>{
                    this.refresh();
                })
            })
        }
    }

    refresh(): void{
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Mission): vscode.TreeItem {
        return element;
    }

    // GetChildren should be triggered by the click on the mission to get the goals;
    getChildren(element?: GoalModel | Mission | Node | undefined): Thenable<GoalModel[] | Mission[] | Node[] | Decomposition[] | (NodeAttr|NodeDecompositions)[]> {
        if(!this.workspaceRoot){
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if(element){
            if(element instanceof Node){
                return Promise.resolve([...element.attributes, element.decompositions]);
            } else if (element instanceof GoalModel) {
                return Promise.resolve(element.missions)
            }else if (element instanceof NodeDecompositions) {
                return Promise.resolve(element.decompositions)
            }else {

                return Promise.resolve(element.nodes);
            }
            // TODO: implement goal recursive getter
            // return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
        } else {
            const gmFolderPath = path.join(this.workspaceRoot, 'gm');
            if(this.pathExists(gmFolderPath)){
                return Promise.resolve(this.getGoalModels(gmFolderPath));
            }   
            return Promise.resolve([]);
        }
    }
    // Should return all the missions inside a GoalModel
    // TODO: parse the goal model in a hierarchical way
    private getGoalModels(gmFolderPath: string): GoalModel[]{
        const workspaceRoot = this.workspaceRoot;
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.drawio'));
            
            
            const gmsDIO: {gm:string,filePath:string}[] = gmList.map(gm=>{
                return {gm:fs.readFileSync(path.join(gmFolderPath, gm)).toString(), filePath: path.join(gmFolderPath, gm)};
            });
            const gms: {gm: gmTypes.GoalModel, filePath}[] = gmsDIO.map(({gm,filePath}) => {
                const res = convertDIOXML2GM(gm);
                return {gm: res as gmTypes.GoalModel, filePath};
            });
            const goalModels = gms.map((gm:{gm:gmTypes.GoalModel, filePath:string}) => {
                
                const gmName = gm.filePath.replace(/(^.*[\\\/])|(\.drawio)/gi, '')
                const goalModel = new GoalModel(gmName, vscode.TreeItemCollapsibleState.Collapsed,gm.gm, gm.filePath)
                const test = goalModel.parseToGm()
                return goalModel

            })
            return goalModels;
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

export class Decomposition extends vscode.TreeItem {
    contextValue = 'decomposition';
    public readonly targetId: string
    public readonly tag
    constructor(
        private readonly info: {tag: string, customId: string},
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly decompositions: NodeDecompositions,
        public readonly command?: vscode.Command
    ){
        super(info.tag, collapsibleState);
        this.tooltip = `${info.tag}`;
        this.targetId = info.customId
    }
}

export class NodeDecompositions extends vscode.TreeItem {
    contextValue = 'decompositions';
    public decompositions: Decomposition[] = []
    constructor(
        public readonly type: string,
        public decompositionsToInstantiate: Array<{tag: string, customId: string}>,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly node: Node,
        public readonly command?: vscode.Command
    ){
        super('decompositions', collapsibleState);
        this.tooltip = 'decompositions';
        this.description = `type ${type}`;
        this.decompositions = decompositionsToInstantiate.map(decomposition => {
            return new Decomposition(decomposition, vscode.TreeItemCollapsibleState.None, this)
        })
    }
}

export class NodeAttr extends vscode.TreeItem {
    contextValue = 'attribute';
    constructor(
        public readonly attrName: string,
        public readonly attrValue: string,
        public readonly custom: boolean,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly node: Node,
        public readonly command?: vscode.Command
    ){
        super(attrValue==="" ? "\"\"" : attrValue, collapsibleState);
        this.tooltip = `${this.attrName}-${this.attrValue}`;
        this.description = attrName;
    }
}

export class Node extends vscode.TreeItem {
    contextValue = 'node';
    terminal = false
    decompositions: NodeDecompositions
    constructor(
        public readonly name: string,
        public attributes: NodeAttr[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly tag: string,
        public readonly nodeType: string,
        public readonly mission: Mission,
        public readonly customId: string,
        public pos: {x: number, y: number},
        public readonly command?: vscode.Command
    ){
        super(name, collapsibleState);
        const runtimeAnnotation = tag.match(/(?<=\[)[a-zA-Z\d\,|\#|\;?]*(?=\])/g);
        if(!runtimeAnnotation){
            this.terminal = true
        }
        this.tooltip = `${this.tag}-${this.name}`;
        this.description = tag;
    }
    parseNode(): gmTypes.Node {
        const customProperties: Record<string,string> = this.attributes.filter(el => el.custom == true).reduce((acc, el)=>{
            acc[el.attrName] = el.attrValue
            return acc
        },{})
        return {
            id: this.customId,
            text: `${this.name}: ${this.description}`,
            x: this.pos.x,
            y: this.pos.y,
            type: `istar.${this.nodeType}` as gmTypes.NodeType,
            customProperties: customProperties
        };
    }
    addAttribute(tag, value){
        const newAttr = new NodeAttr(tag, value, true, vscode.TreeItemCollapsibleState.None, this)
        this.attributes.push(newAttr)
        try{
            this.mission.goalModel.saveGoalModel()
            return
        } catch (e){
            return e;
        }
    }
    removeAttribute(tag){
		this.attributes = this.attributes.filter(attr => attr != tag)
        try{
            this.mission.goalModel.saveGoalModel()
            return
        } catch (e){
            return e;
        } 
    }
    getDecompositions(){
        if(!this.terminal){
            const runtimeAnnotation = this.tag.match(/(?<=\[)[a-zA-Z\d\,|\#|\;?]*(?=\])/g);
            const separator = runtimeAnnotation[0].match(/[^a-zA-Z\d]/)[0];
            let type: "and"|"or"|"fallback"| undefined;
            switch(separator){
                case ';':
                    type = "and"
                    break;
                case ',':
                    type = "fallback"
                    break;
                case '#':
                    type = "and"
                    break;
            }
            const decompositions = runtimeAnnotation[0].split(/;|,|#/g)
            const aux = decompositions.map( tag => {
                const node = this.mission.nodes.find(node => node.name === tag)
                return {tag, customId: node.customId}
            })
            this.decompositions = new NodeDecompositions(type, aux, vscode.TreeItemCollapsibleState.Collapsed, this)
        }
    }
}

export class Mission extends vscode.TreeItem {
    contextValue = 'mission';
    public nodes: Node[]
    constructor(
        public readonly name: string,
        private readonly missionNumber: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly customId: string,
        public readonly goalModel: GoalModel,
        private nodesToInstatiate: gmTypes.Node[],
        public pos: {x: number, y: number},
        public readonly customProperties: Record<string,string>,
        public readonly command?: vscode.Command
    ){
        super(name, collapsibleState);
        this.tooltip = `${missionNumber}-${this.name}`;
        this.description = this.customProperties.description;

        const nodes = nodesToInstatiate.map(node=>{
            const [name,tag] = node.text.split(': ');
            const nodeInst = new Node(name, [], vscode.TreeItemCollapsibleState.Collapsed, tag,(name.startsWith("AT")? "Task" : "Goal"), this, node.id, {x: node.x, y:node.y});
            const customProperties= Object.keys(node.customProperties).map(key => {
                return new NodeAttr(key,node.customProperties[key], true,vscode.TreeItemCollapsibleState.None, nodeInst)
            });
            const attributes = [...customProperties, new NodeAttr("type",node.type, false,vscode.TreeItemCollapsibleState.None, nodeInst)]
                
            nodeInst.attributes = attributes;
            return nodeInst;
        });
        this.nodes = nodes;
        this.nodes.forEach(node=>node.getDecompositions())
    }
    parseToActor(): gmTypes.Actor{
        let actor: gmTypes.Actor = {} as gmTypes.Actor;
        actor.customProperties = this.customProperties
        actor.id = this.customId;
        actor.nodes = this.parseNodes();
        actor.text = `${this.missionNumber}: ${this.name}`;
        actor.type = "istar.Actor";
        actor.x = this.pos.x;
        actor.y = this.pos.y;
        return actor;
    }
    parseNodes(): gmTypes.Node[] {
        return this.nodes.map(node => node.parseNode());
    }
    addNode(node: Node){
        this.nodes.push(node)
    }
    setNodes(nodes: Node[]){
        this.nodes = nodes
    }
}

export class GoalModel extends vscode.TreeItem{
    contextValue = 'goalModel'
    public actors: gmTypes.Actor[]
    public missions: Mission[]
    public orphans: never[]
    public dependencies: never[]
    public links: gmTypes.Link[]
    public display: gmTypes.Display
    public tool: string
    public istar: string
    public saveDate: Date
    public diagram: gmTypes.Diagram
    constructor(
        public readonly name: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        gm: gmTypes.GoalModel,
        public readonly filePath: string,
    ){
        super(name, collapsibleState);
        this.tooltip = `${this.name}`;
        this.description = this.filePath;
        this.actors = gm.actors
        this.links = gm.links
        this.display = gm.display
        this.tool = gm.tool
        this.istar = gm.istar
        this.saveDate = gm.saveDate
        this.diagram = gm.diagram
        this.orphans = []
        this.dependencies=[]

        const actors = gm.actors;
        const info = actors.map(actor=>{
            const parsedText = actor.text.split(': ');
            return {name: parsedText[1], missionNumber: parsedText[0], id: actor.id, nodes: actor.nodes, pos: {x: actor.x, y: actor.y}, customProperties: actor.customProperties};
        });
        this.missions = info.map(info => new Mission(info.name, info.missionNumber, vscode.TreeItemCollapsibleState.Collapsed, info.id, this,info.nodes, info.pos, info.customProperties));
    }
    parseMissions(): gmTypes.Actor[]{
        return this.missions.map(mission => mission.parseToActor())
    }
    parseToGm(): gmTypes.GoalModel{
        
        return {
            actors: this.parseMissions(),
            orphans: this.orphans,
            dependencies: this.dependencies,
            links: this.links,
            display: this.display,
            tool: this.tool,
            istar: this.istar,
            saveDate: this.saveDate,
            diagram: this.diagram
        }
    }
    public saveGoalModel(){
        const gm = this.parseToGm()
        const xml = convertGM2DIOXML(JSON.stringify(gm))
        fs.writeFileSync(this.filePath, xml)
    }
}