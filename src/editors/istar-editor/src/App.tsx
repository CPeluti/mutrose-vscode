import { createMirrorStore, createRemoteDispatcher } from '@istar-ts/actions';
import type { ElementIssue, IstarCanvasHandle, Selection } from '@istar-ts/react';
import {
  IstarCanvas,
  IstarInspector,
} from '@istar-ts/react';
import '@istar-ts/react/styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { mutroseExtension } from './mutroseExtension';
import type { LspDiagnostic } from './reactFlowStyle';
import { ReactFlowSidebar, reactFlowStyleExtension } from './reactFlowStyle';
import vscode, { istarPort } from './vscode';
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
  const [mirror] = useState(() => createMirrorStore(createRemoteDispatcher(istarPort)));
  const canvasRef = useRef<IstarCanvasHandle>(null);
  const [issues, setIssues] = useState<ElementIssue[]>([]);
  const [diagnostics, setDiagnostics] = useState<LspDiagnostic[]>([]);
  const dark = useVsCodeDark();

  useEffect(() => {
    vscode.postMessage({ command: 'ready' });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === 'diagnostics' && Array.isArray(msg.diagnostics)) {
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
  }, []);

  const onSelectionChange = useCallback((selection: Selection) => {
    if (!selection || selection.type !== 'element') {
      vscode.postMessage({ command: 'select', payload: null });
      return;
    }
    const element = mirror.getModel().elements.get(selection.id);
    vscode.postMessage({
      command: 'select',
      payload: {
        target: selection.id,
        parent: element?.parent ?? null,
      },
    });
  }, [mirror]);

  const stableExtensions = useMemo(() => extensions, []);

  if (reactFlowStyle) {
    return (
      <div className="app mutrose-rf">
        <IstarCanvas
          ref={canvasRef}
          store={mirror}
          dispatcher={mirror.dispatcher}
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
        store={mirror}
        dispatcher={mirror.dispatcher}
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
