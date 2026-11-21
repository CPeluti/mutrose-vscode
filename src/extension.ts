import * as vscode from "vscode";
import {
  EditorPlugin,
  LspPlugin,
  MutrosePlugin,
  PluginManager,
  TreeViewPlugin,
} from "./plugins";

let pluginManager: PluginManager;

/**
 * Extension activation entry point.
 * Initializes the plugin manager and registers all feature strategy plugins.
 */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  console.log('Congratulations, your extension "gm-parser" is now active!');

  pluginManager = new PluginManager();
  pluginManager
    .use(new LspPlugin())
    .use(new TreeViewPlugin())
    .use(new EditorPlugin())
    .use(new MutrosePlugin());

  await pluginManager.registerAll(context);
}

/**
 * Extension deactivation entry point.
 * Deregisters all plugins and cleans up active resources.
 */
export async function deactivate(): Promise<void> {
  if (pluginManager) {
    await pluginManager.deregisterAll();
  }
}
