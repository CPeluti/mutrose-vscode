import * as vscode from "vscode";
import * as gmTypes from "../../../GoalModel/index";
import type { Node } from "./Node";
import { Refinement } from "./Refinement";

export class NodeRefinement extends vscode.TreeItem {
  contextValue = "refinements";
  public refinements: Refinement[] = [];
  constructor(
    public type: "istar.AndRefinementLink" | "istar.OrRefinementLink",
    public refinementsToInstantiate: Array<{
      tag: string;
      customId: string;
      linkId: string;
    }>,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly parent: Node,
    public readonly command?: vscode.Command,
  ) {
    super("Refinements", collapsibleState);
    this.tooltip = "Refinements";
    this.description = `type ${type}`;
    this.refinements = refinementsToInstantiate.map((refinement) => {
      return new Refinement(
        refinement,
        vscode.TreeItemCollapsibleState.None,
        this,
      );
    });
  }
  parseRefinements(): gmTypes.Link[] {
    return this.refinements.map((r) =>
      r.parseLink(this.parent.customId, this.type),
    );
  }
  removeRefinement(refinement: Refinement) {
    this.refinements = this.refinements.filter((e) => e != refinement);
  }
  changeRefinementType(
    newRefinementType: "istar.AndRefinementLink" | "istar.OrRefinementLink",
  ) {
    if (this.type != newRefinementType) {
      this.type = newRefinementType;
    }
  }
}
