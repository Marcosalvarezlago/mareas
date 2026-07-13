# Arquitectura de sincronización privada

Fecha: 13 de julio de 2026.

## Objetivo

Recuperar los datos de Mareas después de abrir incógnito, cambiar de navegador o
usar otro dispositivo, manteniendo los roles Maya/Marcos y evitando que una nota
privada viaje dentro de una fila que la pareja pueda consultar.

## Flujo

1. La persona solicita un enlace mágico a su correo.
2. La primera cuenta crea un espacio y elige su rol persistente `her` o `him`.
3. El servidor devuelve una sola vez un código de 48 bits, mostrado en grupos.
   Solo se conserva su hash SHA-256.
4. La segunda cuenta introduce el código y recibe automáticamente el rol libre.
5. Cada cambio local se agrupa durante 900 ms antes de sincronizarse.
6. Los cambios remotos llegan mediante Realtime y se validan antes de entrar en
   Zustand/AsyncStorage.

## Separación de datos

### `private_snapshots`

Una fila por cuenta. Contiene sus notas, resúmenes, estado, bienestar y ajustes.
Las políticas permiten leer, insertar, actualizar o borrar únicamente cuando
`auth.uid() = user_id`.

### `shared_snapshots`

Una fila por cuenta y espacio. El cliente construye una proyección con estado y
bienestar, más notas o resúmenes solo cuando el modo efectivo lo permite. Ambos
miembros pueden leerla; solo la persona propietaria puede escribirla.

### `cycle_snapshots`

Una fila por pareja. Ambos roles pueden leerla y únicamente `her` puede escribir,
regla verificada por PostgreSQL además de la interfaz.

Las tres cargas aceptan objetos JSON de hasta 1 MB. El cliente limita cantidad de
fechas, coordenadas y longitud de textos antes de incorporarlos al estado.

## Migración desde el modo compartido local

La instalación anterior podía contener las dos capas en el mismo navegador. Para
no borrar la segunda durante el alta:

1. la primera cuenta sube únicamente su capa;
2. si la pareja aún no se ha unido, la capa local restante se conserva;
3. el botón de migración permite cambiar de cuenta sin limpiar temporalmente el
   dispositivo;
4. la segunda cuenta entra con el código y sube su propia capa;
5. desde entonces, el cierre de sesión normal borra la copia local sensible.

Este flujo debe hacerse en un dispositivo de confianza. El código se comparte por
un canal privado y puede rotarse, invalidando inmediatamente el anterior.

## Fallos y funcionamiento sin conexión

- AsyncStorage sigue siendo la caché inmediata.
- Un error de red no bloquea el registro; la interfaz lo indica y conserva cambios.
- Al recuperar conexión, una modificación o «Sincronizar ahora» vuelve a subir la
  instantánea.
- Las instantáneas usan última escritura como resolución de conflictos. Es
  adecuado para dos personas que editan capas distintas; dos dispositivos de la
  misma cuenta editando simultáneamente el mismo campo siguen siendo un límite
  conocido. Una futura migración a eventos por campo resolvería ese caso.
- El plan gratuito puede pausar el proyecto tras una semana sin actividad; el
  siguiente acceso puede tardar mientras se reactiva.

## Modelo de amenazas

- Una clave publicable robada no supera RLS.
- Una cuenta comprometida accede a su copia privada y a la proyección compartida,
  pero no a la copia privada de la pareja.
- Marcos no puede modificar el ciclo ni llamando directamente a la API.
- Las funciones de emparejamiento usan `SECURITY DEFINER`, `search_path` fijado y
  validación de autenticación, rol, aforo y código.
- No se registran nombres reales dentro de las cargas.
- GitHub contiene esquema y código, nunca registros, sesiones o claves secretas.

## Inteligencia artificial

No forma parte de esta fase. El resumen es local. Una integración futura con
OpenAI debe ejecutarse en Edge Functions, exigir sesión válida, limitar frecuencia
y coste, enviar solo campos propios imprescindibles y evitar programas gratuitos
que requieran compartir entradas y salidas para entrenamiento.
