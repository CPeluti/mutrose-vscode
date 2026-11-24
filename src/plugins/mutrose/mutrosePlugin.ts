import * as fs from "fs";
import * as vscode from "vscode";
import { GoalModel } from "../../goalModel";
import { getMutroseBinaryPath } from "../../utilities/mutroseBinary";
import { PluginInterface } from "../pluginInterface";
import { MutroseMode, runMutroseBinary } from "./mutroseRunner";

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
    this.runCommand(
      element,
      context,
      "-p",
      "Goal Model Decomposition generated with success!",
    );
  }

  /**
   * Executes MutRoSe to generate the iHTN (-h).
   */
  public generateIhtn(
    element: GoalModel,
    context: vscode.ExtensionContext,
  ): void {
    this.runCommand(
      element,
      context,
      "-h",
      "iHTNs generated with success!",
    );
  }

  private runCommand(
    element: GoalModel,
    context: vscode.ExtensionContext,
    mode: MutroseMode,
    successMessage: string,
  ): void {
    const showInfo = vscode.window.showInformationMessage;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      showInfo("No workspace folder open!");
      return;
    }

    if (!element?.filePath || !fs.existsSync(element.filePath)) {
      showInfo("Goal model file doesn't exist!");
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

    const hddlPath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      cfg.hddlPath,
    ).fsPath;
    const configPath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      cfg.configPath,
    ).fsPath;

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

    runMutroseBinary(
      {
        binaryPath: mutroseRes.binaryPath,
        hddlPath,
        goalModelPath: element.filePath,
        configPath,
        mode,
        cwd: workspaceFolder.uri.fsPath,
      },
      (error, stdout) => {
        if (error) {
          showInfo(`Error: ${error}`);
          console.error(error);
        } else {
          showInfo(successMessage);
          const channel =
            this.outputChannel ?? vscode.window.createOutputChannel("Mutrose");
          channel.append(stdout);
          channel.show();
        }
      },
    );
  }
}
