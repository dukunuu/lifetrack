import { Sparkles } from 'lucide-solid';
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { Group } from '../../lib/db/types';
import { useAiJsonCompletion } from '../../lib/hooks/useAiJsonCompletion';
import { useGroups } from '../../lib/hooks/useGroups';
import { groupSchema } from '../../lib/schemas/group.schema';
import ColorPicker from '../common/ColorPicker';
import EmojiPicker from '../common/EmojiPicker';
import FormErrorAlert from '../common/FormErrorAlert';
import FormField from '../common/FormField';
import FormFooter from '../common/FormFooter';
import FormGrid from '../common/FormGrid';
import FormHeader from '../common/FormHeader';
import FormSection from '../common/FormSection';
import JsonEditor from '../common/JsonEditor';

interface GroupFormProps {
  onSubmit: (data: Omit<Group, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel?: () => void;
  initialData?: Group;
}

export default function GroupFormV2(props: GroupFormProps) {
  const { groups } = useGroups({ load: 'active' });
  const [mode, setMode] = createSignal<'form' | 'json'>('form');

  // Form mode state
  const [name, setName] = createSignal(props.initialData?.name || '');
  const [slug, setSlug] = createSignal(props.initialData?.slug || '');
  const [parentId, setParentId] = createSignal<string | null>(props.initialData?.parentId || null);
  const [description, setDescription] = createSignal(props.initialData?.description || '');
  const [icon, setIcon] = createSignal(props.initialData?.icon || '');
  const [color, setColor] = createSignal(props.initialData?.color || '');
  const [allowsTrackers, setAllowsTrackers] = createSignal(
    props.initialData?.allowsTrackers ?? true,
  );

  // JSON mode state
  const [jsonValue, setJsonValue] = createSignal(
    JSON.stringify(
      {
        name: props.initialData?.name || '',
        slug: props.initialData?.slug || '',
        parentId: props.initialData?.parentId || null,
        path: props.initialData?.path || '',
        description: props.initialData?.description || '',
        icon: props.initialData?.icon || '',
        color: props.initialData?.color || '',
        allowsTrackers: props.initialData?.allowsTrackers ?? true,
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
    groups().map((group) => ({
      id: group._id,
      name: group.name,
      path: group.path,
    })),
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
    schema: groupSchema,
    getPromptContext: () => aiContextLines(),
    getJsonValue: jsonValue,
    onJsonReady: setJsonValue,
  });

  const availableParents = createMemo(() => {
    const allGroups = groups();
    const editingGroup = props.initialData;

    if (!editingGroup) {
      return allGroups;
    }

    return allGroups
      .filter((g) => {
        const isSelf = g._id === editingGroup._id;

        const isDescendant = g.path.startsWith(`${editingGroup.path}/`);

        return !isSelf && !isDescendant;
      })
      .sort((a, b) => a.depth - b.depth);
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

    if (!name().trim()) {
      errors.name = 'Name is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (mode() === 'json') {
      // JSON mode validation
      try {
        const data = JSON.parse(jsonValue());

        if (!data.name) {
          throw new Error('Name is required');
        }

        setSubmitting(true);
        await props.onSubmit({
          ...data,
          path: '', // Will be calculated by repository
          depth: 0, // Will be calculated by repository
        });

        // Reset
        setJsonValue(
          JSON.stringify(
            {
              name: '',
              slug: '',
              parentId: null,
              description: '',
              icon: '',
              color: '',
              allowsTrackers: true,
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
          name: name().trim(),
          slug: slug().trim() || (undefined as any),
          parentId: parentId() || null,
          path: '', // Will be calculated by repository
          depth: 0, // Will be calculated by repository
          description: description().trim() || undefined,
          icon: icon().trim() || undefined,
          color: color().trim() || undefined,
          allowsTrackers: allowsTrackers(),
          sortOrder: props.initialData?.sortOrder || 0,
          archived: props.initialData?.archived || false,
        });

        // Reset form
        setName('');
        setSlug('');
        setParentId(null);
        setDescription('');
        setIcon('');
        setColor('');
        setAllowsTrackers(true);
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
        title={props.initialData ? 'Edit Group' : 'Create New Group'}
        subtitle={
          mode() === 'form'
            ? 'Organize your trackers into hierarchical groups'
            : 'Advanced JSON editing mode'
        }
        mode={mode()}
        onModeChange={setMode}
        onCancel={props.onCancel}
      />

      <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <FormErrorAlert message={error()} class="mb-4" />

        <form id="group-form" onSubmit={handleSubmit}>
          {/* Form Mode */}
          <Show when={mode() === 'form'}>
            <div class="space-y-8">
              {/* Basic Info Section */}
              <FormSection title="Basic Information">
                <FormField
                  label="Name"
                  required
                  error={validationErrors().name}
                  help="Display name for this group"
                >
                  <input
                    type="text"
                    placeholder="e.g., Fitness, Meals, Finances"
                    class="input input-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    classList={{
                      'input-error': !!validationErrors().name,
                    }}
                    value={name()}
                    onInput={(e) => {
                      setName(e.currentTarget.value);
                      if (validationErrors().name) {
                        const errors = { ...validationErrors() };
                        delete errors.name;
                        setValidationErrors(errors);
                      }
                    }}
                  />
                </FormField>

                <FormField
                  label="Slug"
                  help="Auto-generated from name if empty. URL-safe identifier for this group"
                >
                  <input
                    type="text"
                    placeholder="e.g., fitness"
                    class="input input-bordered bg-base-100 text-base-content w-full text-base"
                    value={slug()}
                    onInput={(e) => setSlug(e.currentTarget.value)}
                  />
                </FormField>

                <FormField
                  label="Parent Group"
                  help="Optional. Groups can be nested to organize your trackers hierarchically"
                >
                  <select
                    class="select select-bordered bg-base-100 text-base-content w-full text-base sm:text-lg"
                    value={parentId() || ''}
                    onChange={(e) => setParentId(e.currentTarget.value || null)}
                  >
                    <option value="" selected={!parentId()}>
                      None (Root Group)
                    </option>
                    <For each={availableParents()}>
                      {(group) => (
                        <option value={group._id} selected={group._id === parentId()}>
                          {'\u00A0'.repeat(group.depth * 2)}
                          {group.name}
                        </option>
                      )}
                    </For>
                  </select>
                </FormField>

                <FormField
                  label="Description"
                  help="Optional description of what this group contains"
                >
                  <textarea
                    class="textarea textarea-bordered bg-base-100 text-base-content h-24 w-full text-base"
                    placeholder="Describe what this group is for..."
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                  />
                </FormField>
              </FormSection>

              {/* Appearance Section */}
              <FormSection title="Appearance">
                <FormGrid cols={2}>
                  <EmojiPicker label="Icon" value={icon()} onChange={setIcon} />
                  <ColorPicker label="Color" value={color()} onChange={setColor} />
                </FormGrid>
              </FormSection>

              {/* Settings Section */}
              <FormSection title="Settings">
                <div class="form-control">
                  <label class="border-base-content/10 hover:border-primary/30 bg-base-200 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-primary mt-0.5"
                      checked={allowsTrackers()}
                      onChange={(e) => setAllowsTrackers(e.currentTarget.checked)}
                    />
                    <div class="flex-1">
                      <span class="text-base-content/90 block text-sm font-semibold">
                        Allow trackers in this group
                      </span>
                      <p class="text-base-content/60 mt-1 text-xs">
                        If unchecked, this group can only contain sub-groups
                      </p>
                    </div>
                  </label>
                </div>
              </FormSection>
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
                    <div class="font-bold">Edit the entire group as JSON</div>
                    <div class="text-sm">Press Ctrl+Space for autocomplete. Required: name</div>
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
                      Describe the group you want
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
                    placeholder="Example: A Fitness group with a barbell icon and a deep red color."
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
                      AI will fill the full schema and choose parentId if needed.
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
                schema={groupSchema}
                height="500px"
              />
            </div>
          </Show>
        </form>
      </div>

      <FormFooter
        formId="group-form"
        submitting={submitting()}
        submitLabel={props.initialData ? 'Update Group' : 'Create Group'}
        onCancel={props.onCancel}
      />
    </div>
  );
}
