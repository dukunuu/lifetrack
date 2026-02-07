interface SkeletonProps {
  class?: string;
}

export function SkeletonText(props: SkeletonProps & { width?: string }) {
  return (
    <div
      class={`skeleton bg-base-300 h-4 rounded ${props.class || ''}`}
      style={{ width: props.width || '100%' }}
    />
  );
}

export function SkeletonCard(props: SkeletonProps) {
  return (
    <div class={`card bg-base-200 border-base-300 border p-4 ${props.class || ''}`}>
      <div class="flex items-start gap-4">
        <div class="skeleton bg-base-300 h-12 w-12 shrink-0 rounded-lg" />
        <div class="flex-1 space-y-3">
          <SkeletonText width="60%" />
          <SkeletonText width="40%" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTrackerCard() {
  return (
    <div class="card bg-base-200 border-base-300 group border p-4 transition-all">
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-3">
          <div class="skeleton bg-base-300 grid h-10 w-10 shrink-0 place-items-center rounded-xl" />
          <div class="space-y-2">
            <SkeletonText width="120px" />
            <div class="flex items-center gap-2">
              <SkeletonText width="60px" class="h-3" />
              <SkeletonText width="80px" class="h-3" />
            </div>
          </div>
        </div>
        <div class="flex gap-1">
          <div class="skeleton bg-base-300 h-8 w-8 rounded-lg" />
          <div class="skeleton bg-base-300 h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <div class="skeleton bg-base-300 h-6 w-16 rounded-full" />
        <div class="skeleton bg-base-300 h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonGroupCard() {
  return (
    <div class="border-base-300 bg-base-200 flex items-center gap-3 rounded-lg border p-3">
      <div class="skeleton bg-base-300 h-4 w-4 rounded" />
      <div class="skeleton bg-base-300 h-8 w-8 shrink-0 rounded-lg" />
      <div class="flex-1 space-y-2">
        <SkeletonText width="40%" />
        <SkeletonText width="60%" class="h-3" />
      </div>
      <div class="flex gap-1">
        <div class="skeleton bg-base-300 h-8 w-8 rounded-lg" />
        <div class="skeleton bg-base-300 h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonGoalCard() {
  return (
    <div class="card bg-base-200 border-base-300 group border p-4 transition-all">
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-3">
          <div class="skeleton bg-base-300 grid h-11 w-11 shrink-0 place-items-center rounded-2xl" />
          <div class="space-y-2">
            <SkeletonText width="140px" />
            <SkeletonText width="200px" class="h-3" />
            <div class="flex items-center gap-2">
              <div class="skeleton bg-base-300 h-5 w-14 rounded-full" />
              <div class="skeleton bg-base-300 h-5 w-16 rounded-full" />
              <div class="skeleton bg-base-300 h-5 w-24 rounded-full" />
            </div>
          </div>
        </div>
        <div class="flex gap-1">
          <div class="skeleton bg-base-300 h-8 w-8 rounded-lg" />
          <div class="skeleton bg-base-300 h-8 w-8 rounded-lg" />
          <div class="skeleton bg-base-300 h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div class="mt-5 space-y-2">
        <div class="flex items-center justify-between">
          <SkeletonText width="80px" class="h-3" />
          <SkeletonText width="60px" />
        </div>
        <div class="skeleton bg-base-300 h-2 w-full rounded-full" />
        <div class="flex items-center justify-between">
          <SkeletonText width="60px" class="h-3" />
          <SkeletonText width="40px" class="h-3" />
        </div>
      </div>
    </div>
  );
}

interface SkeletonListProps {
  count?: number;
  type?: 'tracker' | 'group' | 'card' | 'goal';
}

export function SkeletonList(props: SkeletonListProps) {
  const count = () => props.count || 3;
  const items = () => Array.from({ length: count() }, (_, i) => i);

  return (
    <div class="space-y-3">
      {items().map((index) => {
        const style = {
          opacity: `${1 - index * 0.15}`,
          'animation-delay': `${index * 100}ms`,
        };

        if (props.type === 'tracker') {
          return (
            <div style={style}>
              <SkeletonTrackerCard />
            </div>
          );
        }

        if (props.type === 'group') {
          return (
            <div style={style}>
              <SkeletonGroupCard />
            </div>
          );
        }

        if (props.type === 'goal') {
          return (
            <div style={style}>
              <SkeletonGoalCard />
            </div>
          );
        }

        return (
          <div style={style}>
            <SkeletonCard />
          </div>
        );
      })}
    </div>
  );
}
