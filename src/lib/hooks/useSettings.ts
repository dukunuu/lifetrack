import { createEffect, createRoot, createSignal } from 'solid-js';

export interface AppSettings {
  sync: {
    enabled: boolean;
    endpoint: string;
    username: string;
    password: string;
    apiKey: string;
  };
  ai: {
    provider: 'openrouter';
    openRouterApiKey: string;
    openRouterModel: string;
    openRouterImageModel: string;
  };
  appearance: {
    theme: string;
    reduceMotion: boolean;
    timeFormat: '12h' | '24h';
  };
  quickAdd: {
    showSessionTimer: boolean;
    usePopup: boolean;
  };
}

const STORAGE_KEY = 'lifetrack.settings';

const DEFAULT_SETTINGS: AppSettings = {
  sync: {
    enabled: false,
    endpoint: '',
    username: '',
    password: '',
    apiKey: '',
  },
  ai: {
    provider: 'openrouter',
    openRouterApiKey: '',
    openRouterModel: 'openai/gpt-4o-mini',
    openRouterImageModel: 'openai/gpt-5-image-mini',
  },
  appearance: {
    theme: 'lifetrack',
    reduceMotion: false,
    timeFormat: '24h',
  },
  quickAdd: {
    showSessionTimer: true,
    usePopup: false,
  },
};

const mergeSettings = (base: AppSettings, overrides: Partial<AppSettings>): AppSettings => {
  return {
    sync: { ...base.sync, ...overrides.sync },
    ai: { ...base.ai, ...overrides.ai },
    appearance: { ...base.appearance, ...overrides.appearance },
    quickAdd: { ...base.quickAdd, ...overrides.quickAdd },
  };
};

const settingsStore = createRoot(() => {
  const [settings, setSettings] = createSignal<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = createSignal(false);

  const loadSettings = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      setSettings(mergeSettings(DEFAULT_SETTINGS, parsed));
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  loadSettings();
  setLoaded(true);

  createEffect(() => {
    if (!loaded() || typeof window === 'undefined') return;
    const value = settings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });

  createEffect(() => {
    if (typeof window === 'undefined') return;
    const value = settings();
    document.documentElement.setAttribute('data-theme', value.appearance.theme);
    document.documentElement.setAttribute(
      'data-motion',
      value.appearance.reduceMotion ? 'reduced' : 'normal',
    );
  });

  return {
    settings,
    setSettings,
    resetSettings,
  };
});

export function useSettings() {
  return settingsStore;
}
