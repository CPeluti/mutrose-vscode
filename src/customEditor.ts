// src/MeuEditorProvider.ts
import type { MessagePortLike } from "@istar-ts/actions";
import * as vscode from "vscode";
import { IstarServer } from "./istarServer";

/** Draw the istar-ts editor like the legacy React Flow editor. */
function useReactFlowStyle(): boolean {
  return vscode.workspace
    .getConfiguration("mutrose")
    .get<boolean>("istarTsReactFlowStyle", false);
}

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
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "src",
          "editors",
          "dist",
          "istar-webview",
        ),
      ],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Port shim over the webview channel: RPC frames ride `{ command: 'istar-rpc', frame }`
    // alongside the existing `{ command }` messages.
    const port: MessagePortLike = {
      postMessage: (data) => {
        webviewPanel.webview.postMessage({ command: "istar-rpc", frame: data });
      },
      onmessage: null,
    };
    const server = new IstarServer(
      {
        getText: () => document.getText(),
        replaceAll: (text) => Promise.resolve(this.applyEdit(document, text)).then(() => undefined),
      },
      port,
    );

    // Utilitário para enviar diagnósticos atuais do LSP ao React
    const sendDiagnosticsToWebview = () => {
      const rawDiagnostics = vscode.languages.getDiagnostics(document.uri);
      const nodeRanges = getNodeLineRanges(document.getText());

      const diagnostics = rawDiagnostics.map((d) => {
        let nodeId = (d as any).data?.nodeId;
        if (!nodeId) {
          nodeId = findNodeIdAtLine(nodeRanges, d.range.start.line);
        }
        return {
          message: d.message,
          severity:
            d.severity === vscode.DiagnosticSeverity.Error
              ? "error"
              : d.severity === vscode.DiagnosticSeverity.Warning
                ? "warning"
                : "info",
          range: {
            start: {
              line: d.range.start.line,
              character: d.range.start.character,
            },
            end: {
              line: d.range.end.line,
              character: d.range.end.character,
            },
          },
          source: d.source,
          nodeId,
        };
      });

      webviewPanel.webview.postMessage({
        command: "diagnostics",
        diagnostics,
      });
    };

    // Quando o VS Code recarregar o documento (ex: arquivo alterado externamente).
    // `reloadFromDocument` no-ops when the text is the one the server itself just wrote
    // (the echo of an edit coming from the webview), so no extra guard is needed here.
    const changeDocSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() !== document.uri.toString()) return;
        server.reloadFromDocument();
        sendDiagnosticsToWebview();
      },
    );

    // Quando os diagnósticos do documento forem atualizados pelo LSP
    const changeDiagnosticsSubscription =
      vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((u) => u.toString() === document.uri.toString())) {
          sendDiagnosticsToWebview();
        }
      });

    webviewPanel.onDidDispose(() => {
      changeDocSubscription.dispose();
      changeDiagnosticsSubscription.dispose();
      server.dispose();
    });

    // Receber mensagens vindas do React
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "istar-rpc":
          port.onmessage?.({ data: message.frame });
          break;
        case "ready":
          sendDiagnosticsToWebview();
          break;
        case "select":
          if (message.payload?.target) {
            vscode.commands.executeCommand(
              "goalModel.focusElement",
              message.payload.target,
              message.payload.parent,
            );
          }
          break;
      }
    });
  }

  // Aplica edição via WorkspaceEdit — isso ativa undo/redo e dirty state automaticamente
  private applyEdit(
    document: vscode.TextDocument,
    newContent: string,
  ): Thenable<boolean> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
      ),
      newContent,
    );
    return vscode.workspace.applyEdit(edit);
  }

  private getHtml(webview: vscode.Webview): string {
    const bundle = "istar-webview";
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "editors",
        "dist",
        bundle,
        "main.js",
      ),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "editors",
        "dist",
        bundle,
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
<body style="padding:0;" data-editor-style="${useReactFlowStyle() ? "reactflow" : "default"}">
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

export function getNodeLineRanges(
  text: string,
): Array<{ id: string; startLine: number; endLine: number }> {
  const lines = text.split(/\r?\n/);
  const nodeRanges: Array<{ id: string; startLine: number; endLine: number }> =
    [];

  const idRegex = /"id"\s*:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(text)) !== null) {
    const id = match[1];
    const index = match.index;
    const startLine = text.substring(0, index).split(/\r?\n/).length - 1;

    let openBraceLine = startLine;
    while (openBraceLine >= 0 && !lines[openBraceLine].includes("{")) {
      openBraceLine--;
    }
    if (openBraceLine < 0) openBraceLine = startLine;

    let depth = 0;
    let endLine = openBraceLine;
    for (let i = openBraceLine; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === "{") depth++;
        else if (char === "}") depth--;
      }
      if (depth === 0) {
        endLine = i;
        break;
      }
    }
    nodeRanges.push({ id, startLine: openBraceLine, endLine });
  }
  return nodeRanges;
}

export function findNodeIdAtLine(
  ranges: Array<{ id: string; startLine: number; endLine: number }>,
  line: number,
): string | undefined {
  let best: { id: string; startLine: number; endLine: number } | null = null;
  for (const r of ranges) {
    if (line >= r.startLine && line <= r.endLine) {
      if (!best || r.endLine - r.startLine < best.endLine - best.startLine) {
        best = r;
      }
    }
  }
  return best ? best.id : undefined;
}
