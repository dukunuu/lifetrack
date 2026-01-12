import { createSignal, Show, For, onMount, onCleanup, createMemo } from 'solid-js';
import type { Tracker, Group, FieldDefinition } from '../../lib/db/types';
import JsonEditor from '../common/JsonEditor';
import FieldBuilder from './FieldBuilder';
import FormHeader from '../common/FormHeader';
import FormFooter from '../common/FormFooter';
import FormErrorAlert from '../common/FormErrorAlert';
import { trackerSchema } from '../../lib/schemas/tracker.schema';
import { Sparkles } from 'lucide-solid';
import { useAiJsonCompletion } from '../../lib/hooks/useAiJsonCompletion';

interface TrackerFormProps {
  groups: Group[];
  onSubmit: (data: Omit<Tracker, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel?: () => void;
  initialData?: Tracker;
}

const defaultFields: FieldDefinition[] = [
  {
    name: 'value',
    label: 'Value',
    type: 'number',
    required: true,
    sortOrder: 0,
  },
];

export default function TrackerFormV2(props: TrackerFormProps) {
  const [mode, setMode] = createSignal<'form' | 'json'>('form');

  // Form mode state
  const [label, setLabel] = createSignal(props.initialData?.label || '');
  const [tag, setTag] = createSignal(props.initialData?.tag || '');
  const [groupId, setGroupId] = createSignal(props.initialData?.groupId || '');
  const [additionalGroupIds, setAdditionalGroupIds] = createSignal<string[]>(
    props.initialData?.additionalGroupIds || [],
  );
  const [fields, setFields] = createSignal<FieldDefinition[]>(
    props.initialData?.fields || defaultFields,
  );
  const [aliases, setAliases] = createSignal(props.initialData?.aliases?.join(', ') || '');
  const [pinned, setPinned] = createSignal(props.initialData?.pinned || false);

  // JSON mode state
  const [jsonValue, setJsonValue] = createSignal(
    JSON.stringify(
      {
        label: props.initialData?.label || '',
        tag: props.initialData?.tag || '',
        groupId: props.initialData?.groupId || '',
        additionalGroupIds: props.initialData?.additionalGroupIds || [],
        fields: props.initialData?.fields || defaultFields,
        aliases: props.initialData?.aliases || [],
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
    props.groups.filter((group) => group.allowsTrackers).map((group) => ({
      id: group._id,
      name: group.name,
      path: group.path,
    })),
  );
  const selectableGroups = createMemo(() => props.groups.filter((group) => group.allowsTrackers));
  const additionalGroupOptions = createMemo(() =>
    selectableGroups().filter((group) => group._id !== groupId()),
  );
  const aiContextLines = createMemo(() => {
    const groupLines =
      aiGroups().length > 0
        ? aiGroups().map((group) => `- ${group.name} (${group.path}) -> ${group.id}`)
        : ['- No groups available'];
    return ['Available groups (name | path | id):', ...groupLines];
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
    schema: trackerSchema,
    getPromptContext: () => aiContextLines(),
    getJsonValue: jsonValue,
    onJsonReady: setJsonValue,
  });

  // Keyboard shortcuts
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

    if (!label().trim()) {
      errors.label = 'Label is required';
    }

    if (!groupId()) {
      errors.groupId = 'Please select a group';
    }

    if (fields().length === 0) {
      errors.fields = 'At least one field is required';
    }

    // Validate field names
    for (let i = 0; i < fields().length; i++) {
      const field = fields()[i];
      if (!field.name) {
        errors[`field_${i}_name`] = `Field ${i + 1}: name is required`;
      } else if (!/^[a-z][a-z0-9_]*$/.test(field.name)) {
        errors[`field_${i}_name`] =
          `Field ${i + 1}: name must be snake_case (lowercase, start with letter)`;
      }
      if (!field.label) {
        errors[`field_${i}_label`] = `Field ${i + 1}: label is required`;
      }
    }

    // Check for duplicate field names
    const names = fields()
      .map((f) => f.name)
      .filter(Boolean);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.fields = `Duplicate field names: ${[...new Set(duplicates)].join(', ')}`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (mode() === 'json') {
      // JSON mode validation
      try {
        const data = JSON.parse(jsonValue());

        if (
          !data.label ||
          !data.groupId ||
          !data.fields ||
          !Array.isArray(data.fields) ||
          data.fields.length === 0
        ) {
          throw new Error('Required fields: label, groupId, and at least one field');
        }

        setSubmitting(true);
        await props.onSubmit(data);

        // Reset
          setJsonValue(
            JSON.stringify(
              {
                label: '',
                tag: '',
                groupId: '',
                additionalGroupIds: [],
                fields: defaultFields,
                aliases: [],
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
    } else {
      // Form mode validation
      if (!validateForm()) {
        setError('Please fix the validation errors below');
        return;
      }

      setSubmitting(true);
      try {
        await props.onSubmit({
          tag: tag().trim() || (undefined as any),
          label: label().trim(),
          fields: fields(),
          groupId: groupId(),
          additionalGroupIds: Array.from(
            new Set(additionalGroupIds().filter((id) => id && id !== groupId())),
          ),
          aliases: aliases()
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          sortOrder: props.initialData?.sortOrder || 0,
          archived: props.initialData?.archived || false,
          pinned: pinned(),
        });

        // Reset form
        setLabel('');
        setTag('');
        setGroupId('');
        setAdditionalGroupIds([]);
        setFields(defaultFields);
        setAliases('');
        setPinned(false);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div class="flex h-full flex-col">
      <FormHeader
        title={props.initialData ? 'Edit Tracker' : 'Create New Tracker'}
        subtitle={
          mode() === 'form'
            ? 'Define what data this tracker captures'
            : 'Advanced JSON editing mode'
        }
        mode={mode()}
        onModeChange={setMode}
        onCancel={props.onCancel}
        containerClass="bg-linear-to-br from-base-200 to-base-300"
        titleClass="bg-linear-to-r from-primary to-secondary"
      />

      <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <FormErrorAlert message={error()} class="mb-4" />

        <form id="tracker-form" onSubmit={handleSubmitForm}>
          {/* Form Mode */}
          <Show when={mode() === 'form'}>
            <div class="space-y-8">
              {/* Basic Info Section */}
              <div class="space-y-4">
                <h3 class="text-base-content/90 border-primary/20 flex items-center gap-2 border-b pb-2 text-lg font-bold">
                  Basic Information
                </h3>

                {/* Label */}
                <div class="form-control">
                  <label class="mb-2 block">
                    <span class="text-base-content text-sm font-semibold sm:text-base">
                      Label *
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Barbell Bench Press"
                    class="input input-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    classList={{
                      'input-error': !!validationErrors().label,
                    }}
                    value={label()}
                    onInput={(e) => {
                      setLabel(e.currentTarget.value);
                      if (validationErrors().label) {
                        const errors = { ...validationErrors() };
                        delete errors.label;
                        setValidationErrors(errors);
                      }
                    }}
                    required
                  />
                  <Show when={validationErrors().label}>
                    <p class="text-error mt-1 text-xs">{validationErrors().label}</p>
                  </Show>
                  <Show when={!validationErrors().label}>
                    <p class="text-base-content/60 mt-1.5 text-xs sm:text-sm">
                      Display name for this tracker
                    </p>
                  </Show>
                </div>

                {/* Tag */}
                <div class="form-control">
                  <label class="mb-2 block">
                    <span class="text-base-content text-sm font-semibold sm:text-base">Tag</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., bench-press"
                    class="input input-bordered bg-base-100 text-base-content w-full text-base"
                    value={tag()}
                    onInput={(e) => setTag(e.currentTarget.value)}
                  />
                  <p class="text-base-content/60 mt-1.5 text-xs sm:text-sm">
                    Auto-generated from label if empty. Used in quick-add syntax: #{tag() || 'tag'}
                  </p>
                </div>

                {/* Group */}
                <div class="form-control">
                  <label class="mb-2 block">
                    <span class="text-base-content text-sm font-semibold sm:text-base">
                      Group *
                    </span>
                  </label>
                  <select
                    class="select select-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    classList={{
                      'select-error': !!validationErrors().groupId,
                    }}
                    value={groupId()}
                    onChange={(e) => {
                      setGroupId(e.currentTarget.value);
                      setAdditionalGroupIds((prev) =>
                        prev.filter((id) => id !== e.currentTarget.value),
                      );
                      if (validationErrors().groupId) {
                        const errors = { ...validationErrors() };
                        delete errors.groupId;
                        setValidationErrors(errors);
                      }
                    }}
                    required
                  >
                    <option value="" disabled>
                      Select a group
                    </option>
                    <For each={selectableGroups()}>
                      {(group) => (
                        <option value={group._id}>
                          {'  '.repeat(group.depth)}
                          {group.name}
                        </option>
                      )}
                    </For>
                  </select>
                  <Show when={validationErrors().groupId}>
                    <p class="text-error mt-1 text-xs">{validationErrors().groupId}</p>
                  </Show>
                  <Show when={!validationErrors().groupId}>
                    <p class="text-base-content/60 mt-1.5 text-xs sm:text-sm">
                      Where this tracker belongs
                    </p>
                  </Show>
                </div>

                {/* Additional Groups */}
                <div class="form-control">
                  <label class="mb-2 block">
                    <span class="text-base-content text-sm font-semibold sm:text-base">
                      Additional Groups
                    </span>
                  </label>
                  <div class="border-base-300 bg-base-200/50 space-y-2 rounded-xl border p-3">
                    <Show
                      when={additionalGroupOptions().length > 0}
                      fallback={
                        <p class="text-base-content/60 text-xs sm:text-sm">
                          No other groups available.
                        </p>
                      }
                    >
                      <For each={additionalGroupOptions()}>
                        {(group) => (
                          <label class="border-base-content/10 hover:border-primary/30 bg-base-100 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-primary mt-0.5"
                              checked={additionalGroupIds().includes(group._id)}
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                setAdditionalGroupIds((prev) => {
                                  const next = new Set(prev);
                                  if (checked) {
                                    next.add(group._id);
                                  } else {
                                    next.delete(group._id);
                                  }
                                  next.delete(groupId());
                                  return Array.from(next);
                                });
                              }}
                            />
                            <span class="text-sm">
                              {'  '.repeat(group.depth)}
                              {group.name}
                            </span>
                          </label>
                        )}
                      </For>
                    </Show>
                  </div>
                  <p class="text-base-content/60 mt-1.5 text-xs sm:text-sm">
                    Show this tracker under multiple groups.
                  </p>
                </div>
              </div>

              {/* Fields Section */}
              <div class="space-y-4">
                <h3 class="text-base-content/90 border-primary/20 flex items-center gap-2 border-b pb-2 text-lg font-bold">
                  Fields
                </h3>
                <Show when={validationErrors().fields}>
                  <div class="alert alert-error">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 shrink-0 stroke-current"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span class="text-sm">{validationErrors().fields}</span>
                  </div>
                </Show>
                <FieldBuilder
                  fields={fields()}
                  onChange={setFields}
                  validationErrors={validationErrors()}
                  onClearValidationError={(key: string) => {
                    const errors = { ...validationErrors() };
                    delete errors[key];
                    setValidationErrors(errors);
                  }}
                />
              </div>

              {/* Advanced Section */}
              <div class="space-y-4">
                <h3 class="text-base-content/90 border-primary/20 flex items-center gap-2 border-b pb-2 text-lg font-bold">
                  Advanced Options
                </h3>

                {/* Aliases */}
                <div class="form-control">
                  <label class="mb-2 block">
                    <span class="text-base-content text-sm font-semibold sm:text-base">
                      Aliases
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="bench, bp"
                    class="input input-bordered bg-base-100 text-base-content w-full text-base"
                    value={aliases()}
                    onInput={(e) => setAliases(e.currentTarget.value)}
                  />
                  <p class="text-base-content/60 mt-1.5 text-xs sm:text-sm">
                    Comma-separated shortcuts for quick-add (e.g., #bench instead of #bench-press)
                  </p>
                </div>

                {/* Pinned */}
                <div class="form-control">
                  <label class="border-base-content/10 hover:border-primary/30 bg-base-200 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-primary mt-0.5"
                      checked={pinned()}
                      onChange={(e) => setPinned(e.currentTarget.checked)}
                    />
                    <div class="flex-1">
                      <span class="text-base-content/90 block text-sm font-semibold">
                        Pin to quick access
                      </span>
                      <p class="text-base-content/60 mt-1 text-xs">
                        Show this tracker in the dashboard for easy access
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </Show>

          {/* JSON Mode */}
          <Show when={mode() === 'json'}>
            <div class="space-y-4">
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
                    <div class="font-bold">Edit the entire tracker as JSON</div>
                    <div class="text-sm">
                      Press Ctrl+Space for autocomplete. Required: label, groupId, fields
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
                      Describe the tracker you want
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
                    placeholder="Example: A hydration tracker with a single number field in milliliters."
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
                      AI will fill the full schema and pick the best groupId.
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

                <JsonEditor
                  value={jsonValue()}
                  onChange={setJsonValue}
                  schema={trackerSchema}
                  height="600px"
              />
            </div>
          </Show>
        </form>
      </div>

      <FormFooter
        formId="tracker-form"
        submitting={submitting()}
        submitLabel={props.initialData ? 'Update Tracker' : 'Create Tracker'}
        onCancel={props.onCancel}
      />
    </div>
  );
}
