import * as fs from "fs";
import * as path from "path";

export interface StoppableClient {
  isRunning(): boolean;
  stop(): Promise<void>;
}

/**
 * Resolves the compiled `lsp-mutrose` server entry point, checking the plugin
 * submodule path first and falling back to the legacy `src/lsp/lsp-mutrose` path.
 */
export function resolveServerModulePath(
  asAbsolutePath: (relativePath: string) => string,
  existsSync: (filePath: string) => boolean = fs.existsSync,
): string {
  const candidates = [
    asAbsolutePath(
      path.join("src", "plugins", "lsp", "lsp-mutrose", "server", "out", "server.js"),
    ),
    asAbsolutePath(
      path.join("src", "lsp", "lsp-mutrose", "server", "out", "server.js"),
    ),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

/**
 * Safely stops a LanguageClient only if it is currently running, avoiding
 * `Client is not running and can't be stopped` errors when in `startFailed` or `stopped` state.
 */
export async function stopLanguageClientSafely(
  client: StoppableClient | undefined,
): Promise<void> {
  if (!client || !client.isRunning()) {
    return;
  }

  try {
    await client.stop();
  } catch (err) {
    console.error("[LspPlugin] Error while stopping LanguageClient:", err);
  }
}
