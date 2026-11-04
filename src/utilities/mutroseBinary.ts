import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface MutrosePathResolution {
  binaryPath: string;
  error?: string;
}

/**
 * Resolves the path to the MutRoSe binary based on configured path, workspace root, and bundled fallback.
 */
export function resolveMutrosePath(
  configuredPath: string | undefined,
  workspaceRoot: string | undefined,
  bundledPath: string,
): MutrosePathResolution {
  if (configuredPath && configuredPath.trim() !== "") {
    let trimmed = configuredPath.trim().replace(/^["']|["']$/g, "");

    // Expand ~ / home directory
    if (trimmed.startsWith("~/") || trimmed === "~") {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      trimmed = path.join(home, trimmed.slice(1));
    }

    let candidatePath = trimmed;
    if (path.isAbsolute(trimmed)) {
      candidatePath = trimmed;
    } else if (workspaceRoot) {
      candidatePath = path.resolve(workspaceRoot, trimmed);
    } else {
      candidatePath = path.resolve(trimmed);
    }

    if (fs.existsSync(candidatePath)) {
      return { binaryPath: candidatePath };
    }

    // Check if it exists in current working directory if different
    if (fs.existsSync(path.resolve(trimmed))) {
      return { binaryPath: path.resolve(trimmed) };
    }

    // If it's a global command without path separators (e.g. executable in PATH)
    if (!trimmed.includes("/") && !trimmed.includes("\\")) {
      return { binaryPath: trimmed };
    }

    return {
      binaryPath: candidatePath,
      error: `MutRoSe binary not found at configured path: ${configuredPath}`,
    };
  }

  // Fallback to default bundled binary
  if (fs.existsSync(bundledPath)) {
    return { binaryPath: bundledPath };
  }

  return {
    binaryPath: bundledPath,
    error: `Default MutRoSe binary not found at: ${bundledPath}`,
  };
}

/**
 * Retrieves and validates the MutRoSe executable path from workspace/user configuration
 * or uses the bundled binary as fallback.
 * Checks configuration keys:
 * - `mutrose.path`
 * - `mutrose.mutrosePath`
 * - `gmParser.mutrosePath`
 * - `gmParser.path`
 */
export function getMutroseBinaryPath(
  context: vscode.ExtensionContext,
): MutrosePathResolution {
  const mutroseConfig = vscode.workspace.getConfiguration("mutrose");
  const gmParserConfig = vscode.workspace.getConfiguration("gmParser");

  const configuredPath =
    mutroseConfig.get<string>("path") ||
    mutroseConfig.get<string>("mutrosePath") ||
    gmParserConfig.get<string>("mutrosePath") ||
    gmParserConfig.get<string>("path");

  const workspaceRoot =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  let bundledPath = vscode.Uri.joinPath(
    context.extensionUri,
    "binaries",
    "mutrose",
  ).fsPath;

  if (!fs.existsSync(bundledPath)) {
    const altBundledPath = vscode.Uri.joinPath(
      context.extensionUri,
      "binaries",
      "mutrose",
    ).path;
    if (fs.existsSync(altBundledPath)) {
      bundledPath = altBundledPath;
    }
  }

  const result = resolveMutrosePath(configuredPath, workspaceRoot, bundledPath);

  // Ensure execution permission on POSIX systems if the file exists
  if (!result.error && process.platform !== "win32" && fs.existsSync(result.binaryPath)) {
    try {
      fs.accessSync(result.binaryPath, fs.constants.X_OK);
    } catch {
      try {
        fs.chmodSync(result.binaryPath, 0o755);
      } catch (err) {
        console.warn("Could not set execute permissions on MutRoSe binary:", err);
      }
    }
  }

  return result;
}
