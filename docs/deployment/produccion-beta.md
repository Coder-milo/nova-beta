# Despliegue en beta: Vercel + Supabase

Auditoría y guía para la primera subida a producción. El reparto es:

| Pieza | Dónde va | Por qué |
|---|---|---|
| Frontend (Astro + React) | **Vercel** | Es lo que Vercel sabe ejecutar |
| Backend (Spring Boot, Java 21) | **Render / Railway / Fly.io** | Vercel no ejecuta contenedores Java de larga vida. Ya hay `render.yaml` en la raíz |
| Base de datos (PostgreSQL 16) | **Supabase** | El backend ya habla Postgres con Flyway |
| Archivos (fotos, HV, documentos) | **Supabase Storage (S3)** | El disco de Render y las funciones de Vercel son efímeros |

El frontend hace de **BFF**: guarda la sesión en cookies HttpOnly y reenvía `/api/**` al backend traduciendo la cookie a `Authorization: Bearer`. El navegador nunca ve el token y el backend nunca ve la cookie.

---

## Bloqueadores: sin esto no arranca

### 1. `BACKEND_URL` es obligatoria en producción

El middleware necesita saber a dónde reenviar. **Ya corregido** en `front-end/src/lib/server/session.ts`: ahora lee `process.env` antes que `import.meta.env`.

Importa la diferencia: Vite sustituye `import.meta.env.BACKEND_URL` **en tiempo de compilación**. Si la variable no estaba puesta al construir, quedaba congelada como `undefined` en el bundle y la función desplegada llamaba a `localhost:8080` —que en serverless no es nadie— devolviendo 503 sin explicar por qué. Leyendo `process.env` primero, cambiar la URL en el panel de Vercel surte efecto sin recompilar.

En producción, si falta, el arranque falla con un mensaje claro en vez de fallar en silencio.

### 2. Adaptador de Astro

**Ya corregido** en `front-end/astro.config.mjs`: se elige por entorno.

```js
const enVercel = Boolean(process.env.VERCEL)
adapter: enVercel ? vercel() : node({ mode: 'standalone' })
```

Vercel define `VERCEL=1` en sus builds. En local y en Docker se sigue generando el servidor Node, para que `pnpm build` no empiece a producir artefactos que solo Vercel sabe arrancar.

> **Sin verificar del todo.** El build con `VERCEL=1` falla en Windows con `EPERM: operation not permitted, symlink` — es una limitación de symlinks de Windows, no de la configuración. El adaptador se selecciona bien y el bundle se genera; el paso que falla es copiar dependencias, que en los runners Linux de Vercel funciona. Confírmalo en el primer deploy.

### 3. Los archivos subidos se pierden

`StorageService` usa MinIO si hay credenciales y, si no, **disco local** (`./storage`). En Render el disco es efímero: cada redeploy o reinicio borra las fotos, las hojas de vida generadas, los documentos y las plantillas.

Como MinIO es S3-compatible y **Supabase Storage expone API S3**, se resuelve solo con variables de entorno, sin tocar código:

```
MINIO_ENDPOINT=https://<proyecto>.supabase.co/storage/v1/s3
MINIO_ACCESS_KEY=<access key id de Supabase>
MINIO_SECRET_KEY=<secret access key de Supabase>
MINIO_BUCKET=novacrm
```

Crea el bucket `novacrm` en Supabase Storage antes del primer arranque. Genera las claves S3 en *Project Settings → Storage → S3 Access Keys*.

### 4. Datos personales en el repositorio

`back-end/storage/` está versionado: **502 hojas de vida en PDF, 13 MB**, y los nombres de fichero llevan el número de documento (`hv-1002231374.pdf`). El repo es privado, así que no hay filtración, pero no debe seguir así.

**Ya añadido al `.gitignore`** (junto a `node_modules/`, `dist/`, `.astro/` y `.vercel/`, que tampoco estaban).

Falta sacarlos del índice, y eso lo decides tú porque toca el historial:

```bash
git rm -r --cached back-end/storage
```

Eso los quita de los commits futuros pero **siguen en el historial**. Para borrarlos de ahí hace falta `git filter-repo`, que reescribe todos los commits y obliga a que cualquiera con un clon lo rehaga. Con el repo privado, puede esperar.

---

## Configuración por servicio

### Supabase (base de datos)

Usa la cadena de conexión **directa**, no la del pooler en modo transacción: Hibernate abre *prepared statements* con nombre y el pooler de Supabase en `transaction` los rompe. Si necesitas el pooler por límite de conexiones, usa el modo `session`.

```
DB_HOST=db.<proyecto>.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<la de Supabase>
DB_PARAMS=?sslmode=require
```

`DB_PARAMS` no es opcional: Supabase rechaza conexiones sin TLS.

Flyway corre solo al arrancar y crea el esquema (V1…V21). `spring.jpa.hibernate.ddl-auto` está en `validate`, así que si una migración no cuadra con las entidades, el arranque falla en vez de corromper datos en silencio. `flyway.clean-disabled: true` en el perfil `prod` impide borrar la base por accidente.

### Backend (Render)

El `render.yaml` de la raíz ya sirve; solo cambian los datos de la base (antes apuntaba a Neon). Variables a rellenar en el panel:

```
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET=<openssl rand -base64 32>     # Render lo genera solo
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_PARAMS
CORS_ORIGINS=https://<tu-app>.vercel.app
FRONTEND_URL=https://<tu-app>.vercel.app
MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
CORREO_REMITENTE=<dirección verificada en tu proveedor>
SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
APP_CORREO_BASE_URL_PUBLICA=https://<tu-api>.onrender.com
```

`JWT_SECRET` se valida al arrancar: rechaza los que estuvieron publicados en el repositorio y exige 32 bytes. Es lo que impide desplegar con una clave conocida.

`APP_CORREO_BASE_URL_PUBLICA` tiene que ser el dominio **público del backend**: es la dirección que abre el cliente de correo del destinatario para ver las imágenes de marca y los adjuntos de los anuncios. Con `localhost` ahí, los correos salen con las imágenes rotas.

### Vercel (frontend)

```
BACKEND_URL=https://<tu-api>.onrender.com
```

Root directory: `front-end`. El resto lo detecta solo.

---

## Riesgos conocidos que no bloquean el deploy

### Límite de 4.5 MB por petición

Vercel corta el cuerpo de una petición serverless en **4.5 MB**, y todo `/api/**` pasa por el middleware. Los límites de la aplicación son mayores:

| Qué se sube | Límite de la app | Pasa por Vercel |
|---|---|---|
| Adjunto de anuncio | 25 MB | ❌ si supera 4.5 MB |
| Documento | 20 MB | ❌ si supera 4.5 MB |
| Plantilla de HV (Word/PDF) | 10 MB | ❌ si supera 4.5 MB |
| Excel de importación | 5000 filas | ⚠️ normalmente cabe |
| Foto de perfil | sin límite propio | ✅ se reescala a 250 px |

En la práctica un póster o un Word pasan de 4.5 MB con facilidad. Opciones: bajar los límites de la app para que el error sea claro, o subir esos archivos directamente a Supabase Storage desde el navegador sin pasar por el proxy. Para la beta puede bastar con avisar al equipo.

### Arranque en frío

El plan gratuito de Render duerme el servicio tras 15 minutos sin tráfico, y despertar un Spring Boot tarda ~50 s. La primera visita del día parecerá caída. El middleware ya responde un 503 con mensaje legible en vez de un error vacío, pero conviene un ping periódico o el plan de pago.

### Correo

Sin `SMTP_HOST` ni `CORREO_REMITENTE` no se envía nada, y `estaConfigurado()` lo dice explícitamente en vez de fallar con un error de conexión confuso. El proveedor (Brevo, Resend, Mailgun) exige que la dirección remitente esté verificada en su panel antes de aceptar envíos.

Puedes ver cómo quedan los correos antes de mandarlos en **Configuración → Usuarios & Seguridad → Correos que envía el sistema**, con la marca de cada programa.

### Pendientes menores

- **Foto servida con el content-type equivocado.** Al subir se convierte todo a JPEG, pero la clave conserva la extensión original: `foto.png` responde `Content-Type: image/png` con bytes JPEG. Con `X-Content-Type-Options: nosniff` el navegador no lo corrige y la foto no se ve. En el PDF sí funciona. Se arregla forzando `.jpg` en la clave.
- `header.tsx` pinta `<img src={fotoUrl}>` con la clave de almacenamiento en 4 sitios → 404 en la mensajería.
- El CRUD de plantillas de correo existe en el backend y no tiene pantalla.
- `panel-empleabilidad.tsx` envía campos que el DTO de Java no acepta. Nadie lo importa todavía.

---

## Antes de dar por buena la beta

1. Login, y que la sesión sobreviva a recargar.
2. Un estudiante: sube su foto, elige diseño de hoja de vida, previsualiza y descarga. La foto tiene que verse en el PDF del diseño «Clásico con foto».
3. Publicar un anuncio con formato y un adjunto; abrirlo como estudiante.
4. Importar un Excel de empresas y otro de colocaciones.
5. Descargar un reporte en Excel, CSV y PDF, y abrir el CSV en Excel para confirmar acentos y columnas.
6. Crear una cuenta de estudiante y comprobar que el correo llega **y** que sus imágenes cargan.
7. Reiniciar el backend y verificar que la foto subida en el paso 2 sigue ahí (prueba de que el almacenamiento no es efímero).
