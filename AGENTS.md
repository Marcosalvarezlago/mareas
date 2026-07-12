# Mareas — notas para agentes

- Proyecto migrado a `C:\Users\marco\Documents\Codex\Proyectos\mareas` y gestionado con Codex.
- No introducir claves, activar servicios online ni hacer llamadas reales a Anthropic sin autorización explícita del usuario. La IA debe seguir siendo opcional y el fallback local debe funcionar siempre.

- **SDK de Expo: 56** (react-native 0.85). NO subir a SDK 57 hasta que el
  Expo Go de las tiendas lo soporte (el del móvil del usuario va por 56).
- Docs correctas para esta versión: https://docs.expo.dev/versions/v56.0.0/
- Verificación: `npx tsc --noEmit` y preview web (usar `preview_snapshot`;
  `preview_screenshot` se cuelga con esta app).
- En shells del harness, Node no está en PATH: prefijar
  `$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"`.
- El usuario prueba la app con `Ver Mareas en el ordenador (web).bat`.
- Reglas de producto: roles **Maya 🌸** (vive el ciclo, única que lo edita)
  y **Marcos 🌊** (acompaña, solo lectura del ciclo). ACCESO POR CAPAS: puerta
  "¿Quién eres?" al entrar (settings.roleChosen); cada persona ve su capa y
  del otro solo lo compartido; "Cambiar de usuario" vive en Privacidad. Las
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
- Resumen con IA: `src/lib/ai.ts` usa `@anthropic-ai/sdk` con
  `dangerouslyAllowBrowser` y la clave DEL USUARIO (`settings.aiApiKey`,
  solo en su dispositivo — JAMÁS en código ni git). Modelo
  `claude-opus-4-8`. Sin clave → fallback estadístico
  (`summarizeCyclePoint`). No hacer llamadas reales en pruebas.
