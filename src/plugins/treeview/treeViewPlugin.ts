import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  GoalModelProvider,
  Mission,
  Node,
  NodeAttr,
  NodeRefinement,
  Refinement,
} from "../../goalModel";
import {
  pickNodeFromQuickPick,
  promptAndSetPropertyValue,
  runEditNodeLoop,
} from "../../utilities/nodePropertyEditor";
import { PluginInterface } from "../pluginInterface";

export class TreeViewPlugin implements PluginInterface {
  public readonly name = "treeview";
  private provider?: GoalModelProvider;
  private treeView?: vscode.TreeView<any>;
  private disposables: vscode.Disposable[] = [];

  public register(context: vscode.ExtensionContext): void {
    const rootPath =
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

    this.provider = new GoalModelProvider(rootPath);
    this.treeView = vscode.window.createTreeView("goalModel", {
      treeDataProvider: this.provider,
    });

    this.disposables.push(this.provider);
    this.disposables.push(this.treeView);

    this.registerCommands(context);

    this.disposables.forEach((d) => context.subscriptions.push(d));
  }

  public deregister(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.provider = undefined;
    this.treeView = undefined;
  }

  public getProvider(): GoalModelProvider | undefined {
    return this.provider;
  }

  public getTreeView(): vscode.TreeView<any> | undefined {
    return this.treeView;
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    this.disposables.push(
      vscode.commands.registerCommand("goalModel.refreshModels", () => {
        this.refresh();
      }),
    );

    this.disposables.push(
      vscode.commands.registerCommand("goalModel.createNewMission", () => {
        return this.createNewMission();
      }),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.rename",
        (element: Mission | Node) => {
          return this.rename(element);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand("goalModel.addNode", (element: any) => {
        return this.addNode(element);
      }),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.changeRefinementType",
        (element: NodeRefinement) => {
          return this.changeRefinementType(element);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.setRuntimeAnnotation",
        (element: Node) => {
          return this.setRuntimeAnnotation(element);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.editNode",
        (element?: Node) => {
          return this.editNode(element);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.addProperty",
        (element?: Node) => {
          return this.addProperty(element);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.editProperty",
        (element?: NodeAttr | Node) => {
          return this.editProperty(element);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand("goalModel.deleteNode", (element: any) => {
        return this.deleteNode(element);
      }),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.focusElement",
        (targetId: string, parentId?: string) => {
          return this.focusElement(targetId, parentId);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.deleteProperty",
        (element: any) => {
          return this.deleteProperty(element);
        },
      ),
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "goalModel.deleteRefinement",
        (element: Refinement) => {
          return this.deleteRefinement(element);
        },
      ),
    );
  }

  public refresh(): void {
    this.provider?.refresh();
  }

  public async createNewMission(): Promise<void> {
    const rootPath =
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

    if (!rootPath) {
      vscode.window.showErrorMessage(
        "No workspace folder found. Please open a workspace to create a mission.",
      );
      return;
    }

    const gmFolderPath = path.join(rootPath, "gm");
    if (!fs.existsSync(gmFolderPath)) {
      fs.mkdirSync(gmFolderPath, { recursive: true });
    }

    // Determines the next mission number (M1, M2, etc.) by scanning existing .gm files
    let nextMissionNum = 1;
    try {
      const existingFiles = fs
        .readdirSync(gmFolderPath)
        .filter((f) => f.endsWith(".gm"));
      for (const file of existingFiles) {
        try {
          const raw = fs.readFileSync(path.join(gmFolderPath, file), "utf-8");
          const parsed = JSON.parse(raw);
          for (const actor of parsed.actors || []) {
            const match = (actor.text || "").match(/^M(\d+)/i);
            if (match) {
              nextMissionNum = Math.max(
                nextMissionNum,
                parseInt(match[1], 10) + 1,
              );
            }
          }
        } catch {
          // Ignore malformed files
        }
      }
    } catch (err) {
      console.error("Error reading gm folder:", err);
    }

    const missionInput = await vscode.window.showInputBox({
      prompt: "Enter mission name",
      placeHolder: `e.g. Lab Samples Logistics (will be created as M${nextMissionNum}: Lab Samples Logistics)`,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Mission name cannot be empty.";
        }
        return null;
      },
    });

    if (!missionInput) {
      return;
    }

    const rawName = missionInput.trim();
    const hasPrefix = /^M\d+:\s*/i.test(rawName);
    const missionTag = hasPrefix ? rawName : `M${nextMissionNum}: ${rawName}`;
    const cleanName = hasPrefix ? rawName.replace(/^M\d+:\s*/i, "") : rawName;

    let fileBaseName = cleanName
      .replace(/[^\w\s-]/g, "")
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");

    if (!fileBaseName) {
      fileBaseName = `Mission${nextMissionNum}`;
    }

    let fileName = `${fileBaseName}.gm`;
    let targetPath = path.join(gmFolderPath, fileName);

    let counter = 1;
    while (fs.existsSync(targetPath)) {
      fileName = `${fileBaseName}_${counter}.gm`;
      targetPath = path.join(gmFolderPath, fileName);
      counter++;
    }

    const actorId = crypto.randomUUID();
    const newGmContent = {
      actors: [
        {
          id: actorId,
          text: missionTag,
          type: "istar.Actor",
          x: 300,
          y: 80,
          customProperties: {
            Description: "",
          },
          nodes: [],
        },
      ],
      orphans: [],
      dependencies: [],
      links: [],
      display: {},
      tool: "custom",
      istar: "2.0",
      saveDate: new Date().toUTCString(),
      diagram: {
        width: 2000,
        height: 1300,
        name: cleanName,
        customProperties: {
          Description: "",
        },
      },
    };

    try {
      fs.writeFileSync(
        targetPath,
        JSON.stringify(newGmContent, null, 2),
        "utf-8",
      );
      this.refresh();
      vscode.window.showInformationMessage(
        `Mission "${missionTag}" created in gm/${fileName}`,
      );

      const fileUri = vscode.Uri.file(targetPath);
      await vscode.commands.executeCommand(
        "vscode.openWith",
        fileUri,
        "mutrose.gmEditor",
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to create mission file: ${String(err)}`,
      );
      console.error(err);
    }
  }

  public async rename(element: Mission | Node): Promise<void> {
    const newName = await vscode.window.showInputBox({
      placeHolder: "Type new name",
      prompt: `Rename selected ${element instanceof Mission ? "Mission" : "Node"}`,
      value: `${element instanceof Mission ? element.name : element.tag}`,
    });
    if (!newName) {
      return;
    }
    if (element instanceof Mission) {
      element.name = newName;
      await element.parent.saveGoalModel();
    } else {
      element.tag = newName;
      await element.parent.parent.saveGoalModel();
    }
  }

  public async addNode(element: any): Promise<void> {
    const items: vscode.QuickPickItem[] = [
      {
        label: "Goal",
        description: "goal",
      },
      {
        label: "Task",
        description: "Task",
      },
    ];
    try {
      const type = await vscode.window.showQuickPick(items);
      if (!type) return;
      const title = await vscode.window.showInputBox({
        placeHolder: "Type node title",
        prompt: "Node Title",
        value: "",
      });
      if (title === undefined) return;
      element.addNewNode(type.label, title);
      await element.parent.saveGoalModel();
    } catch (e) {
      console.error(e, "erro ao adicionar property");
    }
  }

  public async changeRefinementType(element: NodeRefinement): Promise<void> {
    try {
      const selected = await vscode.window.showQuickPick([
        { label: "And", description: "And Refinement" },
        { label: "Or", description: "Or Refinement" },
      ]);
      if (!selected) return;
      element.changeRefinementType(
        selected.label === "And"
          ? "istar.AndRefinementLink"
          : "istar.OrRefinementLink",
      );
      await element.parent.parent.parent.saveGoalModel();
    } catch (e) {
      console.error("failed to change node refinement", e);
    }
  }

  public async setRuntimeAnnotation(element: Node): Promise<void> {
    try {
      const input = await vscode.window.showInputBox({
        placeHolder: "Type the runtime annotation",
        prompt: "Set the runtime annotation",
        value: element.runtimeAnnotation ? element.runtimeAnnotation : "",
      });
      if (input) {
        element.setRuntimeAnnotation(input);
        await element.parent.parent.saveGoalModel();
      }
    } catch (e) {
      console.error("failed to change node refinement", e);
    }
  }

  public async editNode(element?: Node): Promise<void> {
    let node = element;
    if (!node) {
      if (!this.provider) return;
      node = await pickNodeFromQuickPick(this.provider);
      if (!node) return;
    }
    await runEditNodeLoop(node);
  }

  public async addProperty(element?: Node): Promise<void> {
    let node = element;
    if (!node) {
      if (!this.provider) return;
      node = await pickNodeFromQuickPick(this.provider);
      if (!node) return;
    }
    await runEditNodeLoop(node);
  }

  public async editProperty(element?: NodeAttr | Node): Promise<void> {
    let node: Node | undefined;
    let attr: NodeAttr | undefined;
    if (element instanceof NodeAttr) {
      attr = element;
      node = element.parent;
    } else if (element instanceof Node) {
      node = element;
    } else {
      if (!this.provider) return;
      node = await pickNodeFromQuickPick(this.provider);
      if (!node) return;
    }
    if (attr) {
      await promptAndSetPropertyValue(node, attr.attrName, attr.attrValue);
    } else {
      await runEditNodeLoop(node);
    }
  }

  public async deleteNode(element: any): Promise<void> {
    element.remove();
    await element.parent.parent.saveGoalModel();
  }

  public async focusElement(targetId: string, parentId?: string): Promise<void> {
    if (!this.provider || !this.treeView) return;
    const element =
      this.provider.findElement?.(targetId, parentId) ??
      this.provider.findChildren(parentId ?? "", targetId);
    if (element) {
      try {
        await this.treeView.reveal(element, {
          select: true,
          focus: true,
          expand: true,
        });
      } catch (err) {
        console.error("Failed to reveal element in tree view:", err);
      }
    }
  }

  public async deleteProperty(element: any): Promise<void> {
    await element.parent.removeAttribute(element);
  }

  public async deleteRefinement(element: Refinement): Promise<void> {
    element.parent.removeRefinement(element);
    await element.parent.parent.parent.parent.saveGoalModel();
  }
}
