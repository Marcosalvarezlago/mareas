// Resumen con IA: una llamada real a la API de Claude (Anthropic) usando la
// CLAVE DEL PROPIO USUARIO, guardada solo en su dispositivo (settings.aiApiKey).
// La clave jamás vive en el código ni en git. Si no hay clave, la app usa el
// resumen estadístico local (summarizeCyclePoint) — gratis y sin red.

import Anthropic from '@anthropic-ai/sdk';

import { PHASE_INFO, type Phase, type SimilarDay } from './cycle';
import { formatShort } from './dates';
import { PERSON_META, type Person } from './types';

/** Modelo por defecto. Cada resumen cuesta una fracción de céntimo. */
export const AI_MODEL = 'claude-opus-4-8';

export interface AiSummaryInput {
  apiKey: string;
  me: Person;
  cycleDay: number;
  phase: Phase;
  /** Contexto de la coordenada ("a 4 días de la próxima regla"), si lo hay. */
  context: string | null;
  /** Días equivalentes; solo se envían los campos PROPIOS de `me`. */
  matches: SimilarDay[];
  /** Resumen manual actual del usuario, como contexto (opcional). */
  manualSummary?: string;
}

/** Convierte los días equivalentes en líneas compactas, SOLO con datos propios. */
function buildRecordLines(me: Person, matches: SimilarDay[]): string[] {
  const meta = PERSON_META[me];
  const lines: string[] = [];
  for (const m of matches) {
    const parts: string[] = [];
    if (me === 'her' && (m.entry.flow ?? 0) > 0) parts.push('con regla');
    const mood = m.entry[meta.moodKey];
    if (mood) parts.push(`ánimo ${mood}`);
    const good = m.entry[meta.goodKey];
    if (good) parts.push(`sentó bien: ${good}`);
    const bad = m.entry[meta.badKey];
    if (bad) parts.push(`sentó mal: ${bad}`);
    const note = m.entry[meta.noteKey];
    if (note) parts.push(`nota: «${note.replace(/\s+/g, ' ').trim()}»`);
    if (parts.length) {
      lines.push(`- ${formatShort(m.date)} (día ${m.cycleDay} del ciclo): ${parts.join(' · ')}`);
    }
  }
  return lines;
}

/**
 * Pide a Claude un resumen breve, cálido y en segunda persona del punto del
 * ciclo. Lanza un Error con mensaje legible si algo falla (clave inválida,
 * sin conexión…) para que la UI caiga al resumen estadístico.
 */
export async function aiCycleSummary(input: AiSummaryInput): Promise<string> {
  const meta = PERSON_META[input.me];
  const lines = buildRecordLines(input.me, input.matches);
  if (!lines.length) throw new Error('Sin registros propios en días equivalentes.');

  const client = new Anthropic({
    apiKey: input.apiKey,
    // La app corre en el navegador/móvil del usuario con SU propia clave:
    // este es exactamente el caso que cubre este permiso explícito del SDK.
    dangerouslyAllowBrowser: true,
  });

  const system =
    'Eres la voz de Mareas, una app íntima de ciclo menstrual para parejas. ' +
    'Escribes el resumen de lo que suele significar un punto del ciclo para una persona, ' +
    'basándote SOLO en sus registros (no inventes nada que no esté en ellos). ' +
    'Hablas en segunda persona, con calidez y concreción («sueles…», «te sienta…»), ' +
    'buscando el patrón que conecta los registros, no una lista. Puedes citar los emojis ' +
    'registrados. Nada de diagnósticos ni consejos médicos. 60–110 palabras, en español, ' +
    'un solo párrafo, sin título ni saludo.';

  const phaseName = PHASE_INFO[input.phase].name.toLowerCase();
  const user =
    `Persona: ${meta.label}. Punto del ciclo: día ${input.cycleDay} (${phaseName}` +
    `${input.context ? `, ${input.context}` : ''}).\n` +
    `Registros de sus días equivalentes en otros ciclos:\n${lines.join('\n')}\n` +
    (input.manualSummary
      ? `Su resumen manual actual, como contexto: «${input.manualSummary.replace(/\s+/g, ' ').trim()}»\n`
      : '') +
    '\nEscribe el resumen.';

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: user }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error('Clave de API inválida: revísala en Ajustes.');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Límite de peticiones alcanzado; prueba en un minuto.');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new Error('Sin conexión con la IA.');
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Error de la IA (${err.status ?? '?'}).`);
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('La IA declinó esta petición.');
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('La IA devolvió una respuesta vacía.');
  return text;
}
