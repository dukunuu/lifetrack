import { Show } from 'solid-js';
import { Code, FormInput } from 'lucide-solid';

type FormMode = 'form' | 'json';

interface FormHeaderProps {
  title: string;
  subtitle: string;
  mode: FormMode;
  onModeChange: (mode: FormMode) => void;
  onCancel?: () => void;
  containerClass?: string;
  titleClass?: string;
}

export default function FormHeader(props: FormHeaderProps) {
  const containerClass = () =>
    `sticky top-0 z-10 p-4 sm:p-6 border-b border-base-content/10 ${
      props.containerClass || 'bg-gradient-to-br from-base-200 to-base-300'
    }`;
  const titleClass = () =>
    `text-xl sm:text-3xl font-bold mb-1 sm:mb-2 bg-clip-text text-transparent ${
      props.titleClass || 'bg-gradient-to-r from-primary to-secondary'
    }`;

  return (
    <div class={containerClass()}>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h2 class={titleClass()}>{props.title}</h2>
          <p class="text-base-content/70 text-xs sm:text-sm">{props.subtitle}</p>
        </div>

        <div class="flex flex-shrink-0 items-center gap-2">
          <div class="join hidden shadow-lg sm:flex">
            <button
              type="button"
              class={`btn btn-sm join-item gap-2 ${props.mode === 'form' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => props.onModeChange('form')}
            >
              <FormInput size={16} />
              <span class="hidden lg:inline">Form</span>
            </button>
            <button
              type="button"
              class={`btn btn-sm join-item gap-2 ${props.mode === 'json' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => props.onModeChange('json')}
            >
              <Code size={16} />
              <span class="hidden lg:inline">JSON</span>
            </button>
          </div>

          <Show when={props.onCancel}>
            <button
              type="button"
              class="btn btn-sm btn-circle btn-ghost"
              onClick={props.onCancel}
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Show>
        </div>
      </div>

      <div class="join mt-3 flex w-full shadow-lg sm:hidden">
        <button
          type="button"
          class={`btn btn-sm join-item flex-1 gap-2 ${props.mode === 'form' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => props.onModeChange('form')}
        >
          <FormInput size={16} />
          Form
        </button>
        <button
          type="button"
          class={`btn btn-sm join-item flex-1 gap-2 ${props.mode === 'json' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => props.onModeChange('json')}
        >
          <Code size={16} />
          JSON
        </button>
      </div>
    </div>
  );
}
