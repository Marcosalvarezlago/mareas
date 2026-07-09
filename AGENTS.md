# Mareas — notas para agentes

- **SDK de Expo: 56** (react-native 0.85). NO subir a SDK 57 hasta que el
  Expo Go de las tiendas lo soporte (el del móvil del usuario va por 56).
- Docs correctas para esta versión: https://docs.expo.dev/versions/v56.0.0/
- Verificación: `npx tsc --noEmit` y preview web (usar `preview_snapshot`;
  `preview_screenshot` se cuelga con esta app).
- En shells del harness, Node no está en PATH: prefijar
  `$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"`.
- El usuario prueba la app con `Ver Mareas en el ordenador (web).bat`.
- Reglas de producto: ella es dueña del ciclo (él solo lectura), notas
  privadas por defecto, emojis de estado siempre compartidos, y toda
  predicción lleva disclaimer (no anticonceptivo / no consejo médico).
