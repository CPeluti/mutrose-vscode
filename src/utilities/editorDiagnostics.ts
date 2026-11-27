import * as fs from "fs";
import * as path from "path";

export interface NodeLineRange {
  id: string;
  startLine: number;
  endLine: number;
}

export function getNonce(): string {
  let text = "";
  const chars = "ABCDEFabcdef0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export function getNodeLineRanges(text: string): NodeLineRange[] {
  const lines = text.split(/\r?\n/);
  const nodeRanges: NodeLineRange[] = [];

  const idRegex = /"id"\s*:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(text)) !== null) {
    const id = match[1];
    const index = match.index;
    const startLine = text.substring(0, index).split(/\r?\n/).length - 1;

    let openBraceLine = startLine;
    while (openBraceLine >= 0 && !lines[openBraceLine].includes("{")) {
      openBraceLine--;
    }
    if (openBraceLine < 0) openBraceLine = startLine;

    let depth = 0;
    let endLine = openBraceLine;
    for (let i = openBraceLine; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === "{") depth++;
        else if (char === "}") depth--;
      }
      if (depth === 0) {
        endLine = i;
        break;
      }
    }
    nodeRanges.push({ id, startLine: openBraceLine, endLine });
  }
  return nodeRanges;
}

export function findNodeIdAtLine(
  ranges: NodeLineRange[],
  line: number,
): string | undefined {
  let best: NodeLineRange | null = null;
  for (const r of ranges) {
    if (line >= r.startLine && line <= r.endLine) {
      if (!best || r.endLine - r.startLine < best.endLine - best.startLine) {
        best = r;
      }
    }
  }
  return best ? best.id : undefined;
}

/**
 * Resolves the first candidate relative segment list that exists on disk under `basePath`.
 * Falls back to the first candidate if none exist.
 */
export function resolveFirstExistingSegments(
  basePath: string,
  candidates: string[][],
  existsSync: (filePath: string) => boolean = fs.existsSync,
): string[] {
  for (const segments of candidates) {
    const fullPath = path.join(basePath, ...segments);
    if (existsSync(fullPath)) {
      return segments;
    }
  }
  return candidates[0];
}
