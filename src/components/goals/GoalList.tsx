import { useSearchParams } from '@solidjs/router';
import { Show, createMemo, createResource, createSignal } from 'solid-js';
import { ITEMS_PER_PAGE } from '../../lib/constants/pagination';
import type { Goal, GoalPeriod, PagedResult } from '../../lib/db/types';
import { useEntries } from '../../lib/hooks/useEntries';
import { useSearchCursorPagination } from '../../lib/hooks/useSearchPagination';
import type { GoalSearchOptions } from '../../lib/repositories';
import { type GoalProgress, computeGoalProgress } from '../../lib/services/goal-progress';
import CardList from '../common/CardList';
import PaginationControls from '../common/PaginationControls';
import SearchInput from '../common/SearchInput';
import GoalCard from './GoalCard';
import GoalShowModal from './GoalShow';

interface GoalListProps {
  revision: number;
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

  const { findByGroupId, findRelevantEntries } = useEntries({ autoLoad: false });

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
      revision: props.revision,
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
      revision: props.revision,
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

  const activeGoals = createMemo(() => activeSearchResults().items);

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

  const fetchAllProgressData = async (goals: Goal[]) => {
    const map = new Map<string, GoalProgress>();

    for (const goal of goals) {
      const progress = await computeGoalProgress(goal);
      map.set(goal._id, progress);
    }
    return map;
  };

  const [progressMap] = createResource(activeGoals, fetchAllProgressData, {
    initialValue: new Map<string, GoalProgress>(),
  });

  const [entriesForGoal] = createResource(
    () => ({ goal: selectedGoal() }),
    async ({ goal }) => {
      if (!goal) return [];

      if (goal.groupId) {
        return await findByGroupId(goal.groupId);
      }

      return await findRelevantEntries({ trackerIds: goal.trackerIds });
    },
    { initialValue: [] },
  );

  const sortedEntries = createMemo(() =>
    [...entriesForGoal()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  );

  return (
    <div class="space-y-6">
      <div class="space-y-3">
        <SearchInput value={searchQuery()} onInput={handleSearch} placeholder="Search goals..." />

        <div class="flex flex-wrap items-center gap-2">
          <div class="text-base-content/60 text-sm font-medium tracking-wide uppercase">Period</div>
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
              <Show when={hasFilters()} fallback={<>No goals yet. Create your first goal below.</>}>
                <Show
                  when={searchQuery().trim()}
                  fallback={<>No goals match the selected period.</>}
                >
                  No goals match "{searchQuery()}"
                </Show>
              </Show>
            </div>
          }
        >
          <CardList
            items={activeSearchResults().items}
            CardComponent={GoalCard}
            getCardProps={(goal, index) => ({
              goal,
              progress: progressMap().get(goal._id),
              archived: false,
              index,
              searchQuery: searchQuery(),
              onEdit: props.onEdit,
              onDelete: props.onDelete,
              onToggleArchive: props.onToggleArchive,
              onTogglePin: props.onTogglePin,
              onView: (item) => setSelectedGoal(item),
            })}
          />
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
          <CardList
            items={archivedSearchResults().items}
            CardComponent={GoalCard}
            getCardProps={(goal, index) => ({
              goal,
              progress: progressMap().get(goal._id),
              archived: true,
              index,
              searchQuery: searchQuery(),
              onEdit: props.onEdit,
              onDelete: props.onDelete,
              onToggleArchive: props.onToggleArchive,
              onTogglePin: props.onTogglePin,
              onView: (item) => setSelectedGoal(item),
            })}
          />
          <PaginationControls
            hasPrev={archivedHasPrev()}
            hasNext={archivedHasNext()}
            onPrev={handleArchivedPrev}
            onNext={() => handleArchivedNext(archivedSearchResults().nextCursor)}
          />
        </div>
      </Show>
      <GoalShowModal
        selectedGoal={selectedGoal()}
        setSelectedGoal={setSelectedGoal}
        sortedEntries={sortedEntries()}
      />
    </div>
  );
}
