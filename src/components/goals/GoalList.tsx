import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import type { Entry, Goal, Group, PagedResult, Tracker } from '../../lib/db/types';
import { X } from 'lucide-solid';
import { computeGoalProgress } from '../../lib/services/goal-progress';
import SearchInput from '../common/SearchInput';
import type { GoalSearchOptions } from '../../lib/repositories';
import GoalCard from './GoalCard';
import EntryCard from '../entries/EntryCard';

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
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedGoal, setSelectedGoal] = createSignal<Goal | null>(null);

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
