/**
 * The `mutrose.istarTsReactFlowStyle` look: the @istar-ts editor drawn like the legacy
 * gm-editor (React Flow) webview. Everything MutRoSe-specific lives here; istar-ts only
 * provides the generic hooks (frameless actors, preset tool properties, custom side bar).
 */
import type { Tool } from '@istar-ts/react';
import type { ElementComponentProps, IstarExtension } from '@istar-ts/react';
import {
  EditableLabel,
  ElementIssuesBadge,
  useIstarEditor,
  useTypedProperties,
} from '@istar-ts/react';
import type { ReactElement, ReactNode } from 'react';
import { mutroseGoalProperties } from './mutroseExtension';

export interface LspDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  nodeId?: string;
  range?: { start: { line: number; character: number } };
}

/** Legacy goal colours by GoalType (gm-editor's nodes/Goal.tsx). */
const GOAL_FILL: Record<string, string> = { Achieve: 'green', Query: 'orange' };

function outline(issues: ElementComponentProps['issues']): { stroke: string; width: number } {
  if (issues.some((i) => i.severity === 'error')) return { stroke: '#ef4444', width: 3 };
  if (issues.some((i) => i.severity === 'warning')) return { stroke: '#f59e0b', width: 3 };
  return { stroke: 'black', width: 2 };
}

/** A node drawn as a stretched 130x36 shape with the name centred on it, like gm-editor's. */
function LegacyNode({
  props,
  shape,
}: {
  props: ElementComponentProps;
  shape: (stroke: { stroke: string; width: number }) => ReactNode;
}): ReactElement {
  const { element, width, height, editing, setEditing, actions, issues } = props;
  return (
    <div className="rf-node" style={{ width, height }}>
      <svg
        className="istar-shape"
        viewBox="0 0 130 36"
        preserveAspectRatio="none"
        width={width}
        height={height}
        aria-hidden
      >
        {shape(outline(issues))}
      </svg>
      <EditableLabel
        className="rf-label"
        value={element.name}
        editing={editing}
        onCommit={actions.rename}
        onDone={() => setEditing(false)}
      />
      <ElementIssuesBadge issues={issues} />
    </div>
  );
}

function GoalNode(props: ElementComponentProps): ReactElement {
  const { values } = useTypedProperties(mutroseGoalProperties, props.element, props.actions);
  const fill = GOAL_FILL[String(values.GoalType ?? 'Perform')] ?? 'white';
  return (
    <LegacyNode
      props={props}
      shape={({ stroke, width }) => (
        <rect
          width="130"
          height="36"
          rx="20"
          fill={fill}
          stroke={stroke}
          strokeWidth={width}
          vectorEffect="non-scaling-stroke"
        />
      )}
    />
  );
}

function TaskNode(props: ElementComponentProps): ReactElement {
  return (
    <LegacyNode
      props={props}
      shape={({ stroke, width }) => (
        <polygon
          points="0,18 15,0 115,0 130,18 115,36 15,36"
          fill="white"
          stroke={stroke}
          strokeWidth={width}
          vectorEffect="non-scaling-stroke"
        />
      )}
    />
  );
}

/** The mission (actor) as React Flow's default node: a plain labelled box. */
function MissionNode(props: ElementComponentProps): ReactElement {
  const { element, editing, setEditing, actions } = props;
  return (
    <div className="rf-mission">
      <EditableLabel
        className="rf-label"
        value={element.name}
        editing={editing}
        onCommit={actions.rename}
        onDone={() => setEditing(false)}
      />
    </div>
  );
}

/** Applied after `mutroseExtension`: legacy shapes and sizes, and no actor boundary. */
export const reactFlowStyleExtension: IstarExtension = {
  name: 'mutrose-react-flow-style',
  elements: {
    'istar.Actor': { boundary: false, component: MissionNode, size: { width: 300, height: 40 } },
    'istar.Goal': { component: GoalNode, size: { width: 300, height: 60 } },
    'istar.Task': { component: TaskNode, size: { width: 300, height: 60 } },
  },
};

const TOOLS: { label: string; tool: Tool }[] = [
  { label: 'Achieve', tool: { type: 'element', kind: 'istar.Goal', properties: { GoalType: 'Achieve' } } },
  { label: 'Query', tool: { type: 'element', kind: 'istar.Goal', properties: { GoalType: 'Query' } } },
  { label: 'Perform', tool: { type: 'element', kind: 'istar.Goal', properties: { GoalType: 'Perform' } } },
  { label: 'Or Decomposition', tool: { type: 'link', kind: 'istar.OrRefinementLink' } },
  { label: 'And Decomposition', tool: { type: 'link', kind: 'istar.AndRefinementLink' } },
];

const sameTool = (a: Tool | null, b: Tool): boolean => JSON.stringify(a) === JSON.stringify(b);

/** gm-editor's side bar: creation tools, then the LSP diagnostics. */
export function ReactFlowSidebar({ diagnostics }: { diagnostics: readonly LspDiagnostic[] }): ReactElement {
  const { tool, setTool, readOnly } = useIstarEditor();
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  return (
    <aside className="rf-sidebar">
      {TOOLS.map(({ label, tool: t }) => {
        const active = sameTool(tool, t);
        return (
          <button
            key={label}
            type="button"
            className={`rf-tool${active ? ' is-active' : ''}`}
            aria-pressed={active}
            disabled={readOnly}
            onClick={() => setTool(active ? null : t)}
          >
            {label}
          </button>
        );
      })}
      <section className="rf-diagnostics">
        <header>
          <span className="rf-diagnostics-title">Diagnósticos LSP</span>
          <span className="rf-diagnostics-count">
            {errors} erros, {warnings} avisos
          </span>
        </header>
        {diagnostics.length === 0 ? (
          <div className="rf-valid">✓ Modelo Válido</div>
        ) : (
          <ul>
            {diagnostics.map((d, i) => {
              const isError = d.severity === 'error';
              return (
                <li key={i} className={isError ? 'is-error' : 'is-warning'}>
                  <div className="rf-diagnostic-head">
                    <span>{isError ? '✕ Erro' : '⚠ Aviso'}</span>
                    {d.range && <span className="rf-line">Linha {d.range.start.line + 1}</span>}
                  </div>
                  <div>{d.message}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
