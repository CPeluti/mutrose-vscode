// src/MeuEditorProvider.ts
import * as vscode from "vscode";

export class CustomEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new CustomEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      "mutrose.customEditor", // deve bater com o viewType do package.json
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true, // mantém o React vivo ao trocar de aba
        },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  // Chamado pelo VS Code ao abrir um arquivo associado
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    let isUpdatingFromWebview = false;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "src",
          "editors",
          "dist",
          "webview",
        ),
      ],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Utilitário para enviar o conteúdo atual ao React
    const sendDocumentToWebview = () => {
      webviewPanel.webview.postMessage({
        command: "load",
        content: document.getText(),
      });
    };

    // Quando o VS Code recarregar o documento (ex: arquivo alterado externamente)
    const changeDocSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          if (isUpdatingFromWebview) return;
          sendDocumentToWebview();
        }
      },
    );

    webviewPanel.onDidDispose(() => {
      changeDocSubscription.dispose();
    });

    // Receber edições vindas do React
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "edit":
          isUpdatingFromWebview = true;
          await this.applyEdit(document, message.content);
          isUpdatingFromWebview = false;
          break;
        case "ready":
          sendDocumentToWebview();
          break;
      }
    });

    // Enviar conteúdo inicial assim que a webview estiver pronta
  }

  // Aplica edição via WorkspaceEdit — isso ativa undo/redo e dirty state automaticamente
  private applyEdit(document: vscode.TextDocument, newContent: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      newContent,
    );
    vscode.workspace.applyEdit(edit);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "editors",
        "dist",
        "webview",
        "main.js",
      ),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "editors",
        "dist",
        "webview",
        "main.css",
      ),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <style>
  html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
  #root {
  display: flex;
}
  .app {
  flex: 1;
  display: flex;
  overflow: hidden;
}
  .react-flow {
  flex: 1;
}

  </style>
  </head>
<body style="padding:0;">
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = "";
  const chars = "ABCDEFabcdef0123456789";
  for (let i = 0; i < 32; i++)
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
