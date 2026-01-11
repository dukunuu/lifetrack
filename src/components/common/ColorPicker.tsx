import { Show } from 'solid-js';

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  label?: string;
}

const presetColors = [
  '#7CB37C', // Matcha green
  '#B8A9C9', // Purple
  '#D4A857', // Amber
  '#5B8FB9', // Steel blue
  '#7E5C99', // Deep purple
  '#C75D5D', // Red
  '#E89B6E', // Orange
  '#6BB6AB', // Teal
  '#9B8B7E', // Brown
  '#8B8B8B', // Gray
];

export default function ColorPicker(props: ColorPickerProps) {
  return (
    <div class="form-control">
      <Show when={props.label}>
        <label class="label">
          <span class="label-text font-semibold">{props.label}</span>
        </label>
      </Show>
      <div class="space-y-3">
        {/* Color preview and custom picker */}
        <div class="flex items-center gap-3">
          <label
            class="btn btn-square btn-outline btn-lg relative cursor-pointer overflow-hidden transition-transform hover:scale-105"
            style={{
              'background-color': props.value || '#7CB37C',
              'border-color': props.value || '#7CB37C',
            }}
          >
            <input
              type="color"
              class="absolute inset-0 cursor-pointer opacity-0"
              value={props.value || '#7CB37C'}
              onInput={(e) => props.onChange(e.currentTarget.value)}
            />
          </label>
          <input
            type="text"
            class="input input-bordered input-lg flex-1"
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            placeholder="#7CB37C"
            pattern="^#[0-9A-Fa-f]{6}$"
          />
        </div>
        {/* Preset colors */}
        <div class="flex flex-wrap gap-2">
          {presetColors.map((color) => (
            <button
              type="button"
              class="btn btn-circle h-12 w-12 border-2 transition-transform hover:scale-110"
              classList={{
                'ring-2 ring-primary ring-offset-2 ring-offset-base-200': props.value === color,
              }}
              style={{ 'background-color': color, 'border-color': color }}
              onClick={() => props.onChange(color)}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
