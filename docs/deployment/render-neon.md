# Despliegue gratuito: Render + Neon

Esta guía deja la API de NOVA-CRM en producción **sin costo**, para que el equipo
pueda ir viendo el proyecto. No se usa MinIO ni AWS SES en esta versión (el envío de
correos queda en stand by).

## Arquitectura de esta versión

- **API** (Spring Boot) → Render, plan Free, construida desde el `Dockerfile`.
- **Base de datos** (PostgreSQL) → Neon, plan Free.
- Flyway crea el esquema automáticamente al arrancar (migraciones `V1`-`V30` a la fecha; ver `back-end/src/main/resources/db/migration/`).

## 1. Crear la base de datos en Neon

1. Entra a [neon.tech](https://neon.tech) y crea un proyecto (región cercana, p. ej. AWS us-east).
2. En **Dashboard → Connection Details**, copia estos datos de la cadena de conexión:
   - Host (algo como `ep-xxx-xxx.us-east-2.aws.neon.tech`)
   - Database (por defecto `neondb`)
   - User y Password
3. Neon exige TLS: por eso `DB_PARAMS=?sslmode=require` ya viene en el blueprint.

## 2. Desplegar la API en Render

1. Sube el repositorio a GitHub (si aún no lo está).
2. En [render.com](https://render.com) → **New → Blueprint**, conecta el repo. Render
   detecta el archivo [`render.yaml`](../../render.yaml) de la raíz.
3. Render pedirá completar las variables marcadas como *sync: false*. Rellénalas con
   los datos de Neon del paso anterior:

   | Variable      | Valor                                             |
   |---------------|---------------------------------------------------|
   | `DB_HOST`     | host de Neon                                      |
   | `DB_NAME`     | `neondb` (o el nombre de tu base)                 |
   | `DB_USER`     | usuario de Neon                                   |
   | `DB_PASSWORD` | contraseña de Neon                                |
   | `CORS_ORIGINS`| URL del frontend (ej. `https://mi-front.vercel.app`); si aún no hay front, deja `*` temporalmente |
   | `RATE_LIMIT_TRUSTED_PROXIES` | IPs/CIDRs desde los que se acepta `X-Forwarded-For`. Fijar **solo** la IP real del proxy; si Render reenvía directo, dejar vacío. El default de la app confía en toda red privada, lo que permite falsear el límite de login (hallazgo de pentest F2-1) |
   | `JSEARCH_API_KEY` | Clave de JSearch en RapidAPI. Es la **única fuente de vacantes colombianas** del sistema. Si se deja vacía, el conector se apaga solo y lo registra en el log; el resto de fuentes sigue funcionando |

   `JWT_SECRET` se **genera solo** (Render crea un secreto aleatorio). `DB_PORT` (5432),
   `DB_PARAMS` y `SPRING_PROFILES_ACTIVE=prod` ya vienen fijados.

   Las tres últimas van con `sync: false` en `render.yaml`: se pegan a mano en el panel
   de Render y **nunca** se guardan en el repositorio.

   El resto de fuentes de vacantes tiene valores por defecto razonables y solo hace falta
   tocarlas para desactivar algo: `SCRAPING_REMOTIVE_ENABLED`, `SCRAPING_ARBEITNOW_ENABLED`,
   `JSEARCH_LIMITE_MENSUAL` (200, el tope del plan gratuito) y `JSEARCH_CONSULTAS_POR_CORRIDA`
   (6 — con el cron diario son ~180 al mes, que caben en el cupo con margen para los
   escaneos manuales del panel). `SCRAPING_ELEMPLEO_ENABLED` se queda en `false`: extraer
   contenido de ese portal está restringido por sus condiciones de uso y activarlo exige un
   acuerdo previo con elempleo.com.
4. **Apply / Deploy**. El primer build tarda unos minutos (compila el jar en Docker).

## 3. Verificar

- Health check: `https://<tu-servicio>.onrender.com/actuator/health` → `{"status":"UP"}`.
- Documentación interactiva de la API (para que el equipo explore): `https://<tu-servicio>.onrender.com/swagger-ui.html`.

## Notas

- **Plan Free de Render**: el servicio se "duerme" tras ~15 min de inactividad y la
  primera petición luego tarda unos segundos en responder. Es normal en el tier gratis.
- **Rotación de secreto**: al usar `generateValue`, el `JWT_SECRET` de producción es
  nuevo y no tiene relación con el que estaba en el repositorio. Perfecto.
- **Migraciones**: Flyway corre al arrancar. Si cambias el esquema, agrega un nuevo
  archivo `V31__...sql` (la última aplicada hoy es `V30`); nunca edites los ya aplicados.
- **Pendiente (stand by)**: envío de correos (AWS SES) e integración con LinkedIn. Ambos
  requieren credenciales/servicios externos y no bloquean esta primera puesta en producción.
