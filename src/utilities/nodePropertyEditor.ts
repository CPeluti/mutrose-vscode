import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Node, NodeAttr, GoalModelProvider, GoalModel } from "../goalModel";
import { getLanguageClient } from "../extension";

/**
 * Propriedades suportadas pelo LSP por tipo/contexto de nó
 */
const LSP_CONTEXT_RULES: Record<string, string[]> = {
  GoalType: ["goal"],
  AchieveCondition: ["achieve"],
  QueriedProperty: ["query"],
  Controls: ["achieve", "query"],
  Monitors: ["goal", "achieve", "query"],
  Group: ["achieve"],
  Divisible: ["achieve"],
  Location: ["task"],
  Params: ["task"],
  RobotNumber: ["task"],
  Description: ["goal", "task"],
};

/**
 * Carrega classes e atributos dos XMLs de conhecimento (pasta knowledge/)
 */
export function getKnowledgeBase(): Map<string, string[]> {
  const classes = new Map<string, string[]>();
  const folders = vscode.workspace.workspaceFolders || [];

  const scanDir = (dir: string) => {
    try {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !["node_modules", ".git", "dist"].includes(entry.name)) {
          scanDir(full);
        } else if (entry.name.toLowerCase().endsWith(".xml")) {
          const content = fs.readFileSync(full, "utf-8");
          const classBlockRegex = /<([A-Za-z_]\w*)\b[^>]*>([\s\S]*?)<\/\1>/g;
          let m: RegExpExecArray | null;
          while ((m = classBlockRegex.exec(content)) !== null) {
            const cls = m[1];
            if (cls.toLowerCase() === "world_db") continue;
            if (!classes.has(cls)) classes.set(cls, []);
            const attrRegex = /<([A-Za-z_]\w*)\b[^>]*>/g;
            let am: RegExpExecArray | null;
            const attrs = new Set(classes.get(cls)!);
            while ((am = attrRegex.exec(m[2])) !== null) {
              if (am[1].toLowerCase() !== cls.toLowerCase()) attrs.add(am[1]);
            }
            classes.set(cls, Array.from(attrs).sort());
          }
        }
      }
    } catch { }
  };

  for (const f of folders) scanDir(f.uri.fsPath);
  return classes;
}

/**
 * Obtém mapeamento de variáveis e seus tipos (Controls e declarações OCL)
 */
function getVariableTypes(text: string, node: Node): Map<string, string> {
  const vars = new Map<string, string>();

  // Controls do próprio nó
  const ownControls = node.attributes.find((a) => a.attrName.toLowerCase() === "controls")?.attrValue;
  if (ownControls) {
    for (const m of ownControls.matchAll(/([a-zA-Z_]\w*)\s*:\s*([a-zA-Z_]\w*)/g)) {
      vars.set(m[1], m[2]);
    }
  }

  // Controls de outros nós no mesmo modelo
  try {
    for (const n of node.parent?.nodes || []) {
      const c = n.attributes.find((a: any) => a.attrName.toLowerCase() === "controls")?.attrValue;
      if (c) {
        for (const m of c.matchAll(/([a-zA-Z_]\w*)\s*:\s*([a-zA-Z_]\w*)/g)) {
          if (!vars.has(m[1])) vars.set(m[1], m[2]);
        }
      }
    }
  } catch { }

  // Declarações inline no próprio texto OCL (ex: "n:Nurse |" ou "d : Delivery")
  for (const m of text.matchAll(/([a-zA-Z_]\w*)\s*:\s*([a-zA-Z_]\w*)/g)) {
    vars.set(m[1], m[2]);
  }

  return vars;
}

/**
 * Editor com QuickPick interativo que fornece sugestões em tempo real ao digitar OCL
 * utilizando diretamente as hints geradas pelo LSP (Language Server Protocol)
 */
export async function promptOclExpression(
  node: Node,
  propName: "AchieveCondition" | "QueriedProperty",
  initialValue = ""
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const qp = vscode.window.createQuickPick();
    qp.title = `Editar OCL: ${propName} (${node.name})`;
    qp.placeholder =
      propName === "AchieveCondition"
        ? "ex: deliveries->forAll(d: Delivery | d.delivered = true)"
        : "ex: world_db->select(n: Nurse | n.name in current_delivery.nurse)";
    qp.value = initialValue;

    let queryId = 0;

    const updateSuggestions = async (text: string) => {
      const currentId = ++queryId;
      const items: (vscode.QuickPickItem & { apply?: () => string; isSubmit?: boolean })[] = [];

      // Item de confirmação / salvar
      items.push({
        label: "$(check) Salvar Expressão",
        description: text ? `"${text}"` : "(vazio)",
        detail: "Pressione Enter para confirmar e salvar",
        alwaysShow: true,
        isSubmit: true,
      });

      // Detecta palavra sendo digitada no final do texto
      const trailingWordMatch = /[a-zA-Z_]\w*$/.exec(text);
      const trailingWord = trailingWordMatch ? trailingWordMatch[0] : "";

      // 1. Consulta as hints geradas diretamente pelo servidor LSP
      let lspItems: any[] = [];
      const client = getLanguageClient();
      if (client) {
        try {
          const fileUri = node.parent?.parent?.filePath
            ? vscode.Uri.file(node.parent.parent.filePath).toString()
            : undefined;
          lspItems =
            (await client.sendRequest<any[]>("mutrose/getOclHints", {
              uri: fileUri,
              propName,
              expression: text,
            })) || [];
        } catch (e) {
          console.warn("LSP getOclHints error:", e);
        }
      }

      // Se a digitação continuou enquanto a requisição rodava, descarta resposta obsoleta
      if (currentId !== queryId) return;

      if (lspItems && lspItems.length > 0) {
        // Agrupa as hints retornadas pelo LSP
        const attributeHints = lspItems.filter((i) => i.kind === 10); // Property
        const classHints = lspItems.filter((i) => i.kind === 7); // Class
        const snippetHints = lspItems.filter((i) => i.kind === 15); // Snippet
        const variableHints = lspItems.filter((i) => i.kind === 6); // Variable
        const operatorHints = lspItems.filter((i) => i.kind === 14 || i.kind === 24 || i.kind === 3); // Keyword, Operator, Function

        // 1. Atributos da classe/variável sugeridos pelo LSP
        if (attributeHints.length > 0) {
          const memberMatch = /(?:^|[^a-zA-Z0-9_])([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)?$/.exec(text);
          const varName = memberMatch ? memberMatch[1] : "";
          items.push({
            label: `ATRIBUTOS DO LSP${varName ? ` ('${varName}')` : ""}`,
            kind: vscode.QuickPickItemKind.Separator,
          });

          for (const hint of attributeHints) {
            items.push({
              label: `$(symbol-property) ${varName ? `${varName}.${hint.label}` : hint.label}`,
              description: hint.detail || "Propriedade",
              detail: typeof hint.documentation === "string" ? hint.documentation : hint.documentation?.value,
              alwaysShow: true,
              apply: () => {
                if (varName) {
                  return text.replace(new RegExp(`${varName}\\.[a-zA-Z_0-9]*$`), `${varName}.${hint.label}`);
                }
                return text + hint.label;
              },
            });
          }
        }

        // 2. Classes de conhecimento sugeridas pelo LSP
        if (classHints.length > 0) {
          items.push({
            label: "CLASSES DE CONHECIMENTO (LSP)",
            kind: vscode.QuickPickItemKind.Separator,
          });

          for (const hint of classHints) {
            items.push({
              label: `$(symbol-class) ${hint.label}`,
              description: hint.detail || "Classe de conhecimento",
              alwaysShow: true,
              apply: () => text.replace(/:\s*[a-zA-Z_0-9]*$/, `: ${hint.label} `),
            });
          }
        }

        // 3. Templates iniciais sugeridos pelo LSP
        if (snippetHints.length > 0) {
          items.push({
            label: "TEMPLATES OCL (LSP)",
            kind: vscode.QuickPickItemKind.Separator,
          });

          for (const hint of snippetHints) {
            items.push({
              label: `$(symbol-snippet) ${hint.label}`,
              description: hint.detail || "Template OCL",
              alwaysShow: true,
              apply: () => hint.insertText || hint.label,
            });
          }
        }

        // 4. Variáveis sugeridas pelo LSP (prioriza variáveis que começam com o que foi digitado)
        if (variableHints.length > 0) {
          items.push({
            label: "VARIÁVEIS DISPONÍVEIS (LSP)",
            kind: vscode.QuickPickItemKind.Separator,
          });

          const matchingVars = trailingWord
            ? variableHints.filter((v) => v.label.toLowerCase().startsWith(trailingWord.toLowerCase()))
            : variableHints;
          const otherVars = trailingWord
            ? variableHints.filter((v) => !v.label.toLowerCase().startsWith(trailingWord.toLowerCase()))
            : [];
          const sortedVars = [...matchingVars, ...otherVars];

          for (const hint of sortedVars) {
            items.push({
              label: `$(symbol-variable) ${hint.label}`,
              description: hint.detail || "",
              detail: typeof hint.documentation === "string" ? hint.documentation : hint.documentation?.value,
              alwaysShow: true,
              apply: () => {
                if (trailingWord) {
                  return text.slice(0, text.length - trailingWord.length) + hint.label;
                }
                const needsSpace = text.length > 0 && !text.endsWith(" ") && !text.endsWith("(") && !text.endsWith("|");
                return text + (needsSpace ? " " : "") + hint.label;
              },
            });
          }
        }

        // 5. Operadores OCL sugeridos pelo LSP
        if (operatorHints.length > 0) {
          items.push({
            label: "OPERADORES OCL (LSP)",
            kind: vscode.QuickPickItemKind.Separator,
          });

          for (const hint of operatorHints) {
            const isArrow = hint.label.startsWith("->");
            const isWord = /^[a-zA-Z]+$/.test(hint.label);
            items.push({
              label: `$(symbol-operator) ${hint.label}`,
              description: hint.detail || "",
              alwaysShow: true,
              apply: () => {
                if (isArrow) {
                  if (/->[a-zA-Z_]*$/.test(text)) {
                    return text.replace(/->[a-zA-Z_]*$/, hint.label);
                  }
                  return text + hint.label;
                }
                if (isWord && trailingWord && hint.label.startsWith(trailingWord.toLowerCase())) {
                  return text.slice(0, text.length - trailingWord.length) + hint.label + " ";
                }
                const needsSpace = text.length > 0 && !text.endsWith(" ") && !text.endsWith("(") && !text.endsWith("|");
                return text + (needsSpace ? " " : "") + hint.label + " ";
              },
            });
          }
        }
      } else {
        // Fallback local se o LSP ainda estiver iniciando
        const knowledge = getKnowledgeBase();
        const monitorAttr = node.attributes.find((a) => a.attrName.toLowerCase() === "monitors")?.attrValue;
        const monitorVars = monitorAttr ? monitorAttr.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const varTypes = getVariableTypes(text, node);

        const memberMatch = /(?:^|[^a-zA-Z0-9_])([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)?$/.exec(text);
        if (memberMatch) {
          const varName = memberMatch[1];
          const attrPrefix = memberMatch[2] || "";
          const typeName = varTypes.get(varName);
          const possibleAttrs = typeName && knowledge.has(typeName)
            ? knowledge.get(typeName)!
            : Array.from(new Set(Array.from(knowledge.values()).flat())).sort();
          const matchingAttrs = possibleAttrs.filter((a) => a.toLowerCase().startsWith(attrPrefix.toLowerCase()));
          if (matchingAttrs.length > 0) {
            items.push({ label: `ATRIBUTOS DE '${varName}'`, kind: vscode.QuickPickItemKind.Separator });
            for (const attr of matchingAttrs) {
              items.push({
                label: `$(symbol-property) ${varName}.${attr}`,
                description: typeName ? `Propriedade de ${typeName}` : "Propriedade",
                alwaysShow: true,
                apply: () => text.replace(new RegExp(`${varName}\\.[a-zA-Z_0-9]*$`), `${varName}.${attr}`),
              });
            }
          }
        }

        const declaredVars = Array.from(new Set([...monitorVars, ...Array.from(varTypes.keys()), "world_db"]));
        const matchingVars = trailingWord
          ? declaredVars.filter((v) => v.toLowerCase().startsWith(trailingWord.toLowerCase()))
          : declaredVars;
        const otherVars = trailingWord
          ? declaredVars.filter((v) => !v.toLowerCase().startsWith(trailingWord.toLowerCase()))
          : [];
        const sortedVars = [...matchingVars, ...otherVars];
        if (sortedVars.length > 0) {
          items.push({ label: "VARIÁVEIS DISPONÍVEIS", kind: vscode.QuickPickItemKind.Separator });
          for (const v of sortedVars) {
            items.push({
              label: `$(symbol-variable) ${v}`,
              alwaysShow: true,
              apply: () => {
                if (trailingWord) return text.slice(0, text.length - trailingWord.length) + v;
                return text + (text.endsWith(" ") || text === "" ? "" : " ") + v;
              },
            });
          }
        }
      }

      qp.items = items;
    };

    updateSuggestions(qp.value);

    qp.onDidChangeValue((val) => {
      updateSuggestions(val);
    });

    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0] as any;
      if (!selected || selected.isSubmit) {
        resolve(qp.value);
        qp.hide();
        return;
      }

      if (selected.apply) {
        qp.value = selected.apply();
        updateSuggestions(qp.value);
      }
    });

    qp.onDidHide(() => {
      qp.dispose();
      resolve(undefined);
    });

    qp.show();
  });
}

/**
 * Solicita e atualiza o valor de uma propriedade (com suporte completo a OCL, enum e texto)
 */
export async function promptAndSetPropertyValue(
  node: Node,
  propName: string,
  currentValue = ""
): Promise<boolean> {
  let newValue: string | undefined;

  if (propName === "GoalType") {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Achieve", description: "Meta de alcance (suporta AchieveCondition, Controls, Monitors, Group)" },
        { label: "Query", description: "Meta de consulta (suporta QueriedProperty, Controls, Monitors)" },
        { label: "Perform", description: "Meta de execução" },
      ],
      { placeHolder: "Selecione o GoalType" }
    );
    if (!picked) return false;
    newValue = picked.label;
  } else if (propName === "Group" || propName === "Divisible") {
    const picked = await vscode.window.showQuickPick(["true", "false"], {
      placeHolder: `Definir valor para ${propName}`,
    });
    if (!picked) return false;
    newValue = picked;
  } else if (propName === "AchieveCondition" || propName === "QueriedProperty") {
    newValue = await promptOclExpression(node, propName, currentValue);
    if (newValue === undefined) return false;
  } else if (propName === "Controls") {
    const knowledge = getKnowledgeBase();
    const suggestions = Array.from(knowledge.keys()).map((cls) => ({
      label: `varName : ${cls}`,
      description: `Declarar controle do tipo ${cls}`,
    }));
    suggestions.unshift({
      label: currentValue || "custom",
      description: "Manter valor atual ou digitar novo",
    });

    const picked = await vscode.window.showQuickPick(suggestions, {
      placeHolder: "Selecione uma sugestão ou personalize",
    });
    if (!picked) return false;

    if (picked.label.includes("varName :")) {
      const varName = await vscode.window.showInputBox({
        placeHolder: "Nome da variável (ex: current_delivery)",
        prompt: `Defina o nome da variável para o tipo ${picked.label.split(":")[1].trim()}`,
      });
      if (!varName) return false;
      newValue = `${varName.trim()} : ${picked.label.split(":")[1].trim()}`;
    } else {
      newValue = await vscode.window.showInputBox({
        value: currentValue,
        prompt: "Defina o valor de Controls (ex: var : Type)",
      });
      if (newValue === undefined) return false;
    }
  } else if (propName === "Monitors") {
    const declaredVars: string[] = [];
    try {
      for (const n of node.parent?.nodes || []) {
        const c = n.attributes.find((a: any) => a.attrName.toLowerCase() === "controls")?.attrValue;
        if (c) {
          for (const m of c.matchAll(/([a-zA-Z_]\w*)\s*:/g)) declaredVars.push(m[1]);
        }
      }
    } catch { }

    const options = Array.from(new Set(declaredVars)).map((v) => ({
      label: v,
      description: "Variável declarada em Controls",
    }));

    if (options.length > 0) {
      options.push({ label: "$(pencil) Digitar Manualmente", description: "" });
      const picked = await vscode.window.showQuickPick(options, {
        placeHolder: "Selecione a variável para monitorar",
      });
      if (!picked) return false;
      if (picked.label !== "$(pencil) Digitar Manualmente") {
        newValue = picked.label;
      } else {
        newValue = await vscode.window.showInputBox({ value: currentValue, prompt: "Digite a variável de Monitors" });
        if (newValue === undefined) return false;
      }
    } else {
      newValue = await vscode.window.showInputBox({ value: currentValue, prompt: "Digite a variável de Monitors" });
      if (newValue === undefined) return false;
    }
  } else {
    newValue = await vscode.window.showInputBox({
      value: currentValue,
      prompt: `Editar propriedade ${propName}`,
    });
    if (newValue === undefined) return false;
  }

  node.setAttribute(propName, newValue);
  await node.parent.parent.saveGoalModel();
  vscode.window.showInformationMessage(`Propriedade '${propName}' atualizada com sucesso!`);
  return true;
}

/**
 * Loop interativo no QuickPick para editar propriedades do nó
 */
export async function runEditNodeLoop(node: Node): Promise<void> {
  let finished = false;

  while (!finished) {
    const nodeType = node.nodeType.toLowerCase();
    const goalTypeAttr = node.attributes.find((a) => a.attrName.toLowerCase() === "goaltype" || a.attrName.toLowerCase() === "goal type")?.attrValue?.toLowerCase();

    // Propriedades recomendadas pelo LSP para o contexto atual
    const recommended = Object.keys(LSP_CONTEXT_RULES).filter((name) => {
      const contexts = LSP_CONTEXT_RULES[name];
      if (nodeType === "goal") {
        if (name === "GoalType") return true;
        if (goalTypeAttr) return contexts.includes(goalTypeAttr);
        return contexts.includes("goal");
      }
      return contexts.includes("task");
    });

    const items: vscode.QuickPickItem[] = [];

    items.push({ label: "PROPRIEDADES RECOMENDADAS (LSP)", kind: vscode.QuickPickItemKind.Separator });
    for (const name of recommended) {
      const attr = node.attributes.find((a) => a.attrName.toLowerCase() === name.toLowerCase());
      items.push({
        label: `$(gear) ${name}`,
        description: attr ? `"${attr.attrValue}"` : "(não definido)",
        detail: `Válido para ${node.nodeType}${goalTypeAttr ? ` (${goalTypeAttr})` : ""}`,
      });
    }

    // Outras propriedades presentes no nó
    const others = node.attributes.filter(
      (a) => !recommended.some((r) => r.toLowerCase() === a.attrName.toLowerCase())
    );
    if (others.length > 0) {
      items.push({ label: "OUTRAS PROPRIEDADES", kind: vscode.QuickPickItemKind.Separator });
      for (const a of others) {
        items.push({
          label: `$(warning) ${a.attrName}`,
          description: `"${a.attrValue}"`,
        });
      }
    }

    // Ações
    items.push({ label: "AÇÕES", kind: vscode.QuickPickItemKind.Separator });
    items.push({ label: "$(plus) Adicionar Propriedade Customizada" });
    items.push({ label: "$(trash) Remover Propriedade" });
    items.push({ label: "$(check) Concluir Edição" });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Editando nó: ${node.name} [${node.nodeType}]`,
    });

    if (!selected || selected.label === "$(check) Concluir Edição") {
      finished = true;
      break;
    }

    if (selected.label === "$(plus) Adicionar Propriedade Customizada") {
      const customName = await vscode.window.showInputBox({ prompt: "Nome da nova propriedade" });
      if (customName) await promptAndSetPropertyValue(node, customName, "");
    } else if (selected.label === "$(trash) Remover Propriedade") {
      const toRemove = await vscode.window.showQuickPick(
        node.attributes.map((a) => ({ label: a.attrName, description: `"${a.attrValue}"` })),
        { placeHolder: "Selecione a propriedade a remover" }
      );
      if (toRemove) {
        await node.removeAttribute(toRemove.label);
        vscode.window.showInformationMessage(`Propriedade '${toRemove.label}' removida.`);
      }
    } else {
      const cleanName = selected.label.replace(/\$\([a-z\-]+\)\s*/, "").trim();
      const existing = node.attributes.find((a) => a.attrName.toLowerCase() === cleanName.toLowerCase());
      await promptAndSetPropertyValue(node, cleanName, existing ? existing.attrValue : "");
    }
  }
}

/**
 * Seleciona um nó a partir do QuickPick quando o comando é disparado sem argumento
 */
export async function pickNodeFromQuickPick(gmProvider: GoalModelProvider): Promise<Node | undefined> {
  const models = (await gmProvider.getChildren()) as GoalModel[];
  const allNodes: Node[] = [];

  for (const gm of models || []) {
    if (gm.missions) {
      for (const m of gm.missions) {
        if (m.nodes) allNodes.push(...m.nodes);
      }
    }
  }

  if (allNodes.length === 0) {
    vscode.window.showWarningMessage("Nenhum nó encontrado no modelo aberto.");
    return undefined;
  }

  const items = allNodes.map((n) => ({
    label: `$(symbol-variable) ${n.name}`,
    description: `[${n.nodeType}]`,
    detail: n.attributes.map((a) => `${a.attrName}: "${a.attrValue}"`).join(" | "),
    node: n,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Selecione o nó para editar propriedades",
  });

  return picked?.node;
}
