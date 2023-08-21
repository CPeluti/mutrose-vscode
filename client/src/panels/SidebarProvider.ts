import * as vscode from "vscode";
import { WebviewViewResolveContext, CancellationToken, WebviewView, WebviewViewProvider,Webview, Uri, window } from "vscode";
import { getNonce } from "../utilities/getNonce";
import { getUri } from "../utilities/getUri";
 
export class SidebarProvider implements WebviewViewProvider {
    public static readonly viewType = 'vueapp-teste:sidebar';

    private _view?: WebviewView;

    constructor(private readonly _extensionUri: Uri) {}

    public resolveWebviewView(    
        webviewView: WebviewView,    
        context: WebviewViewResolveContext,
            _token: CancellationToken  
    ) {
        this._view = webviewView;

    webviewView.webview.options = {      
        // Allow scripts in the webview
        enableScripts: true,
        
        localResourceRoots: [
            this._extensionUri
        ],
    };

    webviewView.webview.html = this._getHtmlForWebview(this._view.webview, this._extensionUri);

	// Set an event listener to listen for messages passed from the webview context
	this._setWebviewMessageListener(this._view.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {     
        switch (data.type) {
            case "message": {
                if (!data.value) {
                    return;
                }
                vscode.window.showInformationMessage(data.value);  
                break;
            }
            case "openApp": {  
                await vscode.commands.executeCommand(
                    'vscodevuerollup:openVueApp', { ...data }
                );
                break;
            }
            case "onInfo": {
                if (!data.value) {
                    return; 
                }
                vscode.window.showInformationMessage(data.value);  
                break;
            }
            case "onError": {
                if (!data.value) { 
                    return; 
                } 
                vscode.window.showErrorMessage(data.value); 
                break;
            }
        }
    });
    }

    public revive(panel: vscode.WebviewView) {
        this._view = panel; 
    }

    private _getHtmlForWebview(webview: Webview, extensionUri: Uri) 
    { 
        // The CSS file from the Vue build output
		const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
		// The JS file from the Vue build output
		const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);

		const nonce = getNonce();

    	// Tip: Install the es6-string-html VS Code extension to enable code highlighting below
		return /*html*/ `
		<!DOCTYPE html>
		<html lang="en">
			<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<link rel="stylesheet" type="text/css" href="${stylesUri}">
			<title>Hello World</title>
			</head>
			<body>
			<div id="app"></div>
			<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
			</body>
		</html>
		`;
  	}

	/**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
	private _setWebviewMessageListener(webview: Webview) {
		webview.onDidReceiveMessage(
		  (message: any) => {
			const command = message.command;
			const text = message.text;
	
			switch (command) {
			  case "hello":
				// Code that should run in response to the hello message command
				window.showInformationMessage(text);
				return;
			  // Add more switch case statements here as more webview message commands
			  // are created within the webview context (i.e. inside media/main.js)
			}
		  },
		  undefined
		);
	  }
}
