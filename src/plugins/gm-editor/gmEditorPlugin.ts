import * as vscode from "vscode";
import { PluginInterface } from "../pluginInterface";
import { GM_EDITOR_VIEW_TYPE, GmEditorProvider } from "./gmEditorProvider";

export class GmEditorPlugin implements PluginInterface {
  public readonly name = "gm-editor";
  private disposables: vscode.Disposable[] = [];

  public register(context: vscode.ExtensionContext): void {
    const editorDisposable = GmEditorProvider.register(context);
    this.disposables.push(editorDisposable);
    context.subscriptions.push(editorDisposable);
  }

  public deregister(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  public async openEditor(fileUri: vscode.Uri): Promise<void> {
    await vscode.commands.executeCommand(
      "vscode.openWith",
      fileUri,
      GM_EDITOR_VIEW_TYPE,
    );
  }
}
