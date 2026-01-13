import { useSearchParams } from '@solidjs/router';
import { createEffect, createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';

interface UseSearchPaginationOptions {
  queryKey: string;
  cursorKey: string;
  cursorStackKey: string;
  archivedCursorKey: string;
  archivedCursorStackKey: string;
}

const START_CURSOR = '__start__';

export function useSearchCursorPagination(options: UseSearchPaginationOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  const parseCursor = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

  const parseStack = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return [] as string[];
    return value.split(',').filter(Boolean);
  };

  const searchQuery = createMemo(() => {
    const value = searchParams[options.queryKey];
    return typeof value === 'string' ? value : '';
  });

  const activeCursor = createMemo(() => parseCursor(searchParams[options.cursorKey]));
  const archivedCursor = createMemo(() => parseCursor(searchParams[options.archivedCursorKey]));
  const activeCursorStack = createMemo(() => parseStack(searchParams[options.cursorStackKey]));
  const archivedCursorStack = createMemo(() => parseStack(searchParams[options.archivedCursorStackKey]));

  const resetCursors = () => {
    setSearchParams({
      [options.cursorKey]: undefined,
      [options.cursorStackKey]: undefined,
      [options.archivedCursorKey]: undefined,
      [options.archivedCursorStackKey]: undefined,
    });
  };

  const handleSearch = (value: string) => {
    const trimmed = value.trim();
    setSearchParams({
      [options.queryKey]: trimmed ? value : undefined,
      [options.cursorKey]: undefined,
      [options.cursorStackKey]: undefined,
      [options.archivedCursorKey]: undefined,
      [options.archivedCursorStackKey]: undefined,
    });
  };

  const handleActiveNext = (nextCursor?: string) => {
    if (!nextCursor) return;
    const stack = parseStack(searchParams[options.cursorStackKey]);
    stack.push(activeCursor() ?? START_CURSOR);
    setSearchParams({
      [options.cursorKey]: nextCursor,
      [options.cursorStackKey]: stack.join(','),
    });
  };

  const handleActivePrev = () => {
    const stack = parseStack(searchParams[options.cursorStackKey]);
    if (stack.length === 0) return;
    const prev = stack.pop() as string;
    setSearchParams({
      [options.cursorKey]: prev === START_CURSOR ? undefined : prev,
      [options.cursorStackKey]: stack.length ? stack.join(',') : undefined,
    });
  };

  const handleArchivedNext = (nextCursor?: string) => {
    if (!nextCursor) return;
    const stack = parseStack(searchParams[options.archivedCursorStackKey]);
    stack.push(archivedCursor() ?? START_CURSOR);
    setSearchParams({
      [options.archivedCursorKey]: nextCursor,
      [options.archivedCursorStackKey]: stack.join(','),
    });
  };

  const handleArchivedPrev = () => {
    const stack = parseStack(searchParams[options.archivedCursorStackKey]);
    if (stack.length === 0) return;
    const prev = stack.pop() as string;
    setSearchParams({
      [options.archivedCursorKey]: prev === START_CURSOR ? undefined : prev,
      [options.archivedCursorStackKey]: stack.length ? stack.join(',') : undefined,
    });
  };

  const watchEmptyPages = (activeItems?: Accessor<number>, archivedItems?: Accessor<number>) => {
    if (activeItems) {
      createEffect(() => {
        if (activeCursor() && activeItems() === 0) {
          setSearchParams({
            [options.cursorKey]: undefined,
            [options.cursorStackKey]: undefined,
          });
        }
      });
    }

    if (archivedItems) {
      createEffect(() => {
        if (archivedCursor() && archivedItems() === 0) {
          setSearchParams({
            [options.archivedCursorKey]: undefined,
            [options.archivedCursorStackKey]: undefined,
          });
        }
      });
    }
  };

  return {
    searchQuery,
    activeCursor,
    archivedCursor,
    activeCursorStack,
    archivedCursorStack,
    handleSearch,
    handleActiveNext,
    handleActivePrev,
    handleArchivedNext,
    handleArchivedPrev,
    resetCursors,
    watchEmptyPages,
  };
}
