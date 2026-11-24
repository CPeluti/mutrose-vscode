import * as vscode from "vscode";
import * as gmTypes from "../../../GoalModel/index";
import type { NodeRefinement } from "./NodeRefinement";

export class Refinement extends vscode.TreeItem {
  contextValue = "refinement";
  public readonly sourceId: string;
  public readonly tag;
  public readonly customId: string;

  constructor(
    private readonly info: { tag: string; customId: string; linkId: string },
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly parent: NodeRefinement,
    public readonly command?: vscode.Command,
  ) {
    super(info.tag, collapsibleState);
    this.tooltip = `${info.tag}`;
    this.sourceId = info.customId;
    this.customId = info.linkId;
    //think a way to reduce this type of thing
    this.parent.parent.parent.parent.usedIds.add(this.customId);
  }
  parseLink(
    target: string,
    type: "istar.AndRefinementLink" | "istar.OrRefinementLink",
  ): gmTypes.Link {
    return {
      source: this.sourceId,
      target: target,
      id: this.customId,
      type,
    };
  }
}
