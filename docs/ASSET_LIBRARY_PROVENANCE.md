# Biblioteca visual: procedencia y licencias

**TIMER estimado:** 2–4 horas para una primera implementación verificable. El tiempo real no está medido.

## Objetivo

La biblioteca local de AnimeArt debe organizar recursos gráficos sin presentar su procedencia como conocida cuando no se haya registrado. Los metadatos no certifican por sí solos que una licencia sea válida: describen lo que la persona usuaria introdujo y deben conservarse junto al recurso.

## Metadatos por recurso

- Identificador estable, nombre, categoría, etiquetas y características visuales.
- Tipo de origen: original, variación/derivado, desconocido, generado por AnimeArt o experimental.
- Estado de procedencia: confirmado por la persona usuaria, sin verificar o desconocido.
- Autor/creador, URL de origen, licencia, atribución y notas.
- Hash SHA-256 cuando el navegador ofrece Web Crypto; sirve para detectar archivos idénticos, no para demostrar autoría ni derechos.

Las imágenes incorporadas desde un archivo empiezan como **procedencia desconocida** y **estado desconocido**. No se clasifican automáticamente como originales ni como libres de derechos. Una persona puede revisar esos datos y marcar su estado como confirmado por ella.

## Búsqueda y prevención de duplicados

La búsqueda incluye etiquetas, rasgos visuales, autor, licencia, URL y notas. Los filtros permiten separar categorías, tipos de origen y estados de verificación. La comparación SHA-256 omite duplicados exactos cuando el navegador ofrece el algoritmo; si Web Crypto no está disponible, la importación puede continuar sin esa protección automática.

## Compatibilidad y seguridad

El paquete exportado usa el esquema 2. La importación sigue aceptando paquetes del esquema 1, asignando valores conservadores a los metadatos que faltan. Solo se aceptan enlaces HTTP/HTTPS para procedencia; los esquemas javascript: y otros protocolos no se almacenan como enlaces válidos. Se mantienen el límite de 25 MiB por imagen y el máximo de 500 recursos.

## Límites conocidos

- «Confirmado por mí» es una declaración editorial de la persona usuaria, no una verificación legal automática.
- Una URL o etiqueta de licencia no prueba que quien subió un recurso tenga derechos para redistribuirlo.
- No se scrapean ni se copian recursos protegidos en esta función.
- No se promete deduplicación binaria si el entorno Web Crypto no está disponible.
