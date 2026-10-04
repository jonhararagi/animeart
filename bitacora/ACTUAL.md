# Estado de continuación

## Última sesión registrada

**2026-10-03 — instalación del modo de trabajo persistente**

## Rama

`web-first-foundation`

## Último commit conocido antes de este sistema

`bddc123ac3e31bab33bf72c6849a26cec55bf098`

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

- Web CI #8: SUCCESS.
- Android CI #76: revisar/confirmar en GitHub antes de declarar GREEN para el commit `bddc123...`.

## Regla para la próxima sesión

No empezar directamente a programar. Primero comprobar el estado real de `bddc123...` y de CI. Después continuar desde PB-004.

## Corte

Al alcanzar 5 minutos: detener cambios, guardar esta ficha y crear una nueva bitácora fechada.
