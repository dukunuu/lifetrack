import { type JSX, type ParentComponent, Show } from 'solid-js';

interface PageShellProps {
  title: string;
  subtitle?: string;
  after?: JSX.Element;
  floatingActions?: JSX.Element;
  fab?: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
    title?: string;
    class?: string;
  };
}

const PageShell: ParentComponent<PageShellProps> = (props) => {
  return (
    <div class="bg-base-100 min-h-screen">
      <div class="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div class="glass-card mb-6 rounded-2xl px-5 py-4 sm:mb-8 sm:px-6 sm:py-5">
          <h1 class="from-primary to-secondary mb-2 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent drop-shadow-[0_0_18px_oklch(var(--p)/0.25)] sm:text-4xl">
            {props.title}
          </h1>
          <Show when={props.subtitle}>
            <p class="text-base-content/70 text-base sm:text-lg">{props.subtitle}</p>
          </Show>
        </div>

        {props.children}
      </div>

      <Show when={props.fab}>
        {(fab) => (
          <button
            class={`btn btn-primary btn-circle btn-lg glass-card-raised hover:shadow-3xl fab-quickadd-offset fixed right-6 z-40 border-0 shadow-2xl transition-all hover:scale-110 sm:right-8 ${fab().class ?? ''}`}
            onClick={fab().onClick}
            title={fab().title ?? fab().label}
            aria-label={fab().label}
            type="button"
          >
            {fab().icon}
          </button>
        )}
      </Show>

      {props.floatingActions}
      {props.after}
    </div>
  );
};

export default PageShell;
