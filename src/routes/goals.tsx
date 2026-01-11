import { Show, createMemo } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { useGoals } from '../lib/hooks/useGoals';
import { useGroups } from '../lib/hooks/useGroups';
import { useTrackers } from '../lib/hooks/useTrackers';
import { useEntriesAll } from '../lib/hooks/useEntriesAll';
import GoalFormV2 from '../components/goals/GoalFormV2';
import GoalList from '../components/goals/GoalList';
import type { Goal } from '../lib/db/types';
import { Plus } from 'lucide-solid';

export default function Goals() {
  const { goals, loading: goalsLoading, createGoal, updateGoal, deleteGoal, searchGoals } =
    useGoals();
  const { groups, loading: groupsLoading } = useGroups();
  const { trackers, loading: trackersLoading } = useTrackers();
  const { entries, loading: entriesLoading } = useEntriesAll();
  const [searchParams, setSearchParams] = useSearchParams();

  const createType = createMemo(() => searchParams.create as 'goal' | undefined);
  const editId = createMemo(() => searchParams.edit);

  const editingGoal = createMemo(() => {
    if (editId()) {
      return goals().find((goal) => goal._id === editId());
    }
    return undefined;
  });

  const showModal = createMemo(() => createType() === 'goal' || !!editingGoal());

  const closeModal = () => {
    setSearchParams({ create: undefined, edit: undefined });
  };

  const handleCreateGoal = async (data: Omit<Goal, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    await createGoal(data);
    closeModal();
  };

  const handleEditGoal = async (data: Omit<Goal, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    const goal = editingGoal();
    if (goal) {
      await updateGoal(goal._id, data);
      closeModal();
    }
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (confirm(`Are you sure you want to delete "${goal.name}"?`)) {
      await deleteGoal(goal._id);
    }
  };

  const handleToggleArchive = async (goal: Goal) => {
    await updateGoal(goal._id, { archived: !goal.archived });
  };

  const handleTogglePin = async (goal: Goal) => {
    if (!goal.pinned) {
      const pinnedCount = goals().filter((item) => item.pinned && !item.archived).length;
      if (pinnedCount >= 15) {
        alert('You can pin up to 15 goals.');
        return;
      }
    }
    await updateGoal(goal._id, { pinned: !goal.pinned });
  };

  const loading = () => goalsLoading() || groupsLoading() || trackersLoading() || entriesLoading();

  return (
    <div class="bg-base-100 min-h-screen">
      <div class="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div class="mb-6 sm:mb-8">
          <h1 class="from-primary to-secondary mb-2 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Goals
          </h1>
          <p class="text-base-content/70 text-base sm:text-lg">
            Track progress across trackers or entire groups
          </p>
        </div>

        <Show when={loading()}>
          <div class="flex items-center justify-center py-20">
            <span class="loading loading-spinner loading-lg text-primary"></span>
          </div>
        </Show>

        <Show when={!loading()}>
          <GoalList
            goals={goals()}
            groups={groups()}
            trackers={trackers()}
            entries={entries()}
            searchGoals={searchGoals}
            onEdit={(goal) => setSearchParams({ edit: goal._id })}
            onDelete={handleDeleteGoal}
            onToggleArchive={handleToggleArchive}
            onTogglePin={handleTogglePin}
          />
        </Show>
      </div>

      <button
        class="btn btn-primary btn-circle btn-lg hover:shadow-3xl fixed right-6 z-40 shadow-2xl transition-all hover:scale-110 sm:right-8 fab-quickadd-offset"
        onClick={() => setSearchParams({ create: 'goal' })}
        title="New Goal"
      >
        <Plus size={28} />
      </button>

      <Show when={showModal()}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-300 border-base-content/10 h-full w-full max-w-5xl rounded-none border p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
            <Show when={createType() === 'goal'}>
              <GoalFormV2
                groups={groups()}
                trackers={trackers()}
                onSubmit={handleCreateGoal}
                onCancel={closeModal}
              />
            </Show>
            <Show when={editingGoal()}>
              <GoalFormV2
                groups={groups()}
                trackers={trackers()}
                onSubmit={handleEditGoal}
                onCancel={closeModal}
                initialData={editingGoal()}
              />
            </Show>
          </div>
          <div class="modal-backdrop" onClick={closeModal} />
        </div>
      </Show>
    </div>
  );
}
