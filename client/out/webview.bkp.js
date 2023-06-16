"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mission = exports.Node = exports.NodeAttr = exports.GoalModelProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const parser_1 = require("./parser");
class GoalModelProvider {
    _extensionUri;
    _rootPath;
    static viewType = 'goalModel.goalTree';
    _view;
    constructor(_extensionUri, _rootPath) {
        this._extensionUri = _extensionUri;
        this._rootPath = _rootPath;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'colorSelected':
                    {
                        vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
                        break;
                    }
            }
        });
    }
    _getHtmlForWebview(webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        let elements = [];
        const gmFolderPath = path.join(this._rootPath, 'gm');
        if (this.pathExists(gmFolderPath)) {
            elements = this.getMissionsInGoalModelFolder(gmFolderPath);
        }
        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Cat Colors</title>
			</head>
			<body>
				<p>
				${elements[0].name}
				</p>
			</body>
			</html>`;
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
    getMissionsInGoalModelFolder(gmFolderPath) {
        const workspaceRoot = this._rootPath;
        if (this.pathExists(gmFolderPath) && workspaceRoot) {
            let gmList = fs.readdirSync(gmFolderPath);
            gmList = gmList.filter(gm => gm.includes('.drawio'));
            const toMission = (goalModelJson, filePath) => {
                const actors = goalModelJson.actors;
                const info = actors.map(actor => {
                    const parsedText = actor.text.split(': ');
                    return { name: parsedText[1], missionNumber: parsedText[0], id: actor.id, nodes: actor.nodes };
                });
                const nodes = info[0].nodes.map(node => {
                    const [name, tag] = node.text.split(': ');
                    const customProperties = Object.keys(node.customProperties).map(key => {
                        return { [key]: node.customProperties[key] };
                    });
                    const attributes = [...customProperties, { type: node.type }].map((attribute) => new NodeAttr(Object.keys(attribute)[0], Object.values(attribute)[0], vscode.TreeItemCollapsibleState.None));
                    return new Node(name, attributes, vscode.TreeItemCollapsibleState.Collapsed, tag);
                });
                return new Mission(info[0].name, info[0].missionNumber, vscode.TreeItemCollapsibleState.Collapsed, filePath, info[0].id, nodes);
            };
            const gmsDIO = gmList.map(gm => {
                return { gm: fs.readFileSync(path.join(gmFolderPath, gm)).toString(), filePath: path.join(gmFolderPath, gm) };
            });
            const gms = gmsDIO.map(({ gm, filePath }) => {
                const res = JSON.parse(((0, parser_1.convertDIOXML2GM)(gm)));
                return { gm: res, filePath };
            });
            const res = gms.map((gm) => toMission(gm.gm, gm.filePath));
            // const res = [];
            return res;
        }
        return [];
    }
}
exports.GoalModelProvider = GoalModelProvider;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
class NodeAttr extends vscode.TreeItem {
    attrName;
    attrValue;
    collapsibleState;
    command;
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
    name;
    attributes;
    collapsibleState;
    tag;
    command;
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
    name;
    missionNumber;
    collapsibleState;
    filePath;
    missionId;
    nodes;
    command;
    constructor(name, missionNumber, collapsibleState, filePath, missionId, nodes, command) {
        super(name, collapsibleState);
        this.name = name;
        this.missionNumber = missionNumber;
        this.collapsibleState = collapsibleState;
        this.filePath = filePath;
        this.missionId = missionId;
        this.nodes = nodes;
        this.command = command;
        this.tooltip = `${missionNumber}-${this.name}`;
        this.description = this.missionNumber;
    }
    contextValue = 'mission';
}
exports.Mission = Mission;
//# sourceMappingURL=webview.bkp.js.map