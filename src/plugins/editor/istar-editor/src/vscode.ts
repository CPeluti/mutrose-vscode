import type { MessagePortLike } from '@istar-ts/actions';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
};

const vscode = acquireVsCodeApi();
export default vscode;

/**
 * Port shim over the webview channel: RPC frames ride `{ command: 'istar-rpc', frame }`
 * alongside the existing `{ command }` messages (`customEditor.ts` is the symmetric host side).
 */
export const istarPort: MessagePortLike = {
  postMessage: (data) => {
    vscode.postMessage({ command: 'istar-rpc', frame: data });
  },
  onmessage: null,
};

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.command === 'istar-rpc') {
    istarPort.onmessage?.({ data: event.data.frame });
  }
});
