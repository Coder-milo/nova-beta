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
│   │  14 interfaces, each extending JpaRepository          │   │
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

### Pesos actuales

| Criterio | Peso | Descripción |
|----------|------|-------------|
| Afinidad de perfil | 35% | Coincidencia de términos (cargo, sector, experiencia, perfil, área de formación, nivel educativo) normalizados mediante diccionario de sinónimos técnico-laborales |
| Habilidades | 10% | Habilidades registradas del estudiante (`estudiante_habilidad`) vs texto de la vacante |
| Nivel de inglés | 20% | El nivel del estudiante >= nivel requerido por la vacante |
| Ubicación | 15% | Coincidencia de ubicación geográfica; con disponibilidad de movilidad obtiene el 60% |
| Experiencia | 20% | Años de experiencia del estudiante vs. requeridos |

### Sinónimos técnico-laborales

El tokenizador (`SkillSynonyms`) normaliza términos usando `matching-synonyms.yml` antes de comparar. Ej: "software engineer", "programador", "developer" se normalizan a un mismo grupo canónico.

### Bonus por sector

Si `sectorObjetivo` o `sectorExperiencia` del estudiante coincide con `empresa.sector`, la afinidad recibe un bonus de +15%.

### Configurable sin recompilar

Los pesos, umbral mínimo y máximo de vacantes se definen en `matching-config.yml` (no requiere recompilar, solo reinicio):

```yaml
pesos:
  afinidad: 35
  habilidades: 10
  ingles: 20
  ubicacion: 15
  experiencia: 20
umbral_minimo: 55
max_vacantes_por_ejecucion: 500
```

### Notificaciones automáticas

Al generar nuevos matches, el sistema crea automáticamente notificaciones para cada estudiante (`NotificacionService.generarNotificacionesMatch`).

**Umbral mínimo:** 55/100 puntos (configurable). Ejecutado diariamente a las 07:00 por `MatchScheduler`.

### SkillSynonyms — tokenizador con sinónimos

El componente `SkillSynonyms` carga `matching-synonyms.yml` (28 grupos de sinónimos: roles, lenguajes, sectores, habilidades blandas) y normaliza los textos antes de comparar:

1. Normaliza (NFD, lowercase, sin puntuación)
2. Reemplaza frases multi-palabra por su grupo canónico (ej: `"software engineer"` → `"desarrollador"`)
3. Divide en palabras y conserva solo las que son grupos canónicos conocidos

### MatchingConfig — configuración externa

`MatchingConfig` carga `matching-config.yml` via `@PostConstruct`. Los pesos deben sumar 100. El `umbral_minimo` define el puntaje mínimo para crear un Match. El `max_vacantes_por_ejecucion` controla cuántas vacantes se procesan por ciclo (ya no está limitado a 100).

La clase está en el paquete `com.novacrm.config` y es inyectada en `MatchingService`.

---

## Importación Dinámica de Excel

### ColumnMapper

El componente `ColumnMapper` carga `column-synonyms.yml` (42 entradas con sinónimos para cada campo de `Estudiante`) y resuelve cualquier columna de un Excel a su campo de entidad correspondiente sin código hardcodeado.

**Algoritmo de mapeo (`map(header)`):**
1. **Normalización**: elimina prefijos numéricos (`"3.1 "`, `"4.3 "`), contenido parentético corto, acentos, puntuación, y convierte a lowercase
2. **Coincidencia exacta**: busca el header normalizado en el índice invertido de sinónimos
3. **Substring (con especificidad)**: si múltiples sinónimos coinciden via contains, se elige el de mayor longitud (más específico). Esto evita que términos genéricos como "experiencia laboral" sobrerrepresenten a campos específicos.
4. **Solapamiento de palabras**: para sinónimos de ≥2 palabras, calcula ratio de intersección con las palabras del header (umbral 65%)

**Flujo en `ExcelService.importar()`:**

```
Leer headers del Excel
         │
         ▼
¿Comienza con "3."? ──sí──→ Mapa exacto BBDD + ColumnMapper como fallback
         │ no
         ▼
¿Contiene "Nombre_Completo"? ──sí──→ Mapa exacto MAESTRA + ColumnMapper como fallback
         │ no
         ▼
Usar ColumnMapper para todas las columnas (formato nuevo/desconocido)
         │
         ▼
Por cada fila:
  ├─ Mapear columna → campo vía ColumnMapper
  ├─ Asignar valor al estudiante (conversión de tipos: enteros, booleanos, fechas, nivelIngles)
  └─ Upsert:
       ├─ Por email (primario)
       └─ Por numeroDocumento (secundario, si email no encontró match)
         │
         ▼
Devolver: importados, errores, columnasMapeadas, columnasSinMapeo
```

**Deduplicación mejorada**: ahora busca también por `numeroDocumento` si el email no existe. El repositorio `EstudianteRepository` tiene el nuevo método `findByNumeroDocumento()`.

### Parsing inteligente de campos

El método `asignar()` en `ExcelService` maneja conversiones de tipos con tolerancia a texto no estructurado:

| Campo | Valores textuales aceptados | Conversión |
|---|---|---|
| `aniosExperiencia` | `"No tengo experiencia laboral aún"`, `"Menos de 6 meses"`, `"Entre 6 meses y 1 año"`, `"Entre 1 y 2 años"`, `"Más de 2 años"` | Texto → entero (0, 0, 1, 2, 3) |
| `aniosExperiencia` | Números con coma decimal | `"3,5"` → `4` (redondeo) |
| Booleanos | `"Sí"`, `"No"`, `"Si"`, `"True"`, `"False"`, `"1"`, `"0"` | Texto → `Boolean` |
| `fechaNacimiento` | `dd/MM/yyyy`, `yyyy-MM-dd`, `dd-MM-yyyy` | Texto → `LocalDate` |
| `nivelIngles` | `"B2"`, `"C1"`, `"A2"`, etc. | Código → entidad `NivelIngles` |

### ExcelService — métodos eliminados

- `mapearBBDD()` — reemplazado por el loop genérico sobre `columnMap`
- `mapearMaestra()` — reemplazado; la lógica de `Nombre_Completo` se conserva como post-procesamiento
- `mapearGenerico()` — reemplazado por `ColumnMapper`

### Nuevos campos en respuesta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `columnasMapeadas` | Map<String, String> | Header de Excel → campo de entidad |
| `columnasSinMapeo` | List<String> | Headers que no se pudieron mapear |

---

## Nuevos componentes (esta sesión)

| Componente | Ubicación | Propósito |
|---|---|---|
| `ColumnMapper` | `com.novacrm.excel` | Mapeo dinámico de columnas Excel por sinónimos |
| `SkillSynonyms` | `com.novacrm.matching` | Tokenizador con sinónimos técnico-laborales para matching |
| `MatchingConfig` | `com.novacrm.config` | Config externa de pesos/umbral del matching |
| `EstudianteHabilidadRepository` | `com.novacrm.habilidad` | Repositorio para consultar habilidades por estudiante |
| `AdminService` / `AdminController` | `com.novacrm.admin` | Operaciones masivas: soft/hard delete por programa, cleanup total |
| `PurgeScheduler` | `com.novacrm.config` | Limpieza semanal de papelera (domingo 3 AM, retención 30 días) |

### Papelera de reciclaje

Todos los soft-deletes (`DELETE /api/v1/estudiantes/{id}`, `DELETE /admin/programas/{id}/estudiantes`) ahora marcan `deleted_at = now()` además de `activo = false`.

**Endpoint públicos de papelera:**

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/estudiantes/papelera?programaId=X` | Lista estudiantes en papelera (activo=false) paginados, ordenados por deleted_at DESC |
| `POST` | `/api/v1/estudiantes/{id}/restaurar` | Restaura un estudiante (activo=true, deleted_at=null) |

**Retención:** 30 días. El `PurgeScheduler` (domingo 3 AM) elimina físicamente estudiantes con `deleted_at < now() - 30 días`, incluyendo todas sus dependencias (matches, notificaciones, habilidades, certificaciones, credenciales).

### Administración masiva

El paquete `com.novacrm.admin` implementa cinco operaciones vía `EntityManager` para borrados eficientes sin cargar entidades en memoria:

| Endpoint | Descripción |
|---|---|
| `DELETE /api/v1/admin/programas/{id}/estudiantes` | Soft delete (`activo=false`, `deleted_at=now()`) de todos los estudiantes de un programa |
| `DELETE /api/v1/admin/programas/{id}/reset` | Hard delete con cascada: matches → notificaciones → habilidades → certificaciones → linkedin → estudiantes |
| `POST /api/v1/admin/programas/{id}/restaurar-estudiantes` | Restaura todos los estudiantes de un programa desde la papelera |
| `DELETE /api/v1/admin/purgar-papelera` | Elimina físicamente estudiantes con más de 30 días en papelera (purga manual) |
| `DELETE /api/v1/admin/cleanup` | Vacía todo el sistema transaccional (deja catálogos, programas, empresas, usuarios) |

### Archivos de configuración YAML

| Archivo | Propósito |
|---|---|
| `column-synonyms.yml` | 42 grupos de sinónimos para mapeo de columnas Excel |
| `matching-synonyms.yml` | 28 grupos de sinónimos técnico-laborales para matching |
| `matching-config.yml` | Pesos, umbral mínimo y máximo de vacantes del matching |

---

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

### PurgeScheduler
- **Cron:** `0 0 3 * * SUN` (03:00 domingo)
- Elimina físicamente estudiantes con `activo=false` y `deleted_at < now() - 30 días`, incluyendo matches, notificaciones, habilidades, certificaciones y credenciales

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
4. **Soft-delete con papelera** — Estudiantes se desactivan (`activo = false`) con `deleted_at = now()`, permitiendo restaurarlos. Purga automática a los 30 días via `PurgeScheduler`. Programas solo se desactivan sin papelera.
5. **DTOs con records (Java 17)** — Inmutables, concisos, sin dependencia de Lombok
6. **Bucket4j sobre Redis** — Rate limiting en memoria (sin dependencia externa adicional)

## Monitoreo

| Herramienta | Endpoint | Puerto |
|-------------|----------|--------|
| Prometheus | `/actuator/prometheus` | 8080 |
| Grafana | (dashboard configurable) | 3000 |
| Loki | (logs agregados) | 3100 |
