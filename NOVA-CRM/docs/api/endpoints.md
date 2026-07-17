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

Eliminación lógica (soft-delete). `@PreAuthorize COORDINADOR, ADMIN`

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

Importa estudiantes desde archivo Excel. `@PreAuthorize COORDINADOR, ADMIN`

**Request:** `multipart/form-data` con campo `archivo` (.xlsx)

**Response 200:**
```json
{
  "importados": 25,
  "errores": ["Fila 3: email inválido"]
}
```

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
