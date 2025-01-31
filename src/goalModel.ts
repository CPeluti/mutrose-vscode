import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as gmTypes from './GoalModel/index';
import { convertJSON2JS } from './parser';

// It's suposed that all goal models are inside the "gm" folder
export class GoalModelProvider implements vscode.TreeDataProvider<void | GoalModel | Mission | Node | NodeAttr | Refinement | NodeRefinement>{
    private _onDidChangeTreeData: vscode.EventEmitter<void | GoalModel | Mission | Node | NodeAttr | NodeRefinement | Refinement | undefined | void> = new vscode.EventEmitter<void | Mission | Node | NodeAttr | NodeRefinement | Refinement | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<void | GoalModel | Mission | Node | NodeAttr | NodeRefinement | Refinement | undefined> = this._onDidChangeTreeData.event;
    
    constructor(private workspaceRoot: string | undefined){
        const gmFolderPath = path.join(this.workspaceRoot, 'gm');
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.drawio'));
            gmList.forEach(gm=>{
                const fileWatcher = vscode.workspace.createFileSystemWatcher(path.join(gmFolderPath, gm));
                fileWatcher.onDidChange(()=>{
                    this.refresh();
                });
            });
        }
    }

    goalModels: GoalModel[] = [];

    getParent(element: void | GoalModel | Mission | Node | NodeAttr | Refinement | NodeRefinement): vscode.ProviderResult<void | GoalModel | Mission | Node | NodeAttr | Refinement | NodeRefinement> {
        if(element){
            if(element)
            return element.parent;
        }
    }

    refresh(): void{
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Mission): vscode.TreeItem {
        return element;
    }

    findChildren(actorId: string, nodeId: string): Node | undefined{
        const element = this.goalModels.map(el=>{
            const actor = el.missions.find(a => a.customId == actorId);
            if(actor){
                const node = actor.nodes.find(n=>n.customId==nodeId);
                return node;
            }
            return undefined;
        }, nodeId).filter(el => el != undefined)[0];
        return element;
    }

    // GetChildren should be triggered by the click on the mission to get the goals;
    getChildren(element?: GoalModel | Mission | Node | undefined): Thenable<GoalModel[] | Mission[] | Node[] | Refinement[] | (NodeAttr|NodeRefinement)[]> {
        if(!this.workspaceRoot){
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if(element){
            if(element instanceof Node){
                return Promise.resolve([...element.attributes, element.refinements]);
            } else if (element instanceof GoalModel) {
                return Promise.resolve(element.missions);
            }else if (element instanceof NodeRefinement) {
                return Promise.resolve(element.refinements);
            }else {

                return Promise.resolve(element.nodes);
            }
            // TODO: implement goal recursive getter
            // return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
        } else {
            const gmFolderPath = path.join(this.workspaceRoot, 'gm');
            if(this.pathExists(gmFolderPath)){
                this.goalModels = this.getGoalModels(gmFolderPath);
                return Promise.resolve(this.goalModels);
            }
            this.goalModels = [];
            return Promise.resolve([]);
        }
    }
    // Should return all the missions inside a GoalModel
    // TODO: parse the goal model in a hierarchical way
    private getGoalModels(gmFolderPath: string): GoalModel[]{
        const workspaceRoot = this.workspaceRoot;
        if(this.pathExists(gmFolderPath) && workspaceRoot){
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.gm'));
            
            
            const gms: {gm:string,filePath:string}[] = gmList.map(gm=>{
                return {gm:fs.readFileSync(path.join(gmFolderPath, gm)).toString(), filePath: path.join(gmFolderPath, gm)};
            });
            const parsedGMs: {gm: gmTypes.GoalModel, filePath}[] = gms.map(({gm,filePath}) => {
                const res = JSON.parse(gm);
                return {gm: res as gmTypes.GoalModel, filePath};
            });
            const goalModels = parsedGMs.map((gm:{gm:gmTypes.GoalModel, filePath:string}) => {
                
                const gmName = gm.filePath.replace(/(^.*[\\/])|(\.drawio)/gi, '');
                const goalModel = new GoalModel(gmName, vscode.TreeItemCollapsibleState.Collapsed,gm.gm, gm.filePath);
                // const test = goalModel.parseToGm()
                return goalModel;

            });
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

export class Refinement extends vscode.TreeItem {
    contextValue = 'refinement';
    public readonly sourceId: string;
    public readonly tag;
    public readonly customId: string;

    constructor(
        private readonly info: {tag: string, customId: string, linkId: string},
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent: NodeRefinement,
        public readonly command?: vscode.Command
    ){
        super(info.tag, collapsibleState);
        this.tooltip = `${info.tag}`;
        this.sourceId = info.customId;
        this.customId = info.linkId;
        //think a way to reduce this type of thing
        this.parent.parent.parent.parent.usedIds.add(this.customId);
    }
    parseLink(target: string, type: "istar.AndRefinementLink" | "istar.OrRefinementLink"): gmTypes.Link{
        return {
            source: this.sourceId,
            target: target,
            id: this.customId,
            type
        };
    }
}

export class NodeRefinement extends vscode.TreeItem {
    contextValue = 'refinements';
    public refinements: Refinement[] = [];
    constructor(
        public readonly type: "istar.AndRefinementLink" | "istar.OrRefinementLink",
        public refinementsToInstantiate: Array<{tag: string, customId: string, linkId: string}>,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent: Node,
        public readonly command?: vscode.Command
    ){
        super('Refinements', collapsibleState);
        this.tooltip = 'Refinements';
        this.description = `type ${type}`;
        this.refinements = refinementsToInstantiate.map(refinement => {
            return new Refinement(refinement, vscode.TreeItemCollapsibleState.None, this);
        });
    }
    addRefinement(targetId, tag, newId): void {
        this.refinements.push(
            new Refinement({tag, linkId: newId, customId: targetId}, vscode.TreeItemCollapsibleState.None, this)
        );
    }
    parseRefinements(): gmTypes.Link[] {
        return this.refinements.map(r=> r.parseLink(this.parent.customId, this.type));
    }
    removeRefinement(refinement: Refinement){
        this.refinements = this.refinements.filter(e=> e != refinement);
    }
}

export class NodeAttr extends vscode.TreeItem {
    contextValue = 'attribute';
    constructor(
        public readonly attrName: string,
        public readonly attrValue: string,
        public readonly custom: boolean,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent: Node,
        public readonly command?: vscode.Command
    ){
        super(attrValue==="" ? "\"\"" : attrValue, collapsibleState);
        this.tooltip = `${this.attrName}-${this.attrValue}`;
        this.description = attrName;
    }
}

export class Node extends vscode.TreeItem {
    contextValue = 'node';
    terminal = false;
    refinements: NodeRefinement;
    constructor(
        public readonly name: string,
        public attributes: NodeAttr[],
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly tag: string,
        public readonly nodeType: string,
        public readonly parent: Mission,
        public readonly customId: string,
        public pos: {x: number, y: number},
        public readonly command?: vscode.Command
    ){
        super(name, collapsibleState);
        const runtimeAnnotation = tag?.match(/(?<=\[)[a-zA-Z\d,|#|;?]*(?=\])/g);
        if(!runtimeAnnotation){
            this.terminal = true;
        }
        this.tooltip = `${this.tag}-${this.name}`;
        this.parent.parent.usedIds.add(this.customId);
        this.description = tag;
    }
    parseNode(): gmTypes.Node {
        const customProperties: Record<string,string> = this.attributes.filter(el => el.custom == true).reduce((acc, el)=>{
            acc[el.attrName] = el.attrValue;
            return acc;
        },{});
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
        const newAttr = new NodeAttr(tag, value, true, vscode.TreeItemCollapsibleState.None, this);
        this.attributes.push(newAttr);
        try{
            this.parent.parent.saveGoalModel();
            return;
        } catch (e){
            return e;
        }
    }
    removeAttribute(tag: NodeAttr){
		this.attributes = this.attributes.filter(attr => attr != tag);
        try{
            this.parent.parent.saveGoalModel();
            return;
        } catch (e){
            return e;
        } 
    }
    getRefinements(){
        const links = this.parent.parent.links.filter(link => link.target === this.customId);
        if(links.length){
            const type = links[0].type;
            const aux = links.map(link=>{return {
                customId: link.source,
                tag: this.parent.nodes.find(n=>link.source===n.customId).name,
                linkId: link.id
            };});
            this.refinements = new NodeRefinement(type, aux, vscode.TreeItemCollapsibleState.Collapsed, this);
        }
        // if(!this.terminal){
            // const runtimeAnnotation = this.tag.match(/(?<=\[)[a-zA-Z\d\,|\#|\;?]*(?=\])/g);
            // const separator = runtimeAnnotation[0].match(/[^a-zA-Z\d]/)[0];
            // let type: "and"|"or"|"fallback"| undefined;
            // switch(separator){
                // case ';':
                    // type = "and"
                    // break;
                // case ',':
                    // type = "fallback"
                    // break;
                // case '#':
                    // type = "and"
                    // break;
            // }
            // const refinements = runtimeAnnotation[0].split(/;|,|#/g)

            // const aux = refinements.map( tag => {
                // const node = this.mission.nodes.find(node => node.name === tag)
                // return {tag, customId: node.customId}
            // })
            // this.refinements = new NodeRefinement(type, aux, vscode.TreeItemCollapsibleState.Collapsed, this)
        // }
    }
    addRefinement(type, targetId, tag, newId){
        type = type == 'and'? 'istar.AndRefinementLink' : 'istar.OrRefinementLink';
        this.refinements = new NodeRefinement(type, [], vscode.TreeItemCollapsibleState.Collapsed, this);
        this.refinements.addRefinement(targetId, tag, newId);
    }
    remove(){
        this.parent.deleteNode(this);
    }
    setCollapsableState(newState: vscode.TreeItemCollapsibleState){
        this.collapsibleState = newState;
    }
}

export class Mission extends vscode.TreeItem {
    contextValue = 'mission';
    public nodes: Node[];
    lastGoalNumber = 0;
    lastTaskNumber = 0;
    constructor(
        public readonly name: string,
        private readonly missionNumber: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly customId: string,
        public readonly parent: GoalModel,
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
            if(!name || !tag){
                throw new Error("invalid node name");
            }
            const number = parseInt(name.replace(/[a-zA-Z]/g, ''));
            if (name.startsWith("AT")){
                this.lastTaskNumber = Math.max(this.lastTaskNumber, number);
            } else {
                this.lastGoalNumber = Math.max(this.lastGoalNumber, number);
            }
            const nodeInst = new Node(name, [], vscode.TreeItemCollapsibleState.Collapsed, tag,(name.startsWith("AT")? "Task" : "Goal"), this, node.id, {x: node.x, y:node.y});
            let customProperties = [];
            if(node.customProperties)
            customProperties = Object.keys(node.customProperties).map(key => {
                return new NodeAttr(key,node.customProperties[key], true,vscode.TreeItemCollapsibleState.None, nodeInst);
            });
            const attributes = [...customProperties, new NodeAttr("type",node.type, false,vscode.TreeItemCollapsibleState.None, nodeInst)];
                
            nodeInst.attributes = attributes;
            return nodeInst;
        });
        this.parent.usedIds.add(this.customId);
        this.nodes = nodes;
        this.nodes.forEach(node=>node.getRefinements());
    }
    getLinks(): gmTypes.Link[]{
        const links = [];
        this.nodes.forEach(node => {
            if(node.refinements){
                links.push(node.refinements.parseRefinements());
            }
        });
        return links;
    }
    parseToActor(): gmTypes.Actor{
        const actor: gmTypes.Actor = {} as gmTypes.Actor;
        actor.customProperties = this.customProperties;
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
    addNewNode(type: "Task" | "Goal", title: string){
        const name = type === 'Task'? `AT${this.lastTaskNumber}` : `G${this.lastGoalNumber}`;
        const nodeInst = new Node(name, [], vscode.TreeItemCollapsibleState.Collapsed, title, type, this, this.parent.generateNewId().toString(), {x: 0, y:0});
        nodeInst.addAttribute('Description', '');
        this.addNode(nodeInst);
    }
    deleteNode(node: Node){
        this.nodes.forEach(n=>{
            if(n.refinements){
                n.refinements.refinements = n.refinements.refinements.filter(r => r.sourceId !== node.customId);
            }
        });
        this.nodes = this.nodes.filter(el => el !== node);
    }
    addNode(node: Node){
        this.nodes.push(node);
    }
    setNodes(nodes: Node[]){
        this.nodes = nodes;
    }
}

export class GoalModel extends vscode.TreeItem{
    public parent = undefined;
    contextValue = 'goalModel';
    public usedIds = new Set<string>();
    public actors: gmTypes.Actor[];
    public missions: Mission[];
    public orphans: never[];
    public dependencies: never[];
    public links: gmTypes.Link[];
    public display: gmTypes.Display;
    public tool: string;
    public istar: string;
    public saveDate: Date;
    public diagram: gmTypes.Diagram;
    constructor(
        public readonly name: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        gm: gmTypes.GoalModel,
        public readonly filePath: string,
    ){
        super(name, collapsibleState);
        this.tooltip = `${this.name}`;
        this.description = this.filePath;
        this.actors = gm.actors;
        this.links = gm.links;
        this.display = gm.display;
        this.tool = gm.tool;
        this.istar = gm.istar;
        this.saveDate = gm.saveDate;
        this.diagram = gm.diagram;
        this.orphans = [];
        this.dependencies=[];

        const actors = gm.actors;
        const info = actors.map(actor=>{
            const parsedText = actor.text.split(': ');
            if(parsedText.length<2){
                throw new Error("invalid Mission name");
            }
            return {name: parsedText[1], missionNumber: parsedText[0], id: actor.id, nodes: actor.nodes, pos: {x: actor.x, y: actor.y}, customProperties: actor.customProperties};
        });
        this.missions = info.map(info => new Mission(info.name, info.missionNumber, vscode.TreeItemCollapsibleState.Collapsed, info.id, this,info.nodes, info.pos, info.customProperties));
    }
    parseMissions(): gmTypes.Actor[]{
        return this.missions.map(mission => mission.parseToActor());
    }
    parseLinks(){
        return this.missions.map(mission => mission.getLinks()).flat(Infinity) as gmTypes.Link[];
    }
    parseToGm(): gmTypes.GoalModel{
        
        return {
            actors: this.parseMissions(),
            orphans: this.orphans,
            dependencies: this.dependencies,
            links: this.parseLinks(),
            display: this.display,
            tool: this.tool,
            istar: this.istar,
            saveDate: this.saveDate,
            diagram: this.diagram
        };
    }
    public saveGoalModel(){
        const gm = this.parseToGm();
        const json = JSON.stringify(gm);
        fs.writeFileSync(this.filePath, json);
    }
    generateNewId(){
        let id = 2;
        this.usedIds.forEach(el=>{
            const parsedId = Number(el);
            if(!isNaN(parsedId) && parsedId >= id) {
                id = parsedId+1;
            }
        });
        this.usedIds.add(id.toString());
        return id;
    }
}