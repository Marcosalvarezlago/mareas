# Mareas — notas para agentes

- Proyecto migrado a `C:\Users\marco\Documents\Codex\Proyectos\mareas` y gestionado con Codex.
- No introducir secretos en cliente o git ni activar servicios online sin autorización
  explícita. El usuario aprobó la arquitectura Supabase de la opción A el 13-07-2026,
  pero la redacción con OpenAI queda aplazada: no hacer llamadas reales a ningún
  proveedor de IA. El resumen local debe funcionar siempre.

- **SDK de Expo: 56** (react-native 0.85). NO subir a SDK 57 hasta que el
  Expo Go de las tiendas lo soporte (el del móvil del usuario va por 56).
- Docs correctas para esta versión: https://docs.expo.dev/versions/v56.0.0/
- Verificación: `npx tsc --noEmit` y preview web (usar `preview_snapshot`;
  `preview_screenshot` se cuelga con esta app).
- En shells del harness, Node no está en PATH: prefijar
  `$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"`.
- El usuario prueba la app con `Ver Mareas en el ordenador (web).bat`.
- Reglas de producto: roles **Maya 🌸** (vive el ciclo, única que lo edita)
  y **Marcos 🌊** (acompaña, solo lectura del ciclo). ACCESO POR CAPAS: sin
  cuenta se mantiene la puerta "¿Quién eres?" (`settings.roleChosen`); con
  sincronización, el rol queda fijado por `couple_members` y solo se cambia
  cerrando sesión. Cada persona ve su capa y del otro solo lo compartido. Las
  claves internas siguen siendo `her`/`him` — NO renombrarlas (datos
  persistidos). Privacidad por persona con modo triple ('private' |
  'public' | 'manual'); candados individuales solo aplican en manual —
  en modo global, tocarlos abre la tarjeta de Privacidad proponiendo el
  cambio. Emojis de estado y bienestar (sienta bien/mal) siempre
  compartidos. Toda predicción lleva disclaimer (no anticonceptivo / no
  consejo médico).
- Emparejamiento de "días equivalentes": por fase con doble coordenada
  (adelante desde la regla; atrás hacia la siguiente en lútea; distancia a
  ovulación en fértil), bidireccional en el tiempo, con RADIO configurable
  (`settings.matchRadius` 0–3, topes por fase en `PHASE_RADIUS_CAP`). Único
  punto de acople: `similarDays()` en `src/lib/cycle.ts` — sustituible por
  un modelo aprendido. Los resúmenes (manual + automático por separado, y
  SOLO de uno mismo, en segunda persona) se guardan bajo la coordenada
  rígida `F<n>`/`B<n>`/`O<n>` en `cycleNotes`.
- Sincronización opcional: cliente en `src/lib/supabase.ts`, separación de
  proyecciones en `src/lib/cloud-payload.ts`, orquestación en
  `src/providers/cloud-provider.tsx` y esquema/RLS en `supabase/migrations`.
  `private_snapshots` solo es legible por su persona; `shared_snapshots` nunca
  debe recibir campos no compartidos; `cycle_snapshots` solo lo escribe `her`.
  Si faltan variables `EXPO_PUBLIC_SUPABASE_*`, la app debe seguir local y sin
  errores. Nunca usar una secret/service-role key en Expo.
- Resumen automático: exclusivamente estadístico y local mediante
  `summarizeCyclePoint`. Anthropic fue retirado. La futura redacción con
  ChatGPT solo podrá vivir en una función de servidor, con límite de coste,
  minimización de datos y consentimiento; nunca con una clave en el navegador.
