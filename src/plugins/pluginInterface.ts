import * as vscode from "vscode";

/**
 * Interface that all extension feature plugins (strategies) must implement.
 */
export interface PluginInterface {
  /**
   * Unique identifier name for the plugin.
   */
  readonly name: string;

  /**
   * Registers the plugin's features, commands, and providers into the VS Code extension context.
   *
   * @param context The VS Code extension context for subscriptions and resource resolution.
   */
  register(context: vscode.ExtensionContext): void | Promise<void>;

  /**
   * De-registers the plugin, cleaning up resources, stopping background processes, and disposing subscriptions.
   */
  deregister(): void | Promise<void>;
}
