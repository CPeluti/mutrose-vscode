"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalModel = exports.Mission = exports.Node = exports.NodeAttr = exports.GoalModelProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const parser_1 = require("./parser");
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
                let fileWatcher = vscode.workspace.createFileSystemWatcher(path.join(gmFolderPath, gm));
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
                return Promise.resolve(element.attributes);
            }
            else if (element instanceof GoalModel) {
                return Promise.resolve(element.missions);
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
            gmList = gmList.filter(gm => gm.includes('.drawio'));
            const gmsDIO = gmList.map(gm => {
                return { gm: fs.readFileSync(path.join(gmFolderPath, gm)).toString(), filePath: path.join(gmFolderPath, gm) };
            });
            const gms = gmsDIO.map(({ gm, filePath }) => {
                const res = (0, parser_1.convertDIOXML2GM)(gm);
                return { gm: res, filePath };
            });
            const goalModels = gms.map((gm) => {
                const gmName = gm.filePath.replace(/(^.*[\\\/])|(\.drawio)/gi, '');
                const goalModel = new GoalModel(gmName, vscode.TreeItemCollapsibleState.Collapsed, gm.gm, gm.filePath);
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
    decompositions = [];
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
        const runtimeAnnotation = tag.match(/(?<=\[)[a-zA-Z\d\,|\#|\;?]*(?=\])/g);
        let type;
        if (runtimeAnnotation) {
            const separator = runtimeAnnotation[0].match(/[^a-zA-Z\d]/)[0];
            switch (separator) {
                case ';':
                    type = "and";
                    break;
                case ',':
                    type = "fallback";
                    break;
                case '#':
                    type = "and";
                    break;
            }
        }
        else {
            this.terminal = true;
        }
        console.log(type, this.terminal);
        if (!this.terminal) {
            this.decompositions = runtimeAnnotation[0].split(/;|,|#/g);
        }
        this.tooltip = `${this.tag}-${this.name}`;
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
            const nodeInst = new Node(name, [], vscode.TreeItemCollapsibleState.Collapsed, tag, (name.startsWith("AT") ? "Task" : "Goal"), this, node.id, { x: node.x, y: node.y });
            const customProperties = Object.keys(node.customProperties).map(key => {
                return new NodeAttr(key, node.customProperties[key], true, vscode.TreeItemCollapsibleState.None, nodeInst);
            });
            const attributes = [...customProperties, new NodeAttr("type", node.type, false, vscode.TreeItemCollapsibleState.None, nodeInst)];
            nodeInst.attributes = attributes;
            return nodeInst;
        });
        this.nodes = nodes;
    }
    parseToActor() {
        let actor = {};
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
    parseToGm() {
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
        };
    }
    saveGoalModel() {
        const gm = this.parseToGm();
        const xml = (0, parser_1.convertGM2DIOXML)(JSON.stringify(gm));
        fs.writeFileSync(this.filePath, xml);
    }
}
exports.GoalModel = GoalModel;
//# sourceMappingURL=goalModel.js.map