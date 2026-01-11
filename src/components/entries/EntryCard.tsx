import { Show, For } from 'solid-js';
import { Clock, Hash, Check, X, FileText } from 'lucide-solid';
import type { Entry, Tracker, Group } from '../../lib/db/types';

interface EntryCardProps {
  entry: Entry;
  trackerMap: Map<string, Tracker>;
  groupMap: Map<string, Group>;
  onDelete?: (id: string) => void;
}

export default function EntryCard(props: EntryCardProps) {
  const getFieldUnit = (trackerId: string, fieldName: string): string | undefined => {
    const tracker = props.trackerMap.get(trackerId);
    return tracker?.fields.find((field) => field.name === fieldName)?.unit;
  };

  const getGroup = (trackerId: string): Group | undefined => {
    const tracker = props.trackerMap.get(trackerId);
    return tracker ? props.groupMap.get(tracker.groupId) : undefined;
  };

  const getGroupColor = (trackerId: string): string | undefined => {
    return getGroup(trackerId)?.color;
  };

  const entryAccentColor = (() => {
    for (const data of props.entry.data) {
      const color = getGroupColor(data.trackerId);
      if (color) return color;
    }
    return undefined;
  })();

  const cardStyle = entryAccentColor
    ? {
        borderColor: entryAccentColor,
        boxShadow: `0 0 30px ${entryAccentColor}22`,
        '--accent-color': entryAccentColor,
      }
    : undefined;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatFieldValue = (value: any, trackerId: string, fieldName: string): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    const baseValue = typeof value === 'number' ? value.toString() : String(value);
    const unit = getFieldUnit(trackerId, fieldName);

    return unit ? `${baseValue} ${unit}` : baseValue;
  };

  return (
    <div
      class="accent-card card bg-base-200/70 border-base-300/70 group border shadow-md transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      <div class="card-body p-4">
        {/* Header */}
        <div class="mb-3 flex items-start justify-between">
          <div class="text-base-content/50 flex items-center gap-2 text-xs">
            <Clock class="size-3" />
            <span>{formatTime(props.entry.timestamp)}</span>
          </div>

          <Show when={props.onDelete}>
            <button
              type="button"
              class="btn btn-ghost btn-xs text-error opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => props.onDelete!(props.entry._id)}
            >
              <X class="size-4" />
            </button>
          </Show>
        </div>

        {/* Tracker Data */}
        <div class="space-y-3">
          <For each={props.entry.data}>
            {(data) => {
              const tracker = props.trackerMap.get(data.trackerId);
              const group = tracker ? props.groupMap.get(tracker.groupId) : undefined;
              const groupIcon = group?.icon;
              const groupName = group?.name;
              const accentColor = group?.color;
              const blockStyle = accentColor
                ? {
                    borderColor: accentColor,
                    boxShadow: `0 0 24px ${accentColor}22`,
                  }
                : undefined;
              const iconStyle = accentColor
                ? {
                    color: accentColor,
                    borderColor: accentColor,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }
                : undefined;
              return (
                <div
                  class="border-base-300/50 bg-base-200/40 space-y-2 rounded-2xl border p-3"
                  style={blockStyle}
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="bg-base-100 text-base-content/70 grid h-10 w-10 place-items-center rounded-xl"
                      style={iconStyle}
                    >
                      <Show when={groupIcon} fallback={<Hash class="size-5" />}>
                        <span class="text-2xl">{groupIcon}</span>
                      </Show>
                    </div>
                    <div>
                      <p class="text-base-content text-sm font-semibold">
                        {tracker?.label || data.trackerTag}
                      </p>
                      <div class="text-base-content/50 flex items-center gap-2 text-[11px] tracking-widest uppercase">
                        <span>#{data.trackerTag}</span>
                        {groupName && <span class="text-base-content/40">· {groupName}</span>}
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <For each={Object.entries(data.values)}>
                      {([fieldName, value]) => (
                        <Show when={value !== null && value !== undefined}>
                          <div class="badge badge-ghost gap-1">
                            <span class="text-base-content/50">{fieldName}:</span>
                            <span class="font-semibold">
                              {formatFieldValue(value, data.trackerId, fieldName)}
                            </span>
                          </div>
                        </Show>
                      )}
                    </For>

                    {/* Status Badges */}
                    <Show when={data.completed}>
                      <div class="badge badge-success badge-sm gap-1">
                        <Check class="size-3" />
                        Done
                      </div>
                    </Show>
                    <Show when={data.skipped}>
                      <div class="badge badge-warning badge-sm gap-1">
                        <X class="size-3" />
                        Skipped
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        {/* Note */}
        <Show when={props.entry.note}>
          <div class="divider my-2"></div>
          <div class="text-base-content/70 flex items-start gap-2 text-sm">
            <FileText class="mt-0.5 size-4 flex-shrink-0" />
            <p class="flex-1">{props.entry.note}</p>
          </div>
        </Show>

        {/* Raw Input (for debugging/reference) */}
        <Show when={props.entry.raw}>
          <details class="collapse-arrow bg-base-200 rounded-box collapse mt-2">
            <summary class="collapse-title text-base-content/40 min-h-0 cursor-pointer py-2 text-xs">
              Show raw input
            </summary>
            <div class="collapse-content">
              <code class="text-base-content/50 block font-mono text-xs">{props.entry.raw}</code>
            </div>
          </details>
        </Show>
      </div>
    </div>
  );
}
