import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Node, NodeAttr, GoalModelProvider, GoalModel } from "../goalModel";

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

    const knowledge = getKnowledgeBase();
    const knowledgeClasses = Array.from(knowledge.keys()).sort();

    const monitorAttr = node.attributes.find((a) => a.attrName.toLowerCase() === "monitors")?.attrValue;
    const monitorVars = monitorAttr ? monitorAttr.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const updateSuggestions = (text: string) => {
      const items: (vscode.QuickPickItem & { apply?: () => string; isSubmit?: boolean })[] = [];
      const varTypes = getVariableTypes(text, node);

      // Item de confirmação / salvar
      items.push({
        label: "$(check) Salvar Expressão",
        description: text ? `"${text}"` : "(vazio)",
        detail: "Pressione Enter para confirmar e salvar",
        alwaysShow: true,
        isSubmit: true,
      });

      // 1. Detecta acesso a atributo: "varName." ou "varName.prefix"
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
          items.push({
            label: `ATRIBUTOS DE '${varName}'${typeName ? ` (${typeName})` : ""}`,
            kind: vscode.QuickPickItemKind.Separator,
          });

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

      // 2. Detecta anotação de tipo: ": " ou ": TypePrefix"
      const typeMatch = /:\s*([a-zA-Z_]\w*)?$/.exec(text);
      if (typeMatch) {
        const typePrefix = typeMatch[1] || "";
        const matchingClasses = knowledgeClasses.filter((c) =>
          c.toLowerCase().startsWith(typePrefix.toLowerCase())
        );

        if (matchingClasses.length > 0) {
          items.push({
            label: "CLASSES DE CONHECIMENTO",
            kind: vscode.QuickPickItemKind.Separator,
          });

          for (const cls of matchingClasses) {
            items.push({
              label: `$(symbol-class) ${cls}`,
              description: `Classe XML (${(knowledge.get(cls) || []).join(", ")})`,
              alwaysShow: true,
              apply: () => text.replace(/:\s*[a-zA-Z_0-9]*$/, `: ${cls} `),
            });
            items.push({
              label: `$(symbol-class) Sequence(${cls})`,
              description: `Coleção de ${cls}`,
              alwaysShow: true,
              apply: () => text.replace(/:\s*[a-zA-Z_0-9]*$/, `: Sequence(${cls}) `),
            });
          }
        }
      }

      // 3. Sugestões de Templates Iniciais (quando vazio ou início)
      if (!text || text.trim().length === 0) {
        items.push({
          label: "TEMPLATES OCL SUGERIDOS",
          kind: vscode.QuickPickItemKind.Separator,
        });

        const firstClass = knowledgeClasses[0] || "Item";
        if (propName === "AchieveCondition") {
          const firstMonitor = monitorVars[0] || "collection";
          items.push({
            label: `$(symbol-snippet) ${firstMonitor}->forAll(x: ${firstClass} | ...)`,
            description: "Iterador forAll com classe do conhecimento",
            alwaysShow: true,
            apply: () => `${firstMonitor}->forAll(x: ${firstClass} | x.`,
          });
        } else {
          items.push({
            label: `$(symbol-snippet) world_db->select(x: ${firstClass} | ...)`,
            description: "Consulta select sobre world_db",
            alwaysShow: true,
            apply: () => `world_db->select(x: ${firstClass} | x.`,
          });
        }
      }

      // Detecta palavra sendo digitada no final do texto
      const trailingWordMatch = /[a-zA-Z_]\w*$/.exec(text);
      const trailingWord = trailingWordMatch ? trailingWordMatch[0] : "";

      // 4. Variáveis disponíveis (prioriza as que dão match com o que o usuário está digitando)
      const declaredVars = Array.from(
        new Set([...monitorVars, ...Array.from(varTypes.keys()), "world_db"])
      );

      const matchingVars = trailingWord
        ? declaredVars.filter((v) => v.toLowerCase().startsWith(trailingWord.toLowerCase()))
        : declaredVars;
      const otherVars = trailingWord
        ? declaredVars.filter((v) => !v.toLowerCase().startsWith(trailingWord.toLowerCase()))
        : [];
      const sortedVars = [...matchingVars, ...otherVars];

      if (sortedVars.length > 0) {
        items.push({
          label: "VARIÁVEIS DISPONÍVEIS",
          kind: vscode.QuickPickItemKind.Separator,
        });
        for (const v of sortedVars) {
          const type = varTypes.get(v);
          items.push({
            label: `$(symbol-variable) ${v}`,
            description: type ? `: ${type}` : v === "world_db" ? "Base de conhecimento" : "Variável de Monitor/Controle",
            alwaysShow: true,
            apply: () => {
              if (trailingWord) {
                return text.slice(0, text.length - trailingWord.length) + v;
              }
              const needsSpace = text.length > 0 && !text.endsWith(" ") && !text.endsWith("(") && !text.endsWith("|");
              return text + (needsSpace ? " " : "") + v;
            },
          });
        }
      }

      // 5. Operadores e Palavras-chave OCL
      items.push({
        label: "OPERADORES E PALAVRAS-CHAVE OCL",
        kind: vscode.QuickPickItemKind.Separator,
      });

      const operators = [
        { label: "->forAll(", insert: "->forAll(", isArrow: true },
        { label: "->select(", insert: "->select(", isArrow: true },
        { label: "in", insert: "in", isWord: true },
        { label: "and", insert: "and", isWord: true },
        { label: "or", insert: "or", isWord: true },
        { label: "not", insert: "not", isWord: true },
        { label: "=", insert: "=", isSymbol: true },
        { label: "<>", insert: "<>", isSymbol: true },
      ];

      for (const op of operators) {
        items.push({
          label: `$(symbol-operator) ${op.label}`,
          alwaysShow: true,
          apply: () => {
            if (op.isArrow) {
              if (/->[a-zA-Z_]*$/.test(text)) {
                return text.replace(/->[a-zA-Z_]*$/, op.insert);
              }
              return text + op.insert;
            }
            if (op.isWord && trailingWord && op.insert.startsWith(trailingWord.toLowerCase())) {
              return text.slice(0, text.length - trailingWord.length) + op.insert + " ";
            }
            const needsSpace = text.length > 0 && !text.endsWith(" ") && !text.endsWith("(") && !text.endsWith("|");
            return text + (needsSpace ? " " : "") + op.insert + (op.isSymbol ? " " : " ");
          },
        });
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
