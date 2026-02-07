import { Archive, Edit, Hash, Pin, Tag, Trash2 } from 'lucide-solid';
import { For, Show } from 'solid-js';
import type { Tracker } from '../../lib/db/types';

interface TrackerCardProps {
  tracker: Tracker;
  variant?: 'active' | 'archived';
  index?: number;
  groupName?: string;
  groupColor?: string;
  searchQuery?: string;
  onEdit?: (tracker: Tracker) => void;
  onDelete?: (tracker: Tracker) => void;
  onTogglePin?: (tracker: Tracker) => void;
  onToggleArchive?: (tracker: Tracker) => void;
}

function HighlightText(props: { text: string; query?: string }) {
  if (!props.query || !props.text.toLowerCase().includes(props.query.toLowerCase())) {
    return <>{props.text}</>;
  }

  const parts = props.text.split(new RegExp(`(${props.query})`, 'gi'));
  return (
    <>
      <For each={parts}>
        {(part) =>
          part.toLowerCase() === props.query?.toLowerCase() ? (
            <mark class="bg-primary/30 rounded px-0.5">{part}</mark>
          ) : (
            <>{part}</>
          )
        }
      </For>
    </>
  );
}

export default function TrackerCard(props: TrackerCardProps) {
  const isArchived = () => props.variant === 'archived';
  const animationDelay = () => `${(props.index ?? 0) * 50}ms`;

  return (
    <div
      class={
        isArchived()
          ? 'card bg-base-300/40 border-base-content/5 animate-fade-in-up border opacity-60 shadow-sm transition-all duration-300 hover:opacity-80'
          : 'accent-card card bg-base-300/80 border-base-content/10 animate-fade-in-up border shadow-md transition-all duration-300 hover:shadow-xl'
      }
      style={{
        'border-left':
          !isArchived() && props.groupColor ? `2px solid ${props.groupColor}` : undefined,
        '--accent-color': props.groupColor || 'oklch(var(--p))',
        'animation-delay': animationDelay(),
      }}
    >
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <div class="bg-base-200 text-base-content/60 grid h-10 w-10 place-items-center rounded-xl">
              <Hash class="size-5" />
            </div>
            <div>
              <h4 class="card-title text-lg">
                <HighlightText text={props.tracker.label} query={props.searchQuery} />
              </h4>
              <div class="text-base-content/60 flex items-center gap-1 text-xs">
                <Tag size={12} />
                <span class="font-mono">
                  <HighlightText text={props.tracker.tag} query={props.searchQuery} />
                </span>
              </div>
            </div>
          </div>
          <Show when={!isArchived() && props.tracker.pinned}>
            <Pin size={16} class="text-primary fill-current" />
          </Show>
        </div>

        <Show when={!isArchived()}>
          <div class="mt-2 space-y-1 text-sm">
            <div>
              <span class="text-base-content/60">Group: </span>
              <span class="text-base-content/90">
                <HighlightText text={props.groupName || 'Unknown'} query={props.searchQuery} />
              </span>
            </div>
            <div>
              <span class="text-base-content/60">Fields: </span>
              <span class="text-base-content/90 tabular-nums">{props.tracker.fields.length}</span>
            </div>
            <Show when={props.tracker.aliases && props.tracker.aliases.length > 0}>
              <div>
                <span class="text-base-content/60">Aliases: </span>
                <span class="text-base-content/90 font-mono text-xs">
                  {props.tracker.aliases?.join(', ')}
                </span>
              </div>
            </Show>
          </div>
        </Show>

        <div class="card-actions border-base-content/5 mt-2 justify-end border-t pt-2">
          <Show when={!isArchived()}>
            <button
              class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => props.onTogglePin?.(props.tracker)}
              title={props.tracker.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={16} />
            </button>
            <button
              class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => props.onEdit?.(props.tracker)}
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button
              class="btn btn-ghost btn-sm hover:bg-warning/10 hover:text-warning transition-colors"
              onClick={() => props.onToggleArchive?.(props.tracker)}
              title="Archive"
            >
              <Archive size={16} />
            </button>
          </Show>
          <Show when={isArchived()}>
            <button
              class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => props.onToggleArchive?.(props.tracker)}
              title="Unarchive"
            >
              Unarchive
            </button>
          </Show>
          <button
            class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
            onClick={() => props.onDelete?.(props.tracker)}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
