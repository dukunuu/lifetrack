import { createResource, Show, For, createMemo } from 'solid-js';
import type { Group } from '../../lib/db/types';
import GroupCard from './GroupCard';
import { useGroups } from '../../lib/hooks/useGroups';

interface GroupTreeNodeProps {
  group: Group;
  expandedGroups: Set<string>;
  onToggleExpand: (id: string) => void;
  childrenMap?: Map<string, Group[]>;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
  onToggleArchive?: (group: Group) => void;
}

export default function GroupTreeNode(props: GroupTreeNodeProps) {
  const { findDescendants, groupHasChildren: checkHasChildren } = useGroups({ load: 'none' });
  const isExpanded = () => props.expandedGroups.has(props.group._id);

  const buildSubTree = (parentGroupId: string, descendants: Group[]) => {
    const childrenMap = new Map<string, Group[]>();
    descendants.forEach((g) => {
      if (g.parentId) {
        if (!childrenMap.has(g.parentId)) childrenMap.set(g.parentId, []);
        childrenMap.get(g.parentId)!.push(g);
      }
    });
    return {
      roots: childrenMap.get(parentGroupId) || [],
      fullMap: childrenMap,
    };
  };

  const [branchData] = createResource(
    () => (isExpanded() && !props.childrenMap ? props.group._id : null),
    async (id) => {
      const list = await findDescendants(id);
      return buildSubTree(id, list);
    },
  );

  const [hasChildren] = createResource(
    () => (!isExpanded() && !props.childrenMap ? props.group._id : null),
    async (id) => await checkHasChildren(id),
  );

  const currentChildren = createMemo(() => {
    if (props.childrenMap) return props.childrenMap.get(props.group._id) || [];
    return branchData()?.roots || [];
  });

  const childrenCount = createMemo(() => {
    if (props.childrenMap) return props.childrenMap.get(props.group._id)?.length || 0;
    if (branchData()) return branchData()?.roots.length || 0;
    return hasChildren() ? 1 : 0; // Optimistic 1 if check says true
  });

  return (
    <div class="mb-2">
      <GroupCard
        group={props.group}
        variant="tree"
        isExpanded={isExpanded()}
        onToggleExpand={() => props.onToggleExpand(props.group._id)}
        hasChildren={childrenCount() > 0}
        childrenCount={childrenCount()}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onToggleArchive={props.onToggleArchive}
      />

      <Show when={isExpanded()}>
        <div class="border-base-content/5 mt-2 ml-4 border-l-2 pl-4">
          <Show when={branchData.loading}>
            <div class="loading loading-spinner loading-xs text-primary" />
          </Show>

          <For each={currentChildren()}>
            {(child) => (
              <GroupTreeNode
                group={child}
                expandedGroups={props.expandedGroups}
                onToggleExpand={props.onToggleExpand}
                childrenMap={props.childrenMap || branchData()?.fullMap}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
                onToggleArchive={props.onToggleArchive}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
