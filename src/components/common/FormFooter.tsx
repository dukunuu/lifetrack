import { Show } from 'solid-js';

interface FormFooterProps {
  formId: string;
  submitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
}

export default function FormFooter(props: FormFooterProps) {
  return (
    <div class="bg-base-300 border-base-content/10 sticky bottom-0 flex items-center justify-end gap-3 border-t p-4 sm:p-6">
      <Show when={props.onCancel}>
        <button type="button" class="btn btn-ghost hidden sm:inline-flex" onClick={props.onCancel}>
          Cancel
        </button>
      </Show>
      <button
        type="submit"
        form={props.formId}
        class="btn btn-primary sm:btn-lg flex-1 sm:flex-none sm:px-8"
        disabled={props.submitting}
      >
        <Show when={props.submitting} fallback={props.submitLabel}>
          <span class="loading loading-spinner loading-sm"></span>
          Saving...
        </Show>
      </button>
    </div>
  );
}
