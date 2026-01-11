import type { Entry, Goal, Group, Tracker } from '../db/types';

export interface GoalProgress {
  current: number;
  target: number;
  percent: number;
  periodLabel: string;
  scopeLabel: string;
  detailLabel: string;
}

const toDateString = (date: Date) => date.toISOString().split('T')[0];

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatShortDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value % 1) < 0.001) return Math.round(value).toString();
  return value.toFixed(1);
};

const getDateRange = (goal: Goal) => {
  const today = new Date();
  const end = toDateString(today);

  if (goal.period === 'daily') {
    return { start: end, end };
  }

  if (goal.period === 'weekly') {
    const startDate = addDays(today, -6);
    return { start: toDateString(startDate), end };
  }

  if (goal.period === 'monthly') {
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { start: toDateString(startDate), end };
  }

  if (goal.period === 'yearly') {
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    return { start: toDateString(startDate), end };
  }

  return {
    start: goal.startDate || end,
    end: goal.endDate || end,
  };
};

const getGroupTrackerIds = (groupId: string | undefined, groups: Group[], trackers: Tracker[]) => {
  if (!groupId) return [];
  const group = groups.find((item) => item._id === groupId);
  if (!group) return [];
  const prefix = `${group.path}/`;
  const groupIds = groups
    .filter((item) => item._id === groupId || item.path.startsWith(prefix))
    .map((item) => item._id);

  return trackers
    .filter((tracker) => {
      if (groupIds.includes(tracker.groupId)) return true;
      return tracker.additionalGroupIds?.some((extra) => groupIds.includes(extra));
    })
    .map((tracker) => tracker._id);
};

export function computeGoalProgress(
  goal: Goal,
  entries: Entry[],
  groups: Group[],
  trackers: Tracker[],
): GoalProgress {
  const { start, end } = getDateRange(goal);
  const trackerIds = goal.groupId
    ? getGroupTrackerIds(goal.groupId, groups, trackers)
    : goal.trackerIds;
  const trackerIdSet = new Set(trackerIds);
  const fieldNameSet =
    !goal.groupId && goal.fieldNames && goal.fieldNames.length > 0
      ? new Set(goal.fieldNames)
      : null;

  const dataPoints: Array<{ value: number; date: string; timestamp: string }> = [];
  const dateSet = new Set<string>();

  for (const entry of entries) {
    if (entry.date < start || entry.date > end) continue;

    for (const data of entry.data) {
      if (!trackerIdSet.has(data.trackerId) || data.skipped) continue;

      const entriesToCheck = fieldNameSet
        ? Object.entries(data.values)
            .filter(([key]) => fieldNameSet.has(key))
            .map(([, value]) => value)
        : Object.values(data.values);

      const numericValues = entriesToCheck.filter(
        (value) => typeof value === 'number' && Number.isFinite(value),
      ) as number[];

      const value =
        numericValues.length > 0 ? numericValues.reduce((sum, item) => sum + item, 0) : 0;

      dataPoints.push({ value, date: entry.date, timestamp: entry.timestamp });
      dateSet.add(entry.date);
    }
  }

  let current = 0;
  let detailLabel = '';

  if (goal.type === 'frequency') {
    current = dateSet.size;
    detailLabel = `${current} day${current !== 1 ? 's' : ''}`;
  } else if (goal.type === 'streak') {
    let streak = 0;
    let cursor = new Date(`${end}T00:00:00Z`);
    const startDate = new Date(`${start}T00:00:00Z`);

    while (cursor >= startDate) {
      const day = toDateString(cursor);
      if (!dateSet.has(day)) break;
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    current = streak;
    detailLabel = `${current} day streak`;
  } else {
    if (dataPoints.length > 0) {
      const values = dataPoints.map((item) => item.value);
      if (goal.aggregation === 'count') {
        current = dataPoints.length;
      } else if (goal.aggregation === 'sum') {
        current = values.reduce((sum, item) => sum + item, 0);
      } else if (goal.aggregation === 'average') {
        current = values.reduce((sum, item) => sum + item, 0) / values.length;
      } else if (goal.aggregation === 'max') {
        current = Math.max(...values);
      } else if (goal.aggregation === 'min') {
        current = Math.min(...values);
      } else if (goal.aggregation === 'latest') {
        const latest = dataPoints.reduce((prev, curr) => {
          return curr.timestamp > prev.timestamp ? curr : prev;
        });
        current = latest.value;
      }
    }

    detailLabel = `${formatNumber(current)}${goal.targetUnit ? ` ${goal.targetUnit}` : ''}`;
  }

  const percent = goal.target > 0 ? Math.min(100, (current / goal.target) * 100) : 0;
  const periodLabel = `${formatShortDate(start)} - ${formatShortDate(end)}`;

  let scopeLabel = `${trackerIds.length} tracker${trackerIds.length !== 1 ? 's' : ''}`;
  if (goal.groupId) {
    const groupName = groups.find((group) => group._id === goal.groupId)?.name || 'Unknown group';
    scopeLabel = groupName;
  } else if (trackerIds.length === 1) {
    scopeLabel = trackers.find((tracker) => tracker._id === trackerIds[0])?.label || scopeLabel;
  }

  return {
    current,
    target: goal.target,
    percent,
    periodLabel,
    scopeLabel,
    detailLabel,
  };
}
