# BIMLog Lens Next — guía del operador para instalación y aceptación de campo

Estado: `CANDIDATO_LOCAL_LISTO; AUTORIDAD EXTERNA PENDIENTE`

Esta guía no autoriza instalación, inicio de Navisworks, acceso a documentos de clientes,
escrituras de producción, publicación ni despliegue. Se usa únicamente después de que Roberto
autorice el commit, los hashes, el destino literal, el documento sintético y el alcance exactos.

## Límite inmutable

- Lens Next usa `BIMLogLensNext`, panel `BIMLogLensNext.IgniteSmart`, botón
  `BIMLogLensNextButton.IgniteSmart`, estado `%LOCALAPPDATA%\BIMLog\LensNext`, puente
  `127.0.0.1:8766` y metadatos `bimlog.lens_next.v1`.
- Lens Legacy conserva sus identidades, estado y puerto `8765`. Lens Next no lee ni escribe
  archivos, configuración, estado, caché, registros, procesos o metadatos de Legacy.
- Las ocho banderas `lens_next.*` de escritura permanecen en `false`. La Fase 2 permanece retenida.
- La única navegación permitida resuelve un GUID no vacío exacto y asigna esa misma vista como
  vista actual. Se prohíben enumeración, etiquetas, carpetas, posición, vista activa y cualquier
  coincidencia aproximada o alternativa.

## Preflight del operador

1. Exigir branch, commit aceptado y árbol limpio. Comparar SHA-256 del ZIP y cada entrada con el
   manifiesto aceptado; detenerse ante cualquier diferencia o archivo Autodesk/Legacy inesperado.
2. Confirmar que no existe proceso Navisworks/Roamer. No finalizar procesos automáticamente.
3. Inventariar y hashear el destino Lens Next propuesto y todos los destinos Legacy protegidos.
   El destino no puede superponerse a Legacy. Preservar cualquier Lens Next previo en un respaldo
   nuevo y F-rooted antes de reemplazarlo.
4. Registrar versión exacta 2021 o 2025, documento sintético aprobado y su hash, proyecto positivo,
   fingerprint SHA-256 del modelo y GUID exacto no vacío. La evidencia de un año no acepta el otro.
5. Verificar disponibilidad de `127.0.0.1:8766`. Si está ocupado, detenerse con rechazo visible;
   nunca usar `8765`, otro puerto, `localhost`, interfaz remota ni finalizar el proceso propietario.

## Matriz de ejecución por año

- Abrir Navisworks y el documento sintético autorizado. Confirmar que Lens Next aparece una vez y
  que Legacy conserva nombre, disponibilidad e inventario exactos.
- Confirmar modo solo lectura, las ocho banderas falsas y ausencia de acciones de Fase 2.
- Abrir dos veces el mismo GUID exacto. Comparar antes/después: conteo, GUID, nombre, comentario,
  carpeta y metadatos de SavedViewpoints deben permanecer idénticos.
- Comprobar rechazo explícito para GUID faltante, cero, inválido y no-viewpoint; proyecto o modelo
  incorrectos; documento renombrado/cambiado; sesión cerrada; llamada desde thread no propietario;
  etiqueta, ruta, posición, vista actual y primera/mejor coincidencia.
- Cerrar y reabrir el documento. Crear una sesión nueva y repetir la navegación exacta. La sesión
  anterior debe quedar rechazada y no debe existir estado, archivo ni mutación inesperados.
- Cerrar Navisworks, ejecutar rollback solamente sobre archivos Lens Next poseídos y comparar
  hashes con el inventario previo. Legacy debe quedar byte por byte idéntico.

## Evidencia obligatoria

Complete una copia del template JSON por año con `PASS`, `FAIL` o `NOT_RUN`; incluya autorización,
commit, hashes de paquete/ensamblados, versión de producto, inventarios antes/después/rollback,
hash del documento sintético, proyecto/modelo/GUID, estados de rechazo, capturas, transcript
sanitizado y confirmación explícita de cero I/O Legacy. Un `FAIL`, `NOT_RUN`, dato ambiguo o año
ausente mantiene el candidato sin aceptación. Compilación y pruebas locales no son prueba de campo.
