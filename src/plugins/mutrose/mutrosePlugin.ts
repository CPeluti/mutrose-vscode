import * as child_process from "child_process";
import * as fs from "fs";
import * as vscode from "vscode";
import { GoalModel } from "../../goalModel";
import { getMutroseBinaryPath } from "../../utilities/mutroseBinary";
import { PluginInterface } from "../pluginInterface";

export class MutrosePlugin implements PluginInterface {
  public readonly name = "mutrose";
  private outputChannel?: vscode.OutputChannel;
  private disposables: vscode.Disposable[] = [];

  public register(context: vscode.ExtensionContext): void {
    this.outputChannel = vscode.window.createOutputChannel("Mutrose");
    this.disposables.push(this.outputChannel);

    this.registerCommands(context);

    this.disposables.forEach((d) => context.subscriptions.push(d));
  }

  public deregister(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.outputChannel = undefined;
  }

  public getOutputChannel(): vscode.OutputChannel | undefined {
    return this.outputChannel;
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.execMutRose",
        (element: GoalModel) => {
          this.executeMutRose(element, context);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.generateIhtn",
        (element: GoalModel) => {
          this.generateIhtn(element, context);
        },
      ),
    );
  }

  /**
   * Executes MutRoSe to generate the Goal Model Decomposition (-p).
   */
  public executeMutRose(
    element: GoalModel,
    context: vscode.ExtensionContext,
  ): void {
    const showInfo = vscode.window.showInformationMessage;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      showInfo("No workspace folder open!");
      return;
    }

    const cfg: { hddlPath: string; configPath: string } | undefined =
      vscode.workspace.getConfiguration().get("gmParser");

    if (!cfg?.hddlPath || !cfg?.configPath) {
      showInfo(
        "Please configure gmParser.hddlPath and gmParser.configPath in settings.json",
      );
      return;
    }

    const hddlPath = vscode.Uri.joinPath(workspaceFolder.uri, cfg.hddlPath).path;
    const configPath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      cfg.configPath,
    ).path;

    if (!fs.existsSync(hddlPath)) {
      showInfo("hddl file doesn't exists!");
      return;
    } else if (!fs.existsSync(configPath)) {
      showInfo("config file doesn't exists");
      return;
    }

    const mutroseRes = getMutroseBinaryPath(context);
    if (mutroseRes.error) {
      showInfo(mutroseRes.error);
      return;
    }

    child_process.exec(
      `"${mutroseRes.binaryPath}" ${cfg.hddlPath} ${element.filePath} ${cfg.configPath} -p`,
      { cwd: workspaceFolder.uri.path },
      (error, stdout, stderr) => {
        if (error) {
          showInfo(`Error: ${error}`);
          console.error(error);
        } else {
          showInfo(`Goal Model Decomposition generated with success!`);
          const channel = this.outputChannel ?? vscode.window.createOutputChannel("Mutrose");
          channel.append(stdout);
          channel.show();
        }
      },
    );
  }

  /**
   * Executes MutRoSe to generate the iHTN (-h).
   */
  public generateIhtn(
    element: GoalModel,
    context: vscode.ExtensionContext,
  ): void {
    const showInfo = vscode.window.showInformationMessage;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      showInfo("No workspace folder open!");
      return;
    }

    const cfg: { hddlPath: string; configPath: string } | undefined =
      vscode.workspace.getConfiguration().get("gmParser");

    if (!cfg?.hddlPath || !cfg?.configPath) {
      showInfo(
        "Please configure gmParser.hddlPath and gmParser.configPath in settings.json",
      );
      return;
    }

    const hddlPath = vscode.Uri.joinPath(workspaceFolder.uri, cfg.hddlPath).path;
    const configPath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      cfg.configPath,
    ).path;

    if (!fs.existsSync(hddlPath)) {
      showInfo("hddl file doesn't exists!");
      return;
    } else if (!fs.existsSync(configPath)) {
      showInfo("config file doesn't exists");
      return;
    }

    const mutroseRes = getMutroseBinaryPath(context);
    if (mutroseRes.error) {
      showInfo(mutroseRes.error);
      return;
    }

    const command = `"${mutroseRes.binaryPath}" ${cfg.hddlPath} ${element.filePath} ${cfg.configPath} -h`;
    child_process.exec(
      command,
      { cwd: workspaceFolder.uri.path },
      (error, stdout, stderr) => {
        if (error) {
          showInfo(`Error: ${error}`);
          console.log(error, stdout);
        } else {
          showInfo(`iHTNs generated with success!`);
          const channel = this.outputChannel ?? vscode.window.createOutputChannel("Mutrose");
          channel.append(stdout);
          channel.show();
        }
      },
    );
  }
}
