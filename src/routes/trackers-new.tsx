import { Show, createMemo } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { useTrackers } from '../lib/hooks/useTrackers';
import { useGroups } from '../lib/hooks/useGroups';
import TrackerFormV2 from '../components/trackers/TrackerFormV2';
import TrackerList from '../components/trackers/TrackerList';
import GroupFormV2 from '../components/groups/GroupFormV2';
import GroupList from '../components/groups/GroupList';
import type { Tracker, Group } from '../lib/db/types';
import { Plus, Target, FolderTree } from 'lucide-solid';

export default function TrackersAndGroups() {
  const {
    trackers,
    loading: trackersLoading,
    createTracker,
    updateTracker,
    deleteTracker,
    searchTrackers,
  } = useTrackers();
  const {
    groups,
    loading: groupsLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    searchGroups,
  } = useGroups();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = createMemo(() => (searchParams.tab === 'groups' ? 'groups' : 'trackers'));
  const createType = createMemo(() => searchParams.create as 'tracker' | 'group' | undefined);
  const editType = createMemo(() => searchParams.edit as 'tracker' | 'group' | undefined);
  const editId = createMemo(() => searchParams.id);

  const editingTracker = createMemo(() => {
    if (editType() === 'tracker' && editId()) {
      return trackers().find((t) => t._id === editId());
    }
    return undefined;
  });

  const editingGroup = createMemo(() => {
    if (editType() === 'group' && editId()) {
      return groups().find((g) => g._id === editId());
    }
    return undefined;
  });

  const showModal = createMemo(() => !!createType() || !!editType());

  const closeModal = () => {
    setSearchParams({ create: undefined, edit: undefined, id: undefined });
  };

  // Tracker handlers
  const handleCreateTracker = async (
    data: Omit<Tracker, '_id' | '_rev' | 'createdAt' | 'updatedAt'>,
  ) => {
    await createTracker(data);
    closeModal();
  };

  const handleEditTracker = async (
    data: Omit<Tracker, '_id' | '_rev' | 'createdAt' | 'updatedAt'>,
  ) => {
    const tracker = editingTracker();
    if (tracker) {
      await updateTracker(tracker._id, data);
      closeModal();
    }
  };

  const handleDeleteTracker = async (tracker: Tracker) => {
    if (confirm(`Are you sure you want to delete "${tracker.label}"?`)) {
      await deleteTracker(tracker._id);
    }
  };

  const handleToggleTrackerPin = async (tracker: Tracker) => {
    await updateTracker(tracker._id, { pinned: !tracker.pinned });
  };

  const handleToggleTrackerArchive = async (tracker: Tracker) => {
    await updateTracker(tracker._id, { archived: !tracker.archived });
  };

  const handleEditTrackerClick = (tracker: Tracker) => {
    setSearchParams({ edit: 'tracker', id: tracker._id });
  };

  // Group handlers
  const handleCreateGroup = async (
    data: Omit<Group, '_id' | '_rev' | 'createdAt' | 'updatedAt'>,
  ) => {
    await createGroup(data);
    closeModal();
  };

  const handleEditGroup = async (data: Omit<Group, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    const group = editingGroup();
    if (group) {
      await updateGroup(group._id, data);
      closeModal();
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    if (
      confirm(
        `Are you sure you want to delete "${group.name}"? This will also delete all sub-groups and trackers.`,
      )
    ) {
      await deleteGroup(group._id);
    }
  };

  const handleToggleGroupArchive = async (group: Group) => {
    await updateGroup(group._id, { archived: !group.archived });
  };

  const handleEditGroupClick = (group: Group) => {
    setSearchParams({ edit: 'group', id: group._id });
  };

  const loading = () => trackersLoading() || groupsLoading();

  return (
    <div class="bg-base-100 min-h-screen">
      <div class="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div class="mb-6 sm:mb-8">
          <h1 class="from-primary to-secondary mb-2 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Trackers & Groups
          </h1>
          <p class="text-base-content/70 text-base sm:text-lg">
            Define custom trackers and organize them into hierarchical groups
          </p>
        </div>

        {/* Tabs */}
        <div class="mb-6">
          <div role="tablist" class="tabs tabs-boxed bg-base-200 w-full p-1 sm:w-auto">
            <button
              type="button"
              role="tab"
              class={`tab flex-1 gap-2 sm:flex-none ${activeTab() === 'trackers' ? 'tab-active' : ''}`}
              onClick={() =>
                setSearchParams({
                  tab: 'trackers',
                  create: undefined,
                  edit: undefined,
                  id: undefined,
                })
              }
            >
              <Target size={18} class="hidden sm:inline" />
              <span>Trackers</span>
            </button>
            <button
              type="button"
              role="tab"
              class={`tab flex-1 gap-2 sm:flex-none ${activeTab() === 'groups' ? 'tab-active' : ''}`}
              onClick={() =>
                setSearchParams({
                  tab: 'groups',
                  create: undefined,
                  edit: undefined,
                  id: undefined,
                })
              }
            >
              <FolderTree size={18} class="hidden sm:inline" />
              <span>Groups</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="space-y-6">
          {/* Loading State */}
          <Show when={loading()}>
            <div class="flex items-center justify-center py-20">
              <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </Show>

          {/* Trackers Tab */}
          <Show when={!loading() && activeTab() === 'trackers'}>
            <TrackerList
              trackers={trackers()}
              groups={groups()}
              searchTrackers={searchTrackers}
              onEdit={handleEditTrackerClick}
              onDelete={handleDeleteTracker}
              onTogglePin={handleToggleTrackerPin}
              onToggleArchive={handleToggleTrackerArchive}
            />
          </Show>

          {/* Groups Tab */}
          <Show when={!loading() && activeTab() === 'groups'}>
            <GroupList
              groups={groups()}
              searchGroups={searchGroups}
              onEdit={handleEditGroupClick}
              onDelete={handleDeleteGroup}
              onToggleArchive={handleToggleGroupArchive}
            />
          </Show>
        </div>
      </div>

      {/* Floating Action Button */}
      <Show when={activeTab() === 'trackers'}>
        <button
          class="btn btn-primary btn-circle btn-lg hover:shadow-3xl fixed right-6 z-40 shadow-2xl transition-all hover:scale-110 sm:right-8 fab-quickadd-offset"
          onClick={() => setSearchParams({ create: 'tracker' })}
          title="New Tracker"
        >
          <Plus size={28} />
        </button>
      </Show>

      <Show when={activeTab() === 'groups'}>
        <button
          class="btn btn-primary btn-circle btn-lg hover:shadow-3xl fixed right-6 z-40 shadow-2xl transition-all hover:scale-110 sm:right-8 fab-quickadd-offset"
          onClick={() => setSearchParams({ create: 'group' })}
          title="New Group"
        >
          <Plus size={28} />
        </button>
      </Show>

      {/* Modal */}
      <Show when={showModal()}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-300 border-base-content/10 h-full w-full max-w-4xl rounded-none border p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
            <Show when={createType() === 'tracker'}>
              <TrackerFormV2
                groups={groups()}
                onSubmit={handleCreateTracker}
                onCancel={closeModal}
              />
            </Show>
            <Show when={editType() === 'tracker' && editingTracker()}>
              <TrackerFormV2
                groups={groups()}
                onSubmit={handleEditTracker}
                onCancel={closeModal}
                initialData={editingTracker()}
              />
            </Show>
            <Show when={createType() === 'group'}>
              <GroupFormV2 groups={groups()} onSubmit={handleCreateGroup} onCancel={closeModal} />
            </Show>
            <Show when={editType() === 'group' && editingGroup()}>
              <GroupFormV2
                groups={groups()}
                onSubmit={handleEditGroup}
                onCancel={closeModal}
                initialData={editingGroup()}
              />
            </Show>
          </div>
          <div class="modal-backdrop" onClick={closeModal} />
        </div>
      </Show>
    </div>
  );
}
