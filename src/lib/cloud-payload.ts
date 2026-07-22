import type { ISODate } from './dates';
import type { AppSnapshot } from './store';
import {
  effectiveShared,
  OTHER,
  type CycleDayNote,
  type DayEntry,
  type Flow,
  type Person,
  type PrivacyMode,
  type Settings,
} from './types';

const SCHEMA_VERSION = 1 as const;

export interface PrivatePayload {
  schema: typeof SCHEMA_VERSION;
  role: Person;
  entries: Record<ISODate, DayEntry>;
  cycleNotes: Record<string, CycleDayNote>;
  settings: {
    privacy: PrivacyMode;
    matchRadius: number;
    fallbackCycleLen: number;
  };
}

export interface SharedPayload {
  schema: typeof SCHEMA_VERSION;
  role: Person;
  privacy: PrivacyMode;
  entries: Record<ISODate, DayEntry>;
  cycleNotes: Record<string, CycleDayNote>;
}

export interface CyclePayload {
  schema: typeof SCHEMA_VERSION;
  entries: Record<ISODate, Pick<DayEntry, 'date' | 'flow'>>;
}

function hasFields(value: object, required = 0): boolean {
  return Object.keys(value).length > required;
}

function ownEntry(entry: DayEntry, role: Person): DayEntry {
  if (role === 'her') {
    return {
      date: entry.date,
      moodHer: cleanText(entry.moodHer, 32),
      noteHer: cleanText(entry.noteHer, 4000),
      noteHerShared: entry.noteHerShared,
      goodHer: cleanText(entry.goodHer, 1000),
      badHer: cleanText(entry.badHer, 1000),
    };
  }
  return {
    date: entry.date,
    moodHim: cleanText(entry.moodHim, 32),
    noteHim: cleanText(entry.noteHim, 4000),
    noteHimShared: entry.noteHimShared,
    goodHim: cleanText(entry.goodHim, 1000),
    badHim: cleanText(entry.badHim, 1000),
  };
}

function sharedEntry(entry: DayEntry, role: Person, mode: PrivacyMode): DayEntry {
  if (role === 'her') {
    const noteShared = effectiveShared(mode, entry.noteHerShared);
    return {
      date: entry.date,
      moodHer: cleanText(entry.moodHer, 32),
      goodHer: cleanText(entry.goodHer, 1000),
      badHer: cleanText(entry.badHer, 1000),
      ...(noteShared && entry.noteHer
        ? { noteHer: cleanText(entry.noteHer, 4000), noteHerShared: true }
        : {}),
    };
  }
  const noteShared = effectiveShared(mode, entry.noteHimShared);
  return {
    date: entry.date,
    moodHim: cleanText(entry.moodHim, 32),
    goodHim: cleanText(entry.goodHim, 1000),
    badHim: cleanText(entry.badHim, 1000),
    ...(noteShared && entry.noteHim
      ? { noteHim: cleanText(entry.noteHim, 4000), noteHimShared: true }
      : {}),
  };
}

function ownCycleNote(note: CycleDayNote, role: Person): CycleDayNote {
  if (role === 'her') {
    return {
      summaryHer: cleanText(note.summaryHer, 4000),
      autoSummaryHer: cleanText(note.autoSummaryHer, 4000),
      summaryHerShared: note.summaryHerShared,
    };
  }
  return {
    summaryHim: cleanText(note.summaryHim, 4000),
    autoSummaryHim: cleanText(note.autoSummaryHim, 4000),
    summaryHimShared: note.summaryHimShared,
  };
}

function sharedCycleNote(
  note: CycleDayNote,
  role: Person,
  mode: PrivacyMode,
): CycleDayNote {
  if (role === 'her') {
    return effectiveShared(mode, note.summaryHerShared)
      ? {
          summaryHer: cleanText(note.summaryHer, 4000),
          autoSummaryHer: cleanText(note.autoSummaryHer, 4000),
          summaryHerShared: true,
        }
      : {};
  }
  return effectiveShared(mode, note.summaryHimShared)
    ? {
        summaryHim: cleanText(note.summaryHim, 4000),
        autoSummaryHim: cleanText(note.autoSummaryHim, 4000),
        summaryHimShared: true,
      }
    : {};
}

export function buildPrivatePayload(snapshot: AppSnapshot, role: Person): PrivatePayload {
  const entries: Record<ISODate, DayEntry> = {};
  for (const [date, entry] of Object.entries(snapshot.entries) as [ISODate, DayEntry][]) {
    const filtered = ownEntry(entry, role);
    if (hasFields(filtered, 1)) entries[date] = filtered;
  }

  const cycleNotes: Record<string, CycleDayNote> = {};
  for (const [coord, note] of Object.entries(snapshot.cycleNotes)) {
    const filtered = ownCycleNote(note, role);
    if (hasFields(filtered)) cycleNotes[coord] = filtered;
  }

  return {
    schema: SCHEMA_VERSION,
    role,
    entries,
    cycleNotes,
    settings: {
      privacy: snapshot.settings.privacy[role],
      matchRadius: snapshot.settings.matchRadius,
      fallbackCycleLen: snapshot.settings.fallbackCycleLen,
    },
  };
}

export function buildSharedPayload(snapshot: AppSnapshot, role: Person): SharedPayload {
  const mode = snapshot.settings.privacy[role];
  const entries: Record<ISODate, DayEntry> = {};
  for (const [date, entry] of Object.entries(snapshot.entries) as [ISODate, DayEntry][]) {
    const filtered = sharedEntry(entry, role, mode);
    if (hasFields(filtered, 1)) entries[date] = filtered;
  }

  const cycleNotes: Record<string, CycleDayNote> = {};
  for (const [coord, note] of Object.entries(snapshot.cycleNotes)) {
    const filtered = sharedCycleNote(note, role, mode);
    if (hasFields(filtered)) cycleNotes[coord] = filtered;
  }

  return { schema: SCHEMA_VERSION, role, privacy: mode, entries, cycleNotes };
}

export function buildCyclePayload(snapshot: AppSnapshot): CyclePayload {
  const entries: CyclePayload['entries'] = {};
  for (const [date, entry] of Object.entries(snapshot.entries) as [ISODate, DayEntry][]) {
    if (entry.flow !== undefined) entries[date] = { date, flow: entry.flow };
  }
  return { schema: SCHEMA_VERSION, entries };
}

function validRole(value: unknown): value is Person {
  return value === 'her' || value === 'him';
}

function validPrivacy(value: unknown): value is PrivacyMode {
  return value === 'private' || value === 'public' || value === 'manual';
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

function cleanBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function cleanFlow(value: unknown): Flow | undefined {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : undefined;
}

function validDate(value: string): value is ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanEntries(value: unknown, role: Person, includeFlow = false): Record<ISODate, DayEntry> {
  const source = record(value);
  const result: Record<ISODate, DayEntry> = {};
  if (!source) return result;

  for (const [date, raw] of Object.entries(source).slice(0, 5000)) {
    if (!validDate(date)) continue;
    const item = record(raw);
    if (!item) continue;
    const entry: DayEntry = { date };
    if (includeFlow) entry.flow = cleanFlow(item.flow);
    if (role === 'her') {
      entry.moodHer = cleanText(item.moodHer, 32);
      entry.noteHer = cleanText(item.noteHer, 4000);
      entry.noteHerShared = cleanBool(item.noteHerShared);
      entry.goodHer = cleanText(item.goodHer, 1000);
      entry.badHer = cleanText(item.badHer, 1000);
    } else {
      entry.moodHim = cleanText(item.moodHim, 32);
      entry.noteHim = cleanText(item.noteHim, 4000);
      entry.noteHimShared = cleanBool(item.noteHimShared);
      entry.goodHim = cleanText(item.goodHim, 1000);
      entry.badHim = cleanText(item.badHim, 1000);
    }
    if (hasFields(entry, 1)) result[date] = entry;
  }
  return result;
}

function cleanCycleNotes(value: unknown, role: Person): Record<string, CycleDayNote> {
  const source = record(value);
  const result: Record<string, CycleDayNote> = {};
  if (!source) return result;

  for (const [coord, raw] of Object.entries(source).slice(0, 500)) {
    if (!/^[FBO]-?\d{1,3}$/.test(coord)) continue;
    const item = record(raw);
    if (!item) continue;
    const note: CycleDayNote =
      role === 'her'
        ? {
            summaryHer: cleanText(item.summaryHer, 4000),
            autoSummaryHer: cleanText(item.autoSummaryHer, 4000),
            summaryHerShared: cleanBool(item.summaryHerShared),
          }
        : {
            summaryHim: cleanText(item.summaryHim, 4000),
            autoSummaryHim: cleanText(item.autoSummaryHim, 4000),
            summaryHimShared: cleanBool(item.summaryHimShared),
          };
    if (hasFields(note)) result[coord] = note;
  }
  return result;
}

export function parsePrivatePayload(value: unknown, expectedRole: Person): PrivatePayload | null {
  const source = record(value);
  if (!source || source.schema !== SCHEMA_VERSION || source.role !== expectedRole) return null;
  const settings = record(source.settings);
  if (!settings || !validPrivacy(settings.privacy)) return null;
  return {
    schema: SCHEMA_VERSION,
    role: expectedRole,
    entries: cleanEntries(source.entries, expectedRole),
    cycleNotes: cleanCycleNotes(source.cycleNotes, expectedRole),
    settings: {
      privacy: settings.privacy,
      matchRadius:
        typeof settings.matchRadius === 'number'
          ? Math.min(3, Math.max(0, Math.round(settings.matchRadius)))
          : 2,
      fallbackCycleLen:
        typeof settings.fallbackCycleLen === 'number'
          ? Math.min(45, Math.max(20, Math.round(settings.fallbackCycleLen)))
          : 28,
    },
  };
}

export function parseSharedPayload(value: unknown): SharedPayload | null {
  const source = record(value);
  if (
    !source ||
    source.schema !== SCHEMA_VERSION ||
    !validRole(source.role) ||
    !validPrivacy(source.privacy)
  ) {
    return null;
  }
  return {
    schema: SCHEMA_VERSION,
    role: source.role,
    privacy: source.privacy,
    entries: cleanEntries(source.entries, source.role),
    cycleNotes: cleanCycleNotes(source.cycleNotes, source.role),
  };
}

export function parseCyclePayload(value: unknown): CyclePayload | null {
  const source = record(value);
  if (!source || source.schema !== SCHEMA_VERSION) return null;
  const rawEntries = record(source.entries);
  const entries: CyclePayload['entries'] = {};
  if (rawEntries) {
    for (const [date, raw] of Object.entries(rawEntries).slice(0, 5000)) {
      if (!validDate(date)) continue;
      const item = record(raw);
      if (!item) continue;
      const flow = cleanFlow(item.flow);
      if (flow !== undefined) entries[date] = { date, flow };
    }
  }
  return { schema: SCHEMA_VERSION, entries };
}

function mergeEntries(target: Record<ISODate, DayEntry>, source: Record<ISODate, DayEntry>) {
  for (const [date, entry] of Object.entries(source) as [ISODate, DayEntry][]) {
    target[date] = { ...(target[date] ?? { date }), ...entry, date };
  }
}

function mergeCycleNotes(
  target: Record<string, CycleDayNote>,
  source: Record<string, CycleDayNote>,
) {
  for (const [coord, note] of Object.entries(source)) {
    target[coord] = { ...(target[coord] ?? {}), ...note };
  }
}

export function restoreCloudSnapshot(
  currentSettings: Settings,
  role: Person,
  own: PrivatePayload,
  shared: SharedPayload[],
  cycle: CyclePayload | null,
): AppSnapshot {
  const entries: Record<ISODate, DayEntry> = {};
  const cycleNotes: Record<string, CycleDayNote> = {};

  mergeEntries(entries, own.entries);
  mergeCycleNotes(cycleNotes, own.cycleNotes);

  const partner = shared.find((payload) => payload.role === OTHER[role]);
  if (partner) {
    mergeEntries(entries, partner.entries);
    mergeCycleNotes(cycleNotes, partner.cycleNotes);
  }
  if (cycle) mergeEntries(entries, cycle.entries);

  return {
    entries,
    cycleNotes,
    settings: {
      ...currentSettings,
      fallbackCycleLen: own.settings.fallbackCycleLen,
      matchRadius: own.settings.matchRadius,
      perspective: role,
      roleChosen: true,
      privacy: {
        ...currentSettings.privacy,
        [role]: own.settings.privacy,
        ...(partner ? { [partner.role]: partner.privacy } : {}),
      },
    },
  };
}
