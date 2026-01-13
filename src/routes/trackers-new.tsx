import { Show, createMemo, createResource } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { useTrackers } from '../lib/hooks/useTrackers';
import { useGroups } from '../lib/hooks/useGroups';
import TrackerFormV2 from '../components/trackers/TrackerFormV2';
import TrackerList from '../components/trackers/TrackerList';
import GroupFormV2 from '../components/groups/GroupFormV2';
import GroupList from '../components/groups/GroupList';
import PageShell from '../components/layout/PageShell';
import type { Tracker, Group } from '../lib/db/types';
import { Plus, Target, FolderTree } from 'lucide-solid';

export default function TrackersAndGroups() {
  const {
    loading: trackersLoading,
    createTracker,
    updateTracker,
    deleteTracker,
    searchTrackers,
    findById: findTrackerById,
    revision: trackerRevision,
  } = useTrackers({ loadAll: false });
  const {
    loading: groupsLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    findById: findGroupById,
    revision: groupRevision,
    searchGroups,
  } = useGroups();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = createMemo(() => (searchParams.tab === 'groups' ? 'groups' : 'trackers'));
  const action = createMemo(() => searchParams.action as 'create' | 'edit' | undefined);
  const editId = createMemo(() => (typeof searchParams.id === 'string' ? searchParams.id : undefined));

  const [editingTracker] = createResource(
    () => ({
      id: action() === 'edit' && activeTab() === 'trackers' ? editId() : undefined,
      revision: trackerRevision(),
    }),
    async (source) => {
      if (!source.id) return undefined;
      return (await findTrackerById(source.id)) ?? undefined;
    },
  );

  const [editingGroup] = createResource(
    () => ({
      id: action() === 'edit' && activeTab() === 'groups' ? editId() : undefined,
      revision: groupRevision()
    }),
    async (source) => {
      if (!source.id) return undefined;
      return (await findGroupById(source.id)) ?? undefined;
    }
  )

  const showModal = createMemo(() => !!action());

  const closeModal = () => {
    setSearchParams({ action: undefined, id: undefined });
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
    setSearchParams({ action: 'edit', id: tracker._id });
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
    setSearchParams({ action: 'edit', id: group._id });
  };

  const loading = () => trackersLoading() || groupsLoading();

  return (
    <PageShell
      title="Trackers & Groups"
      subtitle="Define custom trackers and organize them into hierarchical groups"
      fab={
        activeTab() === 'trackers'
          ? {
              label: 'New Tracker',
              icon: <Plus size={28} />,
              onClick: () => setSearchParams({ action: 'create' }),
            }
          : {
              label: 'New Group',
              icon: <Plus size={28} />,
              onClick: () => setSearchParams({ action: 'create' }),
            }
      }
      after={
        <Show when={showModal()}>
          <div class="modal modal-open backdrop-blur-sm">
            <div class="modal-box bg-base-300 border-base-content/10 h-full w-full max-w-4xl rounded-none border p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
              <Show when={action() === 'create' && activeTab() === 'trackers'}>
                <TrackerFormV2
                  onSubmit={handleCreateTracker}
                  onCancel={closeModal}
                />
              </Show>
              <Show when={action() === 'edit' && activeTab() === 'trackers' && editingTracker()}>
                <TrackerFormV2
                  onSubmit={handleEditTracker}
                  onCancel={closeModal}
                  initialData={editingTracker()}
                />
              </Show>
              <Show when={action() === 'create' && activeTab() === 'groups'}>
                <GroupFormV2
                  onSubmit={handleCreateGroup}
                  onCancel={closeModal}
                />
              </Show>
              <Show when={action() === 'edit' && activeTab() === 'groups' && editingGroup()}>
                <GroupFormV2
                  onSubmit={handleEditGroup}
                  onCancel={closeModal}
                  initialData={editingGroup()}
                />
              </Show>
            </div>
            <div class="modal-backdrop" onClick={closeModal} />
          </div>
        </Show>
      }
    >
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
                action: undefined,
                id: undefined,
                t_cursor: undefined,
                t_cursorStack: undefined,
                t_archivedCursor: undefined,
                t_archivedCursorStack: undefined,
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
                action: undefined,
                id: undefined,
                g_cursor: undefined,
                g_cursorStack: undefined,
                g_archivedCursor: undefined,
                g_archivedCursorStack: undefined,
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
              searchTrackers={searchTrackers}
              revision={trackerRevision()}
              onEdit={handleEditTrackerClick}
              onDelete={handleDeleteTracker}
              onTogglePin={handleToggleTrackerPin}
              onToggleArchive={handleToggleTrackerArchive}
            />
        </Show>

        {/* Groups Tab */}
        <Show when={!loading() && activeTab() === 'groups'}>
          <GroupList
            revision={groupRevision()}
            searchGroups={searchGroups}
            archived={false}
            onEdit={handleEditGroupClick}
            onDelete={handleDeleteGroup}
            onToggleArchive={handleToggleGroupArchive}
          />
        </Show>
      </div>
    </PageShell>
  );
}
