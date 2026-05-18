import { Archive, Edit, Eye, Folder, Pin, Target, Trash, Users } from 'lucide-solid';
import { For, Show } from 'solid-js';
import type { Goal } from '../../lib/db/types';
import type { GoalProgress } from '../../lib/services/goal-progress';

interface GoalCardProps {
  goal: Goal;
  progress?: GoalProgress;
  archived: boolean;
  index: number;
  searchQuery?: string;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  onToggleArchive?: (goal: Goal) => void;
  onTogglePin?: (goal: Goal) => void;
  onView?: (goal: Goal) => void;
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

export default function GoalCard(props: GoalCardProps) {
  const { goal, progress } = props;
  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    if (Math.abs(value % 1) < 0.001) return Math.round(value).toString();
    return value.toFixed(1);
  };

  return (
    <div
      class={`accent-card glass-card hover-lift card animate-fade-in-up transition-all duration-300 ${
        props.archived ? 'opacity-60 hover:opacity-80' : ''
      }`}
      style={{
        'border-left': goal.color ? `2px solid ${goal.color}` : undefined,
        '--accent-color': goal.color || 'oklch(var(--p))',
        'animation-delay': `${props.index * 40}ms`,
      }}
    >
      <div class="card-body">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <div class="glass-card flex h-11 w-11 items-center justify-center rounded-2xl">
              <Show when={goal.icon} fallback={<Target size={20} class="text-primary" />}>
                <span class="text-2xl leading-none">{goal.icon}</span>
              </Show>
            </div>
            <div class="min-w-0">
              <h3 class="truncate text-lg font-semibold">
                <HighlightText text={goal.name} query={props.searchQuery} />
              </h3>
              <Show when={goal.description}>
                <p class="text-base-content/60 mt-1 line-clamp-2 text-sm">
                  <HighlightText text={goal.description || ''} query={props.searchQuery} />
                </p>
              </Show>
              <div class="text-base-content/60 mt-2 flex min-w-0 flex-wrap gap-2 text-xs">
                <span class="badge badge-outline badge-sm">{goal.type}</span>
                <span class="badge badge-outline badge-sm">{goal.period}</span>
                <span class="badge badge-outline badge-sm">
                  <Show when={goal.groupId} fallback={<Users size={12} />}>
                    <Folder size={12} />
                  </Show>
                  <span class="ml-1 max-w-[140px] truncate">
                    {progress?.scopeLabel || 'No scope'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div class="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap">
            <button
              class={`btn btn-ghost btn-sm hover:bg-primary/10 transition-colors ${
                goal.pinned ? 'text-primary' : ''
              }`}
              onClick={() => props.onTogglePin?.(goal)}
              title={goal.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={16} class={goal.pinned ? 'fill-current' : ''} />
            </button>
            <button
              class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => props.onEdit?.(goal)}
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button
              class="btn btn-ghost btn-sm hover:bg-warning/10 hover:text-warning transition-colors"
              onClick={() => props.onToggleArchive?.(goal)}
              title={props.archived ? 'Unarchive' : 'Archive'}
            >
              <Archive size={16} />
            </button>
            <button
              class="btn btn-ghost btn-sm hover:bg-secondary/10 hover:text-secondary transition-colors"
              onClick={() => props.onView?.(goal)}
              title="View entries"
            >
              <Eye size={16} />
            </button>
            <button
              class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
              onClick={() => props.onDelete?.(goal)}
              title="Delete"
            >
              <Trash size={16} />
            </button>
          </div>
        </div>

        <div class="mt-5">
          <div class="flex items-center justify-between text-sm">
            <span class="text-base-content/70">{progress?.detailLabel}</span>
            <span class="text-base-content/80 font-semibold tabular-nums">
              {formatNumber(progress?.current ?? 0)} / {formatNumber(progress?.target ?? 0)}
              {goal.targetUnit ? ` ${goal.targetUnit}` : ''}
            </span>
          </div>
          <div class="bg-base-200/70 mt-2 h-2 overflow-hidden rounded-full">
            <div
              class="h-full rounded-full transition-all"
              style={{
                width: `${progress?.percent ?? 0}%`,
                'background-color': goal.color || 'var(--fallback-p,oklch(var(--p)))',
                'box-shadow': goal.color ? `0 0 14px ${goal.color}` : undefined,
              }}
            />
          </div>
          <div class="text-base-content/50 mt-2 flex items-center justify-between text-xs">
            <span>{progress?.periodLabel}</span>
            <span class="tabular-nums">{(progress?.percent ?? 0).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
