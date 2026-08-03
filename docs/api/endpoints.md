# API Endpoints — NOVA CRM

## Autenticación

### `POST /api/v1/auth/login`

Login de usuario, devuelve JWT.

**Request body:**
```json
{
  "email": "admin@novacrm.com",
  "password": "admin123"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "usuarioId": "uuid",
  "email": "admin@novacrm.com",
  "nombre": "Administrador del Sistema",
  "roles": ["ADMIN"]
}
```

**Errores:**

| Código | Cuándo | Cuerpo |
|---|---|---|
| `400` | El email no tiene forma de email, o falta un campo | `VALIDATION_ERROR` con el detalle por campo |
| `401` | Correo desconocido, contraseña incorrecta o cuenta desactivada | `UNAUTHORIZED` — mismo mensaje en los tres casos, para no permitir enumerar cuentas |
| `429` | Más de 5 intentos por minuto desde la misma IP | — |

Los tres fracasos de credenciales devolvían `400` hasta agosto de 2026, porque
los lanzaba una `BusinessException`. El navegador no podía distinguirlos del
`400` de validación y la pantalla de login enseñaba «El servidor respondió con
un error (400). Intenta más tarde» a quien solo se había equivocado de
contraseña.

**Rate limit:** 5 requests/minuto por IP.

### `POST /api/v1/auth/refresh`

Renueva el access token con un refresh token. `LoginResponse` de nuevo (token, usuarioId, email, nombre, roles).

Un refresh token inválido o vencido responde `401` (antes `400`).

**Request body:**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }
```

### `POST /api/v1/auth/forgot-password`

Solicita enlace de recuperación de contraseña. Respuesta idéntica exista o no el correo (evita enumeración de usuarios).

### `POST /api/v1/auth/reset-password`

Restablece la contraseña con el token recibido por correo.

---

## Programas

Base: `/api/v1/programas`

### `GET /api/v1/programas`

Lista programas activos. Público.

**Sin paginación:** devuelve la lista completa (`List<ProgramaResponse>`), no soporta `page`/`size`.

### `GET /api/v1/programas/{id}`

Obtiene programa por ID. Público.

### `POST /api/v1/programas`

Crea programa. `@PreAuthorize COORDINADOR, ADMIN`

**Request body:**
```json
{
  "nombre": "string",
  "descripcion": "string",
  "duracionDias": 0,
  "fechaInicio": "2026-01-01",
  "fechaFin": "2026-06-30",
  "estado": "BORRADOR"
}
```

### `PUT /api/v1/programas/{id}`

Actualiza programa. `@PreAuthorize COORDINADOR, ADMIN`

### `PATCH /api/v1/programas/{id}/estado`

Cambia estado del programa. `@PreAuthorize COORDINADOR, ADMIN`

**Request body:**
```json
{
  "nuevoEstado": "ACTIVO"
}
```

Estados: `BORRADOR → ACTIVO → FINALIZADO → ARCHIVADO`

---

## Plataformas

Base: `/api/v1/plataformas`

Catálogo de plataformas externas (ELL, Pearson, Q10, Test Hub…). Tres capas:
1. **Catálogo**: qué plataformas existen (Configuración). `@PreAuthorize COORDINADOR, ADMIN`
2. **Por programa**: qué ofrece cada programa (Proyectos → pestaña Plataformas). `@PreAuthorize COORDINADOR, ADMIN`
3. **Por estudiante**: qué tiene cada estudiante, solo dentro de lo que ofrece su programa (ficha del estudiante). `@PreAuthorize COORDINADOR, ADMIN`

Eliminar es **desactivar** (borrado suave): la plataforma deja de ofrecerse y de aparecer en el portal, pero las asignaciones existentes no se tocan.

### `GET /api/v1/plataformas`

Catálogo de plataformas activas, ordenado por nombre.

### `POST /api/v1/plataformas`

Crea plataforma. Código único. `@PreAuthorize COORDINADOR, ADMIN`

**Request body:**
```json
{
  "codigo": "ELL",
  "nombre": "ELL Technologies",
  "url": "https://learn.elltechnologies.com/login",
  "iconoUrl": "https://…/logo.png"
}
```

### `PUT /api/v1/plataformas/{id}`

Actualiza nombre, enlace e imagen. Rechaza código duplicado. `@PreAuthorize COORDINADOR, ADMIN`

### `DELETE /api/v1/plataformas/{id}`

Desactiva (borrado suave). No borra asignaciones. `@PreAuthorize COORDINADOR, ADMIN`

### `GET /api/v1/plataformas/programa/{programaId}`

Plataformas visibles en un programa (las que su cohorte puede recibir).

### `PUT /api/v1/plataformas/programa/{programaId}`

Asigna el conjunto completo al programa (reemplazo total). Solo acepta plataformas activas del catálogo. Devuelve la lista resultante.

**Request body:**
```json
{
  "plataformaIds": ["uuid-1", "uuid-2"]
}
```

### `GET /api/v1/plataformas/estudiante/{estudianteId}`

Plataformas asignadas a un estudiante (incluye las desactivadas, para que el equipo pueda ver el historial completo).

### `PUT /api/v1/plataformas/estudiante/{estudianteId}`

Asigna el conjunto completo al estudiante (reemplazo total). Rechaza plataformas que el programa del estudiante no ofrezca. Devuelve la lista resultante.

**Request body:** igual que programa.

### `GET /api/v1/plataformas/mias`

Plataformas activas asignadas al estudiante autenticado. `@PreAuthorize ESTUDIANTE, COORDINADOR, ADMIN`

---

## Estudiantes

Base: `/api/v1/estudiantes`

### `GET /api/v1/estudiantes`

Lista estudiantes paginados. `@PreAuthorize COORDINADOR, ADMIN`

**Query params:** `page`, `size`, `programaId` (**requerido** — 400 si falta)

### `GET /api/v1/estudiantes/{id}`

Obtiene estudiante por ID. `@PreAuthorize COORDINADOR, ADMIN`

### `POST /api/v1/estudiantes`

Crea estudiante. `@PreAuthorize COORDINADOR, ADMIN`

**Request body:**
```json
{
  "nombre": "string",
  "apellidos": "string",
  "email": "string",
  "tipoDocumento": "CC",
  "numeroDocumento": "string",
  "programaId": "uuid"
}
```

### `PUT /api/v1/estudiantes/{id}`

Actualiza estudiante. `@PreAuthorize COORDINADOR, ADMIN, ESTUDIANTE`

### `DELETE /api/v1/estudiantes/{id}`

Eliminación lógica (soft-delete → papelera). `@PreAuthorize COORDINADOR, ADMIN`

### `GET /api/v1/estudiantes/papelera`

Lista estudiantes en la papelera (activo=false, ordenados por deleted_at DESC). `@PreAuthorize COORDINADOR, ADMIN`

**Query params:** `programaId`, `page`, `size`

**Response 200:**
```json
{
  "content": [
    {
      "id": "uuid",
      "nombre": "Juan",
      "email": "juan@email.com",
      "activo": false,
      "deletedAt": "2026-07-15T10:30:00Z",
      ...
    }
  ],
  "totalElements": 5
}
```

### `POST /api/v1/estudiantes/{id}/restaurar`

Restaura un estudiante de la papelera (activo=true, deleted_at=null). `@PreAuthorize COORDINADOR, ADMIN`

### `POST /api/v1/estudiantes/bulk-delete`

Eliminación masiva. `@PreAuthorize COORDINADOR, ADMIN` — pero `permanente=true` exige **ADMIN** (COORDINADOR solo puede hacer soft-delete masivo; `403` si intenta hard-delete).

**Request body:**
```json
{
  "ids": ["uuid", "uuid"],
  "permanente": false
}
```

**Response:** `204 No Content`

---

## Dashboard

Base: `/api/v1/dashboard` · `@PreAuthorize` a nivel de clase: `COORDINADOR, ADMIN`

### `GET /api/v1/dashboard/summary`

KPIs agregados (total estudiantes, activos, graduados, retirados, docs. pendientes, etc.). Sin query params.

### `GET /api/v1/dashboard/charts`

Series para los gráficos del dashboard (distribución por estado, histórico de ingresos, estudiantes por proyecto). Sin query params.

### `GET /api/v1/dashboard/alerts`

Alertas activas (estudiantes con datos faltantes, vacantes por vencer, etc.). Sin query params.

---

## Vacantes

Base: `/api/v1/vacantes`

### `GET /api/v1/vacantes`

Lista vacantes activas. **Público** (no requiere autenticación).

**Query params:** `page`, `size`

### `GET /api/v1/vacantes/{id}`

Obtiene vacante por ID. **Público.**

---

## Matching

El motor evalúa 5 criterios (afinidad 35%, habilidades 10%, inglés 20%, ubicación 15%, experiencia 20%) usando un tokenizador con sinónimos técnico-laborales (`SkillSynonyms`). Pesos y umbral configurables via `matching-config.yml`. Al generar matches, se crean notificaciones automáticas para los estudiantes.

Base: `/api/v1/matches`

### `GET /api/v1/matches`

Obtiene matches de un estudiante. `@PreAuthorize COORDINADOR, ADMIN, ESTUDIANTE`

**Query params:** `estudianteId` (UUID del estudiante)

**Response 200:**
```json
{
  "content": [
    {
      "id": "uuid",
      "estudianteId": "uuid",
      "vacanteId": "uuid",
      "puntaje": 85.50,
      "notificado": false,
      "postulado": false
    }
  ],
  "totalElements": 1
}
```

### `GET /api/v1/matches/pendientes`

Cuenta matches con notificaciones pendientes. `@PreAuthorize COORDINADOR, ADMIN, ESTUDIANTE`

**Query params:** `estudianteId`

**Response 200:**
```json
{
  "pendientes": 3
}
```

### `PATCH /api/v1/matches/{matchId}/postular`

Marca un match como postulado (el estudiante aplicó a la vacante). `@PreAuthorize COORDINADOR, ADMIN, ESTUDIANTE`

**Path params:** `matchId` (UUID del match)

**Response:** `200 OK` (sin cuerpo)

### `POST /api/v1/matches/ejecutar`

Ejecuta el matching bajo demanda para todos los estudiantes activos contra vacantes activas. `@PreAuthorize COORDINADOR, ADMIN`

**Response 200:**
```json
{
  "matchesCreados": 12
}
```

---

## Certificaciones

Base: `/api/v1/certificaciones`

### `GET /api/v1/certificaciones`

Lista certificaciones por programa. **Público.**

**Query params:** `programaId`

### `GET /api/v1/certificaciones/{id}`

Obtiene certificación por ID. **Público.**

---

## Notificaciones

Base: `/api/v1/notificaciones`

### `GET /api/v1/notificaciones`

Lista notificaciones de un estudiante. `@PreAuthorize COORDINADOR, ADMIN, ESTUDIANTE`

**Query params:** `estudianteId`

### `GET /api/v1/notificaciones/no-leidas`

Cuenta notificaciones no leídas. `@PreAuthorize COORDINADOR, ADMIN, ESTUDIANTE`

**Query params:** `estudianteId`

### `PUT /api/v1/notificaciones/{id}/leer`

Marca notificación como leída. `@PreAuthorize COORDINADOR, ADMIN, ESTUDIANTE`

---

## Configuración

### `GET /api/v1/configuracion`

Configuración de la instalación: identidad de la institución y parámetros de operación.
`@PreAuthorize isAuthenticated()`

Una sola fila para todo el CRM (`configuracion_global`, `id = 1`). Vivía en `localStorage`
bajo `nova_inst_config` y `nova_acad_config`, así que cada navegador tenía su propia
versión del NIT y de la sede, y todo se perdía al limpiar la caché.

Si nadie ha guardado nada, responde los valores por defecto con `guardado: false` y los
campos de texto vacíos: no se siembra un NIT ni una resolución de ejemplo, que en la base
parecerían datos reales de la institución.

**Response 200:**
```json
{
  "nombreOficial": null, "nit": null, "registroEducativo": null, "sedePrincipal": null,
  "telefonoContacto": null, "whatsappSoporte": null,
  "emailContacto": null, "emailSoporte": null,
  "sitioWeb": null, "linkedinUrl": null, "instagramUrl": null,
  "cohorteActiva": null,
  "umbralMatchMinimo": 55, "diasRetencionPapelera": 30,
  "guardado": false, "actualizadoEn": null,
  "umbralPorDefecto": 55, "diasRetencionPorDefecto": 30
}
```

`umbralPorDefecto` y `diasRetencionPorDefecto` viajan aparte para que la pantalla pueda
decir de dónde sale el número cuando nadie lo ha tocado: es la diferencia entre «el corte
está en 55» y «el corte está en 55 porque lo dice `matching-config.yml`».

### `PUT /api/v1/configuracion`

Guarda la configuración. `@PreAuthorize COORDINADOR, ADMIN`

El cuerpo va entero (mismo cuerpo que la respuesta, sin los campos derivados): mandar solo
lo cambiado obligaría a distinguir «no lo toqué» de «lo borré», que con campos opcionales
es justo lo que se confunde. Cada panel de la pantalla reenvía los campos que no edita tal
y como los recibió.

| Situación | Código | Detalle |
|---|---|---|
| Guardado | `200` | Devuelve la configuración ya aplicada |
| `umbralMatchMinimo` fuera de 0–100, o `diasRetencionPapelera` fuera de 1–365 | `400` | `BUSINESS_ERROR`, con **todos** los motivos en el mismo mensaje |
| Sin rol COORDINADOR ni ADMIN | `403` | — |

**Los dos números mandan de verdad**, que era el problema:

- `umbralMatchMinimo` lo lee `MatchingService.ejecutarMatching()` en cada corrida. Antes
  el motor leía siempre `umbral_minimo` de `matching-config.yml` mientras la pantalla
  ofrecía editar el valor y arrancaba en 70: subirlo a 80 no cambiaba ni un match. `null`
  vuelve a delegar en el YAML.
- `diasRetencionPapelera` lo lee `DELETE /api/v1/admin/purgar-papelera`. Antes eran 30 días
  escritos en el código, así que subirlos a 90 no salvaba ninguna ficha del borrado del
  día 31.

Solo afecta a los matches que se calculen a partir de ese momento; los ya existentes
conservan el puntaje y el desglose con que se crearon, y su `configVersion` registra el
umbral que se usó.

### `GET /api/v1/configuracion/integraciones`

Estado real de cada integración externa: IA, fuentes de vacantes, correo saliente y
almacenamiento. `@PreAuthorize ADMIN`

**Nunca devuelve credenciales, ni enmascaradas.** Solo dice si están puestas, en qué
variable de entorno se ponen y los datos no sensibles (proveedor, modelo, bucket, cupo
restante). La pantalla de configuración ofrecía campos para escribir las claves de Groq,
WhatsApp y JSearch y las guardaba en `localStorage` —texto plano legible por cualquier
script inyectado— sin que el backend llegara a verlas nunca, porque se leen del entorno
al arrancar.

**Response 200:**
```json
[
  { "id": "ia", "nombre": "Asistencia de IA", "categoria": "Reconocimiento",
    "configurada": true, "resumen": "Reconoce hojas y columnas que...",
    "detalles": [{ "etiqueta": "Modelo", "valor": "llama-3.3-70b-versatile" }],
    "variablesEntorno": ["GROQ_API_KEY", "GROQ_MODELO"],
    "probable": true, "advertencia": "La IA solo sugiere: ..." }
]
```

### `POST /api/v1/configuracion/integraciones/{id}/probar`

Prueba de conexión en vivo. `@PreAuthorize ADMIN`

Solo para lo que se puede comprobar sin efectos (`ia`). Las fuentes con cupo no se
prueban —gastar una de las 200 peticiones mensuales de JSearch para saber que la clave
sirve es justo lo que el panel intenta cuidar— y el correo tampoco, porque una prueba
real implica mandarle un mensaje a alguien.

---

## Importación Excel

### `POST /api/v1/importar/libro`

Importa un libro completo con varias hojas en una sola subida. `@PreAuthorize COORDINADOR, ADMIN`

Es lo que hace falta para el archivo de seguimiento que usa el equipo, que trae siete
pestañas. Los otros tres endpoints leen `getSheetAt(0)` y dan por hecho que la cabecera
es la primera fila; con ese archivo eso significa abrir el tablero de indicadores y
fallar con «no se reconoció ninguna columna».

Cada hoja se clasifica por el vocabulario de sus títulos y se manda a su destino:

| Destino | Qué escribe | Cómo identifica a la persona |
|---|---|---|
| `Participantes` | **Actualiza**, no da de alta | nombre completo |
| `Empresas` | crea o actualiza por nombre | — |
| `Postulaciones` | crea; no duplica las ya anotadas | nombre completo |
| `Colocaciones` | una vigente por participante | documento, correo o nombre completo |

La hoja de participantes **no crea a nadie**: no trae correo, y `Estudiante.email` es
obligatorio y único. Inventar uno rompería el acceso del estudiante y sus avisos, así que
los nombres desconocidos se informan fila por fila.

La cabecera se busca en las primeras 15 filas eligiendo la que más títulos reconocibles
aporta —no la primera con varias celdas, que suele ser una banda de grupos («DATOS DEL
PARTICIPANTE»)—. Se toleran columnas en blanco intercaladas, títulos repetidos (gana la
primera columna) y la fila de leyenda que va justo debajo de la cabecera.

**Request:** `multipart/form-data` con campo `archivo` (.xlsx o .xls) y `simular` (bool,
default `false`). Con `simular=true` corre las mismas validaciones sin escribir nada.

**Response 200:**
```json
{
  "simulacion": true,
  "hojas": [
    { "nombre": "Dashboard", "destino": null, "detalle": null,
      "motivo": "Parece participantes pero le falta la columna que identifica al participante" },
    { "nombre": "Perfiles Empleabilidad", "destino": "Participantes", "motivo": null,
      "detalle": { "simulacion": true, "filasLeidas": 107, "creados": 0, "actualizados": 107,
                   "omitidos": 0, "errores": [], "columnasReconocidas": [] } }
  ]
}
```

Las hojas que no se importan se informan con su motivo en vez de desaparecer: una hoja
omitida en silencio es indistinguible de una importada vacía.

### `POST /api/v1/importar`

Importa estudiantes desde archivo Excel con detección dinámica de columnas mediante `ColumnMapper` (sinónimos en `column-synonyms.yml`). Soporta formatos BBDD, Base Maestra y cualquier formato nuevo. Deduplicación por email y número de documento. `@PreAuthorize COORDINADOR, ADMIN`

**Request:** `multipart/form-data` con campo `archivo` (.xlsx)

**Response 200:**
```json
{
  "importados": 25,
  "errores": 1,
  "totalFilas": 30,
  "columnasDetectadas": ["Nombre_Completo", "Correo", "Documento"],
  "columnasMapeadas": {
    "Nombre_Completo": "nombre",
    "Correo": "email",
    "Documento": "numeroDocumento"
  },
  "columnasSinMapeo": ["Comentarios"],
  "erroresDetalle": ["Fila 3: Email vacío o no encontrado en la fila"]
}
```

- `columnasMapeadas`: mapeo columna → campo de entidad (incluye detección dinámica por sinónimos)
- `columnasSinMapeo`: headers que no se pudieron mapear automáticamente

---

## LinkedIn

**No implementado como API todavía.** Solo existe la entidad `LinkedinConfiguracion` (paquete `com.novacrm.linkedin`); no hay ningún `@RestController` bajo `/api/v1/linkedin/*` en el backend actual ni llamadas a esa ruta desde el frontend. Los endpoints de OAuth/compartir que documentaba esta sección no existen hoy — quedan pendientes de implementar.

---

## Credencial (Thymeleaf — público)

### `GET /credencial/{uuid}`

Página pública de verificación de credencial digital. Renderizada con Thymeleaf.

- Si el UUID existe y la credencial es válida: muestra datos del certificado (`credencial-valida.html`)
- Si no: muestra mensaje de invalidez (`credencial-invalida.html`)

---

## Actuator

Solo `health` e `info` están expuestos (`management.endpoints.web.exposure.include: health,info`); no hay endpoint de métricas Prometheus (ni la dependencia `micrometer-registry-prometheus`, ni Prometheus/Grafana/Loki en `docker-compose.yml` — ver nota en el README).

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `GET /actuator/health` | Público | Health check |
| `GET /actuator/info` | Requiere autenticación | Info de la aplicación |

---

## Admin (solo ADMIN)

Base: `/api/v1/admin`

### `DELETE /api/v1/admin/programas/{programaId}/estudiantes`

Soft delete masivo: desactiva todos los estudiantes activos de un programa. Las relaciones (matches, notificaciones, habilidades) se conservan.

**Response 200:**
```json
{
  "eliminados": 15,
  "tipo": "soft-delete"
}
```

### `DELETE /api/v1/admin/programas/{programaId}/reset`

Hard delete: elimina físicamente estudiantes + matches + notificaciones + habilidades + certificaciones + linkedin configs de un programa. Irreversible.

**Response 200:**
```json
{
  "estudiantesEliminados": 15,
  "tipo": "hard-delete"
}
```

### `DELETE /api/v1/admin/cleanup`

Vacía todo el sistema transaccional: estudiantes, vacantes, matches, notificaciones, habilidades, certificaciones, credenciales y configuraciones LinkedIn. Deja intactos programas, empresas, catálogos y usuarios. Solo para reset completo del entorno.

**Response 200:**
```json
{
  "mensaje": "Sistema transaccional limpiado exitosamente"
}
```

### `POST /api/v1/admin/programas/{programaId}/restaurar-estudiantes`

Restaura todos los estudiantes de un programa desde la papelera. `@PreAuthorize ADMIN`

**Response 200:**
```json
{
  "mensaje": "Estudiantes restaurados del programa uuid",
  "estudiantesRestaurados": 15
}
```

### `DELETE /api/v1/admin/purgar-papelera`

Elimina físicamente los estudiantes que pasaron el plazo de retención y todas sus
dependencias. `@PreAuthorize ADMIN`

El plazo sale de `diasRetencionPapelera` (ver `GET /api/v1/configuracion`); son 30 días si
nadie lo ha configurado. Estaba clavado en 30 en el código mientras la pantalla ofrecía
cambiarlo. `retencion` devuelve el plazo que se acaba de aplicar de verdad, no una
constante.

**Response 200:**
```json
{
  "eliminados": 8,
  "tipo": "hard-delete",
  "retencion": "30 dias"
}
```

---

## Esquemas comunes

### LoginRequest
| Campo | Tipo | Descripción |
|-------|------|-------------|
| email | String | Email del usuario |
| password | String | Contraseña |

### LoginResponse
| Campo | Tipo | Descripción |
|-------|------|-------------|
| token | String | JWT (Bearer) |
| usuarioId | UUID | ID del usuario |
| email | String | Email |
| nombre | String | Nombre completo |
| roles | Array[String] | Roles: ADMIN, COORDINADOR, ESTUDIANTE |

### ProgramaRequest
| Campo | Tipo | Descripción |
|-------|------|-------------|
| nombre | String | Nombre |
| descripcion | String | Descripción |
| duracionDias | Integer | Duración |
| fechaInicio | LocalDate | Inicio |
| fechaFin | LocalDate | Fin |
| estado | ProgramaEstado | BORRADOR, ACTIVO, FINALIZADO, ARCHIVADO |

### EstudianteRequest
| Campo | Tipo | Descripción |
|-------|------|-------------|
| nombre | String | Nombres |
| apellidos | String | Apellidos |
| email | String | Email |
| tipoDocumento | String | CC, CE, NIT, PASAPORTE |
| numeroDocumento | String | Número |
| telefono | String | Teléfono |
| celular | String | Celular |
| programaId | UUID | Programa asignado |
| nivelInglesId | UUID | Nivel de inglés |
