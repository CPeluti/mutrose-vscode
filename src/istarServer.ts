import { createActionDispatcher, connectDispatcher } from "@istar-ts/actions";
import type { MessagePortLike, StoreActionDispatcher } from "@istar-ts/actions";
import { createEmptyModel, createModelStore, parsePistar, toPistar } from "@istar-ts/core";
import type { ModelStore } from "@istar-ts/core";

/** The slice of `vscode.TextDocument` the server needs, so it can be unit tested without VS Code. */
export interface TextDocumentLike {
  getText(): string;
  replaceAll(text: string): Promise<void>;
}

function parse(text: string) {
  const trimmed = text.trim();
  return trimmed ? parsePistar(trimmed) : createEmptyModel();
}

/**
 * Hosts the `.gm` model in the extension process: a `ModelStore` fed from `document`, served to
 * the webview over `port` through an `@istar-ts/actions` dispatcher. Every store change is
 * written back to `document`; every external change to `document` is re-loaded into the store.
 */
export class IstarServer {
  private readonly store: ModelStore;
  private readonly dispatcher: StoreActionDispatcher;
  private readonly unsubscribeStore: () => void;
  private readonly disconnectPort: () => void;
  private lastWrittenText: string;

  constructor(
    private readonly document: TextDocumentLike,
    port: MessagePortLike,
  ) {
    const text = document.getText();
    this.lastWrittenText = text;
    this.store = createModelStore(parse(text));
    this.dispatcher = createActionDispatcher(this.store, { sendModel: true });
    this.unsubscribeStore = this.store.subscribe((event) => {
      if (event.source === "load") return;
      const newText = toPistar(event.model, { saveDate: new Date() });
      if (newText === this.document.getText()) return;
      this.lastWrittenText = newText;
      void this.document.replaceAll(newText);
    });
    this.disconnectPort = connectDispatcher(port, this.dispatcher);
  }

  /**
   * Re-parses `document` into the store, e.g. after `onDidChangeTextDocument` for a change this
   * server did not itself just write (compared against `lastWrittenText` so our own echo is a
   * no-op). The dispatcher (created with `sendModel`) emits `sourceModelChanged` for the load, so
   * a mirror on the other end of `port` follows without any extra call.
   */
  reloadFromDocument(): void {
    const text = this.document.getText();
    if (text === this.lastWrittenText) return;
    try {
      this.store.load(parse(text));
      this.lastWrittenText = text;
    } catch (err) {
      console.error("Failed to parse goal model", err);
    }
  }

  dispose(): void {
    this.disconnectPort();
    this.unsubscribeStore();
  }
}
