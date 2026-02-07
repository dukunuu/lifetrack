import { type JSX, Show, createEffect, createSignal, onCleanup } from 'solid-js';

interface SearchInputProps {
  value: string;
  placeholder: string;
  onInput: (value: string) => void;
  icon?: JSX.Element;
  inputClass?: string;
  wrapperClass?: string;
  debounceMs?: number;
}

export default function SearchInput(props: SearchInputProps) {
  const [localValue, setLocalValue] = createSignal(props.value);
  const paddingClass = () => (props.icon ? 'pl-12' : 'pl-4');
  const inputClass = () =>
    `input input-bordered w-full ${paddingClass()} bg-base-300/50 border-base-content/10 focus:border-primary/50 focus:bg-base-300 transition-all ${
      props.inputClass || ''
    }`;

  // Update local value when prop changes
  createEffect(() => {
    setLocalValue(props.value);
  });

  // Debounce the onInput callback
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = () => props.debounceMs ?? 200;

  const handleInput = (value: string) => {
    setLocalValue(value);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      props.onInput(value);
      timeoutId = null;
    }, debounceMs());
  };

  onCleanup(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });

  return (
    <div class={`relative ${props.wrapperClass || ''}`}>
      <Show when={props.icon}>
        <div class="text-base-content/40 absolute top-1/2 left-4 -translate-y-1/2">
          {props.icon}
        </div>
      </Show>
      <input
        type="text"
        placeholder={props.placeholder}
        value={localValue()}
        onInput={(e) => handleInput(e.currentTarget.value)}
        class={inputClass()}
      />
      <Show when={localValue() !== props.value}>
        <div class="text-base-content/30 absolute top-1/2 right-4 -translate-y-1/2">
          <span class="loading loading-spinner loading-xs" />
        </div>
      </Show>
    </div>
  );
}
