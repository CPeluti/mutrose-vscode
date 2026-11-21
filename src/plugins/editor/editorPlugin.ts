import * as vscode from "vscode";
import { CustomEditorProvider } from "../../customEditor";
import { PluginInterface } from "../pluginInterface";

export class EditorPlugin implements PluginInterface {
  public readonly name = "editor";
  private disposables: vscode.Disposable[] = [];

  public register(context: vscode.ExtensionContext): void {
    const editorDisposable = CustomEditorProvider.register(context);
    this.disposables.push(editorDisposable);
    context.subscriptions.push(editorDisposable);
  }

  public deregister(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  /**
   * Helper method to open a given file with the custom goal model editor.
   */
  public async openCustomEditor(fileUri: vscode.Uri): Promise<void> {
    await vscode.commands.executeCommand(
      "vscode.openWith",
      fileUri,
      "mutrose.customEditor",
    );
  }
}
