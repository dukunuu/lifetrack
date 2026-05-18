import { Archive, ChevronDown, ChevronRight, Edit, Folder, FolderOpen, Trash2 } from 'lucide-solid';
import { Show } from 'solid-js';
import type { Group } from '../../lib/db/types';

interface GroupCardProps {
  group: Group;
  index?: number;
  variant: 'tree' | 'flat';
  hasChildren?: boolean;
  isExpanded?: boolean;
  childrenCount?: number;
  onToggleExpand?: () => void;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
  onToggleArchive?: (group: Group) => void;
}

export default function GroupCard(props: GroupCardProps) {
  const isTree = () => props.variant === 'tree';
  const hasChildren = () => !!props.hasChildren;
  const showExpand = () => isTree() && hasChildren();
  const showIcon = () => !!props.group.icon;
  const animationDelay = () => `${(props.index ?? 0) * 50}ms`;
  const cardClass = isTree()
    ? 'accent-card glass-card hover-lift card animate-fade-in-up transition-all duration-300'
    : 'glass-card hover-lift card animate-fade-in-up mb-2 transition-all duration-300';

  const renderIcon = () => {
    if (showIcon()) {
      return <span class="text-2xl">{props.group.icon}</span>;
    }
    if (isTree() && hasChildren()) {
      return props.isExpanded ? (
        <FolderOpen size={24} class="text-base-content/50" />
      ) : (
        <Folder size={24} class="text-base-content/50" />
      );
    }
    return <FolderOpen size={24} class="text-base-content/50" />;
  };

  return (
    <div
      class={`${cardClass} ${props.group.archived ? 'opacity-60 hover:opacity-80' : ''}`}
      style={{
        'border-left': props.group.color ? `3px solid ${props.group.color}` : undefined,
        '--accent-color': props.group.color || 'oklch(var(--p))',
        'animation-delay': animationDelay(),
      }}
    >
      <div class="card-body p-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-1 items-start gap-3 sm:items-center">
            <Show when={showExpand()}>
              <button
                onClick={props.onToggleExpand}
                class="btn btn-ghost btn-xs hover:bg-primary/10 h-auto min-h-0 p-0 transition-colors"
                title={props.isExpanded ? 'Collapse' : 'Expand'}
                type="button"
              >
                <Show
                  when={props.isExpanded}
                  fallback={<ChevronRight size={16} class="text-primary" />}
                >
                  <ChevronDown size={16} class="text-primary" />
                </Show>
              </button>
            </Show>
            <Show when={isTree() && !hasChildren()}>
              <div class="w-4" />
            </Show>

            {renderIcon()}

            <div class="flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="text-base font-semibold sm:text-lg">{props.group.name}</h4>
                <Show when={isTree() && hasChildren()}>
                  <span class="badge badge-xs bg-base-content/20 tabular-nums">
                    {props.childrenCount ?? 0}
                  </span>
                </Show>
              </div>
              <div class="text-base-content/60 mt-1 flex flex-wrap items-center gap-3 text-sm">
                <span class="font-mono text-[11px] break-all">{props.group.path}</span>
                <Show when={!isTree()}>
                  <span class="badge badge-sm bg-base-content/10 tabular-nums">
                    Depth: {props.group.depth}
                  </span>
                </Show>
                <Show when={!props.group.allowsTrackers}>
                  <span class="badge badge-sm bg-base-content/10">Groups only</span>
                </Show>
                <Show when={props.group.allowsTrackers && !props.group.archived}>
                  <span class="badge badge-sm badge-primary">Allows trackers</span>
                </Show>
              </div>
              <Show when={props.group.description}>
                <p class="text-base-content/70 mt-2 text-sm">{props.group.description}</p>
              </Show>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 sm:justify-end">
            <Show when={!props.group.archived}>
              <button
                class="btn btn-ghost btn-sm hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => props.onEdit?.(props.group)}
                title="Edit"
                type="button"
              >
                <Edit size={16} />
              </button>
            </Show>
            <button
              class="btn btn-ghost btn-sm hover:bg-warning/10 hover:text-warning transition-colors"
              onClick={() => props.onToggleArchive?.(props.group)}
              title={props.group.archived ? 'Unarchive' : 'Archive'}
              type="button"
            >
              <Show when={!props.group.archived} fallback={<span>Unarchive</span>}>
                <Archive size={16} />
              </Show>
            </button>
            <button
              class="btn btn-ghost btn-sm hover:bg-error/10 text-error transition-colors"
              onClick={() => props.onDelete?.(props.group)}
              title="Delete"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
