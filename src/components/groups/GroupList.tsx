import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import type { Group, PagedResult } from '../../lib/db/types';
import {
  FolderOpen,
  Edit,
  Trash2,
  Archive,
  ChevronRight,
  Search,
  ChevronDown,
  Folder,
  ChevronsDown,
  ChevronsRight,
} from 'lucide-solid';
import PaginationControls from '../common/PaginationControls';
import SearchInput from '../common/SearchInput';
import type { GroupSearchOptions } from '../../lib/repositories';

interface GroupListProps {
  groups: Group[];
  searchGroups: (options?: GroupSearchOptions) => Promise<PagedResult<Group>>;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
  onToggleArchive?: (group: Group) => void;
}

const ITEMS_PER_PAGE = 10;

export default function GroupList(props: GroupListProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activePage, setActivePage] = createSignal(1);
  const [archivedPage, setArchivedPage] = createSignal(1);
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set());

  const activeGroups = createMemo(() => {
    return props.groups.filter((g) => !g.archived);
  });

  const archivedGroups = createMemo(() => {
    return props.groups.filter((g) => g.archived);
  });

  const isSearching = createMemo(() => searchQuery().trim().length > 0);

  const [activeSearchResults] = createResource(
    () => ({
      query: searchQuery(),
      page: activePage(),
      perPage: ITEMS_PER_PAGE,
      archived: false,
      revision: props.groups,
    }),
    (source) =>
      props.searchGroups({
        query: source.query,
        page: source.page,
        perPage: source.perPage,
        archived: source.archived,
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
      revision: props.groups,
    }),
    (source) =>
      props.searchGroups({
        query: source.query,
        page: source.page,
        perPage: source.perPage,
        archived: source.archived,
      }),
    {
      initialValue: { items: [], total: 0, page: 1, perPage: ITEMS_PER_PAGE },
    },
  );

  const paginatedFilteredActiveGroups = createMemo(() => {
    if (!isSearching()) return activeGroups();
    return activeSearchResults().items;
  });

  const paginatedFilteredArchivedGroups = createMemo(() => {
    if (!isSearching()) return archivedGroups();
    return archivedSearchResults().items;
  });

  const activeTotalPages = createMemo(() => {
    if (!isSearching()) return 1;
    return Math.ceil(activeSearchResults().total / ITEMS_PER_PAGE);
  });

  const archivedTotalPages = createMemo(() => {
    if (!isSearching()) return 1;
    return Math.ceil(archivedSearchResults().total / ITEMS_PER_PAGE);
  });

  const activeResultTotal = createMemo(() =>
    isSearching() ? activeSearchResults().total : activeGroups().length,
  );

  const archivedResultTotal = createMemo(() =>
    isSearching() ? archivedSearchResults().total : archivedGroups().length,
  );

  // Reset page when search changes
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setActivePage(1);
    setArchivedPage(1);
  };

  // Toggle group expansion
  const toggleExpanded = (groupId: string) => {
    const current = new Set(expandedGroups());
    if (current.has(groupId)) {
      current.delete(groupId);
    } else {
      current.add(groupId);
    }
    setExpandedGroups(current);
  };

  // Expand all groups
  const expandAll = () => {
    const allGroupIds = new Set(props.groups.map((g) => g._id));
    setExpandedGroups(allGroupIds);
  };

  // Collapse all groups
  const collapseAll = () => {
    setExpandedGroups(new Set<string>());
  };

  // Build tree structure
  const buildTree = (groups: Group[]) => {
    const roots = groups.filter((g) => g.parentId === null);
    const childrenMap = new Map<string, Group[]>();

    groups.forEach((g) => {
      if (g.parentId) {
        if (!childrenMap.has(g.parentId)) {
          childrenMap.set(g.parentId, []);
        }
        childrenMap.get(g.parentId)!.push(g);
      }
    });

    return { roots, childrenMap };
  };

  const renderGroup = (
    group: Group,
    childrenMap: Map<string, Group[]>,
    isArchived = false,
    index = 0,
  ) => {
    const children = childrenMap.get(group._id) || [];
    const hasChildren = children.length > 0;

    return (
      <div class="mb-2">
        <div
          class={`accent-card card bg-base-300/80 border-base-content/10 animate-fade-in-up border shadow-md transition-all duration-300 hover:shadow-xl ${
            isArchived ? 'opacity-60 hover:opacity-80' : ''
          }`}
          style={{
            'border-left': group.color ? `2px solid ${group.color}` : undefined,
            '--accent-color': group.color || 'oklch(var(--p))',
            'animation-delay': `${index * 50}ms`,
          }}
        >
          <div class="card-body p-4">
            <div class="flex items-center justify-between">
              <div class="flex flex-1 items-center gap-3">
                {/* Expand/Collapse Button */}
                <Show when={hasChildren} fallback={<div class="w-4" />} /* Spacer for alignment */>
                  <button
                    onClick={() => toggleExpanded(group._id)}
                    class="btn btn-ghost btn-xs hover:bg-primary/10 h-auto min-h-0 p-0 transition-colors"
                    title={expandedGroups().has(group._id) ? 'Collapse' : 'Expand'}
                  >
                    <Show
                      when={expandedGroups().has(group._id)}
                      fallback={<ChevronRight size={16} class="text-primary" />}
                    >
                      <ChevronDown size={16} class="text-primary" />
                    </Show>
                  </button>
                </Show>

                {/* Icon */}
                <Show when={group.icon}>
                  <span class="text-2xl">{group.icon}</span>
                </Show>
                <Show when={!group.icon}>
                  <Show
                    when={hasChildren}
                    fallback={<FolderOpen size={24} class="text-base-content/50" />}
                  >
                    <Show
                      when={expandedGroups().has(group._id)}
                      fallback={<Folder size={24} class="text-base-content/50" />}
                    >
                      <FolderOpen size={24} class="text-base-content/50" />
                    </Show>
                  </Show>
                </Show>

                {/* Group Info */}
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <h4 class="text-lg font-semibold">{group.name}</h4>
                    <Show when={hasChildren}>
                      <span class="badge badge-xs bg-base-content/20 tabular-nums">
                        {children.length}
                      </span>
                    </Show>
                  </div>
                  <div class="text-base-content/60 mt-1 flex items-center gap-4 text-sm">
                    <span class="font-mono text-xs">{group.path}</span>
                    <Show when={!group.allowsTrackers}>
                      <span class="badge badge-sm bg-base-content/10">Groups only</span>
                    </Show>
                    <Show when={group.allowsTrackers}>
                      <span class="badge badge-sm badge-primary">Allows trackers</span>
                    </Show>
                  </div>
                  <Show when={group.description}>
                    <p class="text-base-content/70 mt-2 text-sm">{group.description}</p>
                  </Show>
                </div>
              </div>

              {/* Action Buttons */}
              <div class="flex gap-2">
                <button
                  class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={() => props.onEdit?.(group)}
                  title="Edit"
                >
                  <Edit size={16} />
                </button>
                <button
                  class="btn btn-ghost btn-sm hover:bg-warning/10 hover:text-warning transition-colors"
                  onClick={() => props.onToggleArchive?.(group)}
                  title={isArchived ? 'Unarchive' : 'Archive'}
                >
                  <Archive size={16} />
                </button>
                <button
                  class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
                  onClick={() => props.onDelete?.(group)}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Render children (only if expanded) */}
        <Show when={expandedGroups().has(group._id)}>
          <div class="border-base-content/5 mt-2 ml-6 border-l-2 pl-8">
            <For each={children}>
              {(child, childIndex) =>
                renderGroup(child, childrenMap, isArchived, index + childIndex() + 1)
              }
            </For>
          </div>
        </Show>
      </div>
    );
  };

  const renderFlatGroup = (group: Group, isArchived = false, index = 0) => {
    return (
      <div
        class={`card bg-base-300/80 border-base-content/10 hover:border-primary/30 animate-fade-in-up mb-2 border shadow-md transition-all duration-300 hover:shadow-xl ${
          isArchived ? 'opacity-60 hover:opacity-80' : ''
        }`}
        style={{
          'border-left': group.color ? `3px solid ${group.color}` : undefined,
          'animation-delay': `${index * 50}ms`,
        }}
      >
        <div class="card-body p-4">
          <div class="flex items-center justify-between">
            <div class="flex flex-1 items-center gap-3">
              <Show when={group.icon}>
                <span class="text-2xl">{group.icon}</span>
              </Show>
              <Show when={!group.icon}>
                <FolderOpen size={24} class="text-base-content/50" />
              </Show>
              <div class="flex-1">
                <h4 class="text-lg font-semibold">{group.name}</h4>
                <div class="text-base-content/60 mt-1 flex items-center gap-4 text-sm">
                  <span class="font-mono text-xs">{group.path}</span>
                  <span class="badge badge-sm bg-base-content/10 tabular-nums">
                    Depth: {group.depth}
                  </span>
                  <Show when={!group.allowsTrackers}>
                    <span class="badge badge-sm bg-base-content/10">Groups only</span>
                  </Show>
                  <Show when={group.allowsTrackers}>
                    <span class="badge badge-sm badge-primary">Allows trackers</span>
                  </Show>
                </div>
                <Show when={group.description}>
                  <p class="text-base-content/70 mt-2 text-sm">{group.description}</p>
                </Show>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => props.onEdit?.(group)}
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button
                class="btn btn-ghost btn-sm hover:bg-warning/10 hover:text-warning transition-colors"
                onClick={() => props.onToggleArchive?.(group)}
                title={isArchived ? 'Unarchive' : 'Archive'}
              >
                <Archive size={16} />
              </button>
              <button
                class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
                onClick={() => props.onDelete?.(group)}
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div class="space-y-6">
      {/* Search Bar and Controls */}
      <div class="space-y-3">
        <div class="flex gap-3">
          <SearchInput
            value={searchQuery()}
            onInput={handleSearch}
            placeholder="Search groups by name, path, or description..."
            icon={<Search size={20} />}
            wrapperClass="flex-1"
          />

          {/* Expand/Collapse All Buttons */}
          <Show when={!searchQuery().trim()}>
            <div class="flex gap-2">
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
              {activeResultTotal()} result{activeResultTotal() !== 1 ? 's' : ''}
            </span>
          </Show>
        </div>
        <Show
          when={activeGroups().length > 0}
          fallback={
            <div class="text-base-content/50 py-8 text-center">
              No groups yet. Create your first group above.
            </div>
          }
        >
          <Show
            when={activeResultTotal() > 0}
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
                    {(() => {
                      const { roots, childrenMap } = buildTree(paginatedFilteredActiveGroups());
                      return (
                        <For each={roots}>
                          {(root, index) => renderGroup(root, childrenMap, false, index())}
                        </For>
                      );
                    })()}
                  </>
                }
              >
                <For each={paginatedFilteredActiveGroups()}>
                  {(group, index) => renderFlatGroup(group, false, index())}
                </For>
                <PaginationControls
                  currentPage={activePage()}
                  totalPages={activeTotalPages()}
                  onPageChange={setActivePage}
                />
              </Show>
            </div>
          </Show>
        </Show>
      </div>

      {/* Archived Groups */}
      <Show when={archivedGroups().length > 0}>
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-xl font-bold">Archived Groups</h3>
            <Show when={searchQuery()}>
              <span class="text-base-content/60 text-sm tabular-nums">
                {archivedResultTotal()} result{archivedResultTotal() !== 1 ? 's' : ''}
              </span>
            </Show>
          </div>
          <Show
            when={archivedResultTotal() > 0}
            fallback={
              <div class="text-base-content/50 py-8 text-center">
                No archived groups match "{searchQuery()}"
              </div>
            }
          >
            <div class="space-y-2">
              <Show
                when={searchQuery().trim()}
                fallback={
                  <>
                    {(() => {
                      const { roots, childrenMap } = buildTree(paginatedFilteredArchivedGroups());
                      return (
                        <For each={roots}>
                          {(root, index) => renderGroup(root, childrenMap, true, index())}
                        </For>
                      );
                    })()}
                  </>
                }
              >
                <For each={paginatedFilteredArchivedGroups()}>
                  {(group, index) => renderFlatGroup(group, true, index())}
                </For>
                <PaginationControls
                  currentPage={archivedPage()}
                  totalPages={archivedTotalPages()}
                  onPageChange={setArchivedPage}
                />
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
