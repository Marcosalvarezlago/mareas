# Autoauditoría de seguridad y privacidad

Fecha: 13 de julio de 2026. Alcance: rama `agent/product-evolution`.

## Controles verificados

- No existe una clave de Anthropic, OpenAI, Supabase secreta ni `service_role`
  en código o configuración versionada.
- La aplicación no contiene llamadas reales a proveedores de inteligencia
  artificial; el resumen es local.
- La integración de nube permanece desactivada si faltan las variables públicas.
- Los datos privados y compartidos se almacenan en tablas diferentes.
- Cada cuenta solo puede escribir su fila; ambas pueden leer la proyección
  compartida de su pareja.
- El ciclo se valida en RLS como escritura exclusiva del rol `her`.
- Los códigos de pareja tienen 48 bits aleatorios, se guardan como hash, pueden
  rotarse y el espacio admite dos roles únicos.
- Las respuestas remotas se filtran por campos, longitudes, fechas y coordenadas
  antes de incorporarse al estado local.
- Las instantáneas están limitadas a 1 MB en PostgreSQL.
- Cerrar sesión sincroniza antes de borrar la copia local; si falla la subida no
  se continúa con el cierre.
- La migración del formato anterior elimina la antigua clave guardada y eleva la
  versión de persistencia para reescribir el almacenamiento.

## Verificación ejecutada

- `npm run lint`: sin errores ni avisos.
- `npm run test:cloud`: 20 comprobaciones de privacidad superadas.
- `npx tsc --noEmit`: correcto.
- `npx expo export --platform web`: cuatro rutas estáticas exportadas.
- `npx supabase migration list --linked`: migraciones inicial y correctiva
  registradas en el proyecto remoto.
- `npx supabase db lint --linked --schema public --level warning --fail-on
  error`: sin errores de esquema tras corregir la referencia ambigua de
  `join_couple`.
- `npx supabase config push`: URL pública, redirecciones y valores seguros de
  Auth aplicados; funciones de almacenamiento de pago desactivadas.
- `git diff --check`: correcto.
- Rastreo del bundle: contiene solo la URL y clave publicable previstas, sin
  patrones de claves secretas, tokens personales ni referencias a
  Anthropic/Claude.

## Dependencias

`npm audit --omit=dev` informa de 11 avisos moderados cuyo origen es `xcode ->
uuid`, dentro del toolchain de Expo. La corrección forzada propuesta por npm
instalaría `expo-splash-screen` de SDK 55, incompatible con la regla obligatoria
de SDK 56. No se aplicó. Debe revisarse cuando Expo publique una actualización
56 compatible.

## Límites conocidos

1. **Validación real con dos cuentas pendiente.** El proyecto remoto está
   activo, las migraciones y Auth están desplegados y el lint de PostgreSQL no
   encuentra errores. Aún falta recorrer alta, emparejamiento, RLS, Realtime e
   incógnito con las cuentas reales de Maya y Marcos antes de fusionar a
   producción.
2. **No es cifrado de extremo a extremo.** Supabase cifra transporte y disco y
   RLS separa cuentas, pero el operador del proyecto puede acceder a PostgreSQL.
   El cifrado de aplicación requeriría gestión y recuperación de claves y debe
   tratarse como una fase específica.
3. **Conflictos de la misma cuenta.** Dos dispositivos de la misma persona que
   editen simultáneamente usan última escritura de instantánea. Los roles
   diferentes no colisionan porque escriben filas distintas.
4. **Disponibilidad gratuita.** Supabase puede pausar proyectos inactivos; la
   primera apertura posterior puede demorarse.
5. **Recuperación del correo.** Quien controle el buzón puede iniciar sesión. Se
   recomienda proteger las dos cuentas de correo con autenticación multifactor.

## Pruebas obligatorias antes de fusionar

- Crear dos cuentas de prueba y asignar Maya/Marcos.
- Confirmar que Marcos recibe error al escribir `cycle_snapshots` por API.
- Confirmar que ninguna cuenta puede seleccionar `private_snapshots` de la otra.
- Alternar los tres modos de privacidad y revisar el JSON compartido.
- Probar alta con datos locales existentes y migración secuencial de las dos capas.
- Abrir una ventana de incógnito, iniciar sesión y comprobar recuperación completa.
- Editar desde dos navegadores y validar Realtime y el comportamiento sin conexión.
- Rotar el código y comprobar que el anterior queda invalidado.
- Cerrar sesión y verificar que AsyncStorage/localStorage ya no contiene la copia.
