import { type JSX, Show, children } from 'solid-js';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: JSX.Element;
  class?: string;
  labelClass?: string;
}

export default function FormField(props: FormFieldProps) {
  const resolvedChildren = children(() => props.children);

  return (
    <div class={`form-control ${props.class || ''}`}>
      <label class="mb-2 block">
        <span
          class={`text-base-content text-sm font-semibold sm:text-base ${props.labelClass || ''}`}
        >
          {props.label}
          <Show when={props.required}>
            <span class="text-error ml-1">*</span>
          </Show>
        </span>
      </label>

      {resolvedChildren()}

      <Show
        when={props.error}
        fallback={
          <Show when={props.help}>
            <p class="text-base-content/60 mt-1.5 text-xs sm:text-sm">{props.help}</p>
          </Show>
        }
      >
        <p class="text-error mt-1 text-xs">{props.error}</p>
      </Show>
    </div>
  );
}
