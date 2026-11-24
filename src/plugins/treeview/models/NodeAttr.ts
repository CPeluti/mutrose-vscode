import * as vscode from "vscode";
import type { Node } from "./Node";

export class NodeAttr extends vscode.TreeItem {
  contextValue = "attribute";
  constructor(
    public readonly attrName: string,
    public readonly attrValue: string,
    public readonly custom: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly parent: Node,
    public readonly command?: vscode.Command,
  ) {
    super(attrValue === "" ? '""' : attrValue, collapsibleState);
    this.tooltip = `${this.attrName}-${this.attrValue}`;
    this.description = attrName;
  }
}
