import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { PluginInterface } from "../pluginInterface";

export class LspPlugin implements PluginInterface {
  public readonly name = "lsp";
  private client?: LanguageClient;

  public async register(context: vscode.ExtensionContext): Promise<void> {
    const serverModule = this.getServerModulePath(context);

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

    await this.client.start();
  }

  public async deregister(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = undefined;
    }
  }

  public getClient(): LanguageClient | undefined {
    return this.client;
  }

  public getServerModulePath(context: vscode.ExtensionContext): string {
    return context.asAbsolutePath(
      path.join(
        "src",
        "plugins",
        "lsp",
        "lsp-mutrose",
        "server",
        "out",
        "server.js",
      ),
    );
  }
}
