import type {
  CustomProperties,
  ElementDisplay,
  ElementKind,
  IstarElement,
  IstarModel,
} from '@istar-ts/core';
import {
  createEmptyModel,
  isActorKind,
  parsePistar,
  toPistar,
} from '@istar-ts/core';
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

interface ClipboardItem {
  kind: ElementKind;
  name: string;
  customProperties?: CustomProperties;
  display?: ElementDisplay;
  originalParent?: string;
  originalPosition: { x: number; y: number };
  isCut: boolean;
}

function nextNumber(model: IstarModel, prefix: RegExp): number {
  let max = 0;
  for (const el of model.elements.values()) {
    const match = el.name.match(prefix);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function getNextName(
  model: IstarModel,
  kind: ElementKind,
  originalName: string,
  asCopy: boolean
): string {
  let defaultPrefix = 'G';
  let pattern = /^G(\d+)/;
  if (kind === 'istar.Task') {
    defaultPrefix = 'AT';
    pattern = /^AT(\d+)/;
  } else if (kind === 'istar.Actor' || kind === 'istar.Agent' || kind === 'istar.Role') {
    defaultPrefix = 'M';
    pattern = /^M(\d+)/;
  }

  let prefix = defaultPrefix;
  let title = originalName;

  const match = originalName.match(/^([A-Za-z]+)(\d+)[:\s-]*\s*(.*)$/);
  if (match) {
    prefix = match[1];
    pattern = new RegExp(`^${prefix}(\\d+)`);
    title = match[3];
  }

  title = title.replace(/\s*\(copy\)$/i, '').trim();
  if (!title) {
    title = kind === 'istar.Goal' ? 'New Goal' : kind === 'istar.Task' ? 'New Task' : 'New Actor';
  }

  const nextNum = nextNumber(model, pattern);
  const suffix = asCopy ? ' (copy)' : '';
  return `${prefix}${nextNum}: ${title}${suffix}`;
}

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
    selectedElementRef.current = selection;
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

  const clipboardRef = useRef<ClipboardItem | null>(null);
  const pasteCountRef = useRef(0);
  const selectedElementRef = useRef<Selection>(null);

  const handleCopy = useCallback(() => {
    const sel = selectedElementRef.current;
    if (!sel || sel.type !== 'element') return;
    const el = store.getModel().elements.get(sel.id);
    if (!el) return;

    const item: ClipboardItem = {
      kind: el.kind,
      name: el.name,
      customProperties: el.customProperties ? { ...el.customProperties } : undefined,
      display: el.display ? { ...el.display } : undefined,
      originalParent: el.parent,
      originalPosition: { x: el.x, y: el.y },
      isCut: false,
    };
    clipboardRef.current = item;
    pasteCountRef.current = 0;
    try {
      localStorage.setItem('mutrose_clipboard', JSON.stringify(item));
    } catch {
      // ignore
    }
  }, [store]);

  const handleCut = useCallback(() => {
    const sel = selectedElementRef.current;
    if (!sel || sel.type !== 'element') return;
    const el = store.getModel().elements.get(sel.id);
    if (!el) return;

    const item: ClipboardItem = {
      kind: el.kind,
      name: el.name,
      customProperties: el.customProperties ? { ...el.customProperties } : undefined,
      display: el.display ? { ...el.display } : undefined,
      originalParent: el.parent,
      originalPosition: { x: el.x, y: el.y },
      isCut: true,
    };
    clipboardRef.current = item;
    pasteCountRef.current = 0;
    try {
      localStorage.setItem('mutrose_clipboard', JSON.stringify(item));
    } catch {
      // ignore
    }

    store.removeElement(el.id);
    canvasRef.current?.select(null);
    selectedElementRef.current = null;
  }, [store]);

  const handlePaste = useCallback(() => {
    let item = clipboardRef.current;
    if (!item) {
      try {
        const raw = localStorage.getItem('mutrose_clipboard');
        if (raw) {
          item = JSON.parse(raw) as ClipboardItem;
          clipboardRef.current = item;
        }
      } catch {
        // ignore
      }
    }
    if (!item) return;

    pasteCountRef.current += 1;
    const offset = 40 * pasteCountRef.current;
    const model = store.getModel();

    let targetParent: string | undefined;
    let x = item.originalPosition.x + offset;
    let y = item.originalPosition.y + offset;

    if (isActorKind(item.kind)) {
      targetParent = undefined;
    } else {
      const sel = selectedElementRef.current;
      let targetActor: IstarElement | undefined;
      if (sel && sel.type === 'element') {
        const selEl = model.elements.get(sel.id);
        if (selEl) {
          if (isActorKind(selEl.kind)) {
            targetActor = selEl;
          } else if (selEl.parent) {
            targetActor = model.elements.get(selEl.parent);
          }
        }
      }

      if (!targetActor && item.originalParent) {
        targetActor = model.elements.get(item.originalParent);
      }

      if (!targetActor) {
        targetActor = Array.from(model.elements.values()).find((el) => isActorKind(el.kind));
      }

      if (targetActor) {
        targetParent = targetActor.id;
        if (item.originalParent && targetActor.id !== item.originalParent) {
          const originalActor = model.elements.get(item.originalParent);
          if (originalActor) {
            const relX = item.originalPosition.x - originalActor.x;
            const relY = item.originalPosition.y - originalActor.y;
            x = targetActor.x + relX + offset;
            y = targetActor.y + relY + offset;
          }
        }
      }
    }

    let newName: string;
    if (item.isCut) {
      const nameExists = Array.from(model.elements.values()).some((el) => el.name === item.name);
      if (!nameExists) {
        newName = item.name;
      } else {
        newName = getNextName(model, item.kind, item.name, false);
      }
      item.isCut = false;
    } else {
      newName = getNextName(model, item.kind, item.name, true);
    }

    let createdId: string | null = null;
    store.transaction(() => {
      const created = store.addElement({
        kind: item.kind,
        name: newName,
        x: Math.round(x),
        y: Math.round(y),
        parent: targetParent,
        customProperties: item.customProperties ? { ...item.customProperties } : undefined,
        display: item.display ? { ...item.display } : undefined,
      });
      createdId = created.id;
    });

    if (createdId) {
      const idToFocus = createdId;
      canvasRef.current?.select({ type: 'element', id: idToFocus });
      setTimeout(() => {
        canvasRef.current?.select({ type: 'element', id: idToFocus });
        void canvasRef.current?.centerOn(idToFocus, { duration: 150 });
      }, 50);
    }
  }, [store]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      console.log("aqui" ,event)
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === 'c') {
        console.log("cc")
        handleCopy();
      } else if (key === 'x') {
        event.preventDefault();
        handleCut();
      } else if (key === 'v') {
        event.preventDefault();
        handlePaste();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handleCut, handlePaste]);

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
