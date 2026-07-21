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

**Rate limit:** 5 requests/minuto por IP.

---

## Programas

Base: `/api/v1/programas`

### `GET /api/v1/programas`

Lista programas activos. Público.

**Query params:** `page` (default 0), `size` (default 20)

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

## Estudiantes

Base: `/api/v1/estudiantes`

### `GET /api/v1/estudiantes`

Lista estudiantes paginados. `@PreAuthorize COORDINADOR, ADMIN`

**Query params:** `page`, `size`, `programaId` (filtro opcional)

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

## Importación Excel

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

Base: `/api/v1/linkedin`

**Nota:** Esta funcionalidad requiere crear una app en LinkedIn Developer Portal. Actualmente en desarrollo.

### `GET /api/v1/linkedin/auth-url`

Obtiene URL de OAuth de LinkedIn.

### `POST /api/v1/linkedin/callback`

Callback de OAuth de LinkedIn.

### `POST /api/v1/linkedin/compartir`

Comparte credencial en LinkedIn.

---

## Credencial (Thymeleaf — público)

### `GET /credencial/{uuid}`

Página pública de verificación de credencial digital. Renderizada con Thymeleaf.

- Si el UUID existe y la credencial es válida: muestra datos del certificado (`credencial-valida.html`)
- Si no: muestra mensaje de invalidez (`credencial-invalida.html`)

---

## Actuator

| Ruta | Descripción |
|------|-------------|
| `GET /actuator/health` | Health check |
| `GET /actuator/metrics` | Métricas Prometheus |
| `GET /actuator/info` | Info de la aplicación |

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

Elimina físicamente estudiantes con más de 30 días en la papelera y todas sus dependencias. `@PreAuthorize ADMIN`

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
