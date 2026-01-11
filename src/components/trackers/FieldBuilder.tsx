import { Index, Show } from 'solid-js';
import type { FieldDefinition, FieldType } from '../../lib/db/types';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-solid';

interface FieldBuilderProps {
  fields: FieldDefinition[];
  onChange: (fields: FieldDefinition[]) => void;
  validationErrors?: Record<string, string>;
  onClearValidationError?: (key: string) => void;
}

const fieldTypes: FieldType[] = [
  'number',
  'text',
  'duration',
  'boolean',
  'scale',
  'counter',
  'photo',
];

export default function FieldBuilder(props: FieldBuilderProps) {
  const addField = () => {
    const newField: FieldDefinition = {
      name: '',
      label: '',
      type: 'number',
      sortOrder: props.fields.length,
    };
    props.onChange([...props.fields, newField]);
  };

  const removeField = (index: number) => {
    const updated = props.fields.filter((_, i) => i !== index);
    props.onChange(updated);
  };

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    const updated = [...props.fields];
    updated[index] = { ...updated[index], ...updates };
    props.onChange(updated);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === props.fields.length - 1)
    ) {
      return;
    }

    const updated = [...props.fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    // Update sort orders
    updated.forEach((field, i) => {
      field.sortOrder = i;
    });

    props.onChange(updated);
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <p class="text-base-content/70 text-sm">Define the data fields this tracker will capture</p>
        <button type="button" class="btn btn-primary btn-sm gap-2" onClick={addField}>
          <Plus size={16} />
          Add Field
        </button>
      </div>

      <Show
        when={props.fields.length > 0}
        fallback={
          <div class="alert alert-info">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="h-5 w-5 shrink-0 stroke-current"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm">No fields yet. Add at least one field to track data.</span>
          </div>
        }
      >
        <div class="space-y-4">
          <Index each={props.fields}>
            {(field, index) => {
              const getDefaultValue = () => {
                const value = field().defaultValue;
                return typeof value === 'boolean' ? '' : value ?? '';
              };

              return (
                <div class="card bg-base-200 border-base-300 border shadow-md transition-shadow hover:shadow-lg">
                  <div class="card-body space-y-4 p-6">
                  {/* Header with actions */}
                  <div class="flex items-center justify-between">
                    <span class="badge badge-primary badge-lg gap-2">
                      <span class="font-semibold">Field {index + 1}</span>
                      {field().label && <span class="opacity-80">· {field().label}</span>}
                    </span>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        onClick={() => moveField(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ChevronUp size={18} />
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        onClick={() => moveField(index, 'down')}
                        disabled={index === props.fields.length - 1}
                        title="Move down"
                      >
                        <ChevronDown size={18} />
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-error hover:bg-error/10"
                        onClick={() => removeField(index)}
                        title="Delete field"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div class="form-control">
                      <label class="mb-1.5 block">
                        <span class="text-base-content text-xs font-semibold">Name *</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., weight, reps"
                        class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                        classList={{
                          'input-error': !!(
                            props.validationErrors && props.validationErrors[`field_${index}_name`]
                          ),
                        }}
                        value={field().name}
                        onInput={(e) => {
                          updateField(index, { name: e.currentTarget.value });
                          // Clear validation error for this field
                          if (props.onClearValidationError) {
                            props.onClearValidationError(`field_${index}_name`);
                            props.onClearValidationError('fields');
                          }
                        }}
                        pattern="^[a-z][a-z0-9_]*$"
                        required
                      />
                      <Show
                        when={
                          props.validationErrors && props.validationErrors[`field_${index}_name`]
                        }
                      >
                        <p class="text-error mt-1 text-xs">
                          {props.validationErrors![`field_${index}_name`]}
                        </p>
                      </Show>
                      <Show
                        when={
                          !props.validationErrors || !props.validationErrors[`field_${index}_name`]
                        }
                      >
                        <p class="text-base-content/60 mt-1 text-xs">snake_case</p>
                      </Show>
                    </div>

                    <div class="form-control">
                      <label class="mb-1.5 block">
                        <span class="text-base-content text-xs font-semibold">Label *</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Weight, Reps"
                        class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                        classList={{
                          'input-error': !!(
                            props.validationErrors && props.validationErrors[`field_${index}_label`]
                          ),
                        }}
                        value={field().label}
                        onInput={(e) => {
                          updateField(index, { label: e.currentTarget.value });
                          // Clear validation error for this field
                          if (props.onClearValidationError) {
                            props.onClearValidationError(`field_${index}_label`);
                          }
                        }}
                        required
                      />
                      <Show
                        when={
                          props.validationErrors && props.validationErrors[`field_${index}_label`]
                        }
                      >
                        <p class="text-error mt-1 text-xs">
                          {props.validationErrors![`field_${index}_label`]}
                        </p>
                      </Show>
                    </div>

                    <div class="form-control">
                      <label class="mb-1.5 block">
                        <span class="text-base-content text-xs font-semibold">Type *</span>
                      </label>
                      <select
                        class="select select-bordered select-sm bg-base-100 text-base-content w-full"
                        value={field().type}
                        onChange={(e) =>
                          updateField(index, { type: e.currentTarget.value as FieldType })
                        }
                        required
                      >
                        <Index each={fieldTypes}>
                          {(type) => <option value={type()}>{type()}</option>}
                        </Index>
                      </select>
                    </div>
                  </div>

                  {/* Type-specific options */}
                  <Show
                    when={
                      field().type === 'number' ||
                      field().type === 'counter' ||
                      field().type === 'duration'
                    }
                  >
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Unit</span>
                        </label>
                        <input
                          type="text"
                          placeholder="kg, ml, min"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().unit || ''}
                          onInput={(e) => {
                            updateField(index, { unit: e.currentTarget.value || undefined });
                          }}
                        />
                      </div>

                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Min</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().min ?? ''}
                          onInput={(e) => {
                            updateField(index, {
                              min: e.currentTarget.value
                                ? Number(e.currentTarget.value)
                                : undefined,
                            });
                          }}
                        />
                      </div>

                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Max</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().max ?? ''}
                          onInput={(e) => {
                            updateField(index, {
                              max: e.currentTarget.value
                                ? Number(e.currentTarget.value)
                                : undefined,
                            });
                          }}
                        />
                      </div>

                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Step</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().step ?? ''}
                          onInput={(e) => {
                            updateField(index, {
                              step: e.currentTarget.value
                                ? Number(e.currentTarget.value)
                                : undefined,
                            });
                          }}
                        />
                      </div>
                    </div>
                  </Show>

                  <Show when={field().type === 'scale'}>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Scale Min</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().scaleMin ?? 1}
                          onInput={(e) => {
                            updateField(index, { scaleMin: Number(e.currentTarget.value) });
                          }}
                        />
                      </div>

                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Scale Max</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().scaleMax ?? 5}
                          onInput={(e) => {
                            updateField(index, { scaleMax: Number(e.currentTarget.value) });
                          }}
                        />
                      </div>
                    </div>
                  </Show>

                  <Show when={field().type === 'photo'}>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Max Photos</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().maxPhotos ?? 10}
                          onInput={(e) => {
                            updateField(index, { maxPhotos: Number(e.currentTarget.value) });
                          }}
                        />
                      </div>

                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Max Size (KB)</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().maxSizeKB ?? 2048}
                          onInput={(e) => {
                            updateField(index, { maxSizeKB: Number(e.currentTarget.value) });
                          }}
                        />
                      </div>

                      <div class="form-control">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Target Width</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={field().targetWidth ?? 1920}
                          onInput={(e) => {
                            updateField(index, { targetWidth: Number(e.currentTarget.value) });
                          }}
                        />
                      </div>

                      <div class="form-control">
                        <label class="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm checkbox-primary"
                            checked={field().compress ?? true}
                            onChange={(e) => {
                              updateField(index, { compress: e.currentTarget.checked });
                            }}
                          />
                          <span class="text-base-content text-xs font-medium">Compress</span>
                        </label>
                      </div>
                    </div>
                  </Show>

                  {/* Common options */}
                  <div class="flex flex-wrap items-end gap-4">
                    <div class="form-control">
                      <label class="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-primary"
                          checked={field().required ?? false}
                          onChange={(e) => {
                            updateField(index, { required: e.currentTarget.checked });
                          }}
                        />
                        <span class="text-base-content text-xs font-medium">Required</span>
                      </label>
                    </div>

                    <Show when={field().type !== 'boolean' && field().type !== 'photo'}>
                      <div class="form-control min-w-[150px] flex-1">
                        <label class="mb-1 block">
                          <span class="text-base-content text-xs font-medium">Default Value</span>
                        </label>
                        <input
                          type={
                            field().type === 'number' ||
                            field().type === 'counter' ||
                            field().type === 'scale'
                              ? 'number'
                              : 'text'
                          }
                          class="input input-bordered input-sm bg-base-100 text-base-content w-full"
                          value={getDefaultValue()}
                          onInput={(e) => {
                            const val = e.currentTarget.value;
                            const fieldType = field().type;
                            updateField(index, {
                              defaultValue: val
                                ? fieldType === 'number' ||
                                  fieldType === 'counter' ||
                                  fieldType === 'scale'
                                  ? Number(val)
                                  : val
                                : undefined,
                            });
                          }}
                        />
                      </div>
                    </Show>
                  </div>
                  </div>
                </div>
              );
            }}
          </Index>
        </div>
      </Show>
    </div>
  );
}
