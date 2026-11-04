import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { createMirrorStore, createRemoteDispatcher } from "@istar-ts/actions";
import type { MessagePortLike } from "@istar-ts/actions";
import { IstarServer } from "./istarServer";

/** Two `MessagePortLike` ends wired directly to each other, in-process. */
function createPortPair(): [MessagePortLike, MessagePortLike] {
  const a: MessagePortLike = { postMessage: () => {}, onmessage: null };
  const b: MessagePortLike = { postMessage: () => {}, onmessage: null };
  a.postMessage = (data) => b.onmessage?.({ data });
  b.postMessage = (data) => a.onmessage?.({ data });
  return [a, b];
}

class FakeDocument {
  private text: string;
  writeCount = 0;

  constructor(initial: string) {
    this.text = initial;
  }

  getText(): string {
    return this.text;
  }

  async replaceAll(text: string): Promise<void> {
    this.writeCount++;
    this.text = text;
  }
}

// Read from the source tree, not `__dirname`: the test runs from the compiled `out/` tree,
// which has no copy of this fixture.
const fixturePath = path.join(process.cwd(), "src", "test", "gm", "gm", "LabSampleLogistics.gm");
const fixtureText = fs.readFileSync(fixturePath, "utf8");

describe("IstarServer", () => {
  it("applies a dispatched createNode to the document and the mirror", async () => {
    const document = new FakeDocument("");
    const [hostPort, clientPort] = createPortPair();
    const server = new IstarServer(document, hostPort);

    const remote = createRemoteDispatcher(clientPort);
    const mirror = createMirrorStore(remote);
    await mirror.ready;

    const actor = await mirror.dispatcher.dispatch({
      kind: "createNode",
      elementTypeId: "istar.Actor",
    });
    assert.ok(actor.ok, "createNode(Actor) should be accepted");
    const [actorId] = actor.ok ? actor.createdIds : [];

    const result = await mirror.dispatcher.dispatch({
      kind: "createNode",
      elementTypeId: "istar.Goal",
      containerId: actorId,
    });

    assert.ok(result.ok, "createNode(Goal) should be accepted");
    const [createdId] = result.ok ? result.createdIds : [];
    assert.ok(createdId, "createNode should report the created id");
    assert.ok(document.getText().includes(createdId!), "the document should contain the new element");
    assert.ok(mirror.getModel().elements.has(createdId!), "the mirror should show the new element");

    server.dispose();
    mirror.dispose();
  });

  it("reloads the mirror when the document changes externally", async () => {
    const document = new FakeDocument("");
    const [hostPort, clientPort] = createPortPair();
    const server = new IstarServer(document, hostPort);

    const remote = createRemoteDispatcher(clientPort);
    const mirror = createMirrorStore(remote);
    await mirror.ready;

    assert.strictEqual(mirror.getModel().elements.size, 0);

    await document.replaceAll(fixtureText);
    server.reloadFromDocument();
    await mirror.synced();

    assert.ok(mirror.getModel().elements.size > 0, "the mirror should show the reloaded elements");

    server.dispose();
    mirror.dispose();
  });

  it("does not loop when the host echoes a dispatched edit back", async () => {
    const document = new FakeDocument("");
    const [hostPort, clientPort] = createPortPair();
    const server = new IstarServer(document, hostPort);

    const remote = createRemoteDispatcher(clientPort);
    const mirror = createMirrorStore(remote);
    await mirror.ready;

    const result = await mirror.dispatcher.dispatch({
      kind: "createNode",
      elementTypeId: "istar.Actor",
    });
    assert.ok(result.ok);

    // The document was written once for the edit; re-reading it back in must not write again.
    assert.strictEqual(document.writeCount, 1);
    server.reloadFromDocument();
    assert.strictEqual(document.writeCount, 1);

    server.dispose();
    mirror.dispose();
  });
});
