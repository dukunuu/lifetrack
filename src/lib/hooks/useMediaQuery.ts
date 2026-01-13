import { createSignal, onCleanup, onMount } from 'solid-js';

export function useMediaQuery(query: string) {
  const getMatches = (q: string) => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(q).matches;
    }
    return false;
  };

  const [matches, setMatches] = createSignal(getMatches(query));

  onMount(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    setMatches(media.matches); // Sync in case it changed

    onCleanup(() => media.removeEventListener('change', listener));
  });

  return matches;
}
