import * as assert from "assert";
import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildMutroseArgs,
  ExecFileFn,
  runMutroseBinary,
} from "./mutroseRunner";

describe("mutroseRunner", () => {
  it("builds separate argument array for -p and -h modes", () => {
    assert.deepStrictEqual(
      buildMutroseArgs({
        hddlPath: "/ws/hddl.txt",
        goalModelPath: "/ws/gm/model.gm",
        configPath: "/ws/config.json",
        mode: "-p",
      }),
      ["/ws/hddl.txt", "/ws/gm/model.gm", "/ws/config.json", "-p"],
    );

    assert.deepStrictEqual(
      buildMutroseArgs({
        hddlPath: "/ws/hddl.txt",
        goalModelPath: "/ws/gm/model.gm",
        configPath: "/ws/config.json",
        mode: "-h",
      }),
      ["/ws/hddl.txt", "/ws/gm/model.gm", "/ws/config.json", "-h"],
    );
  });

  it("invokes execFile with shell: false and passes arguments verbatim", () => {
    let capturedFile = "";
    let capturedArgs: readonly string[] = [];
    let capturedOptions: child_process.ExecFileOptions | undefined;

    const fakeExecFile: ExecFileFn = (file, args, options, callback) => {
      capturedFile = file;
      capturedArgs = args;
      capturedOptions = options;
      callback(null, "ok", "");
      return {} as child_process.ChildProcess;
    };

    const injectedPath = "/tmp/my file; rm -rf / && $(whoami) `id`.gm";
    let stdoutResult = "";

    runMutroseBinary(
      {
        binaryPath: "/path with spaces/mutrose",
        hddlPath: "/ws/hddl; echo pwned.txt",
        goalModelPath: injectedPath,
        configPath: "/ws/config$(id).json",
        mode: "-p",
        cwd: "/ws",
      },
      (err, stdout) => {
        assert.strictEqual(err, null);
        stdoutResult = stdout;
      },
      fakeExecFile,
    );

    assert.strictEqual(capturedFile, "/path with spaces/mutrose");
    assert.deepStrictEqual(capturedArgs, [
      "/ws/hddl; echo pwned.txt",
      injectedPath,
      "/ws/config$(id).json",
      "-p",
    ]);
    assert.strictEqual(capturedOptions?.cwd, "/ws");
    assert.strictEqual(capturedOptions?.shell, false);
    assert.strictEqual(stdoutResult, "ok");
  });

  it("does not execute shell metacharacters in real process invocation", (done) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mutrose-runner-test-"));
    const markerFile = path.join(tmpDir, "injected.txt");
    const maliciousArg = `foo; touch "${markerFile}"`;

    runMutroseBinary(
      {
        binaryPath: process.execPath,
        hddlPath: "-e",
        goalModelPath: "process.stdout.write(JSON.stringify(process.argv.slice(1)))",
        configPath: maliciousArg,
        mode: "-h",
        cwd: tmpDir,
      },
      (err, stdout) => {
        try {
          assert.strictEqual(err, null);
          const receivedArgv = JSON.parse(stdout) as string[];
          assert.deepStrictEqual(receivedArgv, [maliciousArg, "-h"]);
          assert.strictEqual(fs.existsSync(markerFile), false);
          done();
        } catch (assertErr) {
          done(assertErr);
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      },
    );
  });
});
