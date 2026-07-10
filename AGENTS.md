# Mareas — notas para agentes

- **SDK de Expo: 56** (react-native 0.85). NO subir a SDK 57 hasta que el
  Expo Go de las tiendas lo soporte (el del móvil del usuario va por 56).
- Docs correctas para esta versión: https://docs.expo.dev/versions/v56.0.0/
- Verificación: `npx tsc --noEmit` y preview web (usar `preview_snapshot`;
  `preview_screenshot` se cuelga con esta app).
- En shells del harness, Node no está en PATH: prefijar
  `$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"`.
- El usuario prueba la app con `Ver Mareas en el ordenador (web).bat`.
- Reglas de producto: los roles visibles son **Luna 🌙** (vive el ciclo,
  única que lo edita) y **Mar 🌊** (acompaña, solo lectura del ciclo); las
  claves internas siguen siendo `her`/`him` — NO renombrarlas (hay datos
  persistidos). Notas privadas por defecto; emojis de estado y bienestar
  (sienta bien/mal) siempre compartidos; toda predicción lleva disclaimer
  (no anticonceptivo / no consejo médico).
- Emparejamiento de "días parecidos": por fase con doble coordenada
  (adelante desde la regla; atrás hacia la siguiente en lútea; distancia a
  ovulación en fértil). Único punto de acople: `similarDays()` en
  `src/lib/cycle.ts` — sustituible por un modelo aprendido.
