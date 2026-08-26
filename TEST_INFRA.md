# E2E Test Infra: NOVA-CRM Multi-Career Bilingual Scraping & Filtering System

## Test Philosophy
- Requirement-driven, opaque-box and component unit testing.
- Methodology: Category-Partition + Boundary Value Analysis + Combinatorial + Real-World Workload Testing.

## Feature Inventory & Test Mapping
| # | Feature | Source | Tier 1 (Unit) | Tier 2 (Boundary) | Tier 3 (Integration) | Tier 4 (E2E) |
|---|---------|--------|:-------------:|:-----------------:|:-------------------:|:------------:|
| 1 | Multi-Disciplinary Ingestion | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 2 | Bilingual Modifiers Enrichment | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 3 | Multi-Industry Fallback Nucleus | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 4 | Frequency Sorting & Cap | ORIGINAL_REQUEST §R1, §R4 | ✓ | ✓ | ✓ | ✓ |
| 5 | Local Connectors (Computrabajo, Elempleo, LinkedIn) | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 6 | Global Connectors (Remotive, Arbeitnow, SmartRecruiters, JSearch) | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 7 | Strict 100% Local English Gate | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 8 | Multidisciplinary Pattern & CEFR Extraction | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 9 | Negative Pattern Guards (B2B, B2C, codes) | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 10 | Two-Tier Deduplication (`hashDedup` + `hashContenido`) | ORIGINAL_REQUEST §R4 | ✓ | ✓ | ✓ | ✓ |
| 11 | Persistent Monthly Quota Control | ORIGINAL_REQUEST §R4 | ✓ | ✓ | ✓ | ✓ |
| 12 | Dedicated Pool & Resilient Run | ORIGINAL_REQUEST §R4 | ✓ | ✓ | ✓ | ✓ |

## Test Architecture
- Framework: JUnit 5, Mockito, AssertJ, Spring Boot Test, Maven Surefire Plugin.
- Test Execution Commands:
  - Scraper & Filter Focus: `mvn test "-Dtest=*Scrap*,*FiltroBilingue*,*TerminosDeBusqueda*"`
  - Full Backend Verification: `mvn test`
- Mock Strategy: Network isolation in unit tests using static HTML fixtures and mock HTTP responses to guarantee deterministic, rapid CI/CD runs.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Expected Outcome |
|---|----------|--------------------|------------------|
| S1 | Software Engineering student registered in Barranquilla | F1, F2, F5, F7, F8 | Generates terms like `"desarrollo de software bilingue"`, queries local/remote portals, filters out non-bilingual positions, admits bilingual Java/React roles. |
| S2 | Accounting & Finance student with B2 English requirement | F1, F2, F6, F8, F9 | Ingests accounting titles, matches bilingual financial analyst posts, tags CEFR B2, excludes non-language "B2" warehouse/zone listings. |
| S3 | Graphic & UI/UX Design student in hybrid market | F1, F2, F5, F8, F10 | Generates bilingual design queries, matches across portals, prevents cross-portal duplicate postings via `hashContenido`. |
| S4 | European Visa Migration seeker | F6, F7, F11 | Ingests Arbeitnow vacancies with `visa_sponsorship=true`, classifies as `MIGRACION`, bypasses Spanish-only filter. |
| S5 | High-load concurrent run with rate limits & quotas | F4, F10, F11, F12 | Respects 10-term budget, caps JSearch monthly quota, retries 429 backoff gracefully, finishes within 8-minute pool timeout. |
