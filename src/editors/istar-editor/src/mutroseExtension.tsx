import type { IstarModel } from '@istar-ts/core';
import { defineProperties, prop } from '@istar-ts/core';
import type { ElementComponentProps, IstarExtension } from '@istar-ts/react';
import {
  DefaultElementComponent,
  ElementIssuesBadge,
  useTypedProperties,
} from '@istar-ts/react';
import type { CSSProperties, ReactElement } from 'react';

const GOAL_TYPES = ['Perform', 'Achieve', 'Query'] as const;

export const mutroseGoalProperties = defineProperties('istar.Goal', {
  Description: prop.string({ default: '', label: 'Description' }),
  GoalType: prop.enum([...GOAL_TYPES], { default: 'Perform', label: 'Goal type' }),
  QueriedProperty: prop.string({ label: 'Queried property' }),
  AchieveCondition: prop.string({ label: 'Achieve condition' }),
  Controls: prop.string({ label: 'Controls' }),
  Monitors: prop.string({ label: 'Monitors' }),
  Group: prop.string({ label: 'Group' }),
});

export const mutroseTaskProperties = defineProperties('istar.Task', {
  Description: prop.string({ default: '', label: 'Description' }),
  Location: prop.string({ label: 'Location' }),
  Params: prop.string({ label: 'Params' }),
});

function nextNumber(model: IstarModel, prefix: RegExp): number {
  let max = 0;
  for (const el of model.elements.values()) {
    const match = el.name.match(prefix);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

const goalFill: Record<string, string> = {
  Achieve: '#86efac',
  Query: '#fdba74',
};

function GoalNode(props: ElementComponentProps): ReactElement {
  const { values } = useTypedProperties(mutroseGoalProperties, props.element, props.actions);
  const goalType = String(values.GoalType ?? 'Perform');
  const style: CSSProperties | undefined = goalFill[goalType]
    ? { ['--istar-node-fill' as string]: goalFill[goalType] }
    : undefined;
  return (
    <div className="mutrose-goal" data-goal-type={goalType} style={style}>
      <DefaultElementComponent {...props} />
      <ElementIssuesBadge issues={props.issues} />
    </div>
  );
}

function TaskNode(props: ElementComponentProps): ReactElement {
  return (
    <div className="mutrose-task">
      <DefaultElementComponent {...props} />
      <ElementIssuesBadge issues={props.issues} />
    </div>
  );
}

export const mutroseExtension: IstarExtension = {
  name: 'mutrose',
  elements: {
    'istar.Goal': {
      component: GoalNode,
      properties: mutroseGoalProperties,
      defaultName: ({ model }) => `G${nextNumber(model, /^G(\d+)/)}: New Goal`,
    },
    'istar.Task': {
      component: TaskNode,
      properties: mutroseTaskProperties,
      defaultName: ({ model }) => `AT${nextNumber(model, /^AT(\d+)/)}: New Task`,
    },
    'istar.Quality': { palette: false },
    'istar.Resource': { palette: false },
    'istar.Agent': { palette: false },
    'istar.Role': { palette: false },
  },
  links: {
    'istar.IsALink': { palette: false },
    'istar.ParticipatesInLink': { palette: false },
    'istar.DependencyLink': { palette: false },
    'istar.ContributionLink': { palette: false },
    'istar.NeededByLink': { palette: false },
    'istar.QualificationLink': { palette: false },
  },
};
