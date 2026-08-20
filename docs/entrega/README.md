# Entrega de producción — NOVA CRM

**Versión:** 2026.08.20
**Producto:** NOVA CRM / CAC Academic
**URL pública:** https://nova-beta-eta.vercel.app
**Repositorio fuente:** `Coder-milo/nova-beta`
**Fecha de entrega:** 20 de agosto de 2026

Esta carpeta es el índice de entrega. Describe el estado real del sistema y no
incluye contraseñas, tokens, cadenas de conexión ni datos personales.

| Documento | Contenido |
|---|---|
| [01-alcance-y-historias.md](01-alcance-y-historias.md) | Alcance, módulos, historias, criterios y restricciones. |
| [02-manual-usuario.md](02-manual-usuario.md) | Uso diario para estudiante, empresa y equipo. |
| [03-manual-administracion.md](03-manual-administracion.md) | Operación del panel, importaciones, comunicaciones y auditoría. |
| [04-arquitectura-y-datos.md](04-arquitectura-y-datos.md) | Arquitectura, estructura, modelo de datos y ERD. |
| [05-api-permisos-y-seguridad.md](05-api-permisos-y-seguridad.md) | API, RBAC, seguridad y matriz de permisos. |
| [06-instalacion-despliegue-e-infraestructura.md](06-instalacion-despliegue-e-infraestructura.md) | Instalación, variables, despliegue, infraestructura y accesos. |
| [07-backups-soporte-y-limitaciones.md](07-backups-soporte-y-limitaciones.md) | Respaldo, recuperación, mantenimiento y límites conocidos. |
| [08-pruebas-uat-y-changelog.md](08-pruebas-uat-y-changelog.md) | Evidencia de pruebas, UAT y cambios de esta versión. |
| [09-acta-de-entrega.md](09-acta-de-entrega.md) | Acta para completar y firmar. |

## Puntos de arranque

- Para usar la plataforma: empieza por el [manual de usuario](02-manual-usuario.md).
- Para operar el sistema: usa el [manual de administración](03-manual-administracion.md).
- Para volver a desplegar o transferir el proyecto: sigue la [guía de instalación y despliegue](06-instalacion-despliegue-e-infraestructura.md).
- Para conocer lo probado y lo que requiere una decisión institucional: revisa [UAT y limitaciones](08-pruebas-uat-y-changelog.md) y [backups y soporte](07-backups-soporte-y-limitaciones.md).

## Regla de seguridad para la entrega

Los accesos deben entregarse mediante un gestor de contraseñas o canal seguro,
con la institución como propietaria de GitHub, Vercel, Render, base de datos,
dominio, almacenamiento, correo y claves de APIs. Nunca se deben copiar en
este repositorio ni en estos documentos.
