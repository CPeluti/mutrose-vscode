import * as assert from "assert";
import * as path from "path";
import {
  findNodeIdAtLine,
  getNodeLineRanges,
  getNonce,
  resolveFirstExistingSegments,
} from "./editorDiagnostics";

describe("editorDiagnostics utilities", () => {
  it("generates a 32-character alphanumeric nonce", () => {
    const nonce = getNonce();
    assert.strictEqual(nonce.length, 32);
    assert.match(nonce, /^[A-Za-z0-9]{32}$/);
  });

  it("extracts nested node line ranges and finds the innermost nodeId", () => {
    const sampleJson = JSON.stringify(
      {
        actors: [
          {
            id: "actor-1",
            text: "Mission 1",
            nodes: [
              {
                id: "goal-1",
                text: "G1: Achieve X",
              },
            ],
          },
        ],
      },
      null,
      2,
    );

    const ranges = getNodeLineRanges(sampleJson);
    assert.strictEqual(ranges.length, 2);

    const lines = sampleJson.split("\n");
    const goalTextLine = lines.findIndex((l) => l.includes("G1: Achieve X"));
    assert.strictEqual(findNodeIdAtLine(ranges, goalTextLine), "goal-1");

    const actorTextLine = lines.findIndex((l) => l.includes("Mission 1"));
    assert.strictEqual(findNodeIdAtLine(ranges, actorTextLine), "actor-1");
  });

  it("resolves the first existing dist path candidate", () => {
    const base = "/ext";
    const candidates = [
      ["src", "plugins", "editor", "dist", "istar-webview"],
      ["src", "editors", "dist", "istar-webview"],
    ];

    const fallbackTarget = path.join(base, ...candidates[1]);
    const chosen = resolveFirstExistingSegments(
      base,
      candidates,
      (p) => p === fallbackTarget,
    );

    assert.deepStrictEqual(chosen, candidates[1]);
  });
});
