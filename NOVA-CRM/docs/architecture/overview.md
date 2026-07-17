# Architecture Overview — NOVA CRM

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
│  ┌──────────────┐  ┌────────────┐  ┌───────────────────┐   │
│  │ Angular 17   │  │ Thymeleaf  │  │ curl / Postman /  │   │
│  │ (front-end)  │  │ (credencial│  │ Swagger UI        │   │
│  │ localhost:4200│  │  pública)  │  │ localhost:8080    │   │
│  └──────┬───────┘  └─────┬──────┘  └─────────┬─────────┘   │
└─────────┼────────────────┼──────────────────┼──────────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER (8080)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Security Filter Chain                                │   │
│  │  ├─ CorsFilter                                        │   │
│  │  ├─ JwtFilter (Bearer token validation)               │   │
│  │  ├─ RateLimitFilter (Bucket4j: login 5/min, API      │   │
│  │  │                                    100/min)        │   │
│  │  └─ AuthorizationFilter (@PreAuthorize)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controllers                                          │   │
│  │  AuthController  │ ProgramaController                 │   │
│  │  EstudianteController │ VacanteController             │   │
│  │  MatchController │ CertificacionController            │   │
│  │  NotificacionController │ ExcelController             │   │
│  │  LinkedinController │ CredencialPublicaController     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services                                             │   │
│  │  AuthService │ ProgramaService │ EstudianteService    │   │
│  │  VacanteService │ MatchingService │ NotificacionSrvc  │   │
│  │  CertificacionService │ ExcelService │ EmailService   │   │
│  │  MatchScheduler │ ScrapingScheduler │ ElempleoScraper │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Repositories (Spring Data JPA)                       │   │
│  │  13 interfaces, each extending JpaRepository          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────────┐ ┌──────────┐ ┌──────────────────┐
│  PostgreSQL 16   │ │  MinIO   │ │  Portales empleo  │
│  (puerto 5433)   │ │(S3 obj.)│ │  (elempleo.com)   │
│                  │ │puerto    │ │                   │
│  - Datos maestro │ │9000/9001│ │  Scraping via     │
│  - Matching      │ │         │ │  Jsoup (06:00 AM) │
│  - Certificados  │ │ PDF     │ │                   │
│                  │ │credenc. │ │                   │
└─────────────────┘ └──────────┘ └──────────────────┘
```

## Entity-Relationship Model

### Core Entities

```
Usuario ──┐                 Programa ──┐
           │ roles: Set<Rol>            │ estado: ProgramaEstado
                                       │
                    Estudiante ────────┘
                    ├── nivelIngles ─── NivelIngles
                    ├── habilidades ─── Habilidad (N:N via EstudianteHabilidad)
                    ├── certificaciones ─ Certificacion (N:N via Est.Certificacion)
                    │                     └── Credencial (1:1, verificación pública)
                    ├── matches ──────── Match ── Vacante ── Empresa
                    ├── notificaciones ─ Notificacion
                    └── linkedinConfig ─ LinkedinConfiguracion
```

### Tablas del sistema

| Esquema | Flyway | Migraciones versionadas |
|---------|--------|------------------------|
| `usuario` | Usuarios del sistema (admin, coordinadores) |
| `programa` | Programas de empleabilidad |
| `estudiante` | Estudiantes inscritos |
| `vacante` | Vacantes de empleo (scrapeadas o manuales) |
| `empresa` | Empresas asociadas a vacantes |
| `match_resultado` | Resultados del matching estudiantes↔vacantes |
| `certificacion` | Certificaciones digitales por programa |
| `estudiante_certificacion` | N:N estudiante ↔ certificación |
| `credencial` | Verificación pública de certificados |
| `notificacion` | Notificaciones del sistema |
| `catalogo_habilidad` | Catálogo de habilidades |
| `estudiante_habilidad` | Habilidades por estudiante |
| `catalogo_nivel_ingles` | Niveles de inglés (A1-C2) |
| `linkedin_configuracion` | Tokens OAuth de LinkedIn |

## Motor de Matching

El `MatchingService` evalúa candidatos contra vacantes usando puntuación ponderada:

| Criterio | Peso | Descripción |
|----------|------|-------------|
| Sector/Área | 30% | Coincidencia entre perfil del estudiante y sector de la vacante |
| Nivel de inglés | 25% | El nivel del estudiante >= nivel requerido por la vacante |
| Ubicación | 25% | Coincidencia de ubicación geográfica |
| Experiencia | 20% | Años de experiencia del estudiante vs. requeridos |

**Umbral mínimo:** 60/100 puntos. Ejecutado diariamente a las 07:00 por `MatchScheduler`.

## Seguridad

- **JWT:** HMAC-SHA con clave de 256 bits (configurable via `JWT_SECRET`), expiración 15 minutos
- **BCrypt:** Passwords hasheadas con BCrypt ($2a$)
- **RBAC:** `@PreAuthorize` con roles ADMIN, COORDINADOR, ESTUDIANTE
- **Rate limiting:** Bucket4j — login 5 req/min, API general 100 req/min (por IP)
- **Endpoints públicos:** login, vacantes, programas (GET), certificaciones (GET), credencial/{uuid}

## Schedulers

### ScrapingScheduler
- **Cron:** `0 0 6 * * *` (06:00 diario)
- **Portal:** elempleo.com vía Jsoup
- **Palabras clave:** desarrollador, ingeniero, analista, practicante, tecnologo
- **Ubicación:** Bogotá

### MatchScheduler
- **Cron:** `0 0 7 * * *` (07:00 diario)
- Ejecuta matching para todos los estudiantes activos contra vacantes activas

## Configuración por entorno

| Propiedad | Dev | Prod |
|-----------|-----|------|
| `DB_HOST` | localhost | postgres (Docker network) |
| `DB_PORT` | 5433 | 5432 |
| `spring.jpa.show-sql` | true | false |
| `spring.jpa.hibernate.ddl-auto` | validate | validate |
| `flyway.clean-disabled` | false | true |
| `app.jwt.expiration-ms` | 900000 (15min) | 900000 (15min) |
| `app.rate-limit.login-max` | 5 | 5 |

## Dependencias externas

| Servicio | Uso | Estado |
|----------|-----|--------|
| **PostgreSQL 16** | Base de datos principal | ✅ Docker local |
| **MinIO** | Almacenamiento PDF credenciales | ✅ Docker local |
| **AWS SES** | Envío de emails | ❌ Sin configurar (dev: no-op) |
| **LinkedIn API** | Compartir credenciales | ❌ Pendiente crear app |

## Decisiones técnicas

1. **UUID como PK** — IDs no secuenciales, seguros para exposición pública en URLs
2. **Flyway + `ddl-auto: validate`** — El schema lo define SQL (Flyway), Hibernate solo valida consistencia
3. **BaseEntity abstracta** — Todos los dominios comparten `id`, `createdAt`, `updatedAt`, `version` (optimistic locking)
4. **Soft-delete** — Estudiantes y programas se desactivan (`activo = false`), no se eliminan físicamente
5. **DTOs con records (Java 17)** — Inmutables, concisos, sin dependencia de Lombok
6. **Bucket4j sobre Redis** — Rate limiting en memoria (sin dependencia externa adicional)

## Monitoreo

| Herramienta | Endpoint | Puerto |
|-------------|----------|--------|
| Prometheus | `/actuator/prometheus` | 8080 |
| Grafana | (dashboard configurable) | 3000 |
| Loki | (logs agregados) | 3100 |
