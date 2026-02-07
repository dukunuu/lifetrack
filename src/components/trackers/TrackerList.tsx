import { useSearchParams } from '@solidjs/router';
import { Filter, Search, X } from 'lucide-solid';
import { For, Show, createMemo, createResource } from 'solid-js';
import { ITEMS_PER_PAGE } from '../../lib/constants/pagination';
import type { Group, PagedResult, Tracker } from '../../lib/db/types';
import { useGroups } from '../../lib/hooks/useGroups';
import { useSearchCursorPagination } from '../../lib/hooks/useSearchPagination';
import type { TrackerSearchOptions } from '../../lib/repositories';
import CardList from '../common/CardList';
import PaginationControls from '../common/PaginationControls';
import SearchInput from '../common/SearchInput';
import TrackerCard from './TrackerCard';

interface TrackerListProps {
  searchTrackers: (options?: TrackerSearchOptions) => Promise<PagedResult<Tracker>>;
  revision?: number;
  onEdit?: (tracker: Tracker) => void;
  onDelete?: (tracker: Tracker) => void;
  onTogglePin?: (tracker: Tracker) => void;
  onToggleArchive?: (tracker: Tracker) => void;
}

export default function TrackerList(props: TrackerListProps) {
  const { groups } = useGroups({ load: 'trackers' });
  const [searchParams, setSearchParams] = useSearchParams();

  const parseGroupIds = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return [];
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

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
    queryKey: 't_q',
    cursorKey: 't_cursor',
    cursorStackKey: 't_cursorStack',
    archivedCursorKey: 't_archivedCursor',
    archivedCursorStackKey: 't_archivedCursorStack',
  });
  const selectedGroupIds = createMemo(() => new Set(parseGroupIds(searchParams.t_groups)));

  const groupsMap = createMemo(() => {
    const map = new Map<string, Group>();
    groups().forEach((g) => map.set(g._id, g));
    return map;
  });

  const getGroupName = (groupId: string) => {
    return groupsMap().get(groupId)?.name || 'Unknown';
  };

  const getGroupColor = (groupId: string) => {
    return groupsMap().get(groupId)?.color;
  };

  const toggleGroupFilter = (groupId: string) => {
    const current = new Set(selectedGroupIds());
    if (current.has(groupId)) {
      current.delete(groupId);
    } else {
      current.add(groupId);
    }
    setSearchParams({
      t_groups: current.size > 0 ? Array.from(current).join(',') : undefined,
    });
    resetCursors();
  };

  const clearGroupFilter = () => {
    setSearchParams({
      t_groups: undefined,
    });
    resetCursors();
  };

  const [activeSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      cursor: activeCursor(),
      perPage: ITEMS_PER_PAGE,
      archived: false,
      groupIds: Array.from(selectedGroupIds()),
      revision: props.revision,
    }),
    (source) =>
      props.searchTrackers({
        query: source.query,
        cursor: source.cursor,
        perPage: source.perPage,
        archived: source.archived,
        groupIds: source.groupIds,
      }),
    {
      initialValue: { items: [], perPage: ITEMS_PER_PAGE },
    },
  );

  const [archivedSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      cursor: archivedCursor(),
      perPage: ITEMS_PER_PAGE,
      archived: true,
      groupIds: Array.from(selectedGroupIds()),
      revision: props.revision,
    }),
    (source) =>
      props.searchTrackers({
        query: source.query,
        cursor: source.cursor,
        perPage: source.perPage,
        archived: source.archived,
        groupIds: source.groupIds,
      }),
    {
      initialValue: { items: [], perPage: ITEMS_PER_PAGE },
    },
  );

  const paginatedActiveTrackers = createMemo(() => activeSearchResults().items);
  const paginatedArchivedTrackers = createMemo(() => archivedSearchResults().items);

  const activeResultTotal = createMemo(
    () => activeSearchResults().total ?? paginatedActiveTrackers().length,
  );
  const archivedResultTotal = createMemo(
    () => archivedSearchResults().total ?? paginatedArchivedTrackers().length,
  );
  const activeHasTotal = createMemo(() => activeSearchResults().total !== undefined);

  const activeHasPrev = createMemo(() => activeCursorStack().length > 0);
  const archivedHasPrev = createMemo(() => archivedCursorStack().length > 0);
  const activeHasNext = createMemo(() => Boolean(activeSearchResults().nextCursor));
  const archivedHasNext = createMemo(() => Boolean(archivedSearchResults().nextCursor));

  watchEmptyPages(
    () => paginatedActiveTrackers().length,
    () => paginatedArchivedTrackers().length,
  );

  return (
    <div class="space-y-6">
      {/* Search and Filter Bar */}
      <div class="space-y-3">
        <SearchInput
          value={searchQuery()}
          onInput={handleSearch}
          placeholder="Search trackers by name, tag, or alias..."
          icon={<Search size={20} />}
        />

        {/* Group Filter */}
        <div class="flex flex-wrap items-center gap-2">
          <div class="text-base-content/60 flex items-center gap-2 text-sm">
            <Filter size={16} />
            <span>Filter by group:</span>
          </div>
          <For each={groups()}>
            {(group) => (
              <button
                onClick={() => toggleGroupFilter(group._id)}
                class={`badge badge-lg gap-2 transition-all ${
                  selectedGroupIds().has(group._id)
                    ? 'badge-primary'
                    : 'bg-base-content/10 hover:bg-base-content/20'
                }`}
              >
                <Show when={group.icon}>
                  <span>{group.icon}</span>
                </Show>
                {group.name}
              </button>
            )}
          </For>
          <Show when={selectedGroupIds().size > 0}>
            <button
              onClick={clearGroupFilter}
              class="btn btn-ghost btn-sm gap-1"
              title="Clear filters"
            >
              <X size={14} />
              Clear
            </button>
          </Show>
        </div>
      </div>

      {/* Active Trackers */}
      <div>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-bold">Active Trackers</h3>
          <Show when={searchQuery() || selectedGroupIds().size > 0}>
            <span class="text-base-content/60 text-sm tabular-nums">
              <Show
                when={activeHasTotal()}
                fallback={<>Showing {paginatedActiveTrackers().length}</>}
              >
                {activeResultTotal()} result{activeResultTotal() !== 1 ? 's' : ''}
              </Show>
              <Show when={selectedGroupIds().size > 0}>
                <span class="ml-2">
                  ({selectedGroupIds().size} group{selectedGroupIds().size !== 1 ? 's' : ''})
                </span>
              </Show>
            </span>
          </Show>
        </div>
        <Show
          when={activeResultTotal() > 0 || searchQuery() || selectedGroupIds().size > 0}
          fallback={
            <div class="text-base-content/50 py-8 text-center">
              No trackers yet. Create your first tracker above.
            </div>
          }
        >
          <Show
            when={activeResultTotal() > 0}
            fallback={
              <div class="text-base-content/50 py-8 text-center">
                No trackers match "{searchQuery()}"
              </div>
            }
          >
            <CardList
              items={paginatedActiveTrackers()}
              CardComponent={TrackerCard}
              getCardProps={(tracker, index) => ({
                tracker,
                index,
                groupName: getGroupName(tracker.groupId),
                groupColor: getGroupColor(tracker.groupId),
                searchQuery: searchQuery(),
                onEdit: props.onEdit,
                onDelete: props.onDelete,
                onTogglePin: props.onTogglePin,
                onToggleArchive: props.onToggleArchive,
              })}
            />
            <PaginationControls
              hasPrev={activeHasPrev()}
              hasNext={activeHasNext()}
              onPrev={handleActivePrev}
              onNext={() => handleActiveNext(activeSearchResults().nextCursor)}
            />
          </Show>
        </Show>
      </div>

      {/* Archived Trackers */}
      <Show when={archivedResultTotal() > 0}>
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-xl font-bold">Archived Trackers</h3>
            <Show when={searchQuery() || selectedGroupIds().size > 0}>
              <span class="text-base-content/60 text-sm tabular-nums">
                {archivedResultTotal()} result{archivedResultTotal() !== 1 ? 's' : ''}
                <Show when={selectedGroupIds().size > 0}>
                  <span class="ml-2">
                    ({selectedGroupIds().size} group{selectedGroupIds().size !== 1 ? 's' : ''})
                  </span>
                </Show>
              </span>
            </Show>
          </div>
          <Show
            when={archivedResultTotal() > 0}
            fallback={
              <div class="text-base-content/50 py-8 text-center">
                No archived trackers match "{searchQuery()}"
              </div>
            }
          >
            <CardList
              items={paginatedArchivedTrackers()}
              CardComponent={TrackerCard}
              getCardProps={(tracker, index) => ({
                tracker,
                index,
                variant: 'archived' as const,
                onDelete: props.onDelete,
                onToggleArchive: props.onToggleArchive,
              })}
            />
            <PaginationControls
              hasPrev={archivedHasPrev()}
              hasNext={archivedHasNext()}
              onPrev={handleArchivedPrev}
              onNext={() => handleArchivedNext(archivedSearchResults().nextCursor)}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
