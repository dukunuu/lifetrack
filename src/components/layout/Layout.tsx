import { For, Show, createSignal, onCleanup, onMount, type ParentComponent } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { Home, Target, TrendingUp, History, Settings, Menu, Zap, X } from 'lucide-solid';
import QuickAdd from '../entries/QuickAdd';
import { useSettings } from '../../lib/hooks/useSettings';
import { useSync } from '../../lib/hooks/useSync';

const routes = [
  { href: '/', label: 'Dashboard', icon: Home, end: true },
  { href: '/trackers', label: 'Trackers & Groups', icon: Target },
  { href: '/goals', label: 'Goals', icon: TrendingUp },
  { href: '/history', label: 'History', icon: History },
];

const settingsRoute = { href: '/settings', label: 'Settings', icon: Settings };

const Layout: ParentComponent = (props) => {
  const location = useLocation();
  const { settings } = useSettings();
  const [isQuickAddOpen, setIsQuickAddOpen] = createSignal(false);
  const [isDrawerOpen, setIsDrawerOpen] = createSignal(false);
  useSync();

  const isSettingsRoute = () => location.pathname === '/settings';
  const isHomeRoute = () => location.pathname === '/';
  const isSessionRoute = () => location.pathname.startsWith('/sessions/');
  const isHistoryRoute = () => location.pathname.startsWith('/history');
  const isQuickAddCollisionRoute = () =>
    location.pathname.startsWith('/trackers') || location.pathname.startsWith('/goals');
  const useQuickAddPopup = () => settings().quickAdd.usePopup;
  const showDockedQuickAdd = () =>
    !isHomeRoute() &&
    !isSettingsRoute() &&
    !isSessionRoute() &&
    !isHistoryRoute() &&
    !useQuickAddPopup();
  const showQuickAddFab = () =>
    !isHomeRoute() &&
    !isSettingsRoute() &&
    !isSessionRoute() &&
    (useQuickAddPopup() || isHistoryRoute());
  const quickAddFabPositionClass = () =>
    isQuickAddCollisionRoute() ? 'right-24 sm:right-28' : 'right-6 sm:right-8';

  onMount(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDrawerOpen(media.matches);
    apply();
    const handler = (event: MediaQueryListEvent) => setIsDrawerOpen(event.matches);
    media.addEventListener('change', handler);
    onCleanup(() => media.removeEventListener('change', handler));
  });

  return (
    <div class="drawer lg:drawer-open">
      <input
        id="app-drawer"
        type="checkbox"
        class="drawer-toggle"
        checked={isDrawerOpen()}
        onChange={(event) => setIsDrawerOpen(event.currentTarget.checked)}
      />

      {/* Main content */}
      <div
        class="drawer-content bg-base-100 flex min-h-screen flex-col"
        classList={{
          'has-quickadd': showDockedQuickAdd(),
          'has-quickadd-fab': showQuickAddFab(),
        }}
      >
        {/* Mobile menu button */}
        <div class="p-4 lg:hidden">
          <label for="app-drawer" aria-label="open sidebar" class="btn btn-square btn-ghost">
            <Menu class="size-5" />
          </label>
        </div>

        {props.children}

        <Show when={showDockedQuickAdd()}>
          <div class="fixed right-0 bottom-0 left-0 z-10 lg:left-64">
            <div>
              <div class="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <QuickAdd fixed openUp showPinnedTrackers={false} />
              </div>
            </div>
          </div>
        </Show>

        <Show when={showQuickAddFab()}>
          <button
            type="button"
            class="btn btn-primary btn-circle fab-quickadd-offset fixed z-20 shadow-lg"
            classList={{
              [quickAddFabPositionClass()]: true,
            }}
            aria-label="Open Quick Add"
            onClick={() => setIsQuickAddOpen(true)}
          >
            <Zap class="size-5" />
          </button>

          <div class="modal backdrop-blur-sm" classList={{ 'modal-open': isQuickAddOpen() }}>
            <div class="modal-box bg-base-200 border-base-300 relative w-full max-w-3xl border">
              <button
                type="button"
                class="btn btn-sm btn-circle absolute top-4 right-4"
                aria-label="Close Quick Add"
                onClick={() => setIsQuickAddOpen(false)}
              >
                <X class="size-4" />
              </button>
              <QuickAdd showPinnedTrackers autoFocus />
            </div>
            <div class="modal-backdrop">
              <button type="button" onClick={() => setIsQuickAddOpen(false)}>
                close
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Sidebar */}
      <div class="drawer-side is-drawer-close:overflow-visible z-[999]">
        <label for="app-drawer" aria-label="close sidebar" class="drawer-overlay"></label>

        <div class="bg-base-300 border-base-content/10 is-drawer-close:w-16 is-drawer-open:w-64 transition-cinematic flex min-h-full flex-col border-r transition-[width] duration-300">
          {/* Header */}
          <div class="is-drawer-close:pl-3 is-drawer-open:px-4 relative py-8">
            <div class="is-drawer-open:gap-3 flex items-center">
              <label for="app-drawer" aria-label="toggle sidebar" class="shrink-0 cursor-pointer">
                <div class="relative">
                  <div class="bg-primary/20 absolute inset-0 rounded-full blur-md"></div>
                  <div class="from-primary/90 to-secondary/90 relative flex size-10 items-center justify-center rounded-xl bg-linear-to-br shadow-lg transition-shadow hover:shadow-xl">
                    <TrendingUp class="text-base-100 size-5 stroke-[2.5]" />
                  </div>
                </div>
              </label>

              <div class="is-drawer-close:opacity-0 is-drawer-close:w-0 is-drawer-open:opacity-100 flex flex-1 flex-col overflow-hidden transition-opacity duration-300">
                <span class="from-primary to-secondary bg-linear-to-r bg-clip-text text-xl font-black tracking-tight whitespace-nowrap text-transparent">
                  LIFETRACK
                </span>
                <span class="text-base-content/40 text-[10px] font-semibold tracking-widest text-nowrap uppercase">
                  Track Everything
                </span>
              </div>

              <label
                for="app-drawer"
                aria-label="toggle sidebar"
                class="btn btn-square btn-ghost btn-sm is-drawer-close:opacity-0 is-drawer-close:w-0 is-drawer-open:opacity-60 shrink-0 overflow-hidden opacity-60 transition-opacity hover:opacity-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                  stroke-width="2"
                  fill="none"
                  stroke="currentColor"
                  class="inline-block size-4"
                >
                  <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
                  <path d="M9 4v16"></path>
                  <path d="M14 10l2 2l-2 2"></path>
                </svg>
              </label>
            </div>
          </div>

          {/* Navigation */}
          <nav class="flex-1 px-3 pt-2">
            <div class="text-base-content/40 is-drawer-close:opacity-0 is-drawer-open:opacity-100 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase transition-opacity duration-300">
              Menu
            </div>
            <ul class="space-y-1">
              <For each={routes}>
                {(route) => {
                  const isActive = () =>
                    route.end
                      ? location.pathname === route.href
                      : location.pathname.startsWith(route.href);

                  return (
                    <li>
                      <A
                        href={route.href}
                        class="group is-drawer-close:pl-3 is-drawer-open:px-3 is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-open:gap-3 relative flex items-center rounded-xl py-2.5 transition-all duration-200"
                        classList={{
                          'bg-primary/10 text-primary': isActive(),
                          'text-base-content/70 hover:text-base-content hover:bg-base-200':
                            !isActive(),
                        }}
                        data-tip={route.label}
                        end={route.end}
                      >
                        <div class="relative shrink-0">
                          <route.icon
                            class="size-5 transition-transform group-hover:scale-110"
                            classList={{
                              'stroke-[2.5]': isActive(),
                            }}
                          />
                        </div>
                        <span class="is-drawer-close:hidden overflow-hidden text-sm font-semibold whitespace-nowrap">
                          {route.label}
                        </span>
                        {isActive() && (
                          <div class="bg-primary is-drawer-close:opacity-0 is-drawer-open:opacity-100 absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full transition-opacity duration-300"></div>
                        )}
                      </A>
                    </li>
                  );
                }}
              </For>
            </ul>
          </nav>

          {/* Footer */}
          <div class="border-base-300/30 mt-auto border-t p-3">
            <A
              href={settingsRoute.href}
              class="group is-drawer-close:pl-3 is-drawer-open:px-3 is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-open:gap-3 relative flex items-center rounded-xl py-2.5 transition-all duration-200"
              classList={{
                'bg-primary/10 text-primary': location.pathname === settingsRoute.href,
                'text-base-content/70 hover:text-base-content hover:bg-base-200':
                  location.pathname !== settingsRoute.href,
              }}
              data-tip={settingsRoute.label}
            >
              <div class="relative shrink-0">
                <settingsRoute.icon
                  class="size-5 transition-transform duration-300 group-hover:rotate-90"
                  classList={{
                    'stroke-[2.5]': location.pathname === settingsRoute.href,
                  }}
                />
              </div>
              <span class="is-drawer-close:hidden overflow-hidden text-sm font-semibold whitespace-nowrap">
                {settingsRoute.label}
              </span>
              {location.pathname === settingsRoute.href && (
                <div class="bg-primary is-drawer-close:opacity-0 is-drawer-open:opacity-100 absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full transition-opacity duration-300"></div>
              )}
            </A>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
