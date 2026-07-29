# Registro de hallazgos — NOVA CRM

> **Fecha:** 2026-07-18 · **Rama:** `back-end` (incluye trabajo sin commitear: `admin/`, papelera/`PurgeScheduler`, `MatchingConfig`, `ColumnMapper`, `SkillSynonyms`, migración V5, ymls de configuración y el front-end Next.js).
>
> **Alcance de la revisión:** auditoría de toda la documentación contra el código actual, revisión del código backend nuevo/modificado y revisión del front-end (incluye `tsc --noEmit`). Este documento **solo registra** hallazgos; no se aplicó ninguna corrección.
>
> **Actualización 2026-07-18:** corregidos ✅ **BE-01** (restaurar ya no re-elimina y devuelve el conteo real), ✅ **BE-02** (ambas purgas borran `LinkedinConfiguracion` antes del delete físico), ✅ **FE-05** (401 fuera de `/auth/` limpia sesión y redirige a `/login?expired=1` con aviso; cookie `max-age=900` alineada al JWT — el refresh token sigue pendiente) y ✅ **FE-04** (`init.body` eliminado en `apiFetch`). Verificado: `mvn compile` OK y `tsc` sin errores en los archivos tocados. **DOC-08** queda resuelto de rebote: la doc ahora describe el comportamiento real.
>
> **Actualización 2 (misma fecha):** corregidos ✅ **FE-01** (`usuarioId`), ✅ **FE-02** (`Button render=` de Base UI en hojas-de-vida y power-bi), ✅ **FE-03** (`TooltipProvider delay`), ✅ **FE-07** (`ignoreBuildErrors` eliminado — `tsc` y `pnpm build` en verde con el gate activo). Añadidos: workflow de CI (`.github/workflows/ci.yml`: `mvn verify` + `tsc` + build) y el primer test de integración (`back-end/src/test/java/com/novacrm/admin/PapeleraIntegrationTest.java`, Testcontainers) cubriendo las regresiones BE-01/BE-02. Nota: Testcontainers actualizado 1.19.7→1.21.3; los tests no pudieron ejecutarse localmente (incompatibilidad npipe entre docker-java y esta versión de Docker Desktop en Windows) — se ejecutarán en CI sobre Linux.

**Leyenda de severidades**

| Símbolo | Severidad | Significado |
|---|---|---|
| 🔴 | Crítico | Bug de datos o de lógica con efecto real |
| 🟠 | Error | Fallo funcional o de compilación |
| 🟡 | Corrección | Inconsistencia, código muerto o contenido engañoso |
| 🔵 | Mejora | Oportunidad de rendimiento, seguridad o claridad |

## Resumen

| Área | 🔴 Crítico | 🟠 Error | 🟡 Corrección | 🔵 Mejora | Total |
|---|---:|---:|---:|---:|---:|
| Backend | 2 | 3 | 5 | 5 | **15** |
| Frontend | 1 | 4 | 5 | 5 | **15** |
| Documentación | 0 | 0 | 9 | 4 | **13** |
| **Total** | **3** | **7** | **19** | **14** | **43** |

---

## Backend

| ID | Sev | Ubicación | Hallazgo | Fix sugerido |
|---|---|---|---|---|
| BE-01 | 🔴 | `admin/AdminController.java:51-58` | `restaurarEstudiantes` restaura (`restaurarEstudiantesByPrograma`) y acto seguido vuelve a soft-eliminar (`softDeleteEstudiantesByPrograma`). Además elimina estudiantes que nunca estuvieron en papelera y devuelve ese conteo como `"estudiantesRestaurados"`. El endpoint es un no-op dañino. | Eliminar la segunda llamada; devolver el conteo real de restaurados. |
| BE-02 | 🔴 | `config/PurgeScheduler.java:45-69` · `admin/AdminService.purgarPapelera:119-155` | Ambas purgas omiten borrar `LinkedinConfiguracion` antes del `DELETE FROM Estudiante` → violación de FK si el estudiante purgado tiene fila LinkedIn. `resetPrograma` y `EstudianteService.hardDeleteMasivo` sí la borran: existen 4 copias divergentes de la misma cascada. El cron dominical (`0 0 3 * * SUN`) disparará el fallo solo. | Unificar la cascada de hard-delete en un único método compartido que incluya `LinkedinConfiguracion`. |
| BE-03 | 🟠 | `excel/ExcelService.java:240-263` | El upsert por `numeroDocumento` es código muerto inalcanzable: la validación previa (L240-242) lanza `BusinessException` si falta email, y esa rama solo corre sin email. La feature "match por documento" está deshabilitada de facto. | Reordenar la validación o eliminar la rama muerta. |
| BE-04 | 🟠 | `excel/ExcelService.java:349-359, 457-460` | Celdas de fecha nativas de Excel llegan como serial numérico ("45000.0"); ningún formato de parseo (`dd/MM/yyyy`, etc.) coincide y el error se traga en silencio (catch vacío) → `fechaNacimiento` queda null sin aviso al usuario. | Detectar `DateUtil.isCellDateFormatted` y convertir el serial a fecha; reportar el error en vez de tragarlo. |
| BE-05 | 🟠 | `matching/MatchingService.java:84-155` | N+1 cuadrático: habilidades (`findByEstudianteId`, L155) y `existsByEstudianteIdAndVacanteId` (L103) se consultan por cada par estudiante×vacante; `tokenize` se recalcula por vacante; `findAll()` (L86) carga también inactivos y los filtra en memoria; todo en una sola transacción larga con `save` individual por match. | Precargar habilidades/tokens por estudiante, consultar matches existentes en bloque, usar `saveAll` y trocear la transacción. |
| BE-06 | 🟡 | `estudiante/EstudianteController.java:76` vs `admin/**` | COORDINADOR puede hacer hard-delete vía `/estudiantes/bulk-delete` (`permanente=true` → `hardDeleteMasivo`) mientras el hard-delete bajo `/admin/**` exige ADMIN. Inconsistencia de privilegios. | Exigir ADMIN para `permanente=true`, o degradar la operación de coordinador a soft-delete. |
| BE-07 | 🟡 | `config/SecurityConfig.java:103-105` | Sin regla URL-level para `/api/v1/admin/**` (la protección depende solo de `@PreAuthorize` en el controller); el filtro JWT traga todas las excepciones sin log → token malformado = anónimo silencioso, sin señal distinguible de 401. | Añadir `requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` como defensa en profundidad; loguear tokens inválidos. |
| BE-08 | 🟡 | `excel/ExcelService.java:159-163, 267` | `new XSSFWorkbook(inputStream)` carga todo el archivo en heap y `MAX_FILAS` se valida **después** de parsear (un archivo enorme se materializa entero antes de rechazarse). Los mensajes de error citan "Fila " + contador acumulado de éxitos+errores, no el índice real de la fila Excel. | Usar lector streaming (SAX/SXSSF) o validar tamaño antes; llevar el índice real de fila en los mensajes. |
| BE-09 | 🟡 | `excel/ExcelService.aplicarActualizacion:381-422` | Reimportar por email un estudiante soft-eliminado actualiza sus datos pero nunca lo reactiva (`activo` queda `false`): queda en la papelera con datos frescos. Probablemente no intencional. | Decidir la semántica: reactivar al reimportar, o rechazar con aviso "está en papelera". |
| BE-10 | 🟡 | `matching/SkillSynonyms.java:71-80` + `matching-synonyms.yml` | Reemplazo in-place sobre el string con sinónimos duplicados entre canónicos (`it`, `ventas`, `sistemas` aparecen bajo dos grupos) → canonicalización dependiente del orden con posible remapeo en cascada; el padding con espacios simples pierde matches de sinónimos multi-palabra adyacentes. | Tokenizar primero y mapear token→canónico sobre la lista, no sobre el string; deduplicar sinónimos en el yml. |
| BE-11 | 🔵 | `config/MatchingConfig.java:30, 42, 49` | Sin validación de pesos (no verifica que sumen 100 ni rangos de umbral); `toInt` devuelve 0 ante un typo silenciosamente; cast sin comprobar de `pesos`. Reimplementa a mano lo que daría `@ConfigurationProperties` + `@Validated`. | Migrar a `@ConfigurationProperties` con `@Validated` y asserts de suma=100. |
| BE-12 | 🔵 | `estudiante/EstudianteRepository.java:59` · `config/PurgeScheduler.java:22-29` | `findByActivoFalseAndDeletedAtBefore` es código muerto (ambas purgas usan JPQL vía `EntityManager`); `PurgeScheduler` inyecta `estudianteRepository` y nunca lo usa. | Usar el método derivado o eliminarlo junto con la inyección. |
| BE-13 | 🔵 | `estudiante/EstudianteService.java:162-163, 169-176` | `toResponse` dereferencia el `Programa` LAZY por fila en el listado paginado → N+1; `softDeleteMasivo` hace load+save en bucle en vez de un `UPDATE` masivo como `softDeleteByProgramaId`. | Fetch-join o proyección en el listado; `UPDATE ... WHERE id IN (:ids)` para el soft-delete masivo. |
| BE-14 | 🔵 | `db/migration/V5__papelera_estudiante.sql` | `deleted_at TIMESTAMP` (sin zona) respaldando un `Instant` de Java; con sesión de BD no-UTC las comparaciones de la purga (30 días) pueden derivar. | Usar `TIMESTAMPTZ` en una migración futura. |
| BE-16 | 🔴 | `scraper/portal/ElempleoScraper.java:33-40` | El scraper de elempleo.com está roto: la URL `/co/busqueda/{keyword}` devuelve **404** y el selector `.offer-card` no existe en el HTML actual del sitio (SPA renderizado por JS). Como es la **única fuente de vacantes**, la tabla `vacante` queda vacía y el matching nunca produce resultados. Detectado en vivo 2026-07-18: 108 estudiantes, 0 vacantes, 0 matches. **Mitigado**: vacantes de prueba sembradas (fuente `MANUAL`) + botón "Ejecutar matching" en la UI; el scraper requiere rehacerse (API interna del portal o fuente alternativa). | Rehacer el scraper contra el HTML/API real del portal, o definir carga manual de vacantes como flujo oficial. |
| BE-15 | 🔵 | `resources/column-synonyms.yml:19-21` | `"Nombre_Completo"` está como sinónimo de `nombre`, pero `ExcelService.MAESTRA_COLUMNS` mapea ese mismo header a `nombreCompleto` (split en nombre+apellido). Un archivo no-maestra con ese header metería el nombre completo en `nombre` sin split. | Mapear `Nombre_Completo` a `nombreCompleto` también en el yml, o aplicar el split en ambas rutas. |

---

## Frontend

| ID | Sev | Ubicación | Hallazgo | Fix sugerido |
|---|---|---|---|---|
| FE-05 | 🔴 | `lib/auth.tsx:78-82` · `middleware.ts:5-16` · `lib/api.ts` | El JWT expira en 15 min pero cookie/localStorage duran 24 h; el middleware solo comprueba **presencia** del token y no hay manejo global de 401 ni refresh. Tras 15 min el usuario queda "autenticado" con todas las llamadas fallando ("Sin permisos") hasta logout manual. El backend define `refresh-expiration-ms` pero no existe endpoint de refresh (ver DOC-09). | Manejar 401 centralmente en `apiFetch` (logout + redirect a `/login`); alinear `max-age` de la cookie con la vida del token; idealmente implementar refresh-token en backend+frontend. |
| FE-01 | 🟠 | `app/configuracion/page.tsx:171-172` | `user?.id` no existe en `AuthUser` — el campo es `usuarioId` (`lib/auth.tsx:23-29`). Error de tipos actualmente oculto por FE-07. | Reemplazar por `user?.usuarioId`. |
| FE-02 | 🟠 | `app/hojas-de-vida/page.tsx:256,263` · `app/power-bi/page.tsx:48` | `<Button asChild>` no existe: el `Button` envuelve **Base UI** (no Radix), que usa la prop `render`. En runtime queda un `<a>` anidado dentro de `<button>` (HTML inválido, problema de hidratación y accesibilidad). | Usar `<Button render={<a href={…} />}>` o estilizar el anchor con `buttonVariants(...)`. |
| FE-03 | 🟠 | `app/layout.tsx:36` | `TooltipProvider delayDuration={200}` — la prop de Base UI se llama `delay` (`components/ui/tooltip.tsx:7-18`); `delayDuration` es el nombre de Radix. | Cambiar a `delay={200}`. |
| FE-04 | 🟠 | `lib/api.ts:54` | `init.body` no existe: `FetchOptions extends Omit<RequestInit, 'body'>` (L29), así que tras el destructuring `init` no tiene `body`. | Quitar el fallback: `body: data !== undefined ? JSON.stringify(data) : undefined`. |
| FE-06 | 🟡 | `front-end/package.json` | Script `"lint": "eslint ."` pero ESLint no está en dependencias ni hay config (`eslint.config.*`): `pnpm lint` siempre falla. | Añadir `eslint` + `eslint-config-next` con flat config, o eliminar el script. |
| FE-07 | 🟡 | `next.config.mjs:2-4` | `typescript.ignoreBuildErrors: true` oculta FE-01…FE-04 (y futuros errores) del build de producción. | Corregir FE-01…04 y quitar la opción para que TypeScript vuelva a ser gate del build. |
| FE-08 | 🟡 | `components/dashboard/activities-card.tsx` · `components/admin/header.tsx:18-114` | "Próximas actividades" y la campana de notificaciones son **siempre mock** presentados como reales (incluye contador de no-leídas falso con punto rojo). El backend sí tiene `/api/v1/notificaciones` sin consumir aquí. | Conectar la campana a `notificacionesApi`; ocultar o marcar como demo la tarjeta de actividades. |
| FE-09 | 🟡 | `app/power-bi/page.tsx` | Página 100% estática que afirma "Informe en tiempo real" y métricas "sincronizadas con el Data Warehouse"; el CTA apunta al genérico `app.powerbi.com` (L49), no a un informe real. | Marcar como "próximamente"/demo o enlazar un informe real embebido. |
| FE-10 | 🟡 | `app/auditoria/page.tsx:27, 127-149` | No existe endpoint de auditoría: la página re-etiqueta `dashboardApi.alerts()` como "registro de auditoría" y la tarjeta "Integridad de Datos" es prosa estática que describe validaciones no verificadas. | Renombrar honestamente la sección (alertas) o implementar un endpoint de auditoría real. |
| FE-11 | 🔵 | `next.config.mjs` (rewrites) vs `lib/api.ts:15-16` | El rewrite `/api/*→backend` (pensado para evitar CORS) nunca se usa: el cliente llama al backend con URL absoluta (`BASE_URL`). Mecanismo muerto y confuso. | Elegir uno: llamadas relativas vía rewrite, o eliminar el rewrite y depender de CORS. |
| FE-12 | 🔵 | `lib/auth.tsx:81` | Token en cookie no-HttpOnly sin `Secure` + copia en localStorage: ambos legibles por cualquier script (robo por XSS). | Preferir cookie HttpOnly+Secure emitida por el backend; como mínimo añadir `Secure`. |
| FE-13 | 🔵 | `components/dashboard/{students-status,students-project,enrollment}-chart.tsx` · `alerts-card.tsx` | Fallback a datos mock cuando `data === null` sin indicador propio en cada componente (solo el banner ámbar de la página): números realistas pueden enmascarar una caída del backend. | Añadir marca visual "datos de ejemplo" por componente o renderizar estado vacío en lugar de mock. |
| FE-14 | 🔵 | `components/admin/header.tsx:77-94` | El buscador del header no tiene `value`/`onChange` ni submit: control decorativo que parece funcional. | Conectarlo a una búsqueda real o eliminarlo. |
| FE-15 | 🔵 | `app/importaciones/page.tsx:8-9` | El JSDoc describe un shape viejo de respuesta (`errores: string[]`); el tipo real es `errores: number` + `erroresDetalle: string[]` y el código lo usa bien — solo el comentario está mal. | Actualizar el comentario. |

---

## Documentación

| ID | Sev | Ubicación | Hallazgo | Fix sugerido |
|---|---|---|---|---|
| DOC-01 | 🟡 | `README.md:38-40` · `docs/architecture/overview.md:8-11, 53-61` | Dicen "Frontend **Angular 17** (localhost:4200)". El front real es **Next.js 16 + React 19** (App Router, pnpm) en puerto 3000. Es el error más engañoso para un dev nuevo. | Reemplazar todas las referencias Angular/4200 por Next.js/3000. |
| DOC-02 | 🟡 | `README.md:30` · `overview.md:327-333` · `endpoints.md:328-334` | Prometen stack Prometheus/Grafana/Loki y endpoints `/actuator/metrics\|prometheus`; docker-compose no tiene esos servicios y actuator solo expone `health,info` (además `/actuator/info` requiere auth; solo `/health` es público). | Quitar las secciones de monitoreo fantasma o marcarlas como "futuro". |
| DOC-03 | 🟡 | `docs/api/endpoints.md:36-39` | `GET /api/v1/programas` documentado con `page`/`size`; el endpoint devuelve `List` plana sin paginación ni params. | Corregir la ficha del endpoint. |
| DOC-04 | 🟡 | `docs/api/endpoints.md:89` | `programaId` documentado como "filtro opcional" en `GET /estudiantes`; en el código es **requerido** (400 si falta, `EstudianteController:37`). | Marcar como requerido. |
| DOC-05 | 🟡 | `README.md` · `endpoints.md` | Sin documentar: los 3 endpoints de Dashboard (`/api/v1/dashboard/summary\|charts\|alerts`, roles COORDINADOR/ADMIN) y `POST /api/v1/estudiantes/bulk-delete` (`{ids, permanente}`). | Añadir ambas secciones. |
| DOC-06 | 🟡 | `endpoints.md:303-309` | Endpoints LinkedIn documentados sin sus query params requeridos: `estudianteId` en los tres, `code` en callback, `credencialId` en compartir. | Completar los params. |
| DOC-07 | 🟡 | `docs/deployment/render-neon.md:11, 54` | Dice "migraciones V1, V2, V3" y sugiere crear "un nuevo archivo `V4__...`"; ya existen V4 y V5. | Actualizar a V1–V5 y sugerir V6 como siguiente. |
| DOC-08 | 🟡 | `endpoints.md:377` · `overview.md:259` · `README.md:98` | Documentan que `restaurar-estudiantes` "restaura desde la papelera"; el código hace lo contrario (BE-01). La doc describe el comportamiento **deseado**: al corregir BE-01 quedará correcta. | Sin cambio de doc; corregir el código (BE-01). |
| DOC-09 | 🟡 | `overview.md:275` · `application.yml:44` | `refresh-expiration-ms` (7 días) definido pero no existe endpoint de refresh (`AuthController` solo tiene `/login`): config muerta sin documentar, raíz del problema FE-05. | Documentar como pendiente o implementar el refresh. |
| DOC-10 | 🔵 | `README.md` | La sección "Empezar" no explica cómo arrancar el front (`cd front-end && pnpm install && pnpm dev`, `NEXT_PUBLIC_API_URL`); path de Swagger inconsistente entre docs (`/swagger-ui/index.html` vs `/swagger-ui.html`); el árbol de paquetes omite `dashboard/`; "GET/POST programas = CRUD" cuando no hay DELETE. | Completar la sección y unificar. |
| DOC-11 | 🔵 | `overview.md:84-99, 164, 267` | La tabla "Tablas del sistema" declara 3 columnas pero las filas tienen 2 (render roto) y omite `usuario_rol`; "42 entradas" de ColumnMapper son 43. | Arreglar la tabla y el conteo. |
| DOC-12 | 🔵 | `application-dev.yml:19` | El perfil `dev` restringe CORS a `http://localhost:4200` únicamente: rompería el front Next en `:3000`. Gotcha sin documentar (agravado por DOC-01). | Añadir `:3000` al perfil dev o documentar que el front requiere el perfil por defecto. |
| DOC-13 | 🔵 | `front-end/README.md:9-45` | Afirma "integración total de todos los endpoints" pero omite la ruta `/power-bi` y no menciona papelera/restauración, `matches/ejecutar` ni notificaciones. | Ajustar la lista de módulos a la realidad. |

---

## Top prioridades

1. **BE-01** — Bug de datos activo: el endpoint de restaurar re-elimina estudiantes y devuelve un conteo engañoso.
2. **BE-02** — Violación de FK latente en la purga: el cron semanal (domingo 03:00) la disparará solo en cuanto haya un estudiante purgable con configuración LinkedIn.
3. **FE-05** — Sesión rota a los 15 minutos sin salida para el usuario (sin manejo de 401 ni refresh).
4. **FE-01…FE-04 + FE-07** — Corregir los 4 errores de tipos y reactivar el gate de TypeScript en el build.
5. **DOC-01 / DOC-02** — Eliminar de la documentación el frontend Angular inexistente y el stack de monitoreo fantasma: es lo que más desorienta a cualquier persona nueva en el proyecto.

> **Nota positiva:** la revisión también confirmó aciertos — enums y contrato Estudiante↔frontend alineados al 100%, guard de zip-bomb y validación de content-type en la importación Excel, `@PreAuthorize` correcto en dashboard/admin/matching, cron y retención de la papelera coherentes con la migración V5, y manejo de errores por página consistente en el front (`ApiCallError` con ramas 401/403/400/409/429).
