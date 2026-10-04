# Estado de continuación

## Última sesión registrada

**2026-10-03 — instalación del modo de trabajo persistente**

## Rama

`web-first-foundation`

## Último commit del sistema de trabajo

`11a7407a0048ef33bf6c292b9494b779fe17f983`

## Punto arquitectónico

La base Web ya tiene un modelo explícito de Document/Layer alineado con los conceptos existentes de Android.

## Siguiente trabajo

1. Introducir o adaptar un **Viewport** explícito en Web.
2. Separar cámara/Viewport de transformación de Layer.
3. Implementar zoom/pan usando ese estado.
4. Añadir tests de coordenadas y transformaciones.
5. Después pasar a Undo/Redo por comando.

## Problema abierto principal

**PB-004** — falta separar formalmente la cámara de la transformación de Layer.

Ver: `problema de huesos/REGISTRO.md`.

## Última evidencia conocida

- Web CI #9: IN_PROGRESS.
- Android CI #77: IN_PROGRESS.
- El commit `11a7407...` todavía no se declara GREEN.

## Regla para la próxima sesión

No empezar directamente a programar. Primero comprobar el estado real de `bddc123...` y de CI. Después continuar desde PB-004.

## Corte

Al alcanzar 5 minutos: detener cambios, guardar esta ficha y crear una nueva bitácora fechada.
