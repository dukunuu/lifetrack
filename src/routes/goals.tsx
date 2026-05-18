import { useSearchParams } from '@solidjs/router';
import { Plus } from 'lucide-solid';
import { Show, createMemo, createResource } from 'solid-js';
import { SkeletonList } from '../components/common/Skeleton';
import GoalFormV2 from '../components/goals/GoalFormV2';
import GoalList from '../components/goals/GoalList';
import PageShell from '../components/layout/PageShell';
import type { Goal } from '../lib/db/types';
import { useGoals } from '../lib/hooks/useGoals';
import { useGroups } from '../lib/hooks/useGroups';
import { useTrackers } from '../lib/hooks/useTrackers';

export default function Goals() {
  const {
    loading: goalsLoading,
    createGoal,
    updateGoal,
    deleteGoal,
    searchGoals,
    findGoalById,
    goalRevision,
    findPinnedGoals,
  } = useGoals();
  const { groups, loading: groupsLoading } = useGroups();
  const { trackers, loading: trackersLoading } = useTrackers({ loadAll: true });
  const [searchParams, setSearchParams] = useSearchParams();

  const action = createMemo(() => searchParams.action as 'create' | 'edit' | undefined);
  const editId = createMemo(() =>
    typeof searchParams.id === 'string' ? searchParams.id : undefined,
  );

  const [editingGoal] = createResource(
    () => ({
      id: action() === 'edit' ? editId() : undefined,
      revision: goalRevision(),
    }),
    async (source) => {
      if (source.id) {
        return (await findGoalById(source.id)) ?? undefined;
      }
      return undefined;
    },
  );

  const showModal = createMemo(() => !!action());

  const closeModal = () => {
    setSearchParams({ action: undefined, id: undefined });
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
      const pinnedCount = await findPinnedGoals();
      if (pinnedCount.length >= 15) {
        alert('You can pin up to 15 goals.');
        return;
      }
    }
    await updateGoal(goal._id, { pinned: !goal.pinned });
  };

  const loading = () => goalsLoading() || groupsLoading() || trackersLoading();

  return (
    <PageShell
      title="Goals"
      subtitle="Track progress across trackers or entire groups"
      fab={{
        label: 'New Goal',
        icon: <Plus size={28} />,
        onClick: () => setSearchParams({ action: 'create' }),
      }}
      after={
        <Show when={showModal()}>
          <div class="modal modal-open backdrop-blur-sm">
            <div class="modal-box glass-card-raised h-full w-full max-w-5xl rounded-none p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
              <Show when={action() === 'create'}>
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
      }
    >
      <Show when={loading()}>
        <div class="animate-fade-in">
          <SkeletonList type="goal" count={3} />
        </div>
      </Show>

      <Show when={!loading()}>
        <GoalList
          revision={goalRevision()}
          searchGoals={searchGoals}
          onEdit={(goal) => setSearchParams({ edit: goal._id })}
          onDelete={handleDeleteGoal}
          onToggleArchive={handleToggleArchive}
          onTogglePin={handleTogglePin}
        />
      </Show>
    </PageShell>
  );
}
