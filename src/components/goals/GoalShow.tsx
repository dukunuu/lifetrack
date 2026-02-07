import { X } from 'lucide-solid';
import { For, Show } from 'solid-js';
import EntryCard from '../entries/EntryCard';
import type { Entry, Goal } from '../../lib/db/types';

interface ShowModalProps {
  selectedGoal: Goal | null;
  sortedEntries: Entry[];
  setSelectedGoal: (goal: Goal | null) => void;
}

export default function GoalShowModal(props: ShowModalProps) {
  return (
    <>
      <Show when={props.selectedGoal}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-300 border-base-content/10 h-full w-full max-w-4xl rounded-none border p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
            <div class="border-base-content/10 flex items-center justify-between border-b px-6 py-4">
              <div>
                <div class="text-base-content/60 text-xs font-semibold tracking-widest uppercase">
                  Goal entries
                </div>
                <h3 class="text-xl font-bold">{props.selectedGoal!.name}</h3>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onClick={() => props.setSelectedGoal(null)}
                aria-label="Close"
              >
                <X class="size-4" />
              </button>
            </div>
            <div class="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-4">
              <Show
                when={props.sortedEntries.length > 0}
                fallback={
                  <div class="text-base-content/50 rounded-xl border border-dashed p-6 text-center text-sm">
                    No entries match this goal yet.
                  </div>
                }
              >
                <For each={props.sortedEntries}>{(entry) => <EntryCard entry={entry} />}</For>
              </Show>
            </div>
          </div>
          <div class="modal-backdrop" onClick={() => props.setSelectedGoal(null)} />
        </div>
      </Show>
    </>
  );
}
