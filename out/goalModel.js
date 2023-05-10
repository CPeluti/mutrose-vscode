"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mission = exports.Node = exports.NodeAttr = exports.GoalModelProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
// It's suposed that all goal models are inside the "gm" folder
class GoalModelProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
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
            else {
                return Promise.resolve(element.nodes);
            }
            // TODO: implement goal recursive getter
            // return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
        }
        else {
            const gmFolderPath = path.join(this.workspaceRoot, 'gm');
            if (this.pathExists(gmFolderPath)) {
                return Promise.resolve(this.getMissionsInGoalModelFolder(gmFolderPath));
            }
            return Promise.resolve([]);
        }
    }
    getNodesFromMission(mission) {
        return [];
    }
    // Should return all the missions inside a GoalModel
    // TODO: parse the goal model in a hierarchical way
    getMissionsInGoalModelFolder(gmFolderPath) {
        const workspaceRoot = this.workspaceRoot;
        if (this.pathExists(gmFolderPath) && workspaceRoot) {
            const gmList = fs.readdirSync(gmFolderPath);
            const toMission = (goalModelJson, filePath) => {
                const actors = goalModelJson.actors;
                const info = actors.map(actor => {
                    const parsedText = actor.text.split(': ');
                    return { name: parsedText[1], missionNumber: parsedText[0], id: actor.id, nodes: actor.nodes };
                });
                const nodes = info[0].nodes.map(node => {
                    console.log(node);
                    const [name, tag] = node.text.split(': ');
                    const customProperties = Object.keys(node.customProperties).map(key => {
                        return { [key]: node.customProperties[key] };
                    });
                    const attributes = [...customProperties, { type: node.type }].map((attribute) => new NodeAttr(Object.keys(attribute)[0], Object.values(attribute)[0], vscode.TreeItemCollapsibleState.None));
                    return new Node(name, attributes, vscode.TreeItemCollapsibleState.Collapsed, tag);
                });
                return new Mission(info[0].name, info[0].missionNumber, vscode.TreeItemCollapsibleState.Collapsed, filePath, info[0].id, nodes);
            };
            const gms = gmList.map(gm => {
                return { gm: JSON.parse(fs.readFileSync(path.join(gmFolderPath, gm), 'utf-8')), filePath: path.join(gmFolderPath, gm) };
            });
            // console.log(gms);
            const res = gms.map((gm) => toMission(gm.gm, gm.filePath));
            return res;
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
    constructor(attrName, attrValue, collapsibleState, command) {
        super(attrValue === "" ? "\"\"" : attrValue, collapsibleState);
        this.attrName = attrName;
        this.attrValue = attrValue;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.tooltip = `${this.attrName}-${this.attrValue}`;
        this.description = attrName;
    }
}
exports.NodeAttr = NodeAttr;
class Node extends vscode.TreeItem {
    constructor(name, attributes, collapsibleState, tag, command) {
        super(name, collapsibleState);
        this.name = name;
        this.attributes = attributes;
        this.collapsibleState = collapsibleState;
        this.tag = tag;
        this.command = command;
        this.tooltip = `${this.tag}-${this.name}`;
        this.description = tag;
    }
}
exports.Node = Node;
class Mission extends vscode.TreeItem {
    constructor(name, missionNumber, collapsibleState, filePath, missionId, nodes, command) {
        super(name, collapsibleState);
        this.name = name;
        this.missionNumber = missionNumber;
        this.collapsibleState = collapsibleState;
        this.filePath = filePath;
        this.missionId = missionId;
        this.nodes = nodes;
        this.command = command;
        this.contextValue = 'Mission';
        this.tooltip = `${missionNumber}-${this.name}`;
        this.description = this.missionNumber;
    }
}
exports.Mission = Mission;
//# sourceMappingURL=goalModel.js.map