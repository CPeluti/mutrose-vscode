// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import * as child_process from "child_process";
import {
  GoalModel,
  GoalModelProvider,
  Mission,
  Node,
  NodeAttr,
  NodeRefinement,
  Refinement,
} from "./goalModel";
import { getAllProperties } from "./utilities/getAllProperties";
import {
  pickNodeFromQuickPick,
  promptAndSetPropertyValue,
  runEditNodeLoop,
} from "./utilities/nodePropertyEditor";
import { cwd } from "process";
import { CustomEditorProvider } from "./customEditor";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { workspace } from "vscode";

let client: LanguageClient;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  const serverModule = context.asAbsolutePath(
    path.join("src", "lsp", "lsp-mutrose", "server", "out", "server.js"),
  );
  console.log(
    path.join("src", "lsp", "lsp-mutrose", "server", "out", "server.js"),
  );

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "plaintext" },
      { scheme: "file", pattern: "**/*.gm" },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.{txt,gm}"),
    },
  };

  client = new LanguageClient(
    "meuLSP",
    "Meu LSP",
    serverOptions,
    clientOptions,
  );
  client.start();
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "gm-parser" is now active!');

  const debugOptions = {};

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json

  const rootPath =
    vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  const gmProvider = new GoalModelProvider(rootPath);
  const treeView = vscode.window.createTreeView("goalModel", {
    treeDataProvider: gmProvider,
  });

  // vscode.window.registerTreeDataProvider('goalModel', gmProvider);

  context.subscriptions.push(CustomEditorProvider.register(context));

  const commands: Array<vscode.Disposable> = [];

  commands.push(
    vscode.commands.registerCommand("goalModel.refreshModels", () => {
      gmProvider.refresh();
    }),
  );
  // const provider = new GoalModelProvider(context.extensionUri, rootPath);

  // context.subscriptions.push(
  // 	vscode.window.registerWebviewViewProvider(GoalModelProvider.viewType, provider)
  // );

  // execute mutrose command
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.execMutRose",
      (element: GoalModel) => {
        const cfg: { hddlPath: string; configPath: string } | undefined =
          vscode.workspace.getConfiguration().get("gmParser");
        const showInfo = vscode.window.showInformationMessage;
        const hddlPath = vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders![0].uri,
          cfg!.hddlPath,
        ).path;
        const configPath = vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders![0].uri,
          cfg!.configPath,
        ).path;
        if (!fs.existsSync(hddlPath)) {
          showInfo("hddl file doesn't exists!");
          return;
        } else if (!fs.existsSync(configPath)) {
          showInfo("config file doesn't exists");
          return;
        }
        child_process.exec(
          `${vscode.Uri.joinPath(context.extensionUri, "binaries", "mutrose").path} ${cfg!.hddlPath} ${element.filePath} ${cfg!.configPath} -p`,
          { cwd: vscode.workspace.workspaceFolders![0].uri.path },
          (error, stdout, stderr) => {
            if (error) {
              showInfo(`Error: ${error}`);
              console.error(error);
            } else {
              showInfo(`Goal Model Decomposition generated with success!`);
              const mutrose = vscode.window.createOutputChannel("Mutrose");
              mutrose.append(stdout);
              mutrose.show();
            }
            // fs.unlinkSync('./temp.txt');
          },
        );
        // const terminal = vscode.window.createTerminal(`Ext Terminal #1`);
        // terminal.sendText("touch test.txt");
        // terminal.dispose();
      },
    ),
  );

  commands.push(
    vscode.commands.registerCommand("goalModel.generateIhtn", (element) => {
      const cfg: { hddlPath: string; configPath: string } | undefined =
        vscode.workspace.getConfiguration().get("gmParser");
      const showInfo = vscode.window.showInformationMessage;
      const hddlPath: string | undefined = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        cfg!.hddlPath,
      ).path;
      const configPath: string | undefined = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        cfg!.configPath,
      ).path;
      if (!fs.existsSync(hddlPath)) {
        showInfo("hddl file doesn't exists!");
        return;
      } else if (!fs.existsSync(configPath)) {
        showInfo("config file doesn't exists");
        return;
      }
      const command = `${vscode.Uri.joinPath(context.extensionUri, "binaries", "mutrose").path} ${cfg?.hddlPath} ${element.filePath} ${cfg?.configPath} -h`;
      child_process.exec(
        command,
        { cwd: vscode.workspace.workspaceFolders![0].uri.path },
        (error, stdout, stderr) => {
          if (error) {
            showInfo(`Error: ${error}`);
            console.log(error, stdout);
          } else {
            showInfo(`iHTNs generated with success!`);
            const mutrose = vscode.window.createOutputChannel("Mutrose");
            mutrose.append(stdout);
            mutrose.show();
            const ihtnPath = vscode.Uri.joinPath(
              vscode.workspace.workspaceFolders![0].uri,
              "ihtn",
            ).path;
            const ihtns = fs.readdirSync(ihtnPath);
            ihtns.forEach((el) => {
              child_process.exec(
                `python3 ${vscode.Uri.joinPath(context.extensionUri, "binaries", "generateIhtnImage.py").path} ${el}`,
                { cwd: ihtnPath },
                (error, stdout, stderr) => {
                  if (error) {
                    showInfo(`Error: ${error}`);
                    console.error(error);
                  } else {
                    showInfo(`iHtn image generated with success!`);
                  }
                },
              );
            });
          }
          // fs.unlinkSync('./temp.txt');
        },
      );
      // const terminal = vscode.window.createTerminal(`Ext Terminal #1`);
      // terminal.sendText("touch test.txt");
      // terminal.dispose();
    }),
  );
  // create new mission command
  commands.push(
    vscode.commands.registerCommand("goalModel.createNewMission", () => {
      console.log("TODO");
    }),
  );

  // rename mission command
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.rename",
      async (element: Mission | Node) => {
        const newName = await vscode.window.showInputBox({
          placeHolder: "Type new name",
          prompt: `Rename selected ${element instanceof Mission ? "Mission" : "Node"}`,
          value: `${element instanceof Mission ? element.name : element.tag}`,
        });
        if (element instanceof Mission) {
          element.name = newName!;
          element.parent.saveGoalModel();
        } else {
          element.tag = newName!;
          element.parent.parent.saveGoalModel();
        }
      },
    ),
  );

  // add node to mission command

  commands.push(
    vscode.commands.registerCommand("goalModel.addNode", async (element) => {
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
        const title = await vscode.window.showInputBox({
          placeHolder: "Type node title",
          prompt: "Node Title",
          value: "",
        });
        element.addNewNode(type!.label, title);
        element.parent.saveGoalModel();
      } catch (e) {
        console.log(e, "erro ao adicionar property");
      }
    }),
  );
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.changeRefinementType",
      async (element: NodeRefinement) => {
        try {
          const selected = await vscode.window.showQuickPick([
            { label: "And", description: "And Refinement" },
            { label: "Or", description: "Or Refinement" },
          ]);
          element.changeRefinementType(
            selected!.label == "And"
              ? "istar.AndRefinementLink"
              : "istar.OrRefinementLink",
          );
          element.parent.parent.parent.saveGoalModel();
        } catch (e) {
          console.error("failed to change node refinement", e);
        }
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.setRuntimeAnnotation",
      async (element: Node) => {
        try {
          const input = await vscode.window.showInputBox({
            placeHolder: "Type the runtime annotation",
            prompt: "Set the runtime annotation",
            value: element.runtimeAnnotation ? element.runtimeAnnotation : "",
          });
          if (input) {
            element.setRuntimeAnnotation(input);
            element.parent.parent.saveGoalModel();
          }
        } catch (e) {
          console.error("failed to change node refinement", e);
        }
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.editNode",
      async (element?: Node) => {
        let node = element;
        if (!node) {
          node = await pickNodeFromQuickPick(gmProvider);
          if (!node) return;
        }
        await runEditNodeLoop(node);
      },
    ),
  );

  // add property to node command
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.addProperty",
      async (element?: Node) => {
        let node = element;
        if (!node) {
          node = await pickNodeFromQuickPick(gmProvider);
          if (!node) return;
        }
        await runEditNodeLoop(node);
      },
    ),
  );

  commands.push(
    vscode.commands.registerCommand(
      "goalModel.editProperty",
      async (element?: NodeAttr | Node) => {
        let node: Node | undefined;
        let attr: NodeAttr | undefined;
        if (element instanceof NodeAttr) {
          attr = element;
          node = element.parent;
        } else if (element instanceof Node) {
          node = element;
        } else {
          node = await pickNodeFromQuickPick(gmProvider);
          if (!node) return;
        }
        if (attr) {
          await promptAndSetPropertyValue(node, attr.attrName, attr.attrValue);
        } else {
          await runEditNodeLoop(node);
        }
      },
    ),
  );

  // delete node from mission command
  commands.push(
    vscode.commands.registerCommand("goalModel.deleteNode", async (element) => {
      element.remove();
      element.parent.parent.saveGoalModel();
    }),
  );

  commands.push(
    vscode.commands.registerCommand(
      "goalModel.focusElement",
      async (targetId: string, parentId: string) => {
        const element = gmProvider.findChildren(parentId, targetId);
        treeView.reveal(element, { expand: true });
      },
    ),
  );
  // add refinements to a node command

  commands.push(
    vscode.commands.registerCommand(
      "goalModel.addRefinementToNode",
      async (element: Node) => {
        const types: vscode.QuickPickItem[] = [
          {
            label: "and",
            description: "and",
          },
          {
            label: "or",
            description: "or",
          },
        ];
        const gm = element.parent.parent;
        let type;
        if (
          element.refinements?.type == "istar.AndRefinementLink" ||
          element.refinements?.type == "istar.OrRefinementLink"
        ) {
          type =
            element.refinements.type == "istar.AndRefinementLink"
              ? "and"
              : "or";
        } else {
          type = await vscode.window.showQuickPick(types);
        }
        const items: vscode.QuickPickItem[] = element.parent.nodes
          .filter((e) => e != element)
          .map((node) => {
            return {
              label: node.name,
              description: node.customId,
            };
          });
        const selected = await vscode.window.showQuickPick(items);
        element.addRefinement(
          type,
          selected!.description,
          selected!.label,
          gm.generateNewId(),
        );
        gm.saveGoalModel();
      },
    ),
  );

  // delete property from node command
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.deleteProperty",
      async (element) => {
        element.parent.removeAttribute(element);
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.addRefinement",
      async (element: NodeRefinement) => {
        const targetNode = element.parent;
        const gm = targetNode.parent.parent;
        const items: vscode.QuickPickItem[] = targetNode.parent.nodes
          .filter((e) => e != targetNode)
          .map((node) => {
            return {
              label: node.name,
              description: node.customId,
            };
          });
        const selected = await vscode.window.showQuickPick(items!);
        element.addRefinement(
          selected!.description,
          selected!.label,
          gm.generateNewId(),
        );
        gm.saveGoalModel();
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "goalModel.deleteRefinement",
      async (element: Refinement) => {
        element.parent.removeRefinement(element);
        element.parent.parent.parent.parent.saveGoalModel();
      },
    ),
  );

  commands.forEach((command) => context.subscriptions.push(command));
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
