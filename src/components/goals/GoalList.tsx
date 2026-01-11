import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import type { Entry, Goal, Group, PagedResult, Tracker } from '../../lib/db/types';
import { Target, Edit, Trash2, Archive, Users, Folder, Pin } from 'lucide-solid';
import { computeGoalProgress } from '../../lib/services/goal-progress';
import SearchInput from '../common/SearchInput';
import type { GoalSearchOptions } from '../../lib/repositories';

interface GoalListProps {
  goals: Goal[];
  groups: Group[];
  trackers: Tracker[];
  entries: Entry[];
  searchGoals: (options?: GoalSearchOptions) => Promise<PagedResult<Goal>>;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  onToggleArchive?: (goal: Goal) => void;
  onTogglePin?: (goal: Goal) => void;
}

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value % 1) < 0.001) return Math.round(value).toString();
  return value.toFixed(1);
};

export default function GoalList(props: GoalListProps) {
  const [searchQuery, setSearchQuery] = createSignal('');

  const [activeSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      archived: false,
      perPage: 0,
      revision: props.goals,
    }),
    (source) =>
      props.searchGoals({
        query: source.query,
        archived: source.archived,
        perPage: source.perPage,
      }),
    {
      initialValue: { items: [], total: 0, page: 1, perPage: 0 },
    },
  );

  const [archivedSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      archived: true,
      perPage: 0,
      revision: props.goals,
    }),
    (source) =>
      props.searchGoals({
        query: source.query,
        archived: source.archived,
        perPage: source.perPage,
      }),
    {
      initialValue: { items: [], total: 0, page: 1, perPage: 0 },
    },
  );

  const activeResultTotal = createMemo(() => activeSearchResults().total);
  const archivedResultTotal = createMemo(() => archivedSearchResults().total);

  const progressMap = createMemo(() => {
    const map = new Map<string, ReturnType<typeof computeGoalProgress>>();
    props.goals.forEach((goal) => {
      map.set(goal._id, computeGoalProgress(goal, props.entries, props.groups, props.trackers));
    });
    return map;
  });

  const renderGoalCard = (goal: Goal, index: number, archived: boolean) => {
    const progress = progressMap().get(goal._id);

    return (
      <div
        class={`accent-card card bg-base-300/80 border-base-content/10 animate-fade-in-up border shadow-md transition-all duration-300 hover:shadow-xl ${
          archived ? 'opacity-60 hover:opacity-80' : ''
        }`}
        style={{
          'border-left': goal.color ? `2px solid ${goal.color}` : undefined,
          '--accent-color': goal.color || 'oklch(var(--p))',
          'animation-delay': `${index * 40}ms`,
        }}
      >
        <div class="card-body">
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
              <div class="bg-base-200 grid h-11 w-11 place-items-center rounded-2xl">
                <Show when={goal.icon} fallback={<Target size={20} class="text-primary" />}>
                  <span class="text-xl">{goal.icon}</span>
                </Show>
              </div>
              <div class="min-w-0">
                <h3 class="truncate text-lg font-semibold">{goal.name}</h3>
                <Show when={goal.description}>
                  <p class="text-base-content/60 mt-1 line-clamp-2 text-sm">{goal.description}</p>
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

            <div class="flex flex-shrink-0 items-center gap-1">
              <button
                class={`btn btn-ghost btn-sm hover:bg-primary/10 transition-colors ${goal.pinned ? 'text-primary' : ''}`}
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
                title={archived ? 'Unarchive' : 'Archive'}
              >
                <Archive size={16} />
              </button>
              <button
                class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
                onClick={() => props.onDelete?.(goal)}
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <Show when={progress}>
            {(data) => (
              <div class="mt-4 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-base-content/70">{data().detailLabel}</span>
                  <span class="text-base-content/80 font-semibold tabular-nums">
                    {formatNumber(data().current)} / {formatNumber(data().target)}
                    {goal.targetUnit ? ` ${goal.targetUnit}` : ''}
                  </span>
                </div>
                <div class="bg-base-300/30 h-2 overflow-hidden rounded-full">
                  <div
                    class="h-full rounded-full transition-all"
                    style={{
                      width: `${data().percent}%`,
                      'background-color': goal.color || 'var(--fallback-p,oklch(var(--p)))',
                    }}
                  />
                </div>
                <div class="text-base-content/50 flex items-center justify-between text-xs">
                  <span>{data().periodLabel}</span>
                  <span class="tabular-nums">{data().percent.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    );
  };

  return (
    <div class="space-y-6">
      <SearchInput value={searchQuery()} onInput={setSearchQuery} placeholder="Search goals..." />

      <div>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-bold">Active Goals</h3>
          <Show when={searchQuery()}>
            <span class="text-base-content/60 text-sm tabular-nums">
              {activeResultTotal()} result{activeResultTotal() !== 1 ? 's' : ''}
            </span>
          </Show>
        </div>
        <Show
          when={activeResultTotal() > 0}
          fallback={
            <div class="text-base-content/50 py-8 text-center">
              <Show
                when={searchQuery()}
                fallback={<>No goals yet. Create your first goal below.</>}
              >
                No goals match "{searchQuery()}"
              </Show>
            </div>
          }
        >
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={activeSearchResults().items}>
              {(goal, index) => renderGoalCard(goal, index(), false)}
            </For>
          </div>
        </Show>
      </div>

      <Show when={archivedResultTotal() > 0}>
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-xl font-bold">Archived Goals</h3>
            <Show when={searchQuery()}>
              <span class="text-base-content/60 text-sm tabular-nums">
                {archivedResultTotal()} result{archivedResultTotal() !== 1 ? 's' : ''}
              </span>
            </Show>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={archivedSearchResults().items}>
              {(goal, index) => renderGoalCard(goal, index(), true)}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
