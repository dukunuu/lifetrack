import { Show, type JSX } from 'solid-js';

interface SearchInputProps {
  value: string;
  placeholder: string;
  onInput: (value: string) => void;
  icon?: JSX.Element;
  inputClass?: string;
  wrapperClass?: string;
}

export default function SearchInput(props: SearchInputProps) {
  const paddingClass = () => (props.icon ? 'pl-12' : 'pl-4');
  const inputClass = () =>
    `input input-bordered w-full ${paddingClass()} bg-base-300/50 border-base-content/10 focus:border-primary/50 focus:bg-base-300 transition-all ${
      props.inputClass || ''
    }`;

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
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        class={inputClass()}
      />
    </div>
  );
}
