import { Sparkles } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { Goal, Group, Tracker } from '../../lib/db/types';
import { useAiJsonCompletion } from '../../lib/hooks/useAiJsonCompletion';
import { goalSchema } from '../../lib/schemas/goal.schema';
import ColorPicker from '../common/ColorPicker';
import EmojiPicker from '../common/EmojiPicker';
import FormErrorAlert from '../common/FormErrorAlert';
import FormField from '../common/FormField';
import FormFooter from '../common/FormFooter';
import FormGrid from '../common/FormGrid';
import FormHeader from '../common/FormHeader';
import FormSection from '../common/FormSection';
import JsonEditor from '../common/JsonEditor';

interface GoalFormProps {
  groups: Group[];
  trackers: Tracker[];
  onSubmit: (data: Omit<Goal, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel?: () => void;
  initialData?: Goal;
}

type GoalScope = 'trackers' | 'group';

const typeOptions: Goal['type'][] = ['target', 'cumulative', 'frequency', 'streak', 'duration'];
const periodOptions: Goal['period'][] = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
const aggregationOptions: Goal['aggregation'][] = [
  'sum',
  'count',
  'average',
  'max',
  'min',
  'latest',
];

const validateJsonGoal = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return ['Goal JSON must be an object.'];
  }

  const data = value as Record<string, unknown>;
  const errors: string[] = [];

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) errors.push('name is required.');

  if (typeof data.type !== 'string' || !typeOptions.includes(data.type as Goal['type'])) {
    errors.push(`type must be one of: ${typeOptions.join(', ')}.`);
  }

  if (typeof data.period !== 'string' || !periodOptions.includes(data.period as Goal['period'])) {
    errors.push(`period must be one of: ${periodOptions.join(', ')}.`);
  }

  if (
    typeof data.aggregation !== 'string' ||
    !aggregationOptions.includes(data.aggregation as Goal['aggregation'])
  ) {
    errors.push(`aggregation must be one of: ${aggregationOptions.join(', ')}.`);
  }

  const target = typeof data.target === 'number' ? data.target : Number.NaN;
  if (!Number.isFinite(target) || target <= 0) {
    errors.push('target must be a number greater than 0.');
  }

  const trackerIds = Array.isArray(data.trackerIds) ? data.trackerIds : [];
  const trackerIdValid = trackerIds.length > 0 && trackerIds.every((id) => typeof id === 'string');
  const groupId = data.groupId;

  if (groupId === undefined || groupId === null) {
    if (!trackerIdValid) {
      errors.push('trackerIds must include at least one tracker when groupId is not set.');
    }
  } else if (typeof groupId !== 'string') {
    errors.push('groupId must be a string when provided.');
  }

  if (data.fieldNames !== undefined && data.fieldNames !== null) {
    if (
      !Array.isArray(data.fieldNames) ||
      !data.fieldNames.every((name) => typeof name === 'string')
    ) {
      errors.push('fieldNames must be an array of strings when provided.');
    }
  }

  if (data.period === 'custom') {
    if (typeof data.startDate !== 'string' || !data.startDate) {
      errors.push('startDate is required when period is custom.');
    }
    if (typeof data.endDate !== 'string' || !data.endDate) {
      errors.push('endDate is required when period is custom.');
    }
  }

  return errors;
};

const toDateString = (value?: string) => {
  if (!value) return '';
  return value.split('T')[0];
};

export default function GoalFormV2(props: GoalFormProps) {
  const initialScope: GoalScope = props.initialData?.groupId ? 'group' : 'trackers';
  const [mode, setMode] = createSignal<'form' | 'json'>('form');

  // Form mode state
  const [name, setName] = createSignal(props.initialData?.name || '');
  const [description, setDescription] = createSignal(props.initialData?.description || '');
  const [scope, setScope] = createSignal<GoalScope>(initialScope);
  const [groupId, setGroupId] = createSignal(props.initialData?.groupId || '');
  const [selectedTrackerIds, setSelectedTrackerIds] = createSignal<Set<string>>(
    new Set(props.initialData?.trackerIds || []),
  );
  const [selectedFieldNames, setSelectedFieldNames] = createSignal<Set<string>>(
    new Set(props.initialData?.fieldNames || []),
  );
  const [type, setType] = createSignal<Goal['type']>(props.initialData?.type || 'target');
  const [target, setTarget] = createSignal(props.initialData?.target ?? 1);
  const [targetUnit, setTargetUnit] = createSignal(props.initialData?.targetUnit || '');
  const [period, setPeriod] = createSignal<Goal['period']>(props.initialData?.period || 'weekly');
  const [startDate, setStartDate] = createSignal(toDateString(props.initialData?.startDate));
  const [endDate, setEndDate] = createSignal(toDateString(props.initialData?.endDate));
  const [aggregation, setAggregation] = createSignal<Goal['aggregation']>(
    props.initialData?.aggregation || 'sum',
  );
  const [rollover, setRollover] = createSignal(props.initialData?.rollover || false);
  const [icon, setIcon] = createSignal(props.initialData?.icon || '');
  const [color, setColor] = createSignal(props.initialData?.color || '');

  const [jsonValue, setJsonValue] = createSignal(
    JSON.stringify(
      {
        name: props.initialData?.name || '',
        description: props.initialData?.description || '',
        trackerIds: props.initialData?.trackerIds || [],
        fieldNames: props.initialData?.fieldNames || [],
        groupId: props.initialData?.groupId || undefined,
        type: props.initialData?.type || 'target',
        target: props.initialData?.target ?? 1,
        targetUnit: props.initialData?.targetUnit || '',
        period: props.initialData?.period || 'weekly',
        startDate: props.initialData?.startDate || undefined,
        endDate: props.initialData?.endDate || undefined,
        aggregation: props.initialData?.aggregation || 'sum',
        rollover: props.initialData?.rollover || false,
        icon: props.initialData?.icon || '',
        color: props.initialData?.color || '',
        pinned: props.initialData?.pinned || false,
        sortOrder: props.initialData?.sortOrder || 0,
        archived: props.initialData?.archived || false,
      },
      null,
      2,
    ),
  );

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const aiGroups = createMemo(() =>
    props.groups.map((group) => ({
      id: group._id,
      name: group.name,
      path: group.path,
    })),
  );

  const aiTrackers = createMemo(() =>
    props.trackers.map((tracker) => ({
      id: tracker._id,
      label: tracker.label,
      tag: tracker.tag,
      groupId: tracker.groupId,
      fields: tracker.fields.map((field) => `${field.name} (${field.type})`),
    })),
  );

  const aiContextLines = createMemo(() => {
    const groupLines =
      aiGroups().length > 0
        ? aiGroups().map((group) => `- ${group.name} (${group.path}) -> ${group.id}`)
        : ['- No groups available'];

    const trackerLines =
      aiTrackers().length > 0
        ? aiTrackers().map(
            (tracker) =>
              `- ${tracker.label} (#${tracker.tag}) -> ${tracker.id} [group: ${tracker.groupId}] fields: ${tracker.fields.join(
                ', ',
              )}`,
          )
        : ['- No trackers available'];

    return [
      'Available groups (name | path | id):',
      ...groupLines,
      '',
      'Available trackers (label | tag | id | group | fields):',
      ...trackerLines,
    ];
  });

  const {
    aiOpen,
    setAiOpen,
    aiPrompt,
    setAiPrompt,
    aiLoading,
    aiError,
    aiEnabled,
    reduceMotion,
    handleGenerateJson,
    clearAiError,
  } = useAiJsonCompletion({
    schema: goalSchema,
    getPromptContext: () => aiContextLines(),
    getJsonValue: jsonValue,
    onJsonReady: setJsonValue,
  });

  const groupMap = createMemo(() => {
    const map = new Map<string, Group>();
    props.groups.forEach((group) => map.set(group._id, group));
    return map;
  });

  const getGroupTrackerIds = (id: string): string[] => {
    if (!id) return [];
    const group = groupMap().get(id);
    if (!group) return [];
    const prefix = `${group.path}/`;
    const groupIds = props.groups
      .filter((g) => g._id === id || g.path.startsWith(prefix))
      .map((g) => g._id);

    return props.trackers
      .filter((tracker) => {
        if (groupIds.includes(tracker.groupId)) return true;
        return tracker.additionalGroupIds?.some((extra) => groupIds.includes(extra));
      })
      .map((tracker) => tracker._id);
  };

  const selectedTrackerCount = createMemo(() => selectedTrackerIds().size);
  const groupTrackerCount = createMemo(() => getGroupTrackerIds(groupId()).length);

  const availableFieldNames = createMemo(() => {
    const trackerIds =
      scope() === 'group' ? getGroupTrackerIds(groupId()) : Array.from(selectedTrackerIds());
    const fieldSet = new Set<string>();
    props.trackers
      .filter((tracker) => trackerIds.includes(tracker._id))
      .forEach((tracker) => {
        tracker.fields.forEach((field) => fieldSet.add(field.name));
      });
    return Array.from(fieldSet).sort();
  });

  createEffect(() => {
    const available = new Set(availableFieldNames());
    const next = new Set(Array.from(selectedFieldNames()).filter((field) => available.has(field)));
    if (next.size !== selectedFieldNames().size) {
      setSelectedFieldNames(next);
    }
  });

  createEffect(() => {
    if (scope() !== 'group') return;
    if (selectedFieldNames().size > 0) {
      setSelectedFieldNames(new Set<string>());
    }
  });

  const toggleTracker = (id: string) => {
    const current = new Set(selectedTrackerIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    setSelectedTrackerIds(current);
  };

  const toggleFieldName = (name: string) => {
    const current = new Set(selectedFieldNames());
    if (current.has(name)) {
      current.delete(name);
    } else {
      current.add(name);
    }
    setSelectedFieldNames(current);
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && props.onCancel) {
        e.preventDefault();
        props.onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name().trim()) {
      errors.name = 'Name is required';
    }

    if (scope() === 'group' && !groupId()) {
      errors.groupId = 'Please select a group';
    }

    if (scope() === 'trackers' && selectedTrackerIds().size === 0) {
      errors.trackerIds = 'Select at least one tracker';
    }

    if (!target() || target() <= 0) {
      errors.target = 'Target must be greater than 0';
    }

    if (period() === 'custom') {
      if (!startDate() || !endDate()) {
        errors.period = 'Custom period requires start and end dates';
      } else if (startDate() > endDate()) {
        errors.period = 'Start date must be before end date';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (mode() === 'json') {
      try {
        const data = JSON.parse(jsonValue());
        const jsonErrors = validateJsonGoal(data);
        if (jsonErrors.length > 0) {
          throw new Error(`JSON validation failed: ${jsonErrors.join(' ')}`);
        }

        setSubmitting(true);
        await props.onSubmit(data);

        setJsonValue(
          JSON.stringify(
            {
              name: '',
              description: '',
              trackerIds: [],
              fieldNames: [],
              groupId: undefined,
              type: 'target',
              target: 1,
              targetUnit: '',
              period: 'weekly',
              startDate: undefined,
              endDate: undefined,
              aggregation: 'sum',
              rollover: false,
              icon: '',
              color: '',
              pinned: false,
              sortOrder: 0,
              archived: false,
            },
            null,
            2,
          ),
        );
      } catch (err) {
        setError(`JSON Error: ${(err as Error).message}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateForm()) {
      setError('Please fix the validation errors below');
      return;
    }

    setSubmitting(true);
    try {
      const resolvedTrackerIds =
        scope() === 'group' ? getGroupTrackerIds(groupId()) : Array.from(selectedTrackerIds());

      await props.onSubmit({
        name: name().trim(),
        description: description().trim() || undefined,
        trackerIds: resolvedTrackerIds,
        fieldNames:
          scope() === 'trackers' && selectedFieldNames().size
            ? Array.from(selectedFieldNames())
            : undefined,
        groupId: scope() === 'group' ? groupId() : undefined,
        type: type(),
        target: Number(target()),
        targetUnit: targetUnit().trim() || undefined,
        period: period(),
        startDate: period() === 'custom' ? startDate() : undefined,
        endDate: period() === 'custom' ? endDate() : undefined,
        aggregation: aggregation(),
        rollover: rollover(),
        icon: icon().trim() || undefined,
        color: color().trim() || undefined,
        pinned: props.initialData?.pinned || false,
        sortOrder: props.initialData?.sortOrder || 0,
        archived: props.initialData?.archived || false,
      });

      setName('');
      setDescription('');
      setScope('trackers');
      setGroupId('');
      setSelectedTrackerIds(new Set<string>());
      setSelectedFieldNames(new Set<string>());
      setType('target');
      setTarget(1);
      setTargetUnit('');
      setPeriod('weekly');
      setStartDate('');
      setEndDate('');
      setAggregation('sum');
      setRollover(false);
      setIcon('');
      setColor('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = () =>
    submitting() ? 'Saving...' : props.initialData ? 'Update Goal' : 'Create Goal';

  return (
    <div class="flex h-full flex-col">
      <FormHeader
        title={props.initialData ? 'Edit Goal' : 'Create New Goal'}
        subtitle={
          mode() === 'form'
            ? 'Set targets for trackers or entire groups'
            : 'Advanced JSON editing mode'
        }
        mode={mode()}
        onModeChange={setMode}
        onCancel={props.onCancel}
      />

      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <Show when={mode() === 'form'}>
          <form id="goal-form" class="space-y-8" onSubmit={handleSubmit}>
            <FormSection title="Basics">
              <FormField label="Goal Name" required error={validationErrors().name}>
                <input
                  type="text"
                  class="input input-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                  classList={{ 'input-error': !!validationErrors().name }}
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="Weekly Training Volume"
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  class="textarea textarea-bordered bg-base-100 text-base-content min-h-[96px]"
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  placeholder="Optional notes about this goal"
                />
              </FormField>
            </FormSection>

            <FormSection title="Scope">
              <FormField label="Scope">
                <div class="join w-full">
                  <button
                    type="button"
                    class={`btn join-item flex-1 ${scope() === 'trackers' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('trackers')}
                  >
                    Trackers
                  </button>
                  <button
                    type="button"
                    class={`btn join-item flex-1 ${scope() === 'group' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setScope('group')}
                  >
                    Group
                  </button>
                </div>
              </FormField>

              <Show when={scope() === 'group'}>
                <FormField
                  label="Group"
                  error={validationErrors().groupId}
                  labelClass="flex items-center justify-between"
                >
                  <span slot="label-extra" class="text-base-content/60 text-xs tabular-nums">
                    {groupTrackerCount()} tracker{groupTrackerCount() !== 1 ? 's' : ''} linked
                  </span>
                  <select
                    class="select select-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    classList={{ 'select-error': !!validationErrors().groupId }}
                    value={groupId()}
                    onChange={(e) => setGroupId(e.currentTarget.value)}
                  >
                    <option value="">Select a group</option>
                    <For each={props.groups.filter((group) => !group.archived)}>
                      {(group) => <option value={group._id}>{group.name}</option>}
                    </For>
                  </select>
                </FormField>
              </Show>

              <Show when={scope() === 'trackers'}>
                <FormField
                  label="Trackers"
                  error={validationErrors().trackerIds}
                  labelClass="flex items-center justify-between"
                >
                  <span slot="label-extra" class="text-base-content/60 text-xs tabular-nums">
                    {selectedTrackerCount()} selected
                  </span>
                  <div
                    class={`border-base-300 max-h-56 space-y-2 overflow-y-auto rounded-xl border p-3 ${
                      validationErrors().trackerIds ? 'border-error' : ''
                    }`}
                  >
                    <For each={props.trackers.filter((tracker) => !tracker.archived)}>
                      {(tracker) => (
                        <label class="hover:bg-base-200/70 flex cursor-pointer items-center gap-3 rounded-lg p-2">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm"
                            checked={selectedTrackerIds().has(tracker._id)}
                            onChange={() => toggleTracker(tracker._id)}
                          />
                          <span class="text-sm font-medium">{tracker.label}</span>
                          <span class="text-base-content/50 font-mono text-xs">#{tracker.tag}</span>
                        </label>
                      )}
                    </For>
                  </div>
                </FormField>
              </Show>

              <Show when={scope() === 'trackers' && availableFieldNames().length > 0}>
                <FormField
                  label="Fields to Track"
                  help="Leave empty to include all numeric fields."
                  labelClass="flex items-center justify-between"
                >
                  <span slot="label-extra" class="text-base-content/60 text-xs tabular-nums">
                    {selectedFieldNames().size || 'All'} selected
                  </span>
                  <div class="border-base-300 max-h-48 space-y-2 overflow-y-auto rounded-xl border p-3">
                    <For each={availableFieldNames()}>
                      {(fieldName) => (
                        <label class="hover:bg-base-200/70 flex cursor-pointer items-center gap-3 rounded-lg p-2">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm"
                            checked={selectedFieldNames().has(fieldName)}
                            onChange={() => toggleFieldName(fieldName)}
                          />
                          <span class="text-sm font-medium">{fieldName}</span>
                        </label>
                      )}
                    </For>
                  </div>
                </FormField>
              </Show>
            </FormSection>

            <FormSection title="Target & Timing">
              <FormGrid>
                <FormField label="Type">
                  <select
                    class="select select-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    value={type()}
                    onChange={(e) => setType(e.currentTarget.value as Goal['type'])}
                  >
                    <For each={typeOptions}>
                      {(option) => <option value={option}>{option}</option>}
                    </For>
                  </select>
                </FormField>

                <FormField label="Aggregation">
                  <select
                    class="select select-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    value={aggregation()}
                    onChange={(e) => setAggregation(e.currentTarget.value as Goal['aggregation'])}
                  >
                    <For each={aggregationOptions}>
                      {(option) => <option value={option}>{option}</option>}
                    </For>
                  </select>
                </FormField>
              </FormGrid>

              <FormGrid>
                <FormField label="Target" required error={validationErrors().target}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    class="input input-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    classList={{ 'input-error': !!validationErrors().target }}
                    value={target()}
                    onInput={(e) => setTarget(Number(e.currentTarget.value))}
                  />
                </FormField>

                <FormField label="Target Unit">
                  <input
                    type="text"
                    class="input input-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    value={targetUnit()}
                    onInput={(e) => setTargetUnit(e.currentTarget.value)}
                    placeholder="kg, sessions, ml"
                  />
                </FormField>
              </FormGrid>

              <FormGrid>
                <FormField label="Period">
                  <select
                    class="select select-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    value={period()}
                    onChange={(e) => setPeriod(e.currentTarget.value as Goal['period'])}
                  >
                    <For each={periodOptions}>
                      {(option) => <option value={option}>{option}</option>}
                    </For>
                  </select>
                </FormField>

                <FormField label="Rollover">
                  <div class="mt-3">
                    <input
                      type="checkbox"
                      class="toggle toggle-primary"
                      checked={rollover()}
                      onChange={(e) => setRollover(e.currentTarget.checked)}
                    />
                  </div>
                </FormField>
              </FormGrid>

              <Show when={period() === 'custom'}>
                <FormGrid>
                  <FormField label="Start Date">
                    <input
                      type="date"
                      class="input input-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                      value={startDate()}
                      onInput={(e) => setStartDate(e.currentTarget.value)}
                    />
                  </FormField>

                  <FormField label="End Date">
                    <input
                      type="date"
                      class="input input-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                      value={endDate()}
                      onInput={(e) => setEndDate(e.currentTarget.value)}
                    />
                  </FormField>
                </FormGrid>
                <Show when={validationErrors().period}>
                  <p class="text-error mt-1 text-xs">{validationErrors().period}</p>
                </Show>
              </Show>
            </FormSection>

            <FormSection title="Style">
              <FormGrid>
                <EmojiPicker value={icon()} onChange={setIcon} label="Icon" />
                <ColorPicker value={color()} onChange={setColor} label="Color" />
              </FormGrid>
            </FormSection>

            <FormErrorAlert message={error()} />
          </form>
        </Show>

        <Show when={mode() === 'json'}>
          <form id="goal-form" class="space-y-4" onSubmit={handleSubmit}>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="alert alert-info flex-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  class="h-6 w-6 shrink-0 stroke-current"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <div class="font-bold">Edit the entire goal as JSON</div>
                  <div class="text-sm">
                    Press Ctrl+Space for autocomplete. Required: name, type, target, period,
                    aggregation
                  </div>
                </div>
              </div>
              <Show when={aiEnabled()}>
                <button
                  type="button"
                  class={`btn btn-sm ${aiOpen() ? 'btn-primary' : 'btn-ghost'} gap-2`}
                  onClick={() => {
                    setAiOpen((prev) => !prev);
                    clearAiError();
                  }}
                >
                  <Sparkles class="size-4" />
                  AI
                </button>
              </Show>
            </div>

            <Show when={aiEnabled() && aiOpen()}>
              <div
                class={`border-base-300 bg-base-200/70 space-y-3 rounded-xl border p-4 transition-all ${
                  reduceMotion() ? '' : 'animate-fade-in-up'
                }`}
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-base-content/80 text-sm font-semibold">
                    Describe the goal you want
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onClick={() => setAiOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <textarea
                  class="textarea textarea-bordered bg-base-100 w-full text-sm"
                  rows={3}
                  placeholder="Example: Weekly goal for hydration with target 14000 ml using the Water tracker."
                  value={aiPrompt()}
                  onInput={(e) => setAiPrompt(e.currentTarget.value)}
                />

                <Show when={aiError()}>
                  <div class="alert alert-error">
                    <span class="text-sm">{aiError()}</span>
                  </div>
                </Show>

                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="text-base-content/60 text-xs">
                    AI will populate trackerIds or groupId based on your prompt.
                  </div>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm gap-2"
                    disabled={!aiPrompt().trim() || aiLoading()}
                    onClick={handleGenerateJson}
                  >
                    <Show when={aiLoading()}>
                      <span class="loading loading-spinner loading-xs" />
                    </Show>
                    Generate JSON
                  </button>
                </div>
              </div>
            </Show>

            <FormErrorAlert message={aiError() || error()} />

            <JsonEditor
              value={jsonValue()}
              onChange={setJsonValue}
              schema={goalSchema}
              height="520px"
            />
          </form>
        </Show>
      </div>

      <FormFooter
        formId="goal-form"
        submitting={submitting()}
        submitLabel={submitLabel()}
        onCancel={props.onCancel}
      />
    </div>
  );
}
