import type { MessagePortLike } from "@istar-ts/actions";
import * as vscode from "vscode";
import { IstarServer } from "../../istarServer";
import {
  applyFullDocumentEdit,
  buildDiagnosticsPayload,
  buildEditorHtml,
  handleCommonEditorCommand,
  resolveWebviewDistDir,
} from "../../utilities/editorUtils";

export const ISTAR_EDITOR_VIEW_TYPE = "mutrose.istarEditor";

const ISTAR_WEBVIEW_DIST_CANDIDATES: string[][] = [
  ["src", "plugins", "editor", "dist", "istar-webview"],
  ["src", "editors", "dist", "istar-webview"],
];

function useReactFlowStyle(): boolean {
  return vscode.workspace
    .getConfiguration("mutrose")
    .get<boolean>("istarTsReactFlowStyle", false);
}

export class IstarEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new IstarEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      ISTAR_EDITOR_VIEW_TYPE,
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
    const distDir = resolveWebviewDistDir(
      this.context.extensionUri,
      ISTAR_WEBVIEW_DIST_CANDIDATES,
    );

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [distDir],
    };

    const styleAttr = `data-editor-style="${useReactFlowStyle() ? "reactflow" : "default"}"`;
    webviewPanel.webview.html = buildEditorHtml(
      webviewPanel.webview,
      distDir,
      styleAttr,
    );

    const port: MessagePortLike = {
      postMessage: (data) => {
        webviewPanel.webview.postMessage({ command: "istar-rpc", frame: data });
      },
      onmessage: null,
    };

    const server = new IstarServer(
      {
        getText: () => document.getText(),
        replaceAll: (text) =>
          Promise.resolve(applyFullDocumentEdit(document, text)).then(
            () => undefined,
          ),
      },
      port,
    );

    const sendDiagnosticsToWebview = () => {
      webviewPanel.webview.postMessage({
        command: "diagnostics",
        diagnostics: buildDiagnosticsPayload(document),
      });
    };

    const changeDocSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() !== document.uri.toString()) return;
        server.reloadFromDocument();
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
      server.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (handleCommonEditorCommand(message, document)) {
        return;
      }

      switch (message.command) {
        case "istar-rpc":
          port.onmessage?.({ data: message.frame });
          break;
        case "ready":
          sendDiagnosticsToWebview();
          break;
      }
    });
  }
}
