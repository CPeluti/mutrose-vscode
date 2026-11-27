import * as vscode from "vscode";
import { PluginInterface } from "../pluginInterface";
import {
  ISTAR_EDITOR_VIEW_TYPE,
  IstarEditorProvider,
} from "./istarEditorProvider";

export class IstarEditorPlugin implements PluginInterface {
  public readonly name = "istar-editor";
  private disposables: vscode.Disposable[] = [];

  public register(context: vscode.ExtensionContext): void {
    const editorDisposable = IstarEditorProvider.register(context);
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
      ISTAR_EDITOR_VIEW_TYPE,
    );
  }
}
