# API, permisos y seguridad

## API

La especificación operativa se publica con SpringDoc:

- Swagger UI: `https://<URL_BACKEND>/swagger-ui.html`
- OpenAPI JSON: `https://<URL_BACKEND>/v3/api-docs`
- Salud: `https://<URL_BACKEND>/actuator/health`

El frontend consume la API con el mismo origen (`/api/**`) y el middleware la
reenvía al backend configurado en `BACKEND_URL`. La lista detallada existente
está en [`../api/endpoints.md`](../api/endpoints.md); Swagger es la fuente de
verdad de rutas, esquemas y cambios de versión.

## Grupos de endpoints

| Base | Operaciones principales | Acceso general |
|---|---|---|
| `/api/v1/auth` | sesión, refresh, recuperación y restablecimiento | público según operación |
| `/api/v1/estudiantes` | CRUD, perfil propio, documentos, historial y filtros | admin/coordinador; estudiante solo propietario |
| `/api/v1/empresas` | CRM, contactos y datos empresariales | admin/coordinador; portal por propiedad |
| `/api/v1/vacantes`, `/matches` | oportunidades, fuentes, matching y revisión | lectura pública controlada; gestión autorizada |
| `/api/v1/postulaciones`, `/colocaciones` | pipeline, entrevistas y vinculaciones | admin/coordinador; vista propia para estudiante |
| `/api/v1/seguimiento`, `/agenda`, `/actividades` | seguimiento, citas y tareas | administración; estudiante para recursos propios |
| `/api/v1/importar` | simulación e importación Excel | admin/coordinador |
| `/api/v1/mensajes`, `/api/v1/notificaciones` | comunicación y avisos | autenticado y filtrado por identidad |
| `/api/v1/configuracion`, `/api/v1/auditoria`, `/api/v1/admin` | configuración, auditoría y operaciones sensibles | administración; algunas rutas solo `ADMIN` |
| `/api/v1/copiloto` | siguiente acción y centro de prioridades | respuesta adaptada al rol y a la propiedad |

## Códigos de respuesta

| Código | Significado para la interfaz |
|---|---|
| `200/201/204` | Operación exitosa. |
| `400/422` | Validación o regla de negocio: corregir datos, no reintentar ciegamente. |
| `401` | Sesión vencida o inválida: iniciar sesión. |
| `403` | Usuario autenticado sin permiso; no cerrar sesión automáticamente. |
| `404` | Recurso inexistente o no visible para el usuario. |
| `409` | Conflicto o duplicado. |
| `429` | Límite de peticiones: esperar y reintentar. |
| `502/503/504` | Servicio temporalmente no disponible; conservar formulario y reintentar. |

## Matriz de permisos

| Funcionalidad | Admin | Coordinador | Estudiante | Empresa |
|---|:---:|:---:|:---:|:---:|
| Ver todos los estudiantes | Sí | Sí | No | No |
| Ver y editar perfil propio | Sí | Sí | Sí, solo propio | No |
| Crear/editar seguimientos | Sí | Sí | No | No |
| Gestionar empresas y vacantes internas | Sí | Sí | No | Solo propias en portal |
| Consultar postulaciones | Todas | Todas | Solo propias | Solo de sus vacantes |
| Registrar/editar colocaciones | Sí | Sí | Solo lectura propia | No |
| Importar Excel | Sí | Sí | No | No |
| Configuración institucional | Sí | Según módulo | Preferencias propias | Cuenta propia |
| Auditoría y zona de peligro | Sí | Consulta según autorización | No | No |
| Mensajes y notificaciones | Sí | Sí | Solo propios | Solo propios |

La interfaz oculta opciones fuera de rol, pero no es la seguridad principal:
las restricciones se validan en el backend. `OwnershipService` evita que una
cuenta cuyo único rol es estudiante lea o edite datos de otra persona.

## Controles de seguridad implementados

- HTTPS administrado por Vercel/Render en producción.
- Cookies `HttpOnly`, `Secure` en producción y `SameSite=Lax` para sesión.
- JWT con secreto requerido y rotación mediante refresh token.
- Hash de contraseñas con Spring Security; nunca se guardan en texto plano.
- RBAC en backend mediante `@PreAuthorize` y verificación de propiedad.
- Limitación de login, API y captación pública por IP.
- CORS configurable desde variables de entorno.
- Cabeceras CSP, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
- Validación de archivos, tipo, tamaño y datos de entrada.
- Auditoría de operaciones relevantes y borrado lógico donde aplica.
- Flyway con `clean-disabled` en perfil de producción.

## Reglas operativas

- No registrar secretos en tickets, commits, logs o documentación.
- Revisar permisos tras crear una cuenta, cambiar de rol o reasignar empresa.
- Mantener `RATE_LIMIT_TRUSTED_PROXIES` restringido al proxy real de producción.
- Rotar credenciales de APIs, correo, almacenamiento y JWT ante salida de personal o sospecha de exposición.
