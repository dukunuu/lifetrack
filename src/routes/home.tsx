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
        <div class="glass-card mb-6 rounded-2xl px-5 py-4 sm:mb-8 sm:px-6 sm:py-5">
          <h1 class="from-primary to-secondary mb-2 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Dashboard
          </h1>
          <p class="text-base-content/70 text-base sm:text-lg">
            Track your progress, achieve your goals
          </p>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <Reveal class="md:col-span-2 lg:col-span-8">
            <QuickAdd />
          </Reveal>

          <Reveal class="md:col-span-2 lg:col-span-4" delay={70}>
            <div class="glass-card glass-topline h-full rounded-2xl p-4 sm:p-5">
              <div class="section-kicker mb-2">Command Center</div>
              <p class="text-base-content/80 text-sm leading-relaxed">
                Quick Add plus session tracking turn this dashboard into your daily control panel.
              </p>
              <div class="mt-5 grid gap-3">
                <div class="glass-card rounded-xl px-3 py-2">
                  <div class="text-base-content/50 text-[11px] tracking-widest uppercase">
                    Pinned Goals
                  </div>
                  <div class="text-lg font-semibold tabular-nums">{pinnedGoals().length}/15</div>
                </div>
                <div class="glass-card rounded-xl px-3 py-2">
                  <div class="text-base-content/50 text-[11px] tracking-widest uppercase">
                    Focus
                  </div>
                  <div class="text-base-content/80 text-sm">
                    Stay in flow with sessions and rapid logging.
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal class="md:col-span-2 lg:col-span-6" delay={110}>
            <ActiveSession />
          </Reveal>

          <Reveal class="md:col-span-2 lg:col-span-6" delay={140}>
            <div class="glass-card glass-topline rounded-2xl p-4 sm:p-5">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 class="section-kicker">Pinned Goals</h2>
                <span class="text-base-content/40 text-xs">
                  Pin up to 15 goals from the Goals page
                </span>
              </div>

              <Show
                when={pinnedGoals().length > 0}
                fallback={
                  <div class="glass-card animate-shimmer text-base-content/60 rounded-2xl p-6 text-sm">
                    No pinned goals yet.
                  </div>
                }
              >
                <div class="carousel rounded-box w-full gap-4">
                  <For each={pinnedProgress()}>
                    {(item, index) => (
                      <div
                        class="carousel-item glass-card hover-lift accent-card group animate-fade-in-up relative w-72 overflow-hidden rounded-2xl transition-all duration-300 sm:w-80"
                        style={{
                          'border-left': item.goal.color
                            ? `2px solid ${item.goal.color}`
                            : undefined,
                          '--accent-color': item.goal.color || 'oklch(var(--p))',
                          'animation-delay': `${index() * 80}ms`,
                        }}
                      >
                        <div class="bg-primary/8 group-hover:bg-primary/14 absolute top-0 right-0 h-28 w-28 rounded-full blur-2xl transition-colors"></div>
                        <div class="relative space-y-3 p-5">
                          <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <div class="flex min-w-0 flex-1 items-center gap-3">
                              <div class="glass-card flex size-10 items-center justify-center rounded-xl">
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
                                  'box-shadow': item.goal.color
                                    ? `0 0 14px ${item.goal.color}`
                                    : undefined,
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

          <Reveal class="md:col-span-2 lg:col-span-12" delay={180}>
            <EntryFeed />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Reveal(props: { children: any; delay?: number; class?: string }) {
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
      class={`reveal ${props.class ?? ''}`}
      classList={{ 'is-visible': visible() }}
      style={{ 'transition-delay': props.delay ? `${props.delay}ms` : undefined }}
    >
      {props.children}
    </div>
  );
}
