import { type JSX, Show, children } from 'solid-js';

interface FormSectionProps {
  title: string;
  children: JSX.Element;
  class?: string;
  icon?: JSX.Element;
}

export default function FormSection(props: FormSectionProps) {
  const resolvedChildren = children(() => props.children);

  return (
    <div class={`space-y-4 ${props.class || ''}`}>
      <h3 class="text-base-content/90 border-primary/20 flex items-center gap-2 border-b pb-2 text-lg font-bold">
        <Show when={props.icon}>{props.icon}</Show>
        <span>{props.title}</span>
      </h3>
      {resolvedChildren()}
    </div>
  );
}
