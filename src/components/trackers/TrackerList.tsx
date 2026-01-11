import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import type { Group, PagedResult, Tracker } from '../../lib/db/types';
import { Pin, Archive, Trash2, Edit, Tag, Search, Filter, X, Hash } from 'lucide-solid';
import PaginationControls from '../common/PaginationControls';
import SearchInput from '../common/SearchInput';
import type { TrackerSearchOptions } from '../../lib/repositories';

interface TrackerListProps {
  trackers: Tracker[];
  groups: Group[];
  searchTrackers: (options?: TrackerSearchOptions) => Promise<PagedResult<Tracker>>;
  onEdit?: (tracker: Tracker) => void;
  onDelete?: (tracker: Tracker) => void;
  onTogglePin?: (tracker: Tracker) => void;
  onToggleArchive?: (tracker: Tracker) => void;
}

const ITEMS_PER_PAGE = 10;

export default function TrackerList(props: TrackerListProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedGroupIds, setSelectedGroupIds] = createSignal<Set<string>>(new Set());
  const [activePage, setActivePage] = createSignal(1);
  const [archivedPage, setArchivedPage] = createSignal(1);

  const groupsMap = createMemo(() => {
    const map = new Map<string, Group>();
    props.groups.forEach((g) => map.set(g._id, g));
    return map;
  });

  const getGroupName = (groupId: string) => {
    return groupsMap().get(groupId)?.name || 'Unknown';
  };

  const getGroupColor = (groupId: string) => {
    return groupsMap().get(groupId)?.color;
  };

  const activeTrackers = createMemo(() => props.trackers.filter((t) => !t.archived));
  const archivedTrackers = createMemo(() => props.trackers.filter((t) => t.archived));

  const toggleGroupFilter = (groupId: string) => {
    const current = new Set(selectedGroupIds());
    if (current.has(groupId)) {
      current.delete(groupId);
    } else {
      current.add(groupId);
    }
    setSelectedGroupIds(current);
    setActivePage(1);
    setArchivedPage(1);
  };

  const clearGroupFilter = () => {
    setSelectedGroupIds(new Set<string>());
    setActivePage(1);
    setArchivedPage(1);
  };

  const [activeSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      page: activePage(),
      perPage: ITEMS_PER_PAGE,
      archived: false,
      groupIds: Array.from(selectedGroupIds()),
      revision: props.trackers,
    }),
    (source) =>
      props.searchTrackers({
        query: source.query,
        page: source.page,
        perPage: source.perPage,
        archived: source.archived,
        groupIds: source.groupIds,
      }),
    {
      initialValue: { items: [], total: 0, page: 1, perPage: ITEMS_PER_PAGE },
    },
  );

  const [archivedSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      page: archivedPage(),
      perPage: ITEMS_PER_PAGE,
      archived: true,
      groupIds: Array.from(selectedGroupIds()),
      revision: props.trackers,
    }),
    (source) =>
      props.searchTrackers({
        query: source.query,
        page: source.page,
        perPage: source.perPage,
        archived: source.archived,
        groupIds: source.groupIds,
      }),
    {
      initialValue: { items: [], total: 0, page: 1, perPage: ITEMS_PER_PAGE },
    },
  );

  const paginatedActiveTrackers = createMemo(() => activeSearchResults().items);
  const paginatedArchivedTrackers = createMemo(() => archivedSearchResults().items);

  const activeTotalPages = createMemo(() =>
    Math.ceil(activeSearchResults().total / ITEMS_PER_PAGE),
  );

  const archivedTotalPages = createMemo(() =>
    Math.ceil(archivedSearchResults().total / ITEMS_PER_PAGE),
  );

  const activeResultTotal = createMemo(() => activeSearchResults().total);
  const archivedResultTotal = createMemo(() => archivedSearchResults().total);

  // Reset page when search changes
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setActivePage(1);
    setArchivedPage(1);
  };

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
          <For each={props.groups.filter((g) => !g.archived)}>
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
              {activeResultTotal()} result{activeResultTotal() !== 1 ? 's' : ''}
              <Show when={selectedGroupIds().size > 0}>
                <span class="ml-2">
                  ({selectedGroupIds().size} group{selectedGroupIds().size !== 1 ? 's' : ''})
                </span>
              </Show>
            </span>
          </Show>
        </div>
        <Show
          when={activeTrackers().length > 0}
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
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <For each={paginatedActiveTrackers()}>
                {(tracker, index) => (
                  <div
                    class="accent-card card bg-base-300/80 border-base-content/10 animate-fade-in-up border shadow-md transition-all duration-300 hover:shadow-xl"
                    style={{
                      'border-left': getGroupColor(tracker.groupId)
                        ? `2px solid ${getGroupColor(tracker.groupId)}`
                        : undefined,
                      '--accent-color': getGroupColor(tracker.groupId) || 'oklch(var(--p))',
                      'animation-delay': `${index() * 50}ms`,
                    }}
                  >
                    <div class="card-body">
                      <div class="flex items-start justify-between">
                        <div class="flex items-center gap-2">
                          <div class="bg-base-200 text-base-content/60 grid h-10 w-10 place-items-center rounded-xl">
                            <Hash class="size-5" />
                          </div>
                          <div>
                            <h4 class="card-title text-lg">{tracker.label}</h4>
                            <div class="text-base-content/60 flex items-center gap-1 text-xs">
                              <Tag size={12} />
                              <span class="font-mono">{tracker.tag}</span>
                            </div>
                          </div>
                        </div>
                        <Show when={tracker.pinned}>
                          <Pin size={16} class="text-primary fill-current" />
                        </Show>
                      </div>

                      <div class="mt-2 space-y-1 text-sm">
                        <div>
                          <span class="text-base-content/60">Group: </span>
                          <span class="text-base-content/90">{getGroupName(tracker.groupId)}</span>
                        </div>
                        <div>
                          <span class="text-base-content/60">Fields: </span>
                          <span class="text-base-content/90 tabular-nums">
                            {tracker.fields.length}
                          </span>
                        </div>
                        <Show when={tracker.aliases && tracker.aliases.length > 0}>
                          <div>
                            <span class="text-base-content/60">Aliases: </span>
                            <span class="text-base-content/90 font-mono text-xs">
                              {tracker.aliases?.join(', ')}
                            </span>
                          </div>
                        </Show>
                      </div>

                      <div class="card-actions border-base-content/5 mt-2 justify-end border-t pt-2">
                        <button
                          class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => props.onTogglePin?.(tracker)}
                          title={tracker.pinned ? 'Unpin' : 'Pin'}
                        >
                          <Pin size={16} />
                        </button>
                        <button
                          class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => props.onEdit?.(tracker)}
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          class="btn btn-ghost btn-sm hover:bg-warning/10 hover:text-warning transition-colors"
                          onClick={() => props.onToggleArchive?.(tracker)}
                          title="Archive"
                        >
                          <Archive size={16} />
                        </button>
                        <button
                          class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
                          onClick={() => props.onDelete?.(tracker)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <PaginationControls
              currentPage={activePage()}
              totalPages={activeTotalPages()}
              onPageChange={setActivePage}
            />
          </Show>
        </Show>
      </div>

      {/* Archived Trackers */}
      <Show when={archivedTrackers().length > 0}>
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
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <For each={paginatedArchivedTrackers()}>
                {(tracker, index) => (
                  <div
                    class="card bg-base-300/40 border-base-content/5 animate-fade-in-up border opacity-60 shadow-sm transition-all duration-300 hover:opacity-80"
                    style={{
                      'animation-delay': `${index() * 50}ms`,
                    }}
                  >
                    <div class="card-body">
                      <div class="flex items-start justify-between">
                        <div class="flex items-center gap-2">
                          <div class="bg-base-200 text-base-content/60 grid h-10 w-10 place-items-center rounded-xl">
                            <Hash class="size-5" />
                          </div>
                          <div>
                            <h4 class="card-title text-lg">{tracker.label}</h4>
                            <div class="text-base-content/60 flex items-center gap-1 text-xs">
                              <Tag size={12} />
                              <span class="font-mono">{tracker.tag}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="card-actions border-base-content/5 mt-2 justify-end border-t pt-2">
                        <button
                          class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => props.onToggleArchive?.(tracker)}
                          title="Unarchive"
                        >
                          Unarchive
                        </button>
                        <button
                          class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
                          onClick={() => props.onDelete?.(tracker)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <PaginationControls
              currentPage={archivedPage()}
              totalPages={archivedTotalPages()}
              onPageChange={setArchivedPage}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
