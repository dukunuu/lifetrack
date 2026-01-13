import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import type { Entry, Goal, GoalPeriod, Group, PagedResult, Tracker } from '../../lib/db/types';
import { X } from 'lucide-solid';
import { computeGoalProgress } from '../../lib/services/goal-progress';
import SearchInput from '../common/SearchInput';
import PaginationControls from '../common/PaginationControls';
import type { GoalSearchOptions } from '../../lib/repositories';
import GoalCard from './GoalCard';
import EntryCard from '../entries/EntryCard';
import { useSearchCursorPagination } from '../../lib/hooks/useSearchPagination';
import { ITEMS_PER_PAGE } from '../../lib/constants/pagination';

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

export default function GoalList(props: GoalListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGoal, setSelectedGoal] = createSignal<Goal | null>(null);
  const {
    searchQuery,
    activeCursor,
    archivedCursor,
    activeCursorStack,
    archivedCursorStack,
    handleSearch,
    handleActiveNext,
    handleActivePrev,
    handleArchivedNext,
    handleArchivedPrev,
    resetCursors,
    watchEmptyPages,
  } = useSearchCursorPagination({
    queryKey: 'q',
    cursorKey: 'goal_cursor',
    cursorStackKey: 'goal_cursorStack',
    archivedCursorKey: 'goal_archivedCursor',
    archivedCursorStackKey: 'goal_archivedCursorStack',
  });
  const allowedPeriods = ['daily', 'weekly', 'monthly'] as const;

  const periodFilter = createMemo<GoalPeriod | undefined>(() => {
    const period = searchParams.period;
    if (typeof period !== 'string') return undefined;
    return allowedPeriods.includes(period as (typeof allowedPeriods)[number])
      ? (period as GoalPeriod)
      : undefined;
  });
  const hasFilters = createMemo(() => Boolean(searchQuery().trim() || periodFilter()));

  const handlePeriodToggle = (period: 'daily' | 'weekly' | 'monthly') => {
    setSearchParams({ period: periodFilter() === period ? undefined : period });
    resetCursors();
  };

  const [activeSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      cursor: activeCursor(),
      archived: false,
      period: periodFilter(),
      perPage: ITEMS_PER_PAGE,
      revision: props.goals,
    }),
    (source) =>
      props.searchGoals({
        query: source.query,
        cursor: source.cursor,
        archived: source.archived,
        period: source.period,
        perPage: source.perPage,
      }),
    {
      initialValue: { items: [], perPage: ITEMS_PER_PAGE },
    },
  );

  const [archivedSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      cursor: archivedCursor(),
      archived: true,
      period: periodFilter(),
      perPage: ITEMS_PER_PAGE,
      revision: props.goals,
    }),
    (source) =>
      props.searchGoals({
        query: source.query,
        cursor: source.cursor,
        archived: source.archived,
        period: source.period,
        perPage: source.perPage,
      }),
    {
      initialValue: { items: [], perPage: ITEMS_PER_PAGE },
    },
  );

  const activeResultTotal = createMemo(
    () => activeSearchResults().total ?? activeSearchResults().items.length,
  );
  const archivedResultTotal = createMemo(
    () => archivedSearchResults().total ?? archivedSearchResults().items.length,
  );
  const activeHasTotal = createMemo(() => activeSearchResults().total !== undefined);
  const archivedHasTotal = createMemo(() => archivedSearchResults().total !== undefined);
  const activeHasPrev = createMemo(() => activeCursorStack().length > 0);
  const archivedHasPrev = createMemo(() => archivedCursorStack().length > 0);
  const activeHasNext = createMemo(() => Boolean(activeSearchResults().nextCursor));
  const archivedHasNext = createMemo(() => Boolean(archivedSearchResults().nextCursor));

  watchEmptyPages(
    () => activeSearchResults().items.length,
    () => archivedSearchResults().items.length,
  );

  const progressMap = createMemo(() => {
    const map = new Map<string, ReturnType<typeof computeGoalProgress>>();
    props.goals.forEach((goal) => {
      map.set(goal._id, computeGoalProgress(goal, props.entries, props.groups, props.trackers));
    });
    return map;
  });

  const trackerMap = createMemo(() => {
    const map = new Map<string, Tracker>();
    props.trackers.forEach((tracker) => map.set(tracker._id, tracker));
    return map;
  });

  const groupMap = createMemo(() => {
    const map = new Map<string, Group>();
    props.groups.forEach((group) => map.set(group._id, group));
    return map;
  });

  const entriesForGoal = createMemo(() => {
    const goal = selectedGoal();
    if (!goal) return [];

    if (goal.groupId) {
      return props.entries.filter((entry) => entry.groupId === goal.groupId);
    }

    const trackerSet = new Set(goal.trackerIds);
    return props.entries.filter((entry) =>
      entry.data.some((item) => trackerSet.has(item.trackerId)),
    );
  });

  const sortedEntries = createMemo(() =>
    [...entriesForGoal()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  );

  return (
    <div class="space-y-6">
      <div class="space-y-3">
        <SearchInput
          value={searchQuery()}
          onInput={handleSearch}
          placeholder="Search goals..."
        />

        <div class="flex flex-wrap items-center gap-2">
          <div class="text-base-content/60 text-sm font-medium uppercase tracking-wide">
            Period
          </div>
          <button
            type="button"
            class={`badge badge-lg transition-all ${
              !periodFilter() ? 'badge-primary' : 'bg-base-content/10 hover:bg-base-content/20'
            }`}
            onClick={() => {
              setSearchParams({ period: undefined });
              resetCursors();
            }}
          >
            All
          </button>
          <button
            type="button"
            class={`badge badge-lg transition-all ${
              periodFilter() === 'daily'
                ? 'badge-primary'
                : 'bg-base-content/10 hover:bg-base-content/20'
            }`}
            onClick={() => handlePeriodToggle('daily')}
          >
            Daily
          </button>
          <button
            type="button"
            class={`badge badge-lg transition-all ${
              periodFilter() === 'weekly'
                ? 'badge-primary'
                : 'bg-base-content/10 hover:bg-base-content/20'
            }`}
            onClick={() => handlePeriodToggle('weekly')}
          >
            Weekly
          </button>
          <button
            type="button"
            class={`badge badge-lg transition-all ${
              periodFilter() === 'monthly'
                ? 'badge-primary'
                : 'bg-base-content/10 hover:bg-base-content/20'
            }`}
            onClick={() => handlePeriodToggle('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      <div>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-bold">Active Goals</h3>
          <Show when={hasFilters()}>
            <span class="text-base-content/60 text-sm tabular-nums">
              <Show
                when={activeHasTotal()}
                fallback={<>Showing {activeSearchResults().items.length}</>}
              >
                {activeResultTotal()} result{activeResultTotal() !== 1 ? 's' : ''}
              </Show>
            </span>
          </Show>
        </div>
        <Show
          when={activeResultTotal() > 0}
          fallback={
            <div class="text-base-content/50 py-8 text-center">
              <Show
                when={hasFilters()}
                fallback={<>No goals yet. Create your first goal below.</>}
              >
                <Show when={searchQuery().trim()} fallback={<>No goals match the selected period.</>}>
                  No goals match "{searchQuery()}"
                </Show>
              </Show>
            </div>
          }
        >
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={activeSearchResults().items}>
              {(goal, index) => (
                <GoalCard
                  goal={goal}
                  progress={progressMap().get(goal._id)}
                  archived={false}
                  index={index()}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  onToggleArchive={props.onToggleArchive}
                  onTogglePin={props.onTogglePin}
                  onView={(item) => setSelectedGoal(item)}
                />
              )}
            </For>
          </div>
          <PaginationControls
            hasPrev={activeHasPrev()}
            hasNext={activeHasNext()}
            onPrev={handleActivePrev}
            onNext={() => handleActiveNext(activeSearchResults().nextCursor)}
          />
        </Show>
      </div>

      <Show when={archivedResultTotal() > 0}>
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-xl font-bold">Archived Goals</h3>
            <Show when={hasFilters()}>
              <span class="text-base-content/60 text-sm tabular-nums">
                <Show
                  when={archivedHasTotal()}
                  fallback={<>Showing {archivedSearchResults().items.length}</>}
                >
                  {archivedResultTotal()} result{archivedResultTotal() !== 1 ? 's' : ''}
                </Show>
              </span>
            </Show>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={archivedSearchResults().items}>
              {(goal, index) => (
                <GoalCard
                  goal={goal}
                  progress={progressMap().get(goal._id)}
                  archived
                  index={index()}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  onToggleArchive={props.onToggleArchive}
                  onTogglePin={props.onTogglePin}
                  onView={(item) => setSelectedGoal(item)}
                />
              )}
            </For>
          </div>
          <PaginationControls
            hasPrev={archivedHasPrev()}
            hasNext={archivedHasNext()}
            onPrev={handleArchivedPrev}
            onNext={() => handleArchivedNext(archivedSearchResults().nextCursor)}
          />
        </div>
      </Show>

      <Show when={selectedGoal()}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-300 border-base-content/10 h-full w-full max-w-4xl rounded-none border p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
            <div class="border-base-content/10 flex items-center justify-between border-b px-6 py-4">
              <div>
                <div class="text-base-content/60 text-xs font-semibold uppercase tracking-widest">
                  Goal entries
                </div>
                <h3 class="text-xl font-bold">{selectedGoal()!.name}</h3>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onClick={() => setSelectedGoal(null)}
                aria-label="Close"
              >
                <X class="size-4" />
              </button>
            </div>
            <div class="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-4">
              <Show
                when={sortedEntries().length > 0}
                fallback={
                  <div class="text-base-content/50 rounded-xl border border-dashed p-6 text-center text-sm">
                    No entries match this goal yet.
                  </div>
                }
              >
                <For each={sortedEntries()}>
                  {(entry) => (
                    <EntryCard entry={entry} trackerMap={trackerMap()} groupMap={groupMap()} />
                  )}
                </For>
              </Show>
            </div>
          </div>
          <div class="modal-backdrop" onClick={() => setSelectedGoal(null)} />
        </div>
      </Show>
    </div>
  );
}
