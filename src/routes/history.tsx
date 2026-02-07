import HistoryCalendar from '../components/history/HistoryCalendar';

export default function History() {
  return (
    <div class="bg-base-100 min-h-0 flex-1 overflow-visible sm:overflow-hidden">
      <div class="container mx-auto flex h-full max-w-7xl flex-col overflow-visible px-4 py-6 sm:overflow-hidden sm:px-6 sm:py-8 lg:px-8">
        <div class="mb-6 sm:mb-8">
          <h1 class="from-primary to-secondary mb-2 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            History
          </h1>
          <p class="text-base-content/70 text-base sm:text-lg">
            View your tracking history, sessions, and recent activity.
          </p>
        </div>

        <HistoryCalendar />
      </div>
    </div>
  );
}
