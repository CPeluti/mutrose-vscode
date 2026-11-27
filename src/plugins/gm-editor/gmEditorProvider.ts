import * as vscode from "vscode";
import {
  applyFullDocumentEdit,
  buildDiagnosticsPayload,
  buildEditorHtml,
  handleCommonEditorCommand,
  resolveWebviewDistDir,
} from "../../utilities/editorUtils";

export const GM_EDITOR_VIEW_TYPE = "mutrose.gmEditor";

const GM_WEBVIEW_DIST_CANDIDATES: string[][] = [
  ["src", "editors", "dist", "webview"],
  ["src", "plugins", "editor", "dist", "webview"],
];

export class GmEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new GmEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      GM_EDITOR_VIEW_TYPE,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    let isUpdatingFromWebview = false;
    const distDir = resolveWebviewDistDir(
      this.context.extensionUri,
      GM_WEBVIEW_DIST_CANDIDATES,
    );

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [distDir],
    };

    webviewPanel.webview.html = buildEditorHtml(webviewPanel.webview, distDir);

    const sendDocumentToWebview = () => {
      webviewPanel.webview.postMessage({
        command: "load",
        content: document.getText(),
      });
    };

    const sendDiagnosticsToWebview = () => {
      webviewPanel.webview.postMessage({
        command: "diagnostics",
        diagnostics: buildDiagnosticsPayload(document),
      });
    };

    const changeDocSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() !== document.uri.toString()) return;
        if (isUpdatingFromWebview) return;
        sendDocumentToWebview();
        sendDiagnosticsToWebview();
      },
    );

    const changeDiagnosticsSubscription =
      vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((u) => u.toString() === document.uri.toString())) {
          sendDiagnosticsToWebview();
        }
      });

    webviewPanel.onDidDispose(() => {
      changeDocSubscription.dispose();
      changeDiagnosticsSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (handleCommonEditorCommand(message, document)) {
        return;
      }

      switch (message.command) {
        case "ready":
          sendDocumentToWebview();
          sendDiagnosticsToWebview();
          break;
        case "edit":
          if (
            typeof message.content === "string" &&
            message.content !== document.getText()
          ) {
            isUpdatingFromWebview = true;
            try {
              await applyFullDocumentEdit(document, message.content);
            } finally {
              isUpdatingFromWebview = false;
            }
          }
          break;
      }
    });
  }
}
