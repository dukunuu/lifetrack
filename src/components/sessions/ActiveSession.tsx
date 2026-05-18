import { Activity, CheckCircle2, XCircle } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { Group } from '../../lib/db/types';
import { useGroups } from '../../lib/hooks/useGroups';
import { useSession } from '../../lib/hooks/useSession';
import GlobalInput from '../common/GlobalInput';

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

export default function ActiveSession() {
  const { groups } = useGroups();
  const { activeSession, loading, error, startSession, completeSession, abandonSession } =
    useSession();

  const [groupId, setGroupId] = createSignal('');
  const [name, setName] = createSignal('');
  const [notes, setNotes] = createSignal('');
  const [now, setNow] = createSignal(Date.now());

  const groupMap = createMemo(() => {
    const map = new Map<string, { name: string; color?: string }>();
    groups().forEach((group) => map.set(group._id, { name: group.name, color: group.color }));
    return map;
  });

  createEffect(() => {
    if (!activeSession()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  const durationLabel = createMemo(() => {
    const session = activeSession();
    if (!session) return '0m 00s';
    const startTime = new Date(session.startTime).getTime();
    const seconds = Math.max(0, Math.floor((now() - startTime) / 1000));
    return formatDuration(seconds);
  });

  const activeGroupColor = createMemo(() => {
    const session = activeSession();
    if (!session?.groupId) return undefined;
    return groupMap().get(session.groupId)?.color;
  });

  const handleStart = async (e: Event) => {
    e.preventDefault();
    if (!groupId()) {
      return;
    }
    await startSession('custom', groupId() || undefined, name().trim() || undefined);
    setName('');
  };

  const handleComplete = async () => {
    await completeSession(notes().trim() || undefined);
    setNotes('');
  };

  const handleAbandon = async () => {
    await abandonSession();
    setNotes('');
  };

  return (
    <div
      class="glass-card glass-topline rounded-2xl p-3 sm:p-6"
      style={{
        'border-left': activeGroupColor() ? `2px solid ${activeGroupColor()}` : undefined,
      }}
    >
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-base-content/40 text-xs font-bold tracking-widest uppercase">
            Session
          </div>
          <p class="text-base-content/60 text-sm">Focus your entries into a single block.</p>
        </div>
        <div class="badge badge-outline text-xs">/start @group</div>
      </div>

      <Show
        when={!loading() && activeSession()}
        keyed
        fallback={
          <div class="glass-card rounded-xl p-4">
            <form class="space-y-4" onSubmit={handleStart}>
              <div class="grid gap-4 md:grid-cols-2">
                <label class="form-control gap-2">
                  <span class="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    Group (required)
                  </span>
                  <select
                    class="select select-bordered glass-input"
                    value={groupId()}
                    onInput={(e) => setGroupId(e.currentTarget.value)}
                  >
                    <option value="">Select a group</option>
                    <For each={groups().filter((group) => !group.archived && group.allowsTrackers)}>
                      {(group: Group) => <option value={group._id}>{group.name}</option>}
                    </For>
                  </select>
                </label>

                <label class="form-control gap-2">
                  <span class="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    Session name
                  </span>
                  <input
                    class="input input-bordered glass-input"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                    placeholder="Morning Push Day"
                  />
                </label>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <Show when={error()}>
                  <span class="text-error text-sm">{error()?.message}</span>
                </Show>
                <button type="submit" class="btn btn-primary gap-2" disabled={!groupId()}>
                  <CheckCircle2 class="size-4" />
                  Start Session
                </button>
              </div>
            </form>
          </div>
        }
      >
        {(session) => (
          <div class="glass-card space-y-4 rounded-xl p-4">
            <div class="glass-card flex w-full flex-col items-center justify-between gap-4 rounded-xl px-4 py-3 sm:flex-row">
              <div class="flex w-full flex-2 items-center gap-3">
                <div
                  class="bg-base-200 flex size-12 items-center justify-center rounded-2xl"
                  style={{
                    color: session.groupId ? groupMap().get(session.groupId)?.color : undefined,
                  }}
                >
                  <Activity class="size-5" />
                </div>
                <div>
                  <div class="text-base-content/60 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                    <span class="bg-success inline-flex size-2 animate-pulse rounded-full shadow-[0_0_10px_oklch(var(--su)/0.9)]"></span>
                    Active Session
                  </div>
                  <div class="text-base-content text-lg font-semibold">
                    {session.name || 'Session'}
                  </div>
                  <div class="text-base-content/60 text-sm">
                    {session.groupId
                      ? (groupMap().get(session.groupId)?.name ?? 'No group')
                      : 'No group'}
                  </div>
                </div>
              </div>
              <div class="flex w-full flex-1 flex-row items-center justify-between gap-x-3 gap-y-4 text-xs sm:justify-end sm:text-right">
                <div class="text-base-content/50 tracking-wide uppercase">Duration</div>
                <div class="text-base-content text-lg font-semibold tabular-nums">
                  {durationLabel()}
                </div>
                <Show when={session.summary?.entryCount !== undefined}>
                  <div>
                    <div class="text-base-content/50 tracking-wide uppercase">Entries</div>
                    <div class="text-base-content text-lg font-semibold tabular-nums">
                      {session.summary?.entryCount ?? 0}
                    </div>
                  </div>
                </Show>
              </div>
            </div>

            <label class="form-control flex flex-col justify-start gap-2 sm:items-start">
              <span class="text-base-content/60 pl-2 text-xs font-semibold tracking-wide uppercase">
                Notes
              </span>
              <GlobalInput
                class="glass-input"
                value={notes()}
                onInput={(e) => setNotes(e.currentTarget.value)}
                placeholder="Optional session notes..."
              />
            </label>

            <div class="flex items-center justify-between gap-3 sm:justify-end">
              <button type="button" class="btn btn-primary gap-2" onClick={handleComplete}>
                <CheckCircle2 class="size-4" />
                Complete
              </button>
              <button type="button" class="btn btn-ghost gap-2" onClick={handleAbandon}>
                <XCircle class="size-4" />
                Abandon
              </button>
              <Show when={error()}>
                <span class="text-error text-sm">{error()?.message}</span>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
