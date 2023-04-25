"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalModel = exports.GoalModelProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class GoalModelProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No goal models in empty workspace');
            return Promise.resolve([]);
        }
        if (element) {
            return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot, 'gm')));
        }
    }
    getGoalModelsInGoalModelFolder(gmFolderPath) {
        const workspaceRoot = this.workspaceRoot;
        if (this.pathExists(gmFolderPath) && workspaceRoot) {
            const gmList = JSON.parse(fs.readdirSync(gmFolderPath));
        }
    }
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
class GoalModel extends vscode.TreeItem {
    constructor(name, missionNumber, collapsibleState, command) {
        super(name, collapsibleState);
        this.name = name;
        this.missionNumber = missionNumber;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.contextValue = 'goalModel';
        this.tooltip = `${missionNumber}-${this.name}`;
        this.description = this.missionNumber;
    }
}
exports.GoalModel = GoalModel;
//# sourceMappingURL=goalModel.js.map