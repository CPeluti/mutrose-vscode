import * as vscode from "vscode";
import * as gmTypes from "../../../GoalModel/index";
import type { Mission } from "./Mission";
import { NodeAttr } from "./NodeAttr";
import { NodeRefinement } from "./NodeRefinement";

export class Node extends vscode.TreeItem {
  contextValue = "node";
  refinements: NodeRefinement;
  constructor(
    public name: string,
    public attributes: NodeAttr[],
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public tag: string,
    public readonly nodeType: string,
    public readonly parent: Mission,
    public readonly customId: string,
    public pos: { x: number; y: number },
    public runtimeAnnotation: string,
    public readonly command?: vscode.Command,
  ) {
    super(name, collapsibleState);
    this.tooltip = `${this.tag}-${this.name}`;
    this.parent.parent.usedIds.add(this.customId);
    this.setRuntimeAnnotation(runtimeAnnotation);
    // this.tag += `[${this.runtimeAnnotation}]`;
  }
  parseNode(): gmTypes.Node {
    const customProperties: Record<string, string> = this.attributes
      .filter((el) => el.custom == true)
      .reduce((acc, el) => {
        acc[el.attrName] = el.attrValue;
        return acc;
      }, {});
    this.setRuntimeAnnotation(this.runtimeAnnotation);
    return {
      id: this.customId,
      text: `${this.name}: ${this.description}`,
      x: this.pos.x,
      y: this.pos.y,
      type: `istar.${this.nodeType}` as gmTypes.NodeType,
      customProperties: customProperties,
    };
  }
  setAttribute(name: string, value: string): void {
    const existing = this.attributes.find(
      (a) => a.custom && a.attrName.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      (existing as any).attrValue = value;
      existing.label = value === "" ? '""' : value;
      existing.tooltip = `${existing.attrName}-${value}`;
    } else {
      const newAttr = new NodeAttr(
        name,
        value,
        true,
        vscode.TreeItemCollapsibleState.None,
        this,
      );
      this.attributes.push(newAttr);
    }
  }
  addAttribute(tag: string, value: string) {
    this.setAttribute(tag, value);
    return this.parent.parent.saveGoalModel();
  }
  removeAttribute(tag: string | NodeAttr) {
    this.attributes = this.attributes.filter((attr) => {
      if (typeof tag === "string") {
        return attr.attrName.toLowerCase() !== tag.toLowerCase();
      }
      return attr !== tag;
    });
    return this.parent.parent.saveGoalModel();
  }
  getRefinements() {
    const links = this.parent.parent.links.filter(
      (link) => link.target === this.customId,
    );
    if (links.length) {
      const type = links[0].type;
      const aux = links.map((link) => {
        return {
          customId: link.source,
          tag: this.parent.nodes.find((n) => link.source === n.customId).name,
          linkId: link.id,
        };
      });
      this.refinements = new NodeRefinement(
        type,
        aux,
        vscode.TreeItemCollapsibleState.Collapsed,
        this,
      );
    }
  }
  setRuntimeAnnotation(annotation: string) {
    this.runtimeAnnotation = annotation;
    this.description =
      this.tag.trim() +
      (this.runtimeAnnotation != "" ? ` [${this.runtimeAnnotation}]` : "");
    return;
  }
  remove() {
    this.parent.deleteNode(this);
  }
  setCollapsableState(newState: vscode.TreeItemCollapsibleState) {
    this.collapsibleState = newState;
  }
}
