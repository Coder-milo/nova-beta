# NOVA CRM · Astro

Frontend del CRM migrado de Next.js a Astro, conservando los componentes
React, la identidad visual, las rutas, la autenticación y la integración con
el backend Spring Boot.

## Desarrollo

```powershell
pnpm install
pnpm dev
```

Astro se inicia en `http://localhost:3000`.

## Producción

```powershell
pnpm build
$env:HOST = "0.0.0.0"
$env:PORT = "3000"
$env:BACKEND_URL = "http://localhost:8081"
node .\dist\server\entry.mjs
```

## Arquitectura

- Astro con salida SSR para Node.
- React como islas interactivas con división de código por módulo.
- Middleware Astro para protección de rutas y proxy `/api`.
- Navegación SPA mediante adaptadores locales.
- Tailwind CSS 4 mediante el plugin oficial para Vite.
- El backend se configura con `BACKEND_URL`.

Este directorio (`front-end/`) es el único frontend activo del repositorio;
la migración desde Next.js ya se completó.
