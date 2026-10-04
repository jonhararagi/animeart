# Modo de trabajo persistente — AnimeArt

## Objetivo

Este repositorio usa un protocolo de trabajo persistente para que cada sesión pueda continuar exactamente desde el punto donde terminó la anterior.

## Regla principal

**INSPECCIONAR → DIAGNOSTICAR → REGISTRAR → PLANIFICAR → EJECUTAR → VERIFICAR → REGISTRAR → CONTINUAR**

Orden de prioridad:

**REUTILIZAR > ADAPTAR > CREAR**

No se debe crear una segunda arquitectura equivalente si ya existe una abstracción reutilizable.

## Reloj de sesión: corte de 5 minutos

Cada sesión de trabajo tiene un bloque máximo operativo de **5 minutos**.

Al iniciar una sesión se debe:

1. Leer este archivo.
2. Leer `bitacora/ACTUAL.md`.
3. Leer la última bitácora fechada de `bitacora/`.
4. Revisar `problema de huesos/REGISTRO.md`.
5. Revisar `docs/TRABAJO-MAPA.md`.
6. Inspeccionar GitHub y el estado real de la rama/CI.

Durante el bloque:

- trabajar solamente sobre el siguiente paso necesario;
- registrar problemas en `problema de huesos/` en cuanto sean detectados;
- registrar la solución cuando un problema quede resuelto;
- no declarar una tarea terminada sin evidencia;
- no iniciar una ampliación grande si el problema actual todavía está abierto.

### Corte obligatorio

Cuando se alcanzan 5 minutos:

1. detener nuevos cambios;
2. guardar el estado alcanzado;
3. actualizar `bitacora/ACTUAL.md`;
4. crear una bitácora fechada en `bitacora/`;
5. indicar exactamente:
   - qué se tocó;
   - qué se verificó;
   - qué problemas aparecieron;
   - qué problemas fueron solucionados;
   - qué quedó pendiente;
   - cuál es el siguiente paso;
   - último commit conocido;
   - estado real de CI.

Si un cambio importante está en proceso pero no puede verificarse antes del corte, se debe dejar **PENDIENTE DE VERIFICACIÓN**, no GREEN.

## Problemas de huesos

La carpeta `problema de huesos/` es el registro permanente de fallos, contradicciones, riesgos arquitectónicos y problemas técnicos encontrados durante el análisis.

Cada problema debe registrar como mínimo:

- ID;
- fecha;
- estado: ABIERTO / EN INVESTIGACIÓN / RESUELTO / BLOQUEADO;
- síntoma;
- causa;
- impacto;
- solución aplicada o propuesta;
- archivos afectados;
- evidencia de verificación;
- commit relacionado;
- siguiente acción.

No se borra un problema resuelto: se conserva para que el historial explique por qué se tomó una decisión.

## Bitácora

`bitacora/ACTUAL.md` es el punto de entrada de la próxima sesión.

Las bitácoras fechadas son el historial inmutable de cada bloque de trabajo.

La próxima sesión debe poder responder estas preguntas leyendo solamente los archivos de este protocolo:

- ¿Dónde quedamos?
- ¿Qué cambió?
- ¿Qué falló?
- ¿Qué se arregló?
- ¿Qué falta?
- ¿Qué debo hacer primero?
- ¿Qué evidencia existe?

## GitHub y CI

Los cambios de trabajo deben quedar en GitHub.

Para cualquier cambio verificable:

- registrar el commit;
- ejecutar/consultar CI cuando corresponda;
- distinguir SUCCESS, FAILURE, IN_PROGRESS y ausencia de evidencia;
- no llamar GREEN a un estado que no haya sido comprobado.

## Continuidad

La continuidad se considera válida únicamente si la bitácora y GitHub coinciden con el estado real del repositorio.

**La evidencia decide.**
