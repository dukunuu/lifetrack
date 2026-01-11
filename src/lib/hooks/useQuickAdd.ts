import { createSignal, createEffect } from 'solid-js';
import type { EntryData, Tracker } from '../db/types';
import { trackerRepo, entryRepo, sessionRepo, groupRepo } from '../repositories';
import { parserService } from '../services/parser';
import { timestamp, dateString } from '../db/utils';
import { Tokenizer } from '../services/parser/tokenizer';
import Fuse from 'fuse.js';

export interface TrackerSuggestion {
  type: 'tracker';
  tracker: Tracker;
  score: number;
  reason: 'fuzzy' | 'pinned' | 'recent';
  highlightRanges?: Array<[number, number]>;
}

export interface CommandSuggestion {
  type: 'command';
  command: 'start' | 'done' | 'abandon';
  label: string;
  description: string;
  insertText: string;
}

export type AutocompleteSuggestion = TrackerSuggestion | CommandSuggestion;

export function useQuickAdd() {
  const [input, setInput] = createSignal('');
  const [suggestions, setSuggestions] = createSignal<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  // Track current tag being typed
  const getCurrentTag = (): string | null => {
    const value = input();
    const cursorPos = value.length; // Assume cursor at end for simplicity

    // Find last # before cursor
    const beforeCursor = value.substring(0, cursorPos);
    const lastHashIndex = beforeCursor.lastIndexOf('#');

    if (lastHashIndex === -1) return null;

    // Extract tag until space or end
    const afterHash = value.substring(lastHashIndex + 1);
    const spaceIndex = afterHash.search(/\s/);
    const tag = spaceIndex === -1 ? afterHash : afterHash.substring(0, spaceIndex);

    return tag;
  };

  const updateSuggestions = async (allowEmpty: boolean = false) => {
    const currentTag = getCurrentTag();
    const rawInput = input().trim();
    const isCommandContext = rawInput.startsWith('/') && !rawInput.includes('#');

    if (isCommandContext) {
      const lower = rawInput.toLowerCase();
      const activeSession = await sessionRepo.findActive();

      if (lower.startsWith('/start')) {
        const groups = await groupRepo.findAll();
        const atIndex = rawInput.indexOf('@');
        const query = atIndex >= 0 ? rawInput.slice(atIndex + 1).trim() : '';

        let results = groups.filter((group) => !group.archived && group.allowsTrackers);
        if (query || allowEmpty) {
          const fuse = new Fuse(results, {
            keys: [
              { name: 'name', weight: 1.5 },
              { name: 'slug', weight: 2 },
              { name: 'path', weight: 1 },
            ],
            threshold: 0.4,
            ignoreLocation: true,
            minMatchCharLength: 1,
          });
          results = query
            ? fuse.search(query).map((result) => result.item)
            : results.slice(0, 8);
        }

        const commandSuggestions: CommandSuggestion[] = results.slice(0, 8).map((group) => ({
          type: 'command',
          command: 'start',
          label: `/start @${group.slug}`,
          description: `${group.name}${group.path ? ` · ${group.path}` : ''}`,
          insertText: `/start @${group.slug} `,
        }));

        setSuggestions(commandSuggestions);
        setShowSuggestions(commandSuggestions.length > 0);
        setSelectedIndex(0);
        return;
      }

      const query = lower.slice(1).trim();
      const commandSuggestions = buildCommandSuggestions(
        activeSession ? activeSession.name ?? 'session' : undefined,
      );
      const filtered = query.length
        ? commandSuggestions.filter(
            (command) =>
              command.command.startsWith(query) ||
              command.label.toLowerCase().includes(query) ||
              command.description.toLowerCase().includes(query),
          )
        : commandSuggestions;

      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
      return;
    }

    if ((!currentTag || currentTag.length === 0) && !allowEmpty) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    try {
      const activeSession = await sessionRepo.findActive();
      const groupId = activeSession?.groupId;
      const isTrackerInGroup = (tracker: Tracker) => {
        if (!groupId) return true;
        return (
          tracker.groupId === groupId || (tracker.additionalGroupIds?.includes(groupId) ?? false)
        );
      };

      const fuzzySuggestions: TrackerSuggestion[] = [];

      if (currentTag && currentTag.length > 0) {
        const fuzzyResults = await trackerRepo.search(currentTag, 5);
        fuzzySuggestions.push(
          ...fuzzyResults
            .map((result) => ({
              type: 'tracker' as const,
              tracker: result.item,
              score: result.score,
              reason: 'fuzzy' as const,
              highlightRanges: result.matches[0]?.indices as Array<[number, number]> | undefined,
            }))
            .filter((result) => isTrackerInGroup(result.tracker)),
        );
      }

      const pinned = await trackerRepo.findPinned();
      const pinnedSuggestions: TrackerSuggestion[] = pinned
        .filter((tracker) => isTrackerInGroup(tracker))
        .filter((t) => !fuzzySuggestions.some((fs) => fs.tracker._id === t._id))
        .slice(0, 3)
        .map((t) => ({
          type: 'tracker' as const,
          tracker: t,
          score: 0,
          reason: 'pinned' as const,
        }));

      const recentTags = await entryRepo.getRecentTags(5);
      const recentTrackers = await Promise.all(recentTags.map((tag) => trackerRepo.findByTag(tag)));
      const recentSuggestions: TrackerSuggestion[] = recentTrackers
        .filter((t): t is Tracker => t !== null)
        .filter((tracker) => isTrackerInGroup(tracker))
        .filter(
          (t) =>
            !fuzzySuggestions.some((fs) => fs.tracker._id === t._id) &&
            !pinnedSuggestions.some((ps) => ps.tracker._id === t._id),
        )
        .slice(0, 2)
        .map((t) => ({
          type: 'tracker' as const,
          tracker: t,
          score: 0,
          reason: 'recent' as const,
        }));

      const allSuggestions = [
        ...fuzzySuggestions,
        ...pinnedSuggestions,
        ...recentSuggestions,
      ].slice(0, 8);

      setSuggestions(allSuggestions);
      setShowSuggestions(allSuggestions.length > 0);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  };

  createEffect(() => {
    updateSuggestions(false);
  });

  const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
    if (suggestion.type === 'command') {
      setInput(suggestion.insertText);
      setShowSuggestions(false);
      return;
    }

    const currentTag = getCurrentTag();
    if (!currentTag) {
      const value = input().trim();
      const next = value.length > 0 ? `${value} #${suggestion.tracker.tag} ` : `#${suggestion.tracker.tag} `;
      setInput(next);
      setShowSuggestions(false);
      return;
    }

    const value = input();
    const lastHashIndex = value.lastIndexOf('#');

    // Replace current tag with selected tracker tag
    const beforeTag = value.substring(0, lastHashIndex + 1);
    const afterTag = value.substring(lastHashIndex + 1 + currentTag.length);

    const newValue = beforeTag + suggestion.tracker.tag + ' ' + afterTag.trimStart();
    setInput(newValue);
    setShowSuggestions(false);
  };

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      await updateSuggestions(true);
      return;
    }

    if (!showSuggestions()) return;

    const sgs = suggestions();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % sgs.length);
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + sgs.length) % sgs.length);
        break;

      case 'Tab':
        if (sgs.length > 0) {
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex((i) => (i - 1 + sgs.length) % sgs.length);
          } else {
            setSelectedIndex((i) => (i + 1) % sgs.length);
          }
        }
        break;

      case 'Enter':
        if (sgs.length > 0) {
          e.preventDefault();
          selectSuggestion(sgs[selectedIndex()]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  };

  const submit = async () => {
    const value = input().trim();
    if (!value) return;

    try {
      setLoading(true);
      setError(null);

      const sessionCommand = await handleSessionCommand(value);
      if (sessionCommand) {
        setInput('');
        setShowSuggestions(false);
        return;
      }

      // Parse input
      const parseResult = await parserService.parse(value);

      if (parseResult.errors.length > 0) {
        const errorMsg = parseResult.errors.map((e) => e.message).join('; ');
        throw new Error(errorMsg);
      }

      if (parseResult.trackerData.length === 0) {
        throw new Error('No trackers found in input');
      }

      // Create entry or append to session
      const now = timestamp();
      const date = dateString(new Date(now));

      const activeSession = await sessionRepo.findActive();

      const sessionGroupId = activeSession?.groupId;
      if (sessionGroupId) {
        const invalid = parseResult.trackerData.some(
          (td) =>
            td.tracker.groupId !== sessionGroupId &&
            !(td.tracker.additionalGroupIds?.includes(sessionGroupId) ?? false),
        );
        if (invalid) {
          throw new Error('This session only accepts trackers from the selected group.');
        }
      }

      const entryData: EntryData[] = parseResult.trackerData.map((td) => ({
        trackerId: td.tracker._id,
        trackerTag: td.tracker.tag,
        values: td.values,
        completed: td.completed,
        skipped: td.skipped,
      }));

      if (activeSession) {
        await sessionRepo.appendPending(
          activeSession._id,
          entryData,
          value,
          parseResult.note || undefined,
        );

        const entryCount = (activeSession.summary?.entryCount ?? 0) + entryData.length;
        const updated = await sessionRepo.updateSummary(activeSession._id, { entryCount });

        if (activeSession.groupId) {
          await maybeCompleteSession(updated);
        }
      } else {
        await entryRepo.create({
          timestamp: now,
          date,
          raw: value,
          data: entryData,
          note: parseResult.note || undefined,
        });
      }

      // Clear input
      setInput('');
      setShowSuggestions(false);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    input,
    setInput,
    suggestions,
    selectedIndex,
    showSuggestions,
    setShowSuggestions,
    loading,
    error,
    selectSuggestion,
    handleKeyDown,
    submit,
  };
}

function buildCommandSuggestions(sessionName?: string): CommandSuggestion[] {
  if (!sessionName) return [];

  return [
    {
      type: 'command',
      command: 'abandon',
      label: '/abandon',
      description: `Abandon the active ${sessionName} session`,
      insertText: '/abandon',
    },
    {
      type: 'command',
      command: 'done',
      label: '/done',
      description: `Complete the active ${sessionName} session`,
      insertText: '/done',
    },
  ];
}

async function handleSessionCommand(inputValue: string): Promise<boolean> {
  const trimmed = inputValue.trim();
  const commandMatch = trimmed.match(/^\/(start|done|abandon)\b(.*)$/i);
  if (!commandMatch) return false;

  const action = commandMatch[1].toLowerCase();
  const rest = commandMatch[2]?.trim() ?? '';

  const tokenizer = new Tokenizer();
  const tokens = tokenizer.tokenize(trimmed);
  const hasTags = tokens.some((token) => token.type === 'tag');

  if (hasTags) return false;

  if (action === 'done') {
    const active = await sessionRepo.findActive();
    if (!active) {
      throw new Error('No active session to complete.');
    }
    await completeGroupedEntry(active);
    return true;
  }

  if (action === 'abandon') {
    const active = await sessionRepo.findActive();
    if (!active) {
      throw new Error('No active session to abandon.');
    }
    await sessionRepo.abandonSession(active._id);
    return true;
  }

  const startMatch = rest.match(/@([a-z0-9/-]+)\s*(.*)?/i);
  if (!startMatch) {
    throw new Error('Use /start @group to begin a session.');
  }

  const groupSlug = startMatch[1];
  const name = startMatch[2]?.trim() || undefined;

  const bySlug = await groupRepo.findBySlug(groupSlug);
  const byPath = !bySlug && groupSlug.includes('/') ? await groupRepo.findByPath(groupSlug) : null;
  const group = bySlug ?? byPath ?? null;
  if (!group) {
    throw new Error(`Group "${groupSlug}" not found.`);
  }

  await sessionRepo.startSession('custom', group._id, name ?? group.name);
  return true;
}

async function maybeCompleteSession(
  session: NonNullable<Awaited<ReturnType<typeof sessionRepo.findActive>>>,
) {
  if (!session.groupId) return;

  const trackers = await trackerRepo.findByGroupId(session.groupId);
  const activeTrackers = trackers.filter((tracker) => !tracker.archived);
  if (activeTrackers.length === 0) return;

  const expected = new Set(activeTrackers.map((tracker) => tracker._id));
  const pending = session.pendingData ?? [];
  const recorded = new Set(pending.map((data) => data.trackerId));

  const allLogged = Array.from(expected).every((id) => recorded.has(id));
  if (allLogged) {
    await completeGroupedEntry(session);
  }
}

async function completeGroupedEntry(
  session: NonNullable<Awaited<ReturnType<typeof sessionRepo.findActive>>>,
) {
  const pendingData = session.pendingData ?? [];
  if (pendingData.length === 0) {
    await sessionRepo.completeSession(session._id);
    return;
  }

  const now = timestamp();
  const date = dateString(new Date(now));
  const raw = (session.pendingRaw ?? []).join('\n');
  const note = (session.pendingNotes ?? []).join(' ').trim();

  await entryRepo.create({
    timestamp: now,
    date,
    raw,
    data: pendingData,
    note: note.length > 0 ? note : undefined,
    sessionId: session._id,
    groupId: session.groupId,
  });

  await sessionRepo.completeSession(session._id, undefined, true);
}
