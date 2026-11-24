import * as vscode from "vscode";
import * as gmTypes from "../../../GoalModel/index";
import type { GoalModel } from "./GoalModel";
import { Node } from "./Node";
import { NodeAttr } from "./NodeAttr";

export class Mission extends vscode.TreeItem {
  contextValue = "mission";
  public nodes: Node[];
  lastGoalNumber = 0;
  lastTaskNumber = 0;
  constructor(
    public name: string,
    private readonly missionNumber: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly customId: string,
    public readonly parent: GoalModel,
    private nodesToInstatiate: gmTypes.Node[],
    public pos: { x: number; y: number },
    public readonly customProperties: Record<string, string>,
    public readonly command?: vscode.Command,
  ) {
    super(name, collapsibleState);
    this.tooltip = `${missionNumber}-${this.name}`;
    this.description = this.customProperties.description;

    const nodes = nodesToInstatiate.map((node) => {
      let [name, tag] = node.text.split(": ");
      if (!name || !tag) {
        // throw new Error("invalid node name");
        name = "";
        tag = node.text;
      }
      const number = parseInt(name.replace(/[a-zA-Z]/g, ""));
      if (name.startsWith("AT")) {
        this.lastTaskNumber = Math.max(this.lastTaskNumber, number);
      } else {
        this.lastGoalNumber = Math.max(this.lastGoalNumber, number);
      }
      const runtimeAnnotationCheck = tag?.match(
        /(?<=\[)[a-zA-Z\d,|#|;?]*(?=\])/g,
      );
      const newTag = tag.replace(/\[[a-zA-Z\d,|#|;?]*\]/g, "");
      const nodeInst = new Node(
        name,
        [],
        vscode.TreeItemCollapsibleState.Collapsed,
        newTag,
        name.startsWith("AT") ? "Task" : "Goal",
        this,
        node.id,
        { x: node.x, y: node.y },
        runtimeAnnotationCheck ? runtimeAnnotationCheck[0] : "",
      );
      let customProperties = [];
      if (node.customProperties)
        customProperties = Object.keys(node.customProperties).map((key) => {
          return new NodeAttr(
            key,
            node.customProperties[key],
            true,
            vscode.TreeItemCollapsibleState.None,
            nodeInst,
          );
        });
      const attributes = [
        ...customProperties,
        new NodeAttr(
          "type",
          node.type,
          false,
          vscode.TreeItemCollapsibleState.None,
          nodeInst,
        ),
      ];

      nodeInst.attributes = attributes;
      return nodeInst;
    });
    this.parent.usedIds.add(this.customId);
    this.nodes = nodes;
    this.nodes.forEach((node) => node.getRefinements());
  }
  getLinks(): gmTypes.Link[] {
    const links = [];
    this.nodes.forEach((node) => {
      if (node.refinements) {
        links.push(node.refinements.parseRefinements());
      }
    });
    return links;
  }
  parseToActor(): gmTypes.Actor {
    const actor: gmTypes.Actor = {} as gmTypes.Actor;
    actor.customProperties = this.customProperties;
    actor.id = this.customId;
    actor.nodes = this.parseNodes();
    actor.text = `${this.missionNumber}: ${this.name}`;
    actor.type = "istar.Actor";
    actor.x = this.pos.x;
    actor.y = this.pos.y;
    return actor;
  }
  parseNodes(): gmTypes.Node[] {
    return this.nodes.map((node) => node.parseNode());
  }
  addNewNode(type: "Task" | "Goal", title: string) {
    const name =
      type === "Task" ? `AT${this.lastTaskNumber}` : `G${this.lastGoalNumber}`;
    const nodeInst = new Node(
      name,
      [],
      vscode.TreeItemCollapsibleState.Collapsed,
      title,
      type,
      this,
      this.parent.generateNewId().toString(),
      { x: 0, y: 0 },
      "",
    );
    nodeInst.addAttribute("Description", "");
    this.addNode(nodeInst);
  }
  deleteNode(node: Node) {
    this.nodes.forEach((n) => {
      if (n.refinements) {
        n.refinements.refinements = n.refinements.refinements.filter(
          (r) => r.sourceId !== node.customId,
        );
      }
    });
    this.nodes = this.nodes.filter((el) => el !== node);
  }
  addNode(node: Node) {
    this.nodes.push(node);
  }
  setNodes(nodes: Node[]) {
    this.nodes = nodes;
  }
}
