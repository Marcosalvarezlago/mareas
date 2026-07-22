import {
  buildCyclePayload,
  buildPrivatePayload,
  buildSharedPayload,
  parseSharedPayload,
  restoreCloudSnapshot,
} from '../src/lib/cloud-payload';
import type { ISODate } from '../src/lib/dates';
import type { AppSnapshot } from '../src/lib/store';
import { DEFAULT_SETTINGS } from '../src/lib/types';

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Esperado ${String(expected)}, recibido ${String(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Objetos distintos: ${JSON.stringify(actual)} / ${JSON.stringify(expected)}`);
    }
  },
};

const date = '2026-07-13' as ISODate;
const base: AppSnapshot = {
  entries: {
    [date]: {
      date,
      flow: 2,
      painHer: 2,
      moodHer: '😊🥺',
      noteHer: 'Nota privada de Maya',
      noteHerShared: true,
      goodHer: 'calor',
      badHer: 'ruido',
      moodHim: '😌',
      noteHim: 'Nota privada de Marcos',
      noteHimShared: false,
      goodHim: 'descanso',
    },
  },
  cycleNotes: {
    F4: {
      summaryHer: 'Resumen privado de Maya',
      summaryHerShared: true,
      summaryHim: 'Resumen privado de Marcos',
      summaryHimShared: false,
    },
  },
  settings: {
    ...DEFAULT_SETTINGS,
    roleChosen: true,
    privacy: { her: 'private', him: 'manual' },
  },
};

const mayaPrivate = buildPrivatePayload(base, 'her');
assert.equal(mayaPrivate.entries[date].noteHer, 'Nota privada de Maya');
assert.equal(mayaPrivate.entries[date].moodHim, undefined);
assert.equal(mayaPrivate.entries[date].flow, undefined);
assert.equal(mayaPrivate.cycleNotes.F4.summaryHim, undefined);

const mayaSharedPrivate = buildSharedPayload(base, 'her');
assert.equal(mayaSharedPrivate.entries[date].moodHer, '😊🥺');
assert.equal(mayaSharedPrivate.entries[date].painHer, 2);
assert.equal(mayaSharedPrivate.entries[date].goodHer, 'calor');
assert.equal(mayaSharedPrivate.entries[date].noteHer, undefined);
assert.equal(mayaSharedPrivate.cycleNotes.F4, undefined);

const manual: AppSnapshot = {
  ...base,
  settings: {
    ...base.settings,
    privacy: { ...base.settings.privacy, her: 'manual' },
  },
};
const mayaSharedManual = buildSharedPayload(manual, 'her');
assert.equal(mayaSharedManual.entries[date].noteHer, 'Nota privada de Maya');
assert.equal(mayaSharedManual.cycleNotes.F4.summaryHer, 'Resumen privado de Maya');

const cycle = buildCyclePayload(base);
assert.deepEqual(cycle.entries[date], { date, flow: 2 });
assert.equal('moodHer' in cycle.entries[date], false);

const marcosShared = parseSharedPayload({
  schema: 1,
  role: 'him',
  privacy: 'manual',
  entries: {
    [date]: {
      date,
      moodHim: '😌',
      noteHim: 'Compartida por Marcos',
      noteHimShared: true,
      moodHer: 'inyección ignorada',
    },
  },
  cycleNotes: {
    F4: {
      summaryHim: 'Compartido por Marcos',
      summaryHimShared: true,
      summaryHer: 'inyección ignorada',
    },
  },
});
if (!marcosShared) throw new Error('La proyección compartida válida fue rechazada.');
assert.equal(marcosShared.entries[date].moodHer, undefined);
assert.equal(marcosShared.entries[date].painHer, undefined);
assert.equal(marcosShared.cycleNotes.F4.summaryHer, undefined);

const restored = restoreCloudSnapshot(
  DEFAULT_SETTINGS,
  'her',
  buildPrivatePayload(manual, 'her'),
  [marcosShared],
  cycle,
);
assert.equal(restored.entries[date].flow, 2);
assert.equal(restored.entries[date].noteHer, 'Nota privada de Maya');
assert.equal(restored.entries[date].noteHim, 'Compartida por Marcos');
assert.equal(restored.settings.perspective, 'her');
assert.equal(restored.settings.roleChosen, true);
assert.equal(restored.settings.privacy.him, 'manual');

const bounded = parseSharedPayload({
  schema: 1,
  role: 'him',
  privacy: 'public',
  entries: { [date]: { date, noteHim: 'x'.repeat(5000) } },
  cycleNotes: {},
});
assert.equal(bounded?.entries[date].noteHim?.length, 4000);

console.log('cloud-payload: 20 comprobaciones de privacidad superadas');
