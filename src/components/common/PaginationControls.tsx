import { Show } from 'solid-js';
import { ChevronLeft, ChevronRight } from 'lucide-solid';

interface PaginationControlsProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function PaginationControls(props: PaginationControlsProps) {
  return (
    <Show when={props.hasPrev || props.hasNext}>
      <div class="mt-6 flex items-center justify-center gap-2">
        <button class="btn btn-sm btn-ghost" disabled={!props.hasPrev} onClick={props.onPrev}>
          <ChevronLeft size={16} />
        </button>
        <button class="btn btn-sm btn-ghost" disabled={!props.hasNext} onClick={props.onNext}>
          <ChevronRight size={16} />
        </button>
      </div>
    </Show>
  );
}
