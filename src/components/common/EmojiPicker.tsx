import { createSignal, Show, createEffect, onCleanup } from 'solid-js';
import { Smile } from 'lucide-solid';

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
  label?: string;
}

// Simple emoji list fallback
const commonEmojis = [
  '💪',
  '🏃',
  '🚴',
  '🏋️',
  '⚽',
  '🏀',
  '🎾',
  '🏊',
  '🍎',
  '🥗',
  '🍗',
  '🍕',
  '🍔',
  '🥤',
  '☕',
  '🍷',
  '💰',
  '💳',
  '📊',
  '📈',
  '💵',
  '🏦',
  '💼',
  '🏠',
  '😊',
  '😴',
  '😢',
  '😡',
  '😌',
  '🤔',
  '😎',
  '🥳',
  '📚',
  '✏️',
  '📝',
  '🎯',
  '⭐',
  '🔥',
  '💯',
  '✅',
  '💧',
  '🌡️',
  '⚖️',
  '📏',
  '⏰',
  '📅',
  '🔔',
  '🎵',
];

export default function EmojiPicker(props: EmojiPickerProps) {
  const [showPicker, setShowPicker] = createSignal(false);
  let pickerRef: HTMLDivElement | undefined;

  // Close picker when clicking outside
  createEffect(() => {
    if (showPicker()) {
      const handleClickOutside = (e: MouseEvent) => {
        if (pickerRef && !pickerRef.contains(e.target as Node)) {
          setShowPicker(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));
    }
  });

  const handleEmojiClick = (emoji: string) => {
    props.onChange(emoji);
    setShowPicker(false);
  };

  return (
    <div class="form-control">
      <Show when={props.label}>
        <label class="label">
          <span class="label-text font-semibold">{props.label}</span>
        </label>
      </Show>
      <div class="relative" ref={pickerRef}>
        <button
          type="button"
          class="btn btn-outline btn-lg w-full justify-start gap-3"
          onClick={() => setShowPicker(!showPicker())}
        >
          <Show when={props.value} fallback={<Smile size={20} />}>
            <span class="text-3xl">{props.value}</span>
          </Show>
          <span class="text-base">{props.value || 'Choose an emoji'}</span>
        </button>
        <Show when={showPicker()}>
          <div class="bg-base-200 border-base-300 absolute z-50 mt-2 w-full rounded-lg border p-4 shadow-2xl">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-sm font-semibold">Pick an emoji</span>
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                onClick={() => setShowPicker(false)}
              >
                Close
              </button>
            </div>
            <div class="grid max-h-64 grid-cols-8 gap-2 overflow-y-auto">
              {commonEmojis.map((emoji) => (
                <button
                  type="button"
                  class="btn btn-ghost btn-sm hover:bg-base-300 text-2xl transition-transform hover:scale-110"
                  onClick={() => handleEmojiClick(emoji)}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
