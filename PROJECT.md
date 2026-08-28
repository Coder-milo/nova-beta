# Project: NOVA-CRM Multi-Career Bilingual Scraping & Filtering System

## Architecture
- **Language / Framework**: Java 17+, Spring Boot 3.x, Maven, JUnit 5, Mockito, AssertJ, Jsoup.
- **Layering & Module Boundaries**:
  - `com.novacrm.scraper`: Core scraping coordination (`ScrapingService`, `TerminosDeBusqueda`, `ScrapingScheduler`).
  - `com.novacrm.scraper.fuente`: Connector contracts (`FuenteDeVacantes`), language gatekeeper (`FiltroBilingue`), geographic filter (`AreaMetropolitana`), quota management (`ControlDeCuota`), and retry backoff (`ReintentoConEspera`).
  - `com.novacrm.scraper.portal`: Specific scrapers for local and global job boards (`ComputrabajoScraper`, `ElempleoScraper`, `LinkedInJobsScraper`, `RemotiveConnector`, `ArbeitnowConnector`, `SmartRecruitersConnector`, `JSearchConnector`).
  - `com.novacrm.vacante`: Vacancy models (`Vacante`, `OfertaCruda`), enrichment (`EnriquecedorDeVacante`), and persistence registration (`RegistroDeVacante`).
  - `com.novacrm.estudiante`: Student entity (`Estudiante`) and query interface (`EstudianteRepository`).

## Code Layout
- `back-end/src/main/java/com/novacrm/scraper/TerminosDeBusqueda.java` — Dynamic search term generator.
- `back-end/src/main/java/com/novacrm/scraper/fuente/FiltroBilingue.java` — Strict multidisciplinary bilingual filter.
- `back-end/src/main/java/com/novacrm/scraper/fuente/FuenteDeVacantes.java` — Unified vacancy source contract.
- `back-end/src/main/java/com/novacrm/scraper/fuente/ControlDeCuota.java` — Database-backed quota control.
- `back-end/src/main/java/com/novacrm/scraper/fuente/ReintentoConEspera.java` — Resilient retry with jitter.
- `back-end/src/main/java/com/novacrm/scraper/fuente/AreaMetropolitana.java` — Local/Remote geographic admissibility.
- `back-end/src/main/java/com/novacrm/scraper/ScrapingService.java` — Dedicated scraping thread pool orchestrator.
- `back-end/src/main/java/com/novacrm/vacante/EnriquecedorDeVacante.java` — NLP & regex attribute enricher.
- `back-end/src/main/java/com/novacrm/vacante/RegistroDeVacante.java` — Two-tier deduplication & employer filter.
- `back-end/src/main/java/com/novacrm/estudiante/EstudianteRepository.java` — Student career goal queries.
- `back-end/src/test/java/com/novacrm/scraper/...` — Unit, integration, and E2E scraper test suites.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Multi-Disciplinary Student Ingestion | Query all academic fields (`cargoObjetivo`, `sectorObjetivo`, `titulo`, `programaAcademico`, `areaFormacion`) across engineering, finance, design, tech, and business. | M1 | ORIGINAL_REQUEST R1 |
| 2 | Dynamic Bilingual Enrichment | Automatically pair extracted career tokens with bilingual search affixes (`[cargo] bilingue`, `[cargo] ingles`, `bilingual [cargo]`, `english [cargo]`). | M1 | ORIGINAL_REQUEST R1 |
| 3 | Balanced Multi-Industry Fallback Nucleus | Provide built-in fallback search terms covering Tech, Business, Engineering, Design, and Support/BPO. | M1 | ORIGINAL_REQUEST R1 |
| 4 | Frequency Sorting & Search Budget Guard | Rank terms by cohort frequency and cap at `MAX_TERMINOS = 10` to avoid rate limit spikes. | M1 | ORIGINAL_REQUEST R1, R4 |
| 5 | Local Colombia Scraping Connectors | Computrabajo, Elempleo, and LinkedIn Jobs multi-career querying with geographic filtering (`AreaMetropolitana`). | M2 | ORIGINAL_REQUEST R2 |
| 6 | Global & Remote Scraping Connectors | Remotive, Arbeitnow, SmartRecruiters, and JSearch ingestion across all disciplines with English tagging. | M2 | ORIGINAL_REQUEST R2 |
| 7 | Strict Local Bilingual Language Gate | 100% rejection of local postings lacking English language requirements. | M3 | ORIGINAL_REQUEST R3 |
| 8 | Multidisciplinary Language Pattern Matching | Recognize CEFR levels (`MCER`, `CEFR`, `B2+`, `C1+`), technical English, and conversational variations across engineering, finance, design, and tech. | M3 | ORIGINAL_REQUEST R3 |
| 9 | Negative Pattern False-Positive Protection | Guard against non-language abbreviations (B2B, B2C, warehouse/zone codes). | M3 | ORIGINAL_REQUEST R3 |
| 10 | Two-Tier Deduplication | Uniqueness by source ID (`hashDedup`) and cross-portal content (`hashContenido`). | M4 | ORIGINAL_REQUEST R4 |
| 11 | Transactional Monthly Quota Control | Persistent database-backed quota consumption per source in `cuota_fuente`. | M4 | ORIGINAL_REQUEST R4 |
| 12 | Dedicated Pool & Resilient Scraping Run | Dedicated thread pool (`MAXIMO_HILOS = 4`), run timeout (8 min), and exponential backoff retry with jitter. | M4 | ORIGINAL_REQUEST R4 |
| 13 | Full E2E Scraper & Backend Verification | Comprehensive test execution: `mvn test "-Dtest=*Scrap*,*FiltroBilingue*,*TerminosDeBusqueda*"` and overall `mvn test`. | M5 | ORIGINAL_REQUEST Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | TerminosDeBusqueda & Multi-Career Keywords | Ingest all student academic fields, bilingual query enrichment, balanced multi-industry fallback nucleus, frequency sorting, and test suite. | none | DONE |
| M2 | Hybrid Connectors & Portals | Local & global connectors verification and multi-career integration (Computrabajo, Elempleo, LinkedIn, Remotive, Arbeitnow, SmartRecruiters, JSearch). | M1 | DONE |
| M3 | Precision Multidisciplinary Bilingual Filter | Strict 100% local language gate, multidisciplinary CEFR/conversational regex patterns, negative guards (B2B, B2C), and test suite. | M1 | DONE |
| M4 | Deduplication, Quotas & Performance Hardening | Two-tier deduplication, persistent monthly quota tracking, thread pool isolation, exponential backoff with jitter. | M2, M3 | DONE |
| M5 | E2E Integration & Full Suite Test Verification | Targeted scraper tests (`*Scrap*`, `*FiltroBilingue*`, `*TerminosDeBusqueda*`) and full backend `mvn test` verification. | M1, M2, M3, M4 | DONE |

## Interface Contracts
### `EstudianteRepository` ↔ `TerminosDeBusqueda` / `ScrapingService`
- Inputs: Active student records.
- Queries: `findCargosObjetivoDeActivos()`, `findSectoresObjetivoDeActivos()`, `findTitulosDeActivos()`, `findProgramasAcademicosDeActivos()`, `findAreasFormacionDeActivos()`.
- Return: `List<String>` of raw distinct tokens.

### `TerminosDeBusqueda` ↔ `ScrapingService` / `FuenteDeVacantes`
- Method: `List<String> generar(List<String> textosCandidatos, List<String> sectores)`
- Output: Ordered list of max 10 normalized search query strings enriched with bilingual modifiers, falling back to multidisciplinary nucleus.

### `FiltroBilingue` ↔ `ScrapingService`
- Method: `boolean esBilingue(Vacante vacante)`
- Output: `true` if `vacante.segmento == REMOTO_INGLES` OR `vacante.nivelInglesRequerido != null` OR text contains verified language requirement; `false` otherwise.
