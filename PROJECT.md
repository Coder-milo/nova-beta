# Project: Multi-Tier Scraping Architecture & ATS Aggregation

## Architecture
- **Multi-Tier Scraping Engine**:
  - **Tier 1 (Native Connectors)**: `LinkedInJobsScraper`, `ComputrabajoScraper`, `ElempleoScraper`, `JoobleConnector`, `RemotiveConnector`, `MagnetoScraper`.
  - **Tier 2 (Proxy Aggregator)**: `JSearchConnector` (Indeed, Glassdoor, ZipRecruiter) guarded by persistent quota tracking (`ControlDeCuota` + `CuotaFuente`).
  - **Tier 3 (Direct ATS Connectors)**: `SmartRecruitersConnector` and direct ATS aggregation for major Atlántico employers (Sutherland, Alorica, Teleperformance, TaskUs, Auxis, Foundever).
- **Resilience & Circuit Breaker**:
  - Dedicated daemon thread pool (`MAXIMO_HILOS = 4`) decoupled from DB transactions.
  - Per-portal isolation: individual `Callable<Void>` execution with try-catch so HTTP 403/500/Captcha/Timeout in one source never aborts the scraping run or other connectors.
  - `ReintentoConEspera` with exponential backoff + jitter + `Retry-After` header handling.
  - Comprehensive telemetry logging into `scraping_ejecucion` (`ofertas_por_portal`, `descartadas_por_idioma`, `error`).
- **Deduplication & Quality Filters**:
  - `RegistroDeVacante`: double deduplication using `hash_dedup` (`sha256(fuente|id)`) and `hash_contenido` (`sha256(normalizar(titulo)|normalizar(empresa))`).
  - `AreaMetropolitana.esAtlanticoORemota`: strict geographic validation (22 Atlántico municipalities or 100% remote).
  - `FiltroBilingue.esDeTrabajoEnIngles`: bilingual/English requirement filter.
- **Admin Monitoring & Control API & UI**:
  - Endpoints: `GET /api/v1/vacantes/scraping/fuentes`, `POST /api/v1/vacantes/scraping/fuentes/{fuente}/probar`, `POST /api/v1/vacantes/scraping/fuentes/{fuente}/sincronizar`.
  - UI: `PanelConectoresScraping` in `/vacantes` with live status badges (`Activo`, `En espera de API Key`, `Error de portal`), quota counters, individual source testing and on-demand synchronization.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Tier 1 Native Connectors | LinkedIn, Computrabajo, ElEmpleo, Jooble, Remotive, Magneto scrapers conforming to `FuenteDeVacantes` | M1 | survey |
| 2 | Tier 2 JSearch Proxy Aggregator | Indeed, Glassdoor, ZipRecruiter aggregation with quota limits & graceful fallback | M1 | survey |
| 3 | Tier 3 Direct ATS Connectors | SmartRecruiters ATS connector with `hashDedup` fix and Atlántico BPO support | M1 | survey |
| 4 | Circuit Breaker & Error Isolation | Independent portal execution, 403/500/Captcha tolerance, telemetry in `scraping_ejecucion` | M2 | survey |
| 5 | Cross-Source Deduplication | `hash_contenido` calculation and uniqueness checks in `RegistroDeVacante` | M2 | survey |
| 6 | Geographic & Bilingual Filtering | `AreaMetropolitana.esAtlanticoORemota` and `FiltroBilingue.esDeTrabajoEnIngles` | M2 | survey |
| 7 | Connector Status & Action Endpoints | Backend REST endpoints to inspect connector health and test/sync single sources | M3 | survey |
| 8 | Admin Live Monitoring UI | Responsive status board with live connector badges and test/sync buttons in `/vacantes` conforming to `AGENTS.md` | M3 | survey |
| 9 | Comprehensive Test Suite & QA | `ScrapingServiceTest` and verification of all scrapers (`mvn test`, `npx tsc --noEmit`) | M4 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend Connectors & ATS Fixes | Fix `SmartRecruitersConnector` `hashDedup` bug, ensure all Tier 1, 2, 3 connectors are properly configured and handle Atlántico employers | none | PLANNED |
| 2 | Circuit Breaker, Deduplication & Quality Pipeline | Verify & enhance `ScrapingService` error isolation, `RegistroDeVacante` `hashContenido` guard, metrics tracking in `ScrapingEjecucion` | M1 | PLANNED |
| 3 | Admin Monitoring & Control (API + Frontend UI) | Implement connector status & test/sync endpoints in `VacanteController`/`ScrapingService` and `PanelConectoresScraping` component in frontend | M2 | PLANNED |
| 4 | Verification & Quality Assurance | Create `ScrapingServiceTest.java`, execute complete test suite with 0 failures, verify TypeScript build | M3 | PLANNED |

## Interface Contracts
### ScrapingService ↔ VacanteController
- `List<EstadoConectorDto> listarEstadoConectores()`
- `ResultadoPruebaFuenteDto probarFuente(String nombreFuente)`
- `ResultadoActualizacion sincronizarFuente(String nombreFuente)`

### Frontend API ↔ Backend Controller
- `GET /api/v1/vacantes/scraping/fuentes` -> `List<EstadoConector>`
- `POST /api/v1/vacantes/scraping/fuentes/{fuente}/probar` -> `ResultadoPruebaFuente`
- `POST /api/v1/vacantes/scraping/fuentes/{fuente}/sincronizar` -> `ResultadoActualizacion`

## Code Layout
- Backend:
  - `back-end/src/main/java/com/novacrm/scraper/fuente/` (Connectors, filters, quota)
  - `back-end/src/main/java/com/novacrm/scraper/portal/` (Native portal scrapers)
  - `back-end/src/main/java/com/novacrm/scraper/ScrapingService.java`
  - `back-end/src/main/java/com/novacrm/scraper/dto/` (EstadoConectorDto, ResultadoPruebaFuenteDto, etc.)
  - `back-end/src/main/java/com/novacrm/vacante/VacanteController.java`
  - `back-end/src/main/java/com/novacrm/vacante/RegistroDeVacante.java`
  - `back-end/src/test/java/com/novacrm/scraper/ScrapingServiceTest.java`
- Frontend:
  - `front-end/src/app/vacantes/page.tsx`
  - `front-end/src/components/admin/panel-conectores-scraping.tsx`
  - `front-end/src/services/vacantes.ts`
