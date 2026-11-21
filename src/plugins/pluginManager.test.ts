import * as assert from "assert";
import * as vscode from "vscode";
import { PluginInterface } from "./pluginInterface";
import { PluginManager } from "./pluginManager";

class MockPlugin implements PluginInterface {
  public registered = false;
  public deregistered = false;
  public receivedContext?: vscode.ExtensionContext;
  public registrationOrder = -1;
  public deregistrationOrder = -1;

  constructor(
    public readonly name: string,
    private readonly tracker?: { regIndex: number; deregIndex: number },
  ) {}

  public register(context: vscode.ExtensionContext): void {
    this.registered = true;
    this.receivedContext = context;
    if (this.tracker) {
      this.registrationOrder = this.tracker.regIndex++;
    }
  }

  public deregister(): void {
    this.deregistered = true;
    if (this.tracker) {
      this.deregistrationOrder = this.tracker.deregIndex++;
    }
  }
}

describe("PluginManager (Strategy Pattern)", () => {
  it("registers and retrieves plugins by name", () => {
    const manager = new PluginManager();
    const pluginA = new MockPlugin("pluginA");
    const pluginB = new MockPlugin("pluginB");

    manager.use(pluginA).use(pluginB);

    assert.strictEqual(manager.getPlugin("pluginA"), pluginA);
    assert.strictEqual(manager.getPlugin("pluginB"), pluginB);
    assert.strictEqual(manager.getPlugin("nonExistent"), undefined);
    assert.strictEqual(manager.getPlugins().length, 2);
  });

  it("calls register on all plugins with the provided context", async () => {
    const manager = new PluginManager();
    const tracker = { regIndex: 0, deregIndex: 0 };
    const plugin1 = new MockPlugin("first", tracker);
    const plugin2 = new MockPlugin("second", tracker);

    manager.use(plugin1).use(plugin2);

    const fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    await manager.registerAll(fakeContext);

    assert.strictEqual(plugin1.registered, true);
    assert.strictEqual(plugin1.receivedContext, fakeContext);
    assert.strictEqual(plugin1.registrationOrder, 0);

    assert.strictEqual(plugin2.registered, true);
    assert.strictEqual(plugin2.receivedContext, fakeContext);
    assert.strictEqual(plugin2.registrationOrder, 1);
  });

  it("calls deregister on all plugins in reverse order and clears the registry", async () => {
    const manager = new PluginManager();
    const tracker = { regIndex: 0, deregIndex: 0 };
    const plugin1 = new MockPlugin("p1", tracker);
    const plugin2 = new MockPlugin("p2", tracker);

    manager.use(plugin1).use(plugin2);

    const fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    await manager.registerAll(fakeContext);
    await manager.deregisterAll();

    assert.strictEqual(plugin1.deregistered, true);
    assert.strictEqual(plugin2.deregistered, true);

    // Reversed deregistration: plugin2 (last registered) should be deregistered first
    assert.strictEqual(plugin2.deregistrationOrder, 0);
    assert.strictEqual(plugin1.deregistrationOrder, 1);

    assert.strictEqual(manager.getPlugins().length, 0);
    assert.strictEqual(manager.getPlugin("p1"), undefined);
  });
});
