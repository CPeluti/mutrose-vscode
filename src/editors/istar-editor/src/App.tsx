import { createEmptyModel, parsePistar, toPistar } from '@istar-ts/core';
import type { ElementIssue, IstarCanvasHandle, Selection } from '@istar-ts/react';
import {
  IstarCanvas,
  IstarInspector,
  useIstarStore,
} from '@istar-ts/react';
import '@istar-ts/react/styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { mutroseExtension } from './mutroseExtension';
import type { LspDiagnostic } from './reactFlowStyle';
import { ReactFlowSidebar, reactFlowStyleExtension } from './reactFlowStyle';
import vscode from './vscode';
import './App.css';

/** Set by the extension from `mutrose.istarTsReactFlowStyle` (see customEditor.ts). */
const reactFlowStyle = document.body.dataset.editorStyle === 'reactflow';

const extensions = reactFlowStyle ? [mutroseExtension, reactFlowStyleExtension] : [mutroseExtension];

/** VS Code marks the webview body with its theme kind; follow it live. */
function useVsCodeDark(): boolean {
  const read = () =>
    document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast');
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export default function App(): ReactElement {
  const { store } = useIstarStore(createEmptyModel);
  const canvasRef = useRef<IstarCanvasHandle>(null);
  const [issues, setIssues] = useState<ElementIssue[]>([]);
  const [diagnostics, setDiagnostics] = useState<LspDiagnostic[]>([]);
  const dark = useVsCodeDark();

  useEffect(() => {
    vscode.postMessage({ command: 'ready' });
  }, []);

  // Persist every model edit (including moveElement on node drag-stop) back to the .gm document.
  useEffect(() => {
    return store.subscribe((event) => {
      if (event.source === 'load') return;
      vscode.postMessage({
        command: 'edit',
        content: toPistar(event.model, { saveDate: new Date() }),
      });
    });
  }, [store]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === 'load' && typeof msg.content === 'string') {
        try {
          const text = msg.content.trim();
          store.load(text ? parsePistar(text) : createEmptyModel());
        } catch (err) {
          console.error('Failed to parse goal model', err);
        }
      } else if (msg.command === 'diagnostics' && Array.isArray(msg.diagnostics)) {
        setDiagnostics(msg.diagnostics as LspDiagnostic[]);
        const next: ElementIssue[] = [];
        for (const d of msg.diagnostics as LspDiagnostic[]) {
          if (!d.nodeId) continue;
          next.push({
            id: d.nodeId,
            severity: d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info',
            message: d.message,
          });
        }
        setIssues(next);
      } else if (msg.command === 'focus' && typeof msg.elementId === 'string') {
        canvasRef.current?.select({ type: 'element', id: msg.elementId });
        void canvasRef.current?.centerOn(msg.elementId, { duration: 200 });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [store]);

  const onSelectionChange = useCallback((selection: Selection) => {
    if (!selection || selection.type !== 'element') {
      vscode.postMessage({ command: 'select', payload: null });
      return;
    }
    const element = store.getModel().elements.get(selection.id);
    vscode.postMessage({
      command: 'select',
      payload: {
        target: selection.id,
        parent: element?.parent ?? null,
      },
    });
  }, [store]);

  const stableExtensions = useMemo(() => extensions, []);

  if (reactFlowStyle) {
    return (
      <div className="app mutrose-rf">
        <IstarCanvas
          ref={canvasRef}
          store={store}
          extensions={stableExtensions}
          issues={issues}
          onSelectionChange={onSelectionChange}
          palette={false}
          aside={<ReactFlowSidebar diagnostics={diagnostics} />}
          colorMode={dark ? 'dark' : 'light'}
          linkShape="curved"
          background
          minimap
          fitView
        />
      </div>
    );
  }

  return (
    <div className="app">
      <IstarCanvas
        ref={canvasRef}
        store={store}
        extensions={stableExtensions}
        issues={issues}
        onSelectionChange={onSelectionChange}
        palette="left"
        aside={<IstarInspector />}
        fitView
      />
    </div>
  );
}
