import { Calendar } from 'lucide-solid';
import { For, Show, createMemo } from 'solid-js';
import type { Entry } from '../../lib/db/types';
import { useEntries } from '../../lib/hooks/useEntries';
import EntryCard from './EntryCard';

export default function EntryFeed() {
  const { entries, loading, error, hasMore, total, deleteEntry, loadMore } = useEntries();

  // Group entries by date
  const entriesByDate = createMemo(() => {
    const groups = new Map<string, Entry[]>();

    for (const entry of entries()) {
      const date = entry.date;
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(entry);
    }

    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  });

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = dateStr.split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateOnly === todayStr) return 'Today';
    if (dateOnly === yesterdayStr) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this entry?')) {
      try {
        await deleteEntry(id);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  return (
    <div class="glass-card glass-topline mt-2 rounded-2xl p-4 sm:p-6">
      {/* Header */}
      <div class="mb-6 flex items-center justify-between">
        <h2 class="section-kicker">Recent Entries</h2>
        <Show when={!loading() && total() > 0}>
          <div class="badge badge-ghost">
            {entries().length} of {total()}
          </div>
        </Show>
      </div>

      {/* Error State */}
      <Show when={error()}>
        <div class="alert alert-error shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error()!.message}</span>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={loading() && entries().length === 0}>
        <div class="flex flex-col items-center justify-center gap-4 py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="text-base-content/60">Loading entries...</p>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={!loading() && entries().length === 0}>
        <div class="glass-card hero rounded-box min-h-[300px]">
          <div class="hero-content text-center">
            <div class="max-w-md">
              <Calendar class="text-base-content/20 mx-auto mb-4 size-16" />
              <h3 class="mb-2 text-lg font-bold">No entries yet</h3>
              <p class="text-base-content/60">Start tracking by using the Quick Add input above</p>
            </div>
          </div>
        </div>
      </Show>

      {/* Entries Grouped by Date */}
      <div class="space-y-8">
        <For each={entriesByDate()}>
          {([date, dateEntries]) => (
            <div>
              {/* Date Header */}
              <div class="mb-4 flex items-center gap-4">
                <h3 class="text-base-content/80 flex-shrink-0 text-sm font-bold">
                  {formatDateHeader(date)}
                </h3>
                <div class="glass-card h-7 rounded-full px-3 py-1 text-[11px] tracking-wide uppercase">
                  {dateEntries.length} entries
                </div>
                <div class="from-primary/30 h-px flex-1 bg-gradient-to-r to-transparent"></div>
              </div>

              {/* Entries for this date */}
              <div class="space-y-3">
                <For each={dateEntries}>
                  {(entry) => <EntryCard entry={entry} onDelete={handleDelete} />}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Load More Button */}
      <Show when={hasMore() && !loading()}>
        <div class="mt-8 flex justify-center">
          <button type="button" class="btn btn-outline btn-primary" onClick={loadMore}>
            Load More
          </button>
        </div>
      </Show>

      {/* Loading More Indicator */}
      <Show when={loading() && entries().length > 0}>
        <div class="flex items-center justify-center gap-3 py-6">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <span class="text-base-content/60">Loading more...</span>
        </div>
      </Show>
    </div>
  );
}
