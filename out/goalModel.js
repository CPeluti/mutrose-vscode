"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalModel = exports.Mission = exports.Node = exports.NodeAttr = exports.NodeRefinement = exports.Refinement = exports.GoalModelProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
// It's suposed that all goal models are inside the "gm" folder
class GoalModelProvider {
    workspaceRoot;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        const gmFolderPath = path.join(this.workspaceRoot, 'gm');
        if (this.pathExists(gmFolderPath) && workspaceRoot) {
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.drawio'));
            gmList.forEach(gm => {
                const fileWatcher = vscode.workspace.createFileSystemWatcher(path.join(gmFolderPath, gm));
                fileWatcher.onDidChange(() => {
                    this.refresh();
                });
            });
        }
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    // GetChildren should be triggered by the click on the mission to get the goals;
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if (element) {
            if (element instanceof Node) {
                return Promise.resolve([...element.attributes, element.refinements]);
            }
            else if (element instanceof GoalModel) {
                return Promise.resolve(element.missions);
            }
            else if (element instanceof NodeRefinement) {
                return Promise.resolve(element.refinements);
            }
            else {
                return Promise.resolve(element.nodes);
            }
            // TODO: implement goal recursive getter
            // return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
        }
        else {
            const gmFolderPath = path.join(this.workspaceRoot, 'gm');
            if (this.pathExists(gmFolderPath)) {
                return Promise.resolve(this.getGoalModels(gmFolderPath));
            }
            return Promise.resolve([]);
        }
    }
    // Should return all the missions inside a GoalModel
    // TODO: parse the goal model in a hierarchical way
    getGoalModels(gmFolderPath) {
        const workspaceRoot = this.workspaceRoot;
        if (this.pathExists(gmFolderPath) && workspaceRoot) {
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.gm'));
            const gms = gmList.map(gm => {
                return { gm: fs.readFileSync(path.join(gmFolderPath, gm)).toString(), filePath: path.join(gmFolderPath, gm) };
            });
            const parsedGMs = gms.map(({ gm, filePath }) => {
                const res = JSON.parse(gm);
                return { gm: res, filePath };
            });
            const goalModels = parsedGMs.map((gm) => {
                const gmName = gm.filePath.replace(/(^.*[\\/])|(\.drawio)/gi, '');
                const goalModel = new GoalModel(gmName, vscode.TreeItemCollapsibleState.Collapsed, gm.gm, gm.filePath);
                // const test = goalModel.parseToGm()
                return goalModel;
            });
            return goalModels;
        }
        return [];
    }
    // Check if path exists
    pathExists(path) {
        try {
            fs.accessSync(path);
        }
        catch (err) {
            return false;
        }
        return true;
    }
}
exports.GoalModelProvider = GoalModelProvider;
class Refinement extends vscode.TreeItem {
    info;
    collapsibleState;
    refinements;
    command;
    contextValue = 'refinement';
    sourceId;
    tag;
    customId;
    constructor(info, collapsibleState, refinements, command) {
        super(info.tag, collapsibleState);
        this.info = info;
        this.collapsibleState = collapsibleState;
        this.refinements = refinements;
        this.command = command;
        this.tooltip = `${info.tag}`;
        this.sourceId = info.customId;
        this.customId = info.linkId;
        this.refinements.node.mission.goalModel.usedIds.add(this.customId);
    }
    parseLink(target, type) {
        return {
            source: this.sourceId,
            target: target,
            id: this.customId,
            type
        };
    }
}
exports.Refinement = Refinement;
class NodeRefinement extends vscode.TreeItem {
    type;
    refinementsToInstantiate;
    collapsibleState;
    node;
    command;
    contextValue = 'refinements';
    refinements = [];
    constructor(type, refinementsToInstantiate, collapsibleState, node, command) {
        super('Refinements', collapsibleState);
        this.type = type;
        this.refinementsToInstantiate = refinementsToInstantiate;
        this.collapsibleState = collapsibleState;
        this.node = node;
        this.command = command;
        this.tooltip = 'Refinements';
        this.description = `type ${type}`;
        this.refinements = refinementsToInstantiate.map(refinement => {
            return new Refinement(refinement, vscode.TreeItemCollapsibleState.None, this);
        });
    }
    addRefinement(targetId, tag, newId) {
        this.refinements.push(new Refinement({ tag, linkId: newId, customId: targetId }, vscode.TreeItemCollapsibleState.None, this));
    }
    parseRefinements() {
        return this.refinements.map(r => r.parseLink(this.node.customId, this.type));
    }
    removeRefinement(refinement) {
        this.refinements = this.refinements.filter(e => e != refinement);
    }
}
exports.NodeRefinement = NodeRefinement;
class NodeAttr extends vscode.TreeItem {
    attrName;
    attrValue;
    custom;
    collapsibleState;
    node;
    command;
    contextValue = 'attribute';
    constructor(attrName, attrValue, custom, collapsibleState, node, command) {
        super(attrValue === "" ? "\"\"" : attrValue, collapsibleState);
        this.attrName = attrName;
        this.attrValue = attrValue;
        this.custom = custom;
        this.collapsibleState = collapsibleState;
        this.node = node;
        this.command = command;
        this.tooltip = `${this.attrName}-${this.attrValue}`;
        this.description = attrName;
    }
}
exports.NodeAttr = NodeAttr;
class Node extends vscode.TreeItem {
    name;
    attributes;
    collapsibleState;
    tag;
    nodeType;
    mission;
    customId;
    pos;
    command;
    contextValue = 'node';
    terminal = false;
    refinements;
    constructor(name, attributes, collapsibleState, tag, nodeType, mission, customId, pos, command) {
        super(name, collapsibleState);
        this.name = name;
        this.attributes = attributes;
        this.collapsibleState = collapsibleState;
        this.tag = tag;
        this.nodeType = nodeType;
        this.mission = mission;
        this.customId = customId;
        this.pos = pos;
        this.command = command;
        const runtimeAnnotation = tag.match(/(?<=\[)[a-zA-Z\d,|#|;?]*(?=\])/g);
        if (!runtimeAnnotation) {
            this.terminal = true;
        }
        this.tooltip = `${this.tag}-${this.name}`;
        this.mission.goalModel.usedIds.add(this.customId);
        this.description = tag;
    }
    parseNode() {
        const customProperties = this.attributes.filter(el => el.custom == true).reduce((acc, el) => {
            acc[el.attrName] = el.attrValue;
            return acc;
        }, {});
        return {
            id: this.customId,
            text: `${this.name}: ${this.description}`,
            x: this.pos.x,
            y: this.pos.y,
            type: `istar.${this.nodeType}`,
            customProperties: customProperties
        };
    }
    addAttribute(tag, value) {
        const newAttr = new NodeAttr(tag, value, true, vscode.TreeItemCollapsibleState.None, this);
        this.attributes.push(newAttr);
        try {
            this.mission.goalModel.saveGoalModel();
            return;
        }
        catch (e) {
            return e;
        }
    }
    removeAttribute(tag) {
        this.attributes = this.attributes.filter(attr => attr != tag);
        try {
            this.mission.goalModel.saveGoalModel();
            return;
        }
        catch (e) {
            return e;
        }
    }
    getRefinements() {
        const links = this.mission.goalModel.links.filter(link => link.target === this.customId);
        if (links.length) {
            const type = links[0].type;
            const aux = links.map(link => {
                return {
                    customId: link.source,
                    tag: this.mission.nodes.find(n => link.source === n.customId).name,
                    linkId: link.id
                };
            });
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
    addRefinement(type, targetId, tag, newId) {
        type = type == 'and' ? 'istar.AndRefinementLink' : 'istar.OrRefinementLink';
        this.refinements = new NodeRefinement(type, [], vscode.TreeItemCollapsibleState.Collapsed, this);
        this.refinements.addRefinement(targetId, tag, newId);
    }
    remove() {
        this.mission.deleteNode(this);
    }
}
exports.Node = Node;
class Mission extends vscode.TreeItem {
    name;
    missionNumber;
    collapsibleState;
    customId;
    goalModel;
    nodesToInstatiate;
    pos;
    customProperties;
    command;
    contextValue = 'mission';
    nodes;
    lastGoalNumber = 0;
    lastTaskNumber = 0;
    constructor(name, missionNumber, collapsibleState, customId, goalModel, nodesToInstatiate, pos, customProperties, command) {
        super(name, collapsibleState);
        this.name = name;
        this.missionNumber = missionNumber;
        this.collapsibleState = collapsibleState;
        this.customId = customId;
        this.goalModel = goalModel;
        this.nodesToInstatiate = nodesToInstatiate;
        this.pos = pos;
        this.customProperties = customProperties;
        this.command = command;
        this.tooltip = `${missionNumber}-${this.name}`;
        this.description = this.customProperties.description;
        const nodes = nodesToInstatiate.map(node => {
            const [name, tag] = node.text.split(': ');
            const number = parseInt(name.replace(/[a-zA-Z]/g, ''));
            if (name.startsWith("AT")) {
                this.lastTaskNumber = Math.max(this.lastTaskNumber, number);
            }
            else {
                this.lastGoalNumber = Math.max(this.lastGoalNumber, number);
            }
            const nodeInst = new Node(name, [], vscode.TreeItemCollapsibleState.Collapsed, tag, (name.startsWith("AT") ? "Task" : "Goal"), this, node.id, { x: node.x, y: node.y });
            const customProperties = Object.keys(node.customProperties).map(key => {
                return new NodeAttr(key, node.customProperties[key], true, vscode.TreeItemCollapsibleState.None, nodeInst);
            });
            const attributes = [...customProperties, new NodeAttr("type", node.type, false, vscode.TreeItemCollapsibleState.None, nodeInst)];
            nodeInst.attributes = attributes;
            return nodeInst;
        });
        this.goalModel.usedIds.add(this.customId);
        this.nodes = nodes;
        this.nodes.forEach(node => node.getRefinements());
    }
    getLinks() {
        const links = [];
        this.nodes.forEach(node => {
            if (node.refinements) {
                links.push(node.refinements.parseRefinements());
            }
        });
        return links;
    }
    parseToActor() {
        const actor = {};
        actor.customProperties = this.customProperties;
        actor.id = this.customId;
        actor.nodes = this.parseNodes();
        actor.text = `${this.missionNumber}: ${this.name}`;
        actor.type = "istar.Actor";
        actor.x = this.pos.x;
        actor.y = this.pos.y;
        return actor;
    }
    parseNodes() {
        return this.nodes.map(node => node.parseNode());
    }
    addNewNode(type, title) {
        const name = type === 'Task' ? `AT${this.lastTaskNumber}` : `G${this.lastGoalNumber}`;
        const nodeInst = new Node(name, [], vscode.TreeItemCollapsibleState.Collapsed, title, type, this, this.goalModel.generateNewId().toString(), { x: 0, y: 0 });
        nodeInst.addAttribute('Description', '');
        this.addNode(nodeInst);
    }
    deleteNode(node) {
        this.nodes.forEach(n => {
            if (n.refinements) {
                n.refinements.refinements = n.refinements.refinements.filter(r => r.sourceId !== node.customId);
            }
        });
        this.nodes = this.nodes.filter(el => el !== node);
    }
    addNode(node) {
        this.nodes.push(node);
    }
    setNodes(nodes) {
        this.nodes = nodes;
    }
}
exports.Mission = Mission;
class GoalModel extends vscode.TreeItem {
    name;
    collapsibleState;
    filePath;
    contextValue = 'goalModel';
    usedIds = new Set();
    actors;
    missions;
    orphans;
    dependencies;
    links;
    display;
    tool;
    istar;
    saveDate;
    diagram;
    constructor(name, collapsibleState, gm, filePath) {
        super(name, collapsibleState);
        this.name = name;
        this.collapsibleState = collapsibleState;
        this.filePath = filePath;
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
        this.dependencies = [];
        const actors = gm.actors;
        const info = actors.map(actor => {
            const parsedText = actor.text.split(': ');
            return { name: parsedText[1], missionNumber: parsedText[0], id: actor.id, nodes: actor.nodes, pos: { x: actor.x, y: actor.y }, customProperties: actor.customProperties };
        });
        this.missions = info.map(info => new Mission(info.name, info.missionNumber, vscode.TreeItemCollapsibleState.Collapsed, info.id, this, info.nodes, info.pos, info.customProperties));
    }
    parseMissions() {
        return this.missions.map(mission => mission.parseToActor());
    }
    parseLinks() {
        return this.missions.map(mission => mission.getLinks()).flat(Infinity);
    }
    parseToGm() {
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
    saveGoalModel() {
        const gm = this.parseToGm();
        const json = JSON.stringify(gm);
        fs.writeFileSync(this.filePath, json);
    }
    generateNewId() {
        let id = 2;
        this.usedIds.forEach(el => {
            const parsedId = Number(el);
            if (!isNaN(parsedId) && parsedId >= id) {
                id = parsedId + 1;
            }
        });
        this.usedIds.add(id.toString());
        return id;
    }
}
exports.GoalModel = GoalModel;
//# sourceMappingURL=goalModel.js.map