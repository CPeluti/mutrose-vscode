import * as fs from "fs";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { PluginInterface } from "../pluginInterface";
import {
  resolveServerModulePath,
  stopLanguageClientSafely,
} from "./lspHelpers";

export class LspPlugin implements PluginInterface {
  public readonly name = "lsp";
  private client?: LanguageClient;

  public async register(context: vscode.ExtensionContext): Promise<void> {
    const serverModule = this.getServerModulePath(context);

    if (!fs.existsSync(serverModule)) {
      const msg = `MutRoSe LSP server not found at "${serverModule}". LSP features will be disabled until the server is compiled.`;
      console.error(`[LspPlugin] ${msg}`);
      void vscode.window.showWarningMessage(msg);
      return;
    }

    const serverOptions: ServerOptions = {
      run: {
        module: serverModule,
        transport: TransportKind.ipc,
      },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: { execArgv: ["--nolazy", "--inspect=6009"] },
      },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: "file", language: "plaintext" },
        { scheme: "file", pattern: "**/*.gm" },
      ],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher("**/*.{txt,gm}"),
      },
    };

    this.client = new LanguageClient(
      "meuLSP",
      "Meu LSP",
      serverOptions,
      clientOptions,
    );

    try {
      await this.client.start();
    } catch (err) {
      console.error("[LspPlugin] Failed to start LanguageClient:", err);
      void vscode.window.showWarningMessage(
        `Failed to start MutRoSe Language Server: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.client = undefined;
    }
  }

  public async deregister(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    await stopLanguageClientSafely(client);
  }

  public getClient(): LanguageClient | undefined {
    return this.client;
  }

  public getServerModulePath(context: vscode.ExtensionContext): string {
    return resolveServerModulePath((rel) => context.asAbsolutePath(rel));
  }
}
