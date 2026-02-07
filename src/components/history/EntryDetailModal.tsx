import { For, Show } from 'solid-js';
import type { Entry } from '../../lib/db/types';

interface EntryDetailModalProps {
  entry: Entry | null;
  onClose: () => void;
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

export default function EntryDetailModal(props: EntryDetailModalProps) {
  return (
    <Show when={props.entry}>
      <div class="modal modal-open" onClick={props.onClose}>
        <div class="modal-box" onClick={(e) => e.stopPropagation()}>
          <h3 class="text-lg font-bold">Entry at {formatTime(props.entry!.timestamp)}</h3>

          <div class="space-y-3 py-4">
            <For each={props.entry!.data}>
              {(data) => (
                <div class="bg-base-200 rounded-lg p-3">
                  <div class="text-sm font-semibold">#{data.trackerTag}</div>
                  <div class="mt-1 space-y-1">
                    <For each={Object.entries(data.values)}>
                      {([key, value]: [string, unknown]) => (
                        <Show when={value !== null && value !== undefined}>
                          <div class="text-sm">
                            <span class="text-base-content/60">{key}:</span>{' '}
                            <span class="font-medium">{formatFieldValue(value)}</span>
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                  <Show when={data.completed}>
                    <div class="badge badge-success badge-sm mt-2">Completed</div>
                  </Show>
                  <Show when={data.skipped}>
                    <div class="badge badge-warning badge-sm mt-2">Skipped</div>
                  </Show>
                </div>
              )}
            </For>

            <Show when={props.entry!.note}>
              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-base-content/60 mb-1 text-sm">Note</div>
                <div class="text-sm">{props.entry!.note}</div>
              </div>
            </Show>
          </div>

          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onClick={props.onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
