import { Target } from 'lucide-solid';
import { For, Show, createMemo, createResource, createSignal, onCleanup, onMount } from 'solid-js';
import EntryFeed from '../components/entries/EntryFeed';
import QuickAdd from '../components/entries/QuickAdd';
import ActiveSession from '../components/sessions/ActiveSession';
import type { Goal } from '../lib/db/types';
import { useGoals } from '../lib/hooks/useGoals';
import { type GoalProgress, computeGoalProgress } from '../lib/services/goal-progress';

interface GoalWithProgress {
  goal: Goal;
  progress: GoalProgress;
}

export default function Home() {
  const { goals, goalRevision } = useGoals();

  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    if (Math.abs(value % 1) < 0.001) return Math.round(value).toString();
    return value.toFixed(1);
  };

  const pinnedGoals = createMemo(() => {
    return goals()
      .filter((goal) => goal.pinned && !goal.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .slice(0, 15);
  });

  const fetchPinnedProgress = async (goals: Goal[]): Promise<GoalWithProgress[]> => {
    const progress = await Promise.all(
      goals.map(async (goal) => ({
        goal,
        progress: await computeGoalProgress(goal),
      })),
    );
    return progress;
  };

  const [pinnedProgress] = createResource(
    () => ({ goals: pinnedGoals(), revision: goalRevision() }),
    (source) => fetchPinnedProgress(source.goals),
    { initialValue: [] as GoalWithProgress[] },
  );

  return (
    <div class="bg-base-100 min-h-screen">
      <div class="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div class="mb-6 sm:mb-8">
          <h1 class="from-primary to-secondary mb-2 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Dashboard
          </h1>
          <p class="text-base-content/70 text-base sm:text-lg">
            Track your progress, achieve your goals
          </p>
        </div>

        <div class="space-y-8">
          <Reveal>
            <QuickAdd />
          </Reveal>

          <Reveal delay={60}>
            <ActiveSession />
          </Reveal>

          <Reveal delay={120}>
            <div>
              <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-base-content/40 text-xs font-bold tracking-widest uppercase">
                  Pinned Goals
                </h2>
                <span class="text-base-content/40 text-xs">
                  Pin up to 15 goals from the Goals page
                </span>
              </div>

              <Show
                when={pinnedGoals().length > 0}
                fallback={
                  <div class="border-base-300/70 bg-base-200/70 text-base-content/60 rounded-2xl border p-6 text-sm shadow-md">
                    No pinned goals yet.
                  </div>
                }
              >
                <div class="carousel rounded-box w-full gap-4">
                  <For each={pinnedProgress()}>
                    {(item, index) => (
                      <div
                        class="carousel-item accent-card group bg-base-200/80 border-base-300/70 animate-fade-in-up relative w-72 overflow-hidden rounded-2xl border shadow-lg transition-all duration-300 sm:w-80"
                        style={{
                          'border-left': item.goal.color
                            ? `2px solid ${item.goal.color}`
                            : undefined,
                          '--accent-color': item.goal.color || 'oklch(var(--p))',
                          'animation-delay': `${index() * 80}ms`,
                        }}
                      >
                        <div class="bg-primary/5 group-hover:bg-primary/10 absolute top-0 right-0 h-28 w-28 rounded-full blur-2xl transition-colors"></div>
                        <div class="relative space-y-3 p-5">
                          <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <div class="flex min-w-0 flex-1 items-center gap-3">
                              <div class="flex size-10 items-center justify-center rounded-xl">
                                <Show
                                  when={item.goal.icon}
                                  fallback={<Target class="text-primary size-5" />}
                                >
                                  <span class="text-2xl leading-none">{item.goal.icon}</span>
                                </Show>
                              </div>
                              <div class="min-w-0 flex-1">
                                <h3 class="truncate text-sm font-semibold">{item.goal.name}</h3>
                                <p class="text-base-content/50 truncate text-xs">
                                  {item.progress.scopeLabel}
                                </p>
                              </div>
                            </div>
                            <span class="text-base-content/50 self-start text-xs tracking-wide uppercase sm:ml-auto sm:self-auto">
                              {item.goal.period}
                            </span>
                          </div>

                          <div>
                            <div class="grid gap-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <span class="text-base-content/70 truncate">
                                {item.progress.detailLabel}
                              </span>
                              <span class="text-base-content/80 font-semibold break-words tabular-nums sm:text-right">
                                {formatNumber(item.progress.current)} /{' '}
                                {formatNumber(item.progress.target)}
                                {item.goal.targetUnit ? ` ${item.goal.targetUnit}` : ''}
                              </span>
                            </div>
                            <div class="bg-base-300/30 mt-2 h-2 overflow-hidden rounded-full">
                              <div
                                class="h-full rounded-full transition-all"
                                style={{
                                  width: `${item.progress.percent}%`,
                                  'background-color':
                                    item.goal.color || 'var(--fallback-p,oklch(var(--p)))',
                                }}
                              />
                            </div>
                            <div class="text-base-content/50 mt-2 flex items-center justify-between text-xs">
                              <span>{item.progress.periodLabel}</span>
                              <span class="tabular-nums">{item.progress.percent.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <EntryFeed />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Reveal(props: { children: any; delay?: number }) {
  const [visible, setVisible] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  onMount(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
          }
        });
      },
      { threshold: 0.15 },
    );
    observer.observe(ref);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div
      ref={ref}
      class="reveal"
      classList={{ 'is-visible': visible() }}
      style={{ 'transition-delay': props.delay ? `${props.delay}ms` : undefined }}
    >
      {props.children}
    </div>
  );
}
