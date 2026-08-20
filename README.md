# NOVA CRM

> **Documentación de entrega vigente:** consulta el índice en
> [`docs/entrega/README.md`](docs/entrega/README.md). Incluye manuales,
> arquitectura, API, despliegue, seguridad, UAT, limitaciones y acta de entrega.

> **Carpeta de trabajo:** ejecuta siempre el proyecto desde la raíz de este repositorio, donde están `front-end/` y `back-end/`. No abras una carpeta `NOVA-CRM` dentro de otra; esa copia antigua fue retirada para que todos usen la misma versión.

**CRM de Empleabilidad** — Sistema integral para la gestión de empleabilidad del programa CAC Eurocentres. Conecta estudiantes, programas, vacantes y empresas mediante un motor de matching inteligente, scraping automatizado de portales de empleo, importación masiva desde Excel, y emisión de certificaciones digitales verificables.

## Features

| Módulo | Capacidad |
|--------|-----------|
| **Matching inteligente** | 5 criterios ponderados (afinidad, habilidades, inglés, ubicación, experiencia) con tokenizador de sinónimos técnico-laborales. Pesos y umbral configurables en YAML sin recompilar. |
| **Importación Excel dinámica** | Detecta automáticamente columnas de cualquier formato usando `ColumnMapper` + diccionario de sinónimos. Deduplicación por email y número de documento. |
| **Notificaciones automáticas** | Al generar matches, se crean notificaciones para cada estudiante. |
| **Scraping de vacantes** | Diario desde elempleo.com vía Jsoup. |
| **Certificaciones digitales** | Emisión y verificación pública vía Thymeleaf + MinIO. |

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | Java 21 |
| Framework | Spring Boot 3.3.0 |
| Base de datos | PostgreSQL 16 (Flyway migrations) |
| ORM | Hibernate 6 / Spring Data JPA |
| Autenticación | JWT (jjwt 0.12.5, HMAC-SHA) |
| Documentación API | SpringDoc OpenAPI 2.5.0 → Swagger UI |
| Objetos | MinIO (S3-compatible) |
| Scraping | Jsoup 1.18.1 |
| Importación Excel | Apache POI 5.3.0 |
| Emails | AWS SES SDK 2.25.0 |
| Rate limiting | Bucket4j 8.7.0 |
| Monitoreo | Actuator (`health`, `info`) — Prometheus/Grafana/Loki no implementado todavía |
| Contenedores | Docker + Docker Compose |

## Arquitectura

```
┌──────────────┐     ┌──────────────────────────────────────────┐
│   Frontend    │     │           NOVA CRM API (8080)            │
│ Astro + React │────▶│                                          │
│ (localhost:   │     │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│    3000)      │     │  │ Auth │ │Progr.│ │Estud.│ │Vacan.│   │
└──────────────┘     │  │      │ │      │ │      │ │      │   │
                     │  ├──────┤ ├──────┤ ├──────┤ ├──────┤   │
┌──────────────┐     │  │Match │ │Certif│ │Notif.│ │Scrap.│   │
│ Thymeleaf     │     │  │      │ │      │ │      │ │      │   │
│ (credencial/  │────▶│  └──────┘ └──────┘ └──────┘ └──────┘   │
│  {uuid})      │     │                                          │
└──────────────┘     └──────────┬──────┬──────────┬─────────────┘
                                │      │          │
                     ┌──────────┘      │          └──────────┐
                     ▼                 ▼                     ▼
              ┌────────────┐   ┌────────────┐   ┌────────────────┐
              │ PostgreSQL │   │   MinIO    │   │   Portales     │
              │  (5433)    │   │  (9000)    │   │   de empleo    │
              └────────────┘   └────────────┘   │ (elempleo.com) │
                                                └────────────────┘
```

## Empezar (desarrollo local)

**Prerequisitos:** Java 21 JDK, Docker Desktop, Maven 3.9+, Node.js 20+ (front-end)

```bash
# 1. Clonar e ir al proyecto
cd NOVA-CRM

# 2. Crear archivo de entorno
cp .env.example .env

# 3. Iniciar infraestructura
docker compose up -d postgres minio

# 4. Iniciar app
cd back-end
mvn spring-boot:run
```

La API arranca en `http://localhost:8080`. Swagger UI en `http://localhost:8080/swagger-ui.html` (path configurado en `springdoc.swagger-ui.path`).

En otra terminal inicia el frontend actual (Astro/React) desde la raíz del repositorio:

```bash
cd front-end
pnpm install --frozen-lockfile
pnpm dev
```

El frontend queda disponible en `http://localhost:3000`.

**Acceso inicial:** no se debe usar una contraseña pública o compartida.
En un entorno nuevo, define `ADMIN_INITIAL_PASSWORD` antes del primer
arranque; si no se define, la aplicación genera una credencial temporal y la
informa una sola vez en el log de inicio. Cámbiala de inmediato desde la
aplicación. Nunca publiques una contraseña real en este repositorio.

## Endpoints principales

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/v1/auth/login` | Público | Login JWT |
| GET/POST/PUT/PATCH | `/api/v1/programas` | Mixto | Listar, crear, editar, cambiar estado (sin DELETE) |
| GET/POST | `/api/v1/estudiantes` | Coord./Admin | CRUD estudiantes |
| GET | `/api/v1/estudiantes/papelera` | Coord./Admin | Listar papelera (inactivos) |
| POST | `/api/v1/estudiantes/{id}/restaurar` | Coord./Admin | Restaurar estudiante de la papelera |
| GET | `/api/v1/vacantes` | Público | Listar vacantes activas |
| GET/PATCH/POST | `/api/v1/matches` | Autenticado | Matching puntuado + marcar postulado + ejecutar bajo demanda |
| GET/PUT | `/api/v1/notificaciones` | Autenticado | Notificaciones |
| POST | `/api/v1/importar` | Admin | Importar Excel (mapeo dinámico por sinónimos) |
| DELETE | `/api/v1/admin/programas/{id}/estudiantes` | Admin | Soft delete masivo de estudiantes de un programa |
| DELETE | `/api/v1/admin/programas/{id}/reset` | Admin | Hard delete: elimina estudiantes y todas sus dependencias |
| POST | `/api/v1/admin/programas/{id}/restaurar-estudiantes` | Admin | Restaura todos los estudiantes de un programa desde la papelera |
| DELETE | `/api/v1/admin/purgar-papelera` | Admin | Elimina físicamente estudiantes con >30 días en papelera |
| DELETE | `/api/v1/admin/cleanup` | Admin | Vacía todo el sistema transaccional (estudiantes, vacantes, matches) |
| GET | `/credencial/{uuid}` | Público | Verificar credencial |
| — | — | — | LinkedIn OAuth: sin implementar (solo existe la entidad `LinkedinConfiguracion`, ningún endpoint todavía) |

Ver documentación completa en [`docs/api/endpoints.md`](docs/api/endpoints.md).

## Schedulers

| Tarea | Horario | Descripción |
|-------|---------|-------------|
| `ScrapingScheduler` | 06:00 diario | Scrapea elempleo.com (Bogotá) |
| `MatchScheduler` | 07:00 diario | Procesa matching estudiantes ↔ vacantes (umbral configurable, peso por 5 criterios con sinónimos) |
| `PurgeScheduler` | 03:00 domingo | Elimina físicamente estudiantes con más de 30 días en la papelera |

## Estructura del proyecto

```
NOVA-CRM/
├── back-end/
│   ├── src/main/java/com/novacrm/
│   │   ├── auth/           # Login, JWT, Usuario
│   │   ├── config/         # Security, CORS, MinIO, SES, Swagger
│   │   ├── dashboard/      # KPIs, gráficos y alertas para el panel
│   │   ├── estudiante/     # CRUD + DTOs
│   │   ├── programa/       # CRUD + estados
│   │   ├── vacante/        # Vacantes públicas
│   │   ├── matching/       # Motor de matching
│   │   ├── certificacion/  # Certificaciones digitales
│   │   ├── credencial/     # Verificación pública (Thymeleaf)
│   │   ├── notificacion/   # Notificaciones
│   │   ├── linkedin/       # Integración LinkedIn
│   │   ├── excel/          # Importación Excel
│   │   ├── scraper/        # Scraping portales empleo
│   │   ├── empresa/        # Empresas
│   │   ├── habilidad/      # Catálogo habilidades
│   │   ├── catalogo/       # Catálogos (nivel inglés)
│   │   ├── admin/          # Operaciones masivas (soft/hard delete, cleanup)
│   │   ├── exception/      # Manejo global errores
│   │   └── shared/         # BaseEntity
│   ├── src/main/resources/
│   │   ├── db/migration/       # Migraciones Flyway
│   │   ├── templates/          # Thymeleaf
│   │   ├── column-synonyms.yml # Sinónimos para mapeo dinámico de columnas Excel
│   │   ├── matching-synonyms.yml # Sinónimos técnico-laborales para matching
│   │   ├── matching-config.yml   # Pesos y umbral del motor de matching
│   │   └── application.yml
│   └── Dockerfile
├── docker-compose.yml
├── .env
└── .env.example
```

## Perfiles

| Perfil | Archivo | Uso |
|--------|---------|-----|
| `default` | `application.yml` | Configuración base |
| `dev` | `application-dev.yml` | SQL logging, Flyway clean habilitado |
| `prod` | `application-prod.yml` | Producción (desactivar clean) |
