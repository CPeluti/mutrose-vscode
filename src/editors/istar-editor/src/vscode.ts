declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
};

const vscode = acquireVsCodeApi();
export default vscode;
