import * as fs from "fs";
import * as vscode from "vscode";
import * as gmTypes from "../../../GoalModel/index";
import { Mission } from "./Mission";

export class GoalModel extends vscode.TreeItem {
  public parent = undefined;
  contextValue = "goalModel";
  public usedIds = new Set<string>();
  public actors: gmTypes.Actor[];
  public missions: Mission[];
  public orphans: any[];
  public dependencies: any[];
  public links: gmTypes.Link[];
  public display: gmTypes.Display;
  public tool: string;
  public istar: string;
  public saveDate: Date;
  public diagram: gmTypes.Diagram;
  constructor(
    public readonly name: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    gm: gmTypes.GoalModel,
    public readonly filePath: string,
  ) {
    super(name, collapsibleState);
    this.tooltip = `${this.name}`;
    this.description = this.filePath;
    this.actors = gm.actors;
    this.links = gm.links;
    this.display = gm.display;
    this.tool = gm.tool;
    this.istar = gm.istar;
    this.saveDate = gm.saveDate;
    this.diagram = gm.diagram;
    this.orphans = gm.orphans || [];
    this.dependencies = gm.dependencies || [];

    const actors = gm.actors;
    const info = actors.map((actor) => {
      const parsedText = actor.text.split(": ");
      let name = actor.text;
      if (parsedText.length >= 2) {
        name = parsedText[1];
      }
      return {
        name: name,
        missionNumber: parsedText[0],
        id: actor.id,
        nodes: actor.nodes,
        pos: { x: actor.x, y: actor.y },
        customProperties: actor.customProperties,
      };
    });
    this.missions = info.map(
      (info) =>
        new Mission(
          info.name,
          info.missionNumber,
          vscode.TreeItemCollapsibleState.Collapsed,
          info.id,
          this,
          info.nodes,
          info.pos,
          info.customProperties,
        ),
    );
  }
  parseMissions(): gmTypes.Actor[] {
    return this.missions.map((mission) => mission.parseToActor());
  }
  parseLinks() {
    return this.missions
      .map((mission) => mission.getLinks())
      .flat(Infinity) as gmTypes.Link[];
  }
  parseToGm(): gmTypes.GoalModel {
    return {
      actors: this.parseMissions(),
      orphans: this.orphans as never,
      dependencies: this.dependencies as never,
      links: this.parseLinks(),
      display: this.display,
      tool: this.tool,
      istar: this.istar,
      saveDate: this.saveDate,
      diagram: this.diagram,
    };
  }
  public async saveGoalModel(): Promise<void> {
    const gm = this.parseToGm();
    const json = JSON.stringify(gm, null, 2);
    const uri = vscode.Uri.file(this.filePath);

    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        doc.uri,
        new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        ),
        json,
      );
      const applied = await vscode.workspace.applyEdit(edit);
      if (applied) {
        await doc.save();
        return;
      }
    } catch (e) {
      console.error("Error saving goal model via WorkspaceEdit:", e);
    }
    fs.writeFileSync(this.filePath, json, "utf-8");
  }
  generateNewId() {
    let id = 1;
    this.usedIds.forEach((el) => {
      const parsedId = Number(el);
      if (!isNaN(parsedId) && parsedId >= id) {
        id = parsedId + 1;
      }
    });
    this.usedIds.add(id.toString());
    return id;
  }
}
