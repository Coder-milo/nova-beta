# Instalación, despliegue e infraestructura

## Requisitos de desarrollo

- JDK 17 (el proyecto declara Java 17; JDK 21 también puede compilarlo).
- Maven 3.9 o equivalente.
- Node.js 20 o superior y pnpm.
- PostgreSQL 16 para entorno local o una instancia compatible.
- Almacenamiento S3/MinIO para archivos persistentes.

## Inicio local

Desde la raíz del repositorio:

```powershell
# Configura variables sin poner secretos en archivos versionados.
Copy-Item .env.example .env

# Infraestructura local, si existe Docker Desktop.
docker compose up -d postgres minio

# API
cd back-end
mvn spring-boot:run

# En otra terminal: frontend
cd front-end
pnpm install --frozen-lockfile
pnpm dev
```

Frontend local: `http://localhost:3000`
API local: `http://localhost:8080`
Swagger local: `http://localhost:8080/swagger-ui.html`

## Validación antes de desplegar

```powershell
cd back-end
mvn test

cd ../front-end
pnpm test
pnpm exec tsc --noEmit
pnpm run check
pnpm run build
```

Las pruebas que dependan de Docker/Testcontainers deben ejecutarse en un equipo
con Docker disponible. No se debe ignorar un fallo de migración o build para
publicar producción.

## Variables de entorno

| Variable | Uso | Obligatoria en producción |
|---|---|:---:|
| `BACKEND_URL` | URL pública de la API que usa el frontend SSR. | Sí, Vercel |
| `SPRING_PROFILES_ACTIVE` | Debe ser `prod` en Render. | Sí |
| `NOVA_JWT_SECRET` o `JWT_SECRET` | Firma JWT; 32+ bytes seguros. | Sí |
| `DB_HOST`, `DB_PORT`, `NOVA_DB_NAME`, `NOVA_DB_USER`, `NOVA_DB_PASSWORD`, `DB_PARAMS` | PostgreSQL con TLS si el proveedor lo exige. | Sí |
| `CORS_ORIGINS`, `FRONTEND_URL` | Dominio permitido y enlaces de correo. | Sí |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | Persistencia de archivos S3 compatible. | Recomendado crítico |
| `SMTP_*` o variables SES | Envío de correo. | Según operación |
| `GROQ_API_KEY`, `GROQ_MODELO`, `GROQ_TIMEOUT_MS` | IA opcional para casos no cubiertos por reglas. | No |
| `JSEARCH_API_KEY` | Fuente opcional de vacantes. | No |
| `WHATSAPP_*` | Integración de WhatsApp si se activa. | No |
| `RATE_LIMIT_TRUSTED_PROXIES` | Proxies confiables para límite por IP. | Sí, revisar |

La lista extendida y ejemplos sin secretos están en `.env.example` y
`render.yaml`. Nunca copies los valores reales a Git.

## Despliegue actual

| Componente | Plataforma | Configuración |
|---|---|---|
| Frontend | Vercel | Root Directory: `front-end`; variable `BACKEND_URL`. |
| Backend | Render | Servicio Docker definido en `render.yaml`; health check `/actuator/health`. |
| Base de datos | PostgreSQL administrado externo | Conexión mediante variables `DB_*`; Flyway aplica migraciones al iniciar. |
| Archivos | S3/MinIO compatible | Bucket privado y credenciales fuera del repositorio. |

Render aplica despliegue del backend cuando cambia `back-end/**`; Vercel debe
desplegar cambios del frontend. Después de un push a la rama de producción,
verifica ambos eventos y `GET /actuator/health` antes de anunciar la entrega.

## Procedimiento de despliegue seguro

1. Confirma que el árbol de Git contiene solo cambios intencionales.
2. Ejecuta la validación local completa.
3. Revisa las variables de entorno en Vercel y Render, sin revelar secretos.
4. Haz push a la rama que ambos proveedores observan.
5. Espera que Flyway termine; no interrumpas el servicio durante la migración.
6. Verifica health, login, dashboard, estudiante y una vista previa de importación.
7. Revisa logs por excepciones o errores 5xx.
8. Registra versión, commit, resultado y cualquier rollback en el changelog.

## Inventario y transferencia de propiedad

| Recurso | Propietario esperado | Evidencia a entregar |
|---|---|---|
| Repositorio GitHub | Organización de la institución | Administradores institucionales y rama protegida. |
| Vercel | Organización de la institución | Proyecto, dominio y responsables. |
| Render | Organización de la institución | Servicio, logs, variables y facturación. |
| PostgreSQL | Organización de la institución | Proyecto, backups, roles y facturación. |
| Almacenamiento | Organización de la institución | Bucket, políticas, ciclo de vida y claves rotables. |
| Dominio/DNS | Organización de la institución | Registrador, DNS y renovación. |
| Correo/WhatsApp/IA | Organización de la institución | Cuenta, facturación, remitentes y límites. |

Entrega accesos por gestor de contraseñas. Esta tabla no sustituye la evidencia
de que cada recurso fue transferido.
