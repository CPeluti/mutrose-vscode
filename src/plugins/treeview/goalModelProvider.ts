import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as gmTypes from "../../GoalModel/index";
import { GoalModel } from "./models/GoalModel";
import { Mission } from "./models/Mission";
import { Node } from "./models/Node";
import { NodeAttr } from "./models/NodeAttr";
import { NodeRefinement } from "./models/NodeRefinement";
import { Refinement } from "./models/Refinement";

// It's suposed that all goal models are inside the "gm" folder
export class GoalModelProvider implements vscode.TreeDataProvider<
  void | GoalModel | Mission | Node | NodeAttr | Refinement | NodeRefinement
>, vscode.Disposable {
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private _onDidChangeTreeData: vscode.EventEmitter<
    | void
    | GoalModel
    | Mission
    | Node
    | NodeAttr
    | NodeRefinement
    | Refinement
    | undefined
    | void
  > = new vscode.EventEmitter<
    | void
    | Mission
    | Node
    | NodeAttr
    | NodeRefinement
    | Refinement
    | undefined
    | void
  >();
  readonly onDidChangeTreeData: vscode.Event<
    | void
    | GoalModel
    | Mission
    | Node
    | NodeAttr
    | NodeRefinement
    | Refinement
    | undefined
  > = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string | undefined) {
    if (!workspaceRoot) {
      return;
    }
    const gmFolderPath = path.join(this.workspaceRoot!, "gm");
    if (this.pathExists(gmFolderPath)) {
      this.goalModels = this.getGoalModels(gmFolderPath);
    }

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot!, "gm/*.gm"),
    );
    this.fileWatcher.onDidChange(() => this.refresh());
    this.fileWatcher.onDidCreate(() => this.refresh());
    this.fileWatcher.onDidDelete(() => this.refresh());
  }

  public dispose(): void {
    this.fileWatcher?.dispose();
  }

  goalModels: GoalModel[] = [];

  getParent(
    element:
      | void
      | GoalModel
      | Mission
      | Node
      | NodeAttr
      | Refinement
      | NodeRefinement,
  ): vscode.ProviderResult<
    void | GoalModel | Mission | Node | NodeAttr | Refinement | NodeRefinement
  > {
    if (element) {
      if (element) return element.parent;
    }
  }

  public ensureGoalModelsLoaded(): GoalModel[] {
    if (this.goalModels.length === 0 && this.workspaceRoot) {
      const gmFolderPath = path.join(this.workspaceRoot, "gm");
      if (this.pathExists(gmFolderPath)) {
        this.goalModels = this.getGoalModels(gmFolderPath);
      }
    }
    return this.goalModels;
  }

  refresh(): void {
    if (this.workspaceRoot) {
      const gmFolderPath = path.join(this.workspaceRoot, "gm");
      if (this.pathExists(gmFolderPath)) {
        this.goalModels = this.getGoalModels(gmFolderPath);
      } else {
        this.goalModels = [];
      }
    } else {
      this.goalModels = [];
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Mission): vscode.TreeItem {
    return element;
  }

  findChildren(actorId: string, nodeId: string): Node | undefined {
    this.ensureGoalModelsLoaded();
    if (actorId) {
      for (const el of this.goalModels) {
        const actor = el.missions.find((a) => a.customId == actorId);
        if (actor) {
          const node = actor.nodes.find((n) => n.customId == nodeId);
          if (node) return node;
        }
      }
    }
    // Fallback: search across all missions if actorId is undefined or not found in specified actor
    for (const el of this.goalModels) {
      for (const actor of el.missions) {
        const node = actor.nodes.find((n) => n.customId == nodeId);
        if (node) return node;
      }
    }
    return undefined;
  }

  findElement(targetId: string, parentId?: string): Node | Mission | undefined {
    this.ensureGoalModelsLoaded();
    if (targetId) {
      // First try to find a Node
      const node = this.findChildren(parentId || "", targetId);
      if (node) return node;

      // If not a node, check if targetId matches a Mission (Actor)
      for (const el of this.goalModels) {
        const actor = el.missions.find((a) => a.customId == targetId);
        if (actor) return actor;
      }
    }
    return undefined;
  }

  getChildren(
    element?:
      | GoalModel
      | Mission
      | Node
      | NodeAttr
      | Refinement
      | NodeRefinement,
  ): Thenable<
    Array<GoalModel | Mission | Node | NodeAttr | Refinement | NodeRefinement>
  > {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No goal model in empty workspace");
      return Promise.resolve([]);
    }
    if (element) {
      if (element instanceof Node) {
        return Promise.resolve([...element.attributes, element.refinements]);
      } else if (element instanceof GoalModel) {
        return Promise.resolve(element.missions);
      } else if (element instanceof NodeRefinement) {
        return Promise.resolve(element.refinements);
      } else if (element instanceof Mission) {
        return Promise.resolve(element.nodes);
      } else {
        return Promise.resolve([]);
      }
      // TODO: implement goal recursive getter
      // return Promise.resolve(this.getGoalModelsInGoalModelFolder(path.join(this.workspaceRoot,'gm')));
    } else {
      this.ensureGoalModelsLoaded();
      return Promise.resolve(this.goalModels);
    }
  }
  // Should return all the missions inside a GoalModel
  // TODO: parse the goal model in a hierarchical way
  private getGoalModels(gmFolderPath: string): GoalModel[] {
    const workspaceRoot = this.workspaceRoot;
    if (this.pathExists(gmFolderPath) && workspaceRoot) {
      let gmList = fs.readdirSync(gmFolderPath);
      gmList = gmList.filter((gm) => gm.endsWith(".gm"));

      const gms: { gm: string; filePath: string }[] = gmList.map((gm) => {
        const filePath = path.join(gmFolderPath, gm);
        const openDoc = vscode.workspace.textDocuments.find(
          (d) => d.uri.fsPath === filePath,
        );
        return {
          gm: openDoc ? openDoc.getText() : fs.readFileSync(filePath, "utf-8"),
          filePath: filePath,
        };
      });
      const parsedGMs: { gm: gmTypes.GoalModel; filePath: string }[] = [];
      for (const { gm, filePath } of gms) {
        try {
          const res = JSON.parse(gm);
          parsedGMs.push({ gm: res as gmTypes.GoalModel, filePath });
        } catch (e) {
          console.error(`Error parsing ${filePath}:`, e);
        }
      }
      const goalModels = parsedGMs.map(
        (gm: { gm: gmTypes.GoalModel; filePath: string }) => {
          const gmName = gm.filePath.replace(/(^.*[\\/])|(\.gm)/gi, "");
          const goalModel = new GoalModel(
            gmName,
            vscode.TreeItemCollapsibleState.Collapsed,
            gm.gm,
            gm.filePath,
          );
          return goalModel;
        },
      );
      return goalModels;
    }
    return [];
  }
  // Check if path exists
  private pathExists(path: string): boolean {
    try {
      fs.accessSync(path);
    } catch (err) {
      return false;
    }
    return true;
  }
}
