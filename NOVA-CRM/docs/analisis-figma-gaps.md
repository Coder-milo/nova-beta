# Análisis: diseño Figma Make vs implementación actual

> **Fuente:** `Create it (Copy)` (Figma Make) — 14 pantallas + especificación original (`academia-cac-admin-app.md`, 969 líneas) + modelo de datos (`mock.ts`).
> **Comparado contra:** backend `back-end` (d038210) y front `front-end` (30d9bc6).
> **Fecha:** 2026-07-21

## Resumen ejecutivo

El diseño describe una plataforma de gestión académica cuyo **corazón es la generación de hojas de vida** (plantillas institucionales + generación masiva + extracción desde PDF), con proyectos enriquecidos, perfil profundo de estudiante, documentos con versiones, seguimientos y auditoría real. El backend actual cubre bien el CRUD básico (estudiantes, programas, importación simple, dashboard, matching), pero **faltan 6 módulos completos** y varios campos/filtros. El front tiene 11 rutas pero 5 de ellas muestran contenido distinto (o mock) de lo que el diseño exige.

Nota importante: el diseño **no contempla** vacantes/matching — esa feature ya construida es un extra valioso que hay que conservar (sugerencia: mover a `/vacantes` y liberar `/hojas-de-vida` para su propósito real).

---

## A) Endpoints que faltan en el backend

### A1. Proyectos (ampliar `ProgramaController`) — prioridad ALTA
| Falta | Detalle |
|---|---|
| Campos en entidad | `cliente`, `responsable`, `observaciones`, `porcentajeAvance` (o derivado de fechas) |
| Estados | Diseño: Planeación / Activo / En ejecución / Pausado / Finalizado / Cancelado — hoy: BORRADOR / ACTIVO / FINALIZADO / ARCHIVADO. Ampliar enum o mapear |
| `DELETE /api/v1/programas/{id}` | Con confirmación (soft-delete recomendado) |
| `GET /api/v1/programas` con filtros + paginación | nombre, cliente, estado, responsable, fechas — hoy devuelve `List` sin params |
| `GET /api/v1/programas/{id}/resumen` | Indicadores del proyecto: total/activos/graduados/retirados, info incompleta, HVs generadas |
| `PATCH /api/v1/estudiantes/{id}/programa` | "Vincular estudiante" existente a un proyecto |

### A2. Estudiantes (ampliar) — prioridad ALTA
| Falta | Detalle |
|---|---|
| `GET /api/v1/estudiantes` con filtros avanzados | Hoy solo `programaId`. Diseño pide: búsqueda por nombre/documento, ciudad, estado, programa, empresa, fechas — sin exigir proyecto |
| Campos | `direccion`, `fotoUrl`; `porcentajeCompletitud` (derivado) en el response |
| `POST /api/v1/estudiantes/{id}/foto` | Upload a MinIO (ya configurado) |
| CRUD `/api/v1/estudiantes/{id}/formaciones` | Formación adicional múltiple: tipo (técnica/tecnológica/universitaria/especialización/curso/diplomado/idioma), institución, programa, fechas, estado, certificado adjunto |
| CRUD `/api/v1/estudiantes/{id}/experiencias` | Empresa, cargo, fechas, funciones, relacionada, empleo actual |
| Campos profesionales | competencias, idiomas, referencias, disponibilidad (columnas o colecciones) |
| `GET /api/v1/estudiantes/export?formato=xlsx\|pdf` | Exportación del listado con filtros |

### A3. Hojas de vida — MÓDULO NUEVO COMPLETO, prioridad MÁXIMA (corazón del diseño)
| Falta | Detalle |
|---|---|
| CRUD `/api/v1/plantillas-hv` | Subir plantilla (PDF/compatible), nombre, visualizar, `PATCH {id}/predeterminada`, versiones anteriores |
| `POST /api/v1/hojas-de-vida/generar` | Individual (`estudianteId`), selección (`ids[]`), por proyecto (`programaId`), todos los completos — job con progreso |
| `GET /api/v1/hojas-de-vida/jobs/{id}` | Estado/progreso/resultados de la generación masiva (listos, incompletos, errores) |
| `GET /api/v1/estudiantes/{id}/hojas-de-vida` | Versiones generadas, marcar versión actual |
| `GET /api/v1/hojas-de-vida/{id}/pdf` · `POST /descargar-zip` | Descarga individual y masiva comprimida |
| `POST /api/v1/hojas-de-vida/extraer` | Subir HV en PDF → parsing → campos detectados con nivel de confianza → confirmar y volcar al perfil (evitando duplicados) |
| Nota | `hvsPorGenerar` del dashboard hoy está hardcodeado en 0 — este módulo lo alimenta |

### A4. Documentos — MÓDULO NUEVO, prioridad ALTA (MinIO ya está configurado sin usar)
| Falta | Detalle |
|---|---|
| `POST /api/v1/documentos` | Multipart a MinIO: estudianteId/programaId, tipo (HV original, HV institucional, certificado CAC, certificado externo, foto, doc. identidad, otros) |
| `GET /api/v1/documentos` | Filtros: estudiante, proyecto, tipo, fecha, búsqueda |
| `GET /{id}/descargar` · `PUT /{id}` (reemplazo) · `DELETE /{id}` · `GET /{id}/versiones` | Ciclo completo con historial de versiones |
| Nota | `documentosPendientes` del dashboard hoy hardcodeado en 0 — este módulo lo alimenta |

### A5. Seguimientos e historial — MÓDULO NUEVO, prioridad MEDIA
| Falta | Detalle |
|---|---|
| CRUD `/api/v1/estudiantes/{id}/seguimientos` | Fecha, tipo, responsable, observación, próxima acción + fecha, estado, adjuntos |
| `GET /api/v1/estudiantes/{id}/historial` | Timeline: cambios de estado, documentos cargados, HVs generadas, seguimientos, con usuario y fecha |

### A6. Auditoría real — MÓDULO NUEVO, prioridad MEDIA
| Falta | Detalle |
|---|---|
| Registro transversal | Aspect/listener que persista: fecha, usuario, módulo, acción, entidad, registro, valores anterior/nuevo (JSON), IP |
| `GET /api/v1/auditoria` | Filtros: usuario, fecha, módulo, acción, proyecto, estudiante; paginado |
| `GET /api/v1/auditoria/{id}` | Detalle con diff antes/después |

### A7. Importaciones avanzadas — prioridad MEDIA
| Falta | Detalle |
|---|---|
| `POST /api/v1/importar/preview` | Dry-run: válidos, errores, duplicados, nuevos vs actualizados, obligatorios faltantes + descarga de errores. Hoy importa directo sin previsualizar |
| Mapeo de columnas expuesto | `ColumnMapper` ya existe pero es interno/automático: exponer sugerencia de mapeo y aceptar mapeo confirmado por el usuario |
| Opciones de importación | Solo nuevos / actualizar existentes / omitir duplicados / preservar valores actuales |
| `GET /api/v1/importaciones` | Historial: fecha, usuario, archivo, resultados |
| Destinos adicionales | Importar proyectos, formación y experiencias (hoy solo estudiantes) |

### A8. Reportes exportables — prioridad MEDIA
| Falta | Detalle |
|---|---|
| `GET /api/v1/reportes/{tipo}/export?formato=xlsx\|pdf` | Tipos: proyecto, estudiantes, académico, empleabilidad, formación, empresas, ciudades, certificaciones, incompletos. POI ya está en el pom para xlsx |
| Charts adicionales en `/dashboard/charts` | Estudiantes por ciudad, formación académica, proyectos por estado |

### A9. Autenticación — prioridad ALTA (rápido)
| Falta | Detalle |
|---|---|
| `POST /api/v1/auth/forgot-password` · `POST /api/v1/auth/reset-password` | La spec dedica una pantalla completa; SES ya está configurado para el correo |
| `POST /api/v1/auth/refresh` | Ya detectado en el registro (DOC-09/FE-05): `refresh-expiration-ms` existe sin endpoint |

### A10. Configuración y catálogos — prioridad BAJA-MEDIA
| Falta | Detalle |
|---|---|
| CRUD `/api/v1/usuarios` (+ asignación de roles) | Solo existe el seed admin |
| Catálogos CRUD | Ciudades, tipos de documento, tipos de formación, estados configurables (hoy enums hardcoded) |
| `GET/PUT /api/v1/configuracion/academia` | Datos institucionales |

### A11. Otros
| Falta | Detalle |
|---|---|
| `GET /api/v1/buscar?q=` | Buscador global del topbar (estudiantes + proyectos + documentos) |
| CRUD `/api/v1/programas/{id}/actividades` | "Próximas actividades" del dashboard y tab del proyecto (entidad Actividad no existe) |
| Notificaciones del admin | Las actuales son por estudiante (matching); el topbar del diseño espera notificaciones administrativas |
| Power BI | Estado de conexión/sincronizaciones — o mantener la página como informativa honesta |

---

## B) Qué falta en el front por diseñar/implementar

| # | Pantalla del diseño | Estado actual | Gap |
|---|---|---|---|
| 1 | **Detalle de proyecto** (`/proyectos/[id]`) con tabs Resumen · Estudiantes · Documentos · Hojas de vida · Actividades · Historial | No existe | Página completa nueva |
| 2 | Formulario de proyecto completo | Form básico (sin cliente, responsable, observaciones) | Ampliar |
| 3 | **Perfil de estudiante** como página (`/estudiantes/[id]`) con 9 tabs, foto, % completitud, alertas de faltantes | Drawer con 4 tabs | Página nueva (el drawer puede quedar como vista rápida) |
| 4 | **Formulario de estudiante multi-paso** (6 pasos: personal, académica, formación, experiencia, profesional, documentos; borrador + autosave) | Form plano en modal/página | Rediseño completo |
| 5 | **Hojas de vida real**: 3 procesos (manual, extracción PDF con vista dividida, plantilla institucional) + asistente de generación masiva con progreso | La ruta muestra **vacantes/matching** | Módulo nuevo; mover vacantes a `/vacantes` |
| 6 | **Asistente de importación** 6 pasos (archivo → destino → mapeo → validación → confirmación → resultado) | Upload directo simple | Rediseño |
| 7 | **Documentos** con upload, preview, versiones, filtros | Lista certificaciones (otra cosa) | Módulo nuevo |
| 8 | **Auditoría** con tabla real y diff antes/después | Re-etiqueta alertas del dashboard (FE-10) | Módulo nuevo |
| 9 | **Recuperación de contraseña** (2 pantallas) | No existe | Nuevo |
| 10 | **Configuración funcional** (usuarios, roles, catálogos, plantillas HV) | Página estática | Rediseño |
| 11 | Buscador global + notificaciones reales en topbar | Buscador eliminado; campana mock (FE-08) | Conectar a endpoints nuevos |
| 12 | Próximas actividades del dashboard | Mock permanente | Conectar a entidad nueva |

**Ya cubierto y alineado** ✓: Login, Dashboard (KPIs + 4 charts), listado de proyectos (cards), listado de estudiantes con filtros/selección múltiple/papelera, importación básica, reportes con gráficos (falta export server-side).

---

## C) Orden de implementación sugerido

1. **A9 auth** (forgot/reset + refresh) — pequeño, desbloquea UX crítica ya registrada (FE-05)
2. **A1 + B1/B2 proyectos enriquecidos + detalle** — base de navegación de todo lo demás
3. **A4 + B7 documentos** — MinIO ya está listo; alimenta dashboard y perfil
4. **A2 + B3/B4 estudiante profundo** (formación, experiencia, foto, perfil, form multi-paso)
5. **A3 + B5 hojas de vida** (plantillas → generación individual → masiva → extracción PDF al final, es lo más complejo)
6. **A7 + B6 importación avanzada** (preview/mapeo sobre el ColumnMapper existente)
7. **A6 + B8 auditoría** · **A8 reportes export** · **A11 buscador/actividades** · **A10 configuración**
