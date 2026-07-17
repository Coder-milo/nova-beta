# NOVA CRM

**CRM de Empleabilidad** — Sistema integral para la gestión de empleabilidad del programa CAC Eurocentres. Conecta estudiantes, programas, vacantes y empresas mediante un motor de matching inteligente, scraping automatizado de portales de empleo, importación masiva desde Excel, y emisión de certificaciones digitales verificables.

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | Java 17 |
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
| Monitoreo | Prometheus / Grafana / Loki (micrometer) |
| Contenedores | Docker + Docker Compose |

## Arquitectura

```
┌──────────────┐     ┌──────────────────────────────────────────┐
│   Frontend    │     │           NOVA CRM API (8080)            │
│  Angular 17   │────▶│                                          │
│ (localhost:   │     │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│    4200)      │     │  │ Auth │ │Progr.│ │Estud.│ │Vacan.│   │
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

**Prerequisitos:** Java 17 JDK, Docker Desktop, Maven 3.9+

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

La API arranca en `http://localhost:8080`. Swagger UI en `http://localhost:8080/swagger-ui/index.html`.

**Credenciales admin por defecto (seed Flyway):**
- Email: `admin@novacrm.com`
- Password: `admin123`

## Endpoints principales

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/v1/auth/login` | Público | Login JWT |
| GET/POST | `/api/v1/programas` | Mixto | CRUD programas |
| GET/POST | `/api/v1/estudiantes` | Coord./Admin | CRUD estudiantes |
| GET | `/api/v1/vacantes` | Público | Listar vacantes activas |
| GET | `/api/v1/matches` | Autenticado | Matching puntuado |
| GET/PUT | `/api/v1/notificaciones` | Autenticado | Notificaciones |
| POST | `/api/v1/importar` | Admin | Importar Excel |
| GET | `/credencial/{uuid}` | Público | Verificar credencial |
| GET/POST | `/api/v1/linkedin/*` | Autenticado | LinkedIn OAuth |

Ver documentación completa en [`docs/api/endpoints.md`](docs/api/endpoints.md).

## Schedulers

| Tarea | Horario | Descripción |
|-------|---------|-------------|
| `ScrapingScheduler` | 06:00 diario | Scrapea elempleo.com (Bogotá) |
| `MatchScheduler` | 07:00 diario | Procesa matching estudiantes ↔ vacantes (umbral ≥ 60) |

## Estructura del proyecto

```
NOVA-CRM/
├── back-end/
│   ├── src/main/java/com/novacrm/
│   │   ├── auth/           # Login, JWT, Usuario
│   │   ├── config/         # Security, CORS, MinIO, SES, Swagger
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
│   │   ├── exception/      # Manejo global errores
│   │   └── shared/         # BaseEntity
│   ├── src/main/resources/
│   │   ├── db/migration/   # Migraciones Flyway
│   │   ├── templates/      # Thymeleaf
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
