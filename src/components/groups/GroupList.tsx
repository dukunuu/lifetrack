import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import type { Group, PagedResult } from '../../lib/db/types';
import { Search, ChevronsDown, ChevronsRight } from 'lucide-solid';
import PaginationControls from '../common/PaginationControls';
import SearchInput from '../common/SearchInput';
import type { GroupSearchOptions } from '../../lib/repositories';
import { useSearchCursorPagination } from '../../lib/hooks/useSearchPagination';
import GroupCard from './GroupCard';
import CardList from '../common/CardList';
import { ITEMS_PER_PAGE } from '../../lib/constants/pagination';
import GroupTreeNode from './GroupTreeNode';

interface GroupListProps {
  revision: number;
  archived: boolean;
  searchGroups: (options?: GroupSearchOptions) => Promise<PagedResult<Group>>;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
  onToggleArchive?: (group: Group) => void;
}

export default function GroupList(props: GroupListProps) {
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set());
  const {
    searchQuery,
    activeCursor,
    activeCursorStack,
    handleSearch,
    handleActiveNext,
    handleActivePrev,
    watchEmptyPages,
  } = useSearchCursorPagination({
    queryKey: 'g_q',
    cursorKey: 'g_cursor',
    cursorStackKey: 'g_cursorStack',
    archivedCursorKey: 'g_archivedCursor',
    archivedCursorStackKey: 'g_archivedCursorStack',
  });

  const [activeSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      cursor: activeCursor(),
      perPage: ITEMS_PER_PAGE,
      revision: props.revision,
    }),
    (source) =>
      props.searchGroups({
        query: source.query,
        cursor: source.cursor,
        perPage: source.perPage,
      }),
    {
      initialValue: { items: [], perPage: ITEMS_PER_PAGE },
    },
  );

  const paginatedFilteredActiveGroups = createMemo(() => activeSearchResults().items);

  const activeResultTotal = createMemo(
    () => activeSearchResults().total ?? paginatedFilteredActiveGroups().length,
  );
  const activeHasTotal = createMemo(() => activeSearchResults().total !== undefined);

  const activeHasPrev = createMemo(() => activeCursorStack().length > 0);
  const activeHasNext = createMemo(() => Boolean(activeSearchResults().nextCursor));

  watchEmptyPages(() => paginatedFilteredActiveGroups().length);

  const toggleExpanded = (groupId: string) => {
    const current = new Set(expandedGroups());
    if (current.has(groupId)) {
      current.delete(groupId);
    } else {
      current.add(groupId);
    }
    setExpandedGroups(current);
  };

  const expandAll = () => {
    const allGroupIds = new Set(paginatedFilteredActiveGroups().map((g) => g._id));
    setExpandedGroups(allGroupIds);
  };

  const collapseAll = () => {
    setExpandedGroups(new Set<string>());
  };

  return (
    <div class="space-y-6">
      <div class="space-y-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={searchQuery()}
            onInput={handleSearch}
            placeholder="Search groups by name, path, or description..."
            icon={<Search size={20} />}
            wrapperClass="flex-1"
          />

          <Show when={!searchQuery().trim()}>
            <div class="flex flex-wrap gap-2">
              <button
                onClick={expandAll}
                class="btn btn-ghost btn-sm gap-2"
                title="Expand all groups"
              >
                <ChevronsDown size={16} />
                Expand All
              </button>
              <button
                onClick={collapseAll}
                class="btn btn-ghost btn-sm gap-2"
                title="Collapse all groups"
              >
                <ChevronsRight size={16} />
                Collapse All
              </button>
            </div>
          </Show>
        </div>
      </div>

      {/* Active Groups */}
      <div>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-bold">Groups</h3>
          <Show when={searchQuery()}>
            <span class="text-base-content/60 text-sm tabular-nums">
              <Show
                when={activeHasTotal()}
                fallback={<>Showing {paginatedFilteredActiveGroups().length}</>}
              >
                {activeResultTotal()} result{activeResultTotal() !== 1 ? 's' : ''}
              </Show>
            </span>
          </Show>
        </div>
        <Show
          when={activeResultTotal() > 0 || searchQuery()}
          fallback={
            <div class="text-base-content/50 py-8 text-center">
              No groups yet. Create your first group above.
            </div>
          }
        >
          <Show
            when={(activeResultTotal() ?? 0) > 0}
            fallback={
              <div class="text-base-content/50 py-8 text-center">
                No groups match "{searchQuery()}"
              </div>
            }
          >
            <div class="space-y-2">
              <Show
                when={searchQuery().trim()}
                fallback={
                  <>
                    <For each={activeSearchResults().items}>
                      {(root) => (
                        <GroupTreeNode
                          expandedGroups={expandedGroups()}
                          onToggleExpand={toggleExpanded}
                          group={root}
                          onEdit={props.onEdit}
                          onDelete={props.onDelete}
                          onToggleArchive={props.onToggleArchive}
                        />
                      )}
                    </For>
                  </>
                }
              >
                <CardList
                  class="space-y-2"
                  items={paginatedFilteredActiveGroups()}
                  CardComponent={GroupCard}
                  getCardProps={(group, index) => ({
                    group,
                    index,
                    variant: 'flat' as const,
                    onEdit: props.onEdit,
                    onDelete: props.onDelete,
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
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
