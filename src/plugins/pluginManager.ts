import * as vscode from "vscode";
import { PluginInterface } from "./pluginInterface";

/**
 * Context in the Strategy Pattern: manages the registration and lifecycle
 * of extension plugins implementing `PluginInterface`.
 */
export class PluginManager {
  private plugins: Map<string, PluginInterface> = new Map();

  /**
   * Adds a plugin strategy to the manager.
   */
  public use(plugin: PluginInterface): this {
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  /**
   * Retrieves a registered plugin by its unique name.
   */
  public getPlugin<T extends PluginInterface>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  /**
   * Returns all registered plugins.
   */
  public getPlugins(): PluginInterface[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Registers all registered plugins using the provided VS Code extension context.
   */
  public async registerAll(context: vscode.ExtensionContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.register(context);
    }
  }

  /**
   * De-registers all registered plugins in reverse registration order.
   */
  public async deregisterAll(): Promise<void> {
    const list = Array.from(this.plugins.values()).reverse();
    for (const plugin of list) {
      await plugin.deregister();
    }
    this.plugins.clear();
  }
}
