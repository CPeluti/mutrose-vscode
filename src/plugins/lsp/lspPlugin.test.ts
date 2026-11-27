import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  resolveServerModulePath,
  stopLanguageClientSafely,
  StoppableClient,
} from "./lspHelpers";

describe("LspPlugin helpers", () => {
  it("resolves the primary plugin path when it exists", () => {
    const root = "/workspace";
    const primary = path.join(
      root,
      "src",
      "plugins",
      "lsp",
      "lsp-mutrose",
      "server",
      "out",
      "server.js",
    );

    const resolved = resolveServerModulePath(
      (rel) => path.join(root, rel),
      (filePath) => filePath === primary,
    );

    assert.strictEqual(resolved, primary);
  });

  it("falls back to src/lsp/lsp-mutrose when src/plugins/lsp/lsp-mutrose is empty", () => {
    const root = "/workspace";
    const fallback = path.join(
      root,
      "src",
      "lsp",
      "lsp-mutrose",
      "server",
      "out",
      "server.js",
    );

    const resolved = resolveServerModulePath(
      (rel) => path.join(root, rel),
      (filePath) => filePath === fallback,
    );

    assert.strictEqual(resolved, fallback);
  });

  it("resolves an existing server.js in the current repository", () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const resolved = resolveServerModulePath((rel) => path.join(repoRoot, rel));

    assert.strictEqual(fs.existsSync(resolved), true);
    assert.ok(resolved.endsWith(path.join("server", "out", "server.js")));
  });

  it("does not call stop() when client is not running (e.g. startFailed)", async () => {
    let stopCalled = false;
    const failedClient: StoppableClient = {
      isRunning: () => false,
      stop: async () => {
        stopCalled = true;
        throw new Error(
          "Client is not running and can't be stopped. It's current state is: startFailed",
        );
      },
    };

    await stopLanguageClientSafely(failedClient);
    assert.strictEqual(stopCalled, false);
  });

  it("calls stop() when client is running", async () => {
    let stopCalled = false;
    const runningClient: StoppableClient = {
      isRunning: () => true,
      stop: async () => {
        stopCalled = true;
      },
    };

    await stopLanguageClientSafely(runningClient);
    assert.strictEqual(stopCalled, true);
  });
});
