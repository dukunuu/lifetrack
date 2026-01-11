import { Show } from 'solid-js';
import { ChevronLeft, ChevronRight } from 'lucide-solid';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function PaginationControls(props: PaginationControlsProps) {
  return (
    <Show when={props.totalPages > 1}>
      <div class="mt-6 flex items-center justify-center gap-2">
        <button
          class="btn btn-sm btn-ghost"
          disabled={props.currentPage === 1}
          onClick={() => props.onPageChange(props.currentPage - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span class="text-base-content/70 text-sm tabular-nums">
          Page {props.currentPage} of {props.totalPages}
        </span>
        <button
          class="btn btn-sm btn-ghost"
          disabled={props.currentPage === props.totalPages}
          onClick={() => props.onPageChange(props.currentPage + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </Show>
  );
}
