import * as vscode from "vscode";
import {
  findNodeIdAtLine,
  getNodeLineRanges,
  getNonce,
  resolveFirstExistingSegments,
} from "./editorDiagnostics";

export {
  findNodeIdAtLine,
  getNodeLineRanges,
  getNonce,
  resolveFirstExistingSegments,
};

export interface WebviewDiagnosticPayload {
  message: string;
  severity: "error" | "warning" | "info";
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  source?: string;
  nodeId?: string;
}

export function buildDiagnosticsPayload(
  document: vscode.TextDocument,
): WebviewDiagnosticPayload[] {
  const rawDiagnostics = vscode.languages.getDiagnostics(document.uri);
  const nodeRanges = getNodeLineRanges(document.getText());

  return rawDiagnostics.map((d) => {
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
}

export function applyFullDocumentEdit(
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

/**
 * Handles commands shared by all goal model editors (`select`, `decompose`, `generateIhtn`).
 * Returns true if the message was handled.
 */
export function handleCommonEditorCommand(
  message: any,
  document: vscode.TextDocument,
): boolean {
  switch (message?.command) {
    case "select":
      if (message.payload?.target) {
        vscode.commands.executeCommand(
          "goalModel.focusElement",
          message.payload.target,
          message.payload.parent,
        );
      }
      return true;
    case "decompose":
      vscode.commands.executeCommand("goalModel.execMutRose", {
        filePath: document.uri.fsPath,
      });
      return true;
    case "generateIhtn":
      vscode.commands.executeCommand("goalModel.generateIhtn", {
        filePath: document.uri.fsPath,
      });
      return true;
    default:
      return false;
  }
}

export function resolveWebviewDistDir(
  extensionUri: vscode.Uri,
  candidates: string[][],
): vscode.Uri {
  const chosen = resolveFirstExistingSegments(extensionUri.fsPath, candidates);
  return vscode.Uri.joinPath(extensionUri, ...chosen);
}

export function buildEditorHtml(
  webview: vscode.Webview,
  distDir: vscode.Uri,
  bodyAttrs = "",
): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, "main.css"));
  const nonce = getNonce();
  const extraAttrs = bodyAttrs ? ` ${bodyAttrs}` : "";

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
<body style="padding:0;"${extraAttrs}>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
