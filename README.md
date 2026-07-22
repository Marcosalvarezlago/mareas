# Mareas 🌊

Mareas es una aplicación íntima para dos personas. Convierte el ciclo menstrual,
el estado emocional y el bienestar cotidiano en contexto compartido y cuidado,
sin convertir las predicciones en diagnósticos ni exponer notas privadas.

La aplicación usa Expo SDK 56 y funciona en web, Android e iOS. La versión web
pública se despliega automáticamente desde `main` mediante GitHub Pages.

## Principios de producto

- Maya (`her`) vive el ciclo y es la única persona que puede modificarlo.
- Marcos (`him`) acompaña y tiene acceso de lectura al ciclo.
- Cada persona edita únicamente su estado, bienestar, notas y resúmenes.
- El estado y el bienestar se comparten; las notas y resúmenes siguen el modo
  privado, compartido o selección manual de su autora o autor.
- Las predicciones son estadísticas: no son un método anticonceptivo ni consejo
  médico.
- El resumen automático funciona localmente y no envía registros a una IA.

## Desarrollo local

```powershell
npm install
npx expo start --web
```

Comprobaciones mínimas antes de publicar:

```powershell
npx tsc --noEmit
npx expo export --platform web
git diff --check
```

## Persistencia y sincronización

Sin configurar ningún servicio, Zustand y AsyncStorage conservan los datos solo
en el navegador o dispositivo. Una ventana de incógnito tiene otro almacenamiento
y, al cerrarse, lo destruye; por eso no puede recuperar datos automáticamente.

La sincronización opcional usa Supabase:

1. acceso mediante enlace mágico por correo, sin contraseña y restringido a
   las dos cuentas existentes;
2. espacio de pareja con un código aleatorio cuyo servidor guarda solo el hash;
3. copia privada separada para cada persona;
4. proyección compartida que contiene únicamente campos autorizados;
5. copia del ciclo compartida para lectura y modificable solo por Maya;
6. políticas de seguridad por fila en PostgreSQL y actualizaciones en tiempo real;
7. caché local para seguir funcionando cuando no haya red.

El diseño completo y sus límites están en
[`docs/sync-architecture.md`](docs/sync-architecture.md).

### Activar Supabase

1. Crear un proyecto gratuito en Supabase, preferentemente en una región europea.
2. Ejecutar en el editor SQL la migración de `supabase/migrations`.
3. Copiar `.env.example` como `.env` y rellenar la URL y la clave publicable.
4. En Auth > URL Configuration añadir:
   `https://marcosalvarezlago.github.io/mareas/`.
5. En GitHub crear los secretos de Actions
   `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
6. Exponerlos al paso `Export web app` del workflow antes del despliegue.

Las instantáneas activas se sincronizan entre dispositivos. Cada versión
reemplazada queda además archivada en `snapshot_history`, protegida por RLS,
para poder recuperar la memoria si una modificación futura introduce un error.

La clave publicable no es un secreto y está diseñada para cliente; nunca debe
usarse la clave secreta o `service_role` en Expo. La protección depende de que
las políticas RLS de la migración estén activas.

Si las variables no existen o son inválidas, la aplicación continúa en modo
local. Ningún dato se sube por el mero hecho de instalar las dependencias.

## Inteligencia artificial y coste

La integración cliente de Anthropic fue eliminada. Mareas utiliza actualmente un
resumen estadístico local, gratuito y privado.

La redacción opcional con ChatGPT queda para una fase posterior. Requerirá una
función de servidor, una clave de OpenAI almacenada como secreto, minimización de
los campos enviados, consentimiento explícito y un límite de gasto. No se usará
la promoción de tokens gratuitos ligada a compartir entradas y salidas con el
proveedor.

## Estructura relevante

- `src/lib/cycle.ts`: predicción, fases, días equivalentes y resumen local.
- `src/lib/store.ts`: estado local persistente y migraciones.
- `src/lib/cloud-payload.ts`: separación y validación de datos privados/compartidos.
- `src/providers/cloud-provider.tsx`: autenticación, sincronización y tiempo real.
- `src/components/sync-card.tsx`: acceso y emparejamiento.
- `supabase/migrations`: esquema, funciones seguras y políticas RLS.
- `docs/competitive-research.md`: estudio competitivo y hoja de ruta.
