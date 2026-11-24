import * as child_process from "child_process";

export type MutroseMode = "-p" | "-h";

export interface MutroseExecOptions {
  binaryPath: string;
  hddlPath: string;
  goalModelPath: string;
  configPath: string;
  mode: MutroseMode;
  cwd: string;
}

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: child_process.ExecFileOptions,
  callback: (
    error: child_process.ExecFileException | null,
    stdout: string,
    stderr: string,
  ) => void,
) => child_process.ChildProcess;

/**
 * Builds the argument list passed directly to the MutRoSe binary without shell interpolation.
 */
export function buildMutroseArgs(
  options: Omit<MutroseExecOptions, "binaryPath" | "cwd">,
): string[] {
  return [
    options.hddlPath,
    options.goalModelPath,
    options.configPath,
    options.mode,
  ];
}

/**
 * Executes the MutRoSe binary directly via `execFile` with `shell: false` to prevent command injection.
 */
export function runMutroseBinary(
  options: MutroseExecOptions,
  callback: (
    error: child_process.ExecFileException | null,
    stdout: string,
    stderr: string,
  ) => void,
  execFileFn: ExecFileFn = child_process.execFile,
): child_process.ChildProcess {
  const args = buildMutroseArgs(options);
  return execFileFn(
    options.binaryPath,
    args,
    { cwd: options.cwd, shell: false },
    callback,
  );
}
