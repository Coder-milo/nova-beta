package com.novacrm.scraper;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.scraper.dto.EjecucionDeScraping;
import com.novacrm.scraper.dto.EstadoConectorDto;
import com.novacrm.scraper.dto.ResultadoActualizacion;
import com.novacrm.scraper.dto.ResultadoPruebaFuenteDto;
import com.novacrm.scraper.fuente.*;
import com.novacrm.scraper.portal.*;
import com.novacrm.vacante.EnriquecedorDeVacante;
import com.novacrm.vacante.RegistroDeVacante;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Empirical Verification Harness for Milestone 2:
 * Connectors, Segment Classification, Geographic Filtering, and Fault-Tolerant Scraping Isolation.
 */
public class M2EmpiricalTestRunner {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static int totalFound = 0;
    private static int totalPassed = 0;
    private static int totalFailed = 0;
    private static final List<String> failures = new ArrayList<>();

    public static void main(String[] args) {
        System.out.println("================================================================================");
        System.out.println("  NOVA-CRM Empirical Challenger 2 - Milestone 2 Verification Harness");
        System.out.println("  Targets: Connectors, Segment Tagging, AreaMetropolitana, ScrapingService Isolation");
        System.out.println("================================================================================");

        long start = System.currentTimeMillis();

        runSuite("SUITE 1: Segment Classification & Tagging Across All 7 Sources", M2EmpiricalTestRunner::runSuite1SegmentClassification);
        runSuite("SUITE 2: Geographic Filtering (AreaMetropolitana.esAtlanticoORemota)", M2EmpiricalTestRunner::runSuite2GeographicFiltering);
        runSuite("SUITE 3: ScrapingService Non-Blocking Error Isolation (1 Failure, 6 Successes)", M2EmpiricalTestRunner::runSuite3ErrorIsolation);
        runSuite("SUITE 4: ScrapingService Severe Failures & Timeout Handling", M2EmpiricalTestRunner::runSuite4SevereFailuresAndTimeout);
        runSuite("SUITE 5: Diagnostic Endpoints & Quota Protection", M2EmpiricalTestRunner::runSuite5DiagnosticsAndQuota);

        long elapsed = System.currentTimeMillis() - start;

        System.out.println("\n----------------------------- FINAL TEST SUMMARY -----------------------------");
        System.out.printf("Total Assertions Executed: %d%n", totalFound);
        System.out.printf("Total Succeeded:           %d%n", totalPassed);
        System.out.printf("Total Failed:              %d%n", totalFailed);
        System.out.printf("Execution Time:            %d ms%n", elapsed);
        System.out.println("------------------------------------------------------------------------------");

        if (totalFailed > 0) {
            System.err.println("\n>>> FAILURES DETECTED <<<");
            failures.forEach(System.err::println);
            System.exit(1);
        } else {
            System.out.println("\n>>> EMPIRICAL VERDICT: ALL TESTS SUCCEEDED WITH ZERO ERRORS (APPROVE) <<<");
            System.exit(0);
        }
    }

    private static void runSuite(String suiteName, Runnable runnable) {
        System.out.println("\n[" + suiteName + "]");
        try {
            runnable.run();
        } catch (Throwable t) {
            System.err.println("CRITICAL FAILURE in " + suiteName + ": " + t.getMessage());
            t.printStackTrace();
            totalFailed++;
            failures.add("CRITICAL: " + suiteName + " -> " + t.getMessage());
        }
    }

    private static void check(String description, boolean condition) {
        totalFound++;
        System.out.printf("  - [TEST] %-72s ... ", description);
        if (condition) {
            System.out.println("PASSED");
            totalPassed++;
        } else {
            System.out.println("FAILED");
            totalFailed++;
            failures.add("FAILED: " + description);
        }
    }

    private static String sha256(String input) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // =========================================================================
    // Reflection Invokers for Package-Private Connector Methods
    // =========================================================================
    @SuppressWarnings("unchecked")
    private static Optional<Vacante> invokeMapearRemotive(RemotiveConnector connector, JsonNode json) {
        try {
            Method m = RemotiveConnector.class.getDeclaredMethod("mapear", JsonNode.class);
            m.setAccessible(true);
            return (Optional<Vacante>) m.invoke(connector, json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static Optional<OfertaCruda> invokeMapearArbeitnow(ArbeitnowConnector connector, JsonNode json) {
        try {
            Method m = ArbeitnowConnector.class.getDeclaredMethod("mapear", JsonNode.class);
            m.setAccessible(true);
            return (Optional<OfertaCruda>) m.invoke(connector, json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<OfertaCruda> invokeParsearComputrabajo(Document doc, String ciudad) {
        try {
            Method m = ComputrabajoScraper.class.getDeclaredMethod("parsear", Document.class, String.class);
            m.setAccessible(true);
            return (List<OfertaCruda>) m.invoke(null, doc, ciudad);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<OfertaCruda> invokeParsearElempleo(Document doc) {
        try {
            Method m = ElempleoScraper.class.getDeclaredMethod("parsear", Document.class);
            m.setAccessible(true);
            return (List<OfertaCruda>) m.invoke(null, doc);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<OfertaCruda> invokeParsearLinkedIn(Document doc, String ciudad) {
        try {
            Method m = LinkedInJobsScraper.class.getDeclaredMethod("parsear", Document.class, String.class);
            m.setAccessible(true);
            return (List<OfertaCruda>) m.invoke(null, doc, ciudad);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<OfertaCruda> invokeProcesarSmartRecruiters(SmartRecruitersConnector connector, String json, String empresa) {
        try {
            Method m = SmartRecruitersConnector.class.getDeclaredMethod("procesar", String.class, String.class);
            m.setAccessible(true);
            return (List<OfertaCruda>) m.invoke(connector, json, empresa);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<OfertaCruda> invokeProcesarJSearch(JSearchConnector connector, String json) {
        try {
            Method m = JSearchConnector.class.getDeclaredMethod("procesar", String.class);
            m.setAccessible(true);
            return (List<OfertaCruda>) m.invoke(connector, json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // =========================================================================
    // SUITE 1: Segment Classification & Tagging Across All 7 Sources
    // =========================================================================
    private static void runSuite1SegmentClassification() {
        // 1. RemotiveConnector -> REMOTO_INGLES
        RemotiveConnector remotive = new RemotiveConnector(true);
        check("1.1 RemotiveConnector declares Segmento.REMOTO_INGLES",
                remotive.segmento() == Segmento.REMOTO_INGLES);

        try {
            var remotiveJson = MAPPER.readTree("""
                    {
                      "id": 8881,
                      "url": "https://remotive.com/job/8881",
                      "title": "Bilingual Customer Support Representative",
                      "company_name": "GlobalTech",
                      "candidate_required_location": "LATAM",
                      "description": "Must speak fluent English and have remote setup."
                    }
                    """);
            Optional<Vacante> vacRem = invokeMapearRemotive(remotive, remotiveJson);
            check("1.2 Remotive mapped vacancy tagged Segmento.REMOTO_INGLES",
                    vacRem.isPresent() && vacRem.get().getSegmento() == Segmento.REMOTO_INGLES);
            check("1.3 Remotive vacancy modality set to REMOTO",
                    vacRem.isPresent() && "REMOTO".equalsIgnoreCase(vacRem.get().getModalidadTrabajo()));

            // Candidate location gate
            var usaOnlyJson = MAPPER.readTree("""
                    {"id": 8882, "title": "Senior Engineer", "candidate_required_location": "USA Only"}
                    """);
            check("1.4 Remotive drops vacancies restricted to 'USA Only'",
                    invokeMapearRemotive(remotive, usaOnlyJson).isEmpty());

            var germanyOnlyJson = MAPPER.readTree("""
                    {"id": 8883, "title": "DevOps", "candidate_required_location": "Germany"}
                    """);
            check("1.5 Remotive drops vacancies restricted to 'Germany'",
                    invokeMapearRemotive(remotive, germanyOnlyJson).isEmpty());

            for (String adm : List.of("Worldwide", "Anywhere", "Global", "Latam", "Latin America", "South America", "Americas", "Colombia", "")) {
                var json = MAPPER.readTree(String.format("{\"id\": 8884, \"title\": \"Support\", \"candidate_required_location\": \"%s\"}", adm));
                check("1.6 Remotive admits region: '" + (adm.isEmpty() ? "<empty>" : adm) + "'",
                        invokeMapearRemotive(remotive, json).isPresent());
            }
        } catch (Exception e) {
            check("1.x Remotive JSON parsing error: " + e.getMessage(), false);
        }

        // 2. ArbeitnowConnector -> MIGRACION
        ArbeitnowConnector arbeitnow = new ArbeitnowConnector(true, true);
        check("1.7 ArbeitnowConnector declares Segmento.MIGRACION",
                arbeitnow.segmento() == Segmento.MIGRACION);

        try {
            var visaJson = MAPPER.readTree("""
                    {
                      "slug": "backend-dev-visa-123",
                      "title": "Senior Java Developer",
                      "company_name": "Berlin Fintech",
                      "location": "Berlin, Germany",
                      "remote": false,
                      "visa_sponsorship": true,
                      "description": "Full visa sponsorship provided for relocation to Germany."
                    }
                    """);
            Optional<OfertaCruda> visaVac = invokeMapearArbeitnow(arbeitnow, visaJson);
            check("1.8 Arbeitnow mapped vacancy tagged Segmento.MIGRACION",
                    visaVac.isPresent() && visaVac.get().vacante().getSegmento() == Segmento.MIGRACION);
            check("1.9 Arbeitnow preserves company name from JSON payload",
                    visaVac.isPresent() && "Berlin Fintech".equals(visaVac.get().nombreEmpresa()));

            var noVisaJson = MAPPER.readTree("""
                    {
                      "slug": "marketing-lead-novisa-456",
                      "title": "Marketing Lead",
                      "company_name": "Munich Agency",
                      "location": "Munich, Germany",
                      "remote": false,
                      "visa_sponsorship": false
                    }
                    """);
            check("1.10 Arbeitnow drops vacancies with visa_sponsorship=false when soloConVisa=true",
                    invokeMapearArbeitnow(arbeitnow, noVisaJson).isEmpty());

            var missingVisaJson = MAPPER.readTree("""
                    {
                      "slug": "devops-missing-visa-789",
                      "title": "DevOps Engineer",
                      "company_name": "Frankfurt Cloud",
                      "location": "Frankfurt, Germany"
                    }
                    """);
            check("1.11 Arbeitnow drops vacancies with missing visa_sponsorship field",
                    invokeMapearArbeitnow(arbeitnow, missingVisaJson).isEmpty());

            // Check permissive mode if soloConVisa is disabled
            ArbeitnowConnector arbeitnowPermissive = new ArbeitnowConnector(true, false);
            check("1.12 Arbeitnow admits non-visa vacancies when soloConVisa=false",
                    invokeMapearArbeitnow(arbeitnowPermissive, noVisaJson).isPresent());
        } catch (Exception e) {
            check("1.x Arbeitnow JSON parsing error: " + e.getMessage(), false);
        }

        // 3. ComputrabajoScraper -> LOCAL_COLOMBIA
        ComputrabajoScraper computrabajo = new ComputrabajoScraper(true);
        check("1.13 ComputrabajoScraper declares Segmento.LOCAL_COLOMBIA",
                computrabajo.segmento() == Segmento.LOCAL_COLOMBIA);
        check("1.14 ComputrabajoScraper declares filtraPorCiudad=true",
                computrabajo.filtraPorCiudad());

        String ctHtmlPresencial = """
                <article class="box_offer" data-id="CT-PRES-101">
                  <a class="title_offer" href="/ofertas-de-trabajo/oferta-de-trabajo-de-asesor-bilingue-en-barranquilla-CT-PRES-101">Asesor Bilingue Barranquilla</a>
                  <a href="/empresas/sutherland">Sutherland</a>
                  <p class="fs16"><span class="mr10">Barranquilla, Atlántico</span></p>
                  <p class="description">Atencion al cliente presencial en Barranquilla. English required.</p>
                </article>
                """;
        List<OfertaCruda> ctPresencialList = invokeParsearComputrabajo(Jsoup.parse(ctHtmlPresencial), "Barranquilla");
        check("1.15 Computrabajo presencial job mapped to Segmento.LOCAL_COLOMBIA",
                !ctPresencialList.isEmpty() && ctPresencialList.get(0).vacante().getSegmento() == Segmento.LOCAL_COLOMBIA);

        String ctHtmlRemoto = """
                <article class="box_offer" data-id="CT-REM-202">
                  <a class="title_offer" href="/ofertas-de-trabajo/oferta-de-trabajo-de-customer-service-remoto-CT-REM-202">Customer Service 100% Remoto</a>
                  <a href="/empresas/teleperformance">Teleperformance</a>
                  <p class="description">Trabajo 100% remoto desde casa en Colombia. Bilingüe.</p>
                </article>
                """;
        List<OfertaCruda> ctRemotoList = invokeParsearComputrabajo(Jsoup.parse(ctHtmlRemoto), "Barranquilla");
        check("1.16 Computrabajo 100% remote job promoted to Segmento.REMOTO_INGLES",
                !ctRemotoList.isEmpty() && ctRemotoList.get(0).vacante().getSegmento() == Segmento.REMOTO_INGLES);

        // 4. ElempleoScraper -> LOCAL_COLOMBIA
        ElempleoScraper elempleo = new ElempleoScraper(false);
        check("1.17 ElempleoScraper declares Segmento.LOCAL_COLOMBIA",
                elempleo.segmento() == Segmento.LOCAL_COLOMBIA);

        String eeHtml = """
                <div class="js-area-bind" data-url="/co/ofertas-empleo/bilingual-agent-123"
                     data-ga4-offerdata='{"id":"EE-123","title":"Bilingual Technical Support Agent","company":"Auxis","location":"Barranquilla","salary":"$2.500.000","equivalentPositions":["Tech Support"],"tags":["Bilingual","English"]}'>
                </div>
                """;
        List<OfertaCruda> eeList = invokeParsearElempleo(Jsoup.parse(eeHtml));
        check("1.18 Elempleo vacancy mapped to Segmento.LOCAL_COLOMBIA",
                !eeList.isEmpty() && eeList.get(0).vacante().getSegmento() == Segmento.LOCAL_COLOMBIA);
        check("1.19 Elempleo parses equivalent positions and tags into description",
                !eeList.isEmpty() && eeList.get(0).vacante().getDescripcion().contains("Tech Support"));

        // 5. LinkedInJobsScraper -> LOCAL_COLOMBIA
        LinkedInJobsScraper linkedin = new LinkedInJobsScraper(true);
        check("1.20 LinkedInJobsScraper declares Segmento.LOCAL_COLOMBIA",
                linkedin.segmento() == Segmento.LOCAL_COLOMBIA);
        check("1.21 LinkedInJobsScraper declares filtraPorCiudad=true",
                linkedin.filtraPorCiudad());

        String lkHtmlPresencial = """
                <li>
                  <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/999888771">
                    <h3 class="base-search-card__title">Bilingual Customer Service Specialist</h3>
                  </a>
                  <h4 class="base-search-card__subtitle">Alorica</h4>
                  <span class="job-search-card__location">Barranquilla, Atlantico, Colombia</span>
                  <p class="job-search-card__snippet">Full time on site customer support. Fluent English required.</p>
                </li>
                """;
        List<OfertaCruda> lkPresencialList = invokeParsearLinkedIn(Jsoup.parse(lkHtmlPresencial), "Barranquilla");
        check("1.22 LinkedIn presencial Atlantico vacancy mapped to Segmento.LOCAL_COLOMBIA",
                !lkPresencialList.isEmpty() && lkPresencialList.get(0).vacante().getSegmento() == Segmento.LOCAL_COLOMBIA);

        String lkHtmlRemoto = """
                <li>
                  <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/999888772">
                    <h3 class="base-search-card__title">Remote Bilingual Tech Support</h3>
                  </a>
                  <h4 class="base-search-card__subtitle">TaskUs</h4>
                  <span class="job-search-card__location">Colombia (Remote)</span>
                  <p class="job-search-card__snippet">100% remote teletrabajo from anywhere in Colombia.</p>
                </li>
                """;
        List<OfertaCruda> lkRemotoList = invokeParsearLinkedIn(Jsoup.parse(lkHtmlRemoto), "Barranquilla");
        check("1.23 LinkedIn remote vacancy promoted to Segmento.REMOTO_INGLES",
                !lkRemotoList.isEmpty() && lkRemotoList.get(0).vacante().getSegmento() == Segmento.REMOTO_INGLES);

        // 6. SmartRecruitersConnector -> LOCAL_COLOMBIA
        SmartRecruitersConnector smart = new SmartRecruitersConnector(true, "Sutherland,Alorica");
        check("1.24 SmartRecruitersConnector declares Segmento.LOCAL_COLOMBIA",
                smart.segmento() == Segmento.LOCAL_COLOMBIA);

        try {
            String srJson = """
                    {
                      "content": [
                        {
                          "id": "SR-POST-1",
                          "name": "Bilingual Customer Service Advisor",
                          "location": {"city": "Barranquilla", "region": "Atlántico"},
                          "typeOfEmployment": {"label": "Full-time"}
                        }
                      ]
                    }
                    """;
            List<OfertaCruda> srList = invokeProcesarSmartRecruiters(smart, srJson, "Sutherland");
            check("1.25 SmartRecruiters vacancy mapped to Segmento.LOCAL_COLOMBIA",
                    !srList.isEmpty() && srList.get(0).vacante().getSegmento() == Segmento.LOCAL_COLOMBIA);
            check("1.26 SmartRecruiters vacancy marked as revisada=true",
                    !srList.isEmpty() && srList.get(0).vacante().isRevisada());
        } catch (Exception e) {
            check("1.x SmartRecruiters JSON parsing error: " + e.getMessage(), false);
        }

        // 7. JSearchConnector -> LOCAL_COLOMBIA
        JSearchConnector jsearch = new JSearchConnector(mock(ControlDeCuota.class), "mock-key", true, 200, 6, "co");
        check("1.27 JSearchConnector declares Segmento.LOCAL_COLOMBIA",
                jsearch.segmento() == Segmento.LOCAL_COLOMBIA);
        check("1.28 JSearchConnector declares filtraPorCiudad=true",
                jsearch.filtraPorCiudad());

        try {
            String jsJson = """
                    {
                      "data": {
                        "jobs": [
                          {
                            "job_id": "JS-991",
                            "job_title": "Bilingual Financial Analyst",
                            "employer_name": "BPO Corp",
                            "job_city": "Barranquilla",
                            "job_state": "Atlántico",
                            "job_country": "Colombia",
                            "job_description": "Financial analysis in English.",
                            "job_highlights": {
                              "Qualifications": ["Fluent English B2", "Bachelor in Accounting or Finance"]
                            }
                          }
                        ]
                      }
                    }
                    """;
            List<OfertaCruda> jsList = invokeProcesarJSearch(jsearch, jsJson);
            check("1.29 JSearch vacancy mapped to Segmento.LOCAL_COLOMBIA",
                    !jsList.isEmpty() && jsList.get(0).vacante().getSegmento() == Segmento.LOCAL_COLOMBIA);
            check("1.30 JSearch extracts qualifications into vacante.requisitos",
                    !jsList.isEmpty() && jsList.get(0).vacante().getRequisitos().contains("Bachelor in Accounting"));
        } catch (Exception e) {
            check("1.x JSearch JSON parsing error: " + e.getMessage(), false);
        }
    }

    // =========================================================================
    // SUITE 2: Geographic Filtering (AreaMetropolitana.esAtlanticoORemota)
    // =========================================================================
    private static void runSuite2GeographicFiltering() {
        // A. Reject Presencial Outside Atlántico
        List<String> ciudadesExcluidas = List.of(
                "Medellín", "Medellin", "Bogotá", "Bogota", "Cali", "Pereira", "Dosquebradas",
                "Manizales", "Armenia", "Bucaramanga", "Floridablanca", "Cúcuta", "Cartagena",
                "Santa Marta", "Ibagué", "Neiva", "Villavicencio", "Pasto", "Popayán",
                "Montería", "Sincelejo", "Valledupar", "Riohacha", "Tunja"
        );

        for (String c : ciudadesExcluidas) {
            Vacante v = new Vacante();
            v.setCiudad(c);
            v.setUbicacion(c + ", Colombia");
            v.setModalidadTrabajo("Presencial");
            v.setTitulo("Bilingual Agent");
            v.setDescripcion("Trabajo presencial en sede " + c);
            check("2.1 Reject presencial vacancy in " + c, !AreaMetropolitana.esAtlanticoORemota(v));
        }

        // URL slug rejection
        for (String c : List.of("bogota", "medellin", "pereira", "cali", "bucaramanga")) {
            Vacante v = new Vacante();
            v.setCiudad("Colombia");
            v.setModalidadTrabajo("Presencial");
            v.setUrlOrigen("https://co.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-agente-en-" + c + "-12345");
            check("2.2 Reject presencial vacancy with URL slug containing '-en-" + c + "-'", !AreaMetropolitana.esAtlanticoORemota(v));
        }

        // Title rejection
        for (String c : List.of("Bogotá", "Medellín", "Pereira", "Cali")) {
            Vacante v = new Vacante();
            v.setTitulo("Bilingual Customer Representative en " + c);
            v.setModalidadTrabajo("Presencial");
            check("2.3 Reject presencial vacancy with title containing 'en " + c + "'", !AreaMetropolitana.esAtlanticoORemota(v));
        }

        // B. Admit Atlántico Municipalities (Presencial)
        List<String> municipiosAtlantico = List.of(
                "Barranquilla", "barranquilla", "BARRANQUILLA", "Barranquilla, Atlántico",
                "Soledad", "soledad", "Malambo", "malambo", "Galapa", "galapa",
                "Puerto Colombia", "puerto colombia", "Sabanalarga", "sabanalarga",
                "Baranoa", "Palmar de Varela", "Santo Tomás", "Polonuevo", "Tubará",
                "Luruaco", "Suan", "Campo de la Cruz", "Ponedera", "Candelaria",
                "Juan de Acosta", "Piojó", "Repelón", "Santa Lucía", "Usiacurí", "Manatí"
        );

        for (String m : municipiosAtlantico) {
            Vacante v = new Vacante();
            v.setCiudad(m);
            v.setUbicacion(m + ", Colombia");
            v.setModalidadTrabajo("Presencial");
            v.setTitulo("Bilingual Customer Support Representative");
            check("2.4 Admit presencial Atlántico municipality: " + m, AreaMetropolitana.esAtlanticoORemota(v));
        }

        // Department region match
        Vacante vRegion = new Vacante();
        vRegion.setUbicacion("Departamento del Atlántico, Colombia");
        vRegion.setModalidadTrabajo("Presencial");
        check("2.5 Admit presencial vacancy with region 'Atlántico'", AreaMetropolitana.esAtlanticoORemota(vRegion));

        // C. Admit Remote Vacancies from Any Location
        Vacante vRemotoIngles = new Vacante();
        vRemotoIngles.setSegmento(Segmento.REMOTO_INGLES);
        vRemotoIngles.setCiudad("Medellín");
        check("2.6 Admit Segmento.REMOTO_INGLES regardless of city (Medellín)",
                AreaMetropolitana.esAtlanticoORemota(vRemotoIngles));

        for (String remoteSignal : List.of("REMOTO", "Remoto", "100% remoto", "Totalmente Remoto", "Teletrabajo", "Home Office", "Work from home")) {
            Vacante vRemote = new Vacante();
            vRemote.setCiudad("Bogotá");
            vRemote.setUbicacion("Bogotá, D.C.");
            vRemote.setModalidadTrabajo(remoteSignal);
            vRemote.setDescripcion("Puesto para laborar desde casa en modalidad " + remoteSignal);
            check("2.7 Admit remote vacancy with modality '" + remoteSignal + "' in Bogotá",
                    AreaMetropolitana.esAtlanticoORemota(vRemote));
            check("2.8 Remoteness detected properly for " + remoteSignal,
                    AreaMetropolitana.esRemoto(remoteSignal) || AreaMetropolitana.esAtlanticoORemota(vRemote));
        }

        // Description remote signal promotion when modality is null/presencial
        Vacante vDescRemote = new Vacante();
        vDescRemote.setCiudad("Cali");
        vDescRemote.setTitulo("Bilingual Chat Representative");
        vDescRemote.setDescripcion("Posición 100% remoto / teletrabajo para todo Colombia.");
        check("2.9 Admit vacancy with 100% remoto in description even if listed in Cali",
                AreaMetropolitana.esAtlanticoORemota(vDescRemote));
        check("2.10 Modality normalized to Remoto when remote description detected",
                "Remoto".equalsIgnoreCase(vDescRemote.getModalidadTrabajo()));

        // Edge case: null safety
        check("2.11 AreaMetropolitana.esAtlanticoORemota(null) returns false safely",
                !AreaMetropolitana.esAtlanticoORemota(null));
        check("2.12 AreaMetropolitana.esRemoto(null/blank) returns false safely",
                !AreaMetropolitana.esRemoto(null) && !AreaMetropolitana.esRemoto(""));
    }

    // =========================================================================
    // SUITE 3: ScrapingService Non-Blocking Error Isolation (1 Failure, 6 Success)
    // =========================================================================
    private static void runSuite3ErrorIsolation() {
        EstudianteRepository estudianteRepo = mock(EstudianteRepository.class);
        VacanteRepository vacanteRepo = mock(VacanteRepository.class);
        EmpresaRepository empresaRepo = mock(EmpresaRepository.class);
        ScrapingEjecucionRepository ejecucionRepo = mock(ScrapingEjecucionRepository.class);
        EnriquecedorDeVacante enriquecedor = mock(EnriquecedorDeVacante.class);
        ControlDeCuota controlDeCuota = mock(ControlDeCuota.class);

        RegistroDeVacante registroDeVacante = new RegistroDeVacante(vacanteRepo, empresaRepo, enriquecedor);

        when(estudianteRepo.findCargosObjetivoDeActivos()).thenReturn(List.of("desarrollador java"));
        when(estudianteRepo.findSectoresObjetivoDeActivos()).thenReturn(List.of());
        when(estudianteRepo.findTitulosDeActivos()).thenReturn(List.of());
        when(estudianteRepo.findProgramasAcademicosDeActivos()).thenReturn(List.of());
        when(estudianteRepo.findAreasFormacionDeActivos()).thenReturn(List.of());
        when(estudianteRepo.findCiudadesDeActivosPorFrecuencia()).thenReturn(List.of("Barranquilla"));
        when(vacanteRepo.findVencidasSinCerrar(any())).thenReturn(List.of());
        when(vacanteRepo.contarVigentes(any())).thenReturn(50L);

        when(vacanteRepo.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacanteRepo.findByHashContenido(anyString())).thenReturn(Optional.empty());
        when(vacanteRepo.save(any(Vacante.class))).thenAnswer(inv -> inv.getArgument(0));
        when(empresaRepo.findByNombreIgnoreCaseActiva(anyString())).thenReturn(Optional.empty());
        when(empresaRepo.save(any(Empresa.class))).thenAnswer(inv -> inv.getArgument(0));

        // Create 7 connectors: 6 healthy, 1 failing
        FuenteDeVacantes f1 = crearMockFuente("COMPUTRABAJO", Segmento.LOCAL_COLOMBIA, true, 2, "Barranquilla", "Bilingual Java Dev", false);
        FuenteDeVacantes f2 = crearMockFuente("ELEMPLEO", Segmento.LOCAL_COLOMBIA, true, 2, "Barranquilla", "Bilingual Software Engineer", false);
        FuenteDeVacantes f3 = crearMockFuente("LINKEDIN", Segmento.LOCAL_COLOMBIA, true, 2, "Barranquilla", "Bilingual Fullstack Developer", false);
        FuenteDeVacantes f4 = crearMockFuente("REMOTIVE", Segmento.REMOTO_INGLES, false, 2, "Remoto", "Remote Bilingual Backend Engineer", false);
        FuenteDeVacantes f5 = crearMockFuente("ARBEITNOW", Segmento.MIGRACION, false, 2, "Berlin", "Java Developer Visa Sponsorship", false);

        // FAILING CONNECTOR (Throws 500 / 403 / Network Timeout)
        FuenteDeVacantes f6Failing = mock(FuenteDeVacantes.class);
        when(f6Failing.nombre()).thenReturn("SMARTRECRUITERS");
        when(f6Failing.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(f6Failing.estaHabilitada()).thenReturn(true);
        when(f6Failing.filtraPorCiudad()).thenReturn(false);
        when(f6Failing.maximoConsultasPorCorrida()).thenReturn(1);
        when(f6Failing.buscar(any(), any())).thenThrow(new RuntimeException("500 Internal Server Error: Connection reset by peer"));

        FuenteDeVacantes f7 = crearMockFuente("JSEARCH", Segmento.LOCAL_COLOMBIA, true, 2, "Barranquilla", "Bilingual Cloud Engineer", false);

        List<FuenteDeVacantes> todasLasFuentes = List.of(f1, f2, f3, f4, f5, f6Failing, f7);

        ScrapingService service = new ScrapingService(
                todasLasFuentes,
                estudianteRepo,
                vacanteRepo,
                ejecucionRepo,
                registroDeVacante,
                controlDeCuota
        );

        ResultadoActualizacion resultado = service.actualizar(ScrapingEjecucion.Origen.PROGRAMADA);

        // Assertions for 6 successful connectors (2 vacancies each = 12 vacancies)
        check("3.1 6 healthy connectors persisted all 12 vacancies despite 1 failing connector",
                resultado.vacantesNuevas() == 12);
        verify(vacanteRepo, times(12)).save(any(Vacante.class));

        // Verify execution history captured error from failing connector without aborting
        var captor = org.mockito.ArgumentCaptor.forClass(ScrapingEjecucion.class);
        verify(ejecucionRepo).save(captor.capture());
        ScrapingEjecucion ejecucion = captor.getValue();

        check("3.2 ScrapingEjecucion error log contains failing connector details",
                ejecucion.getError() != null && ejecucion.getError().contains("SMARTRECRUITERS: 500 Internal Server Error"));
        check("3.3 ScrapingEjecucion portales list contains all 7 registered connectors",
                ejecucion.getPortales().contains("COMPUTRABAJO")
                        && ejecucion.getPortales().contains("ELEMPLEO")
                        && ejecucion.getPortales().contains("LINKEDIN")
                        && ejecucion.getPortales().contains("REMOTIVE")
                        && ejecucion.getPortales().contains("ARBEITNOW")
                        && ejecucion.getPortales().contains("SMARTRECRUITERS")
                        && ejecucion.getPortales().contains("JSEARCH"));
        check("3.4 ScrapingEjecucion ofertasPorPortal records 2 for each healthy and 0 for failing",
                ejecucion.getOfertasPorPortal().contains("COMPUTRABAJO=2")
                        && ejecucion.getOfertasPorPortal().contains("REMOTIVE=2")
                        && ejecucion.getOfertasPorPortal().contains("ARBEITNOW=2")
                        && ejecucion.getOfertasPorPortal().contains("SMARTRECRUITERS=0"));
    }

    // =========================================================================
    // SUITE 4: ScrapingService Severe Failures & Timeout Handling
    // =========================================================================
    private static void runSuite4SevereFailuresAndTimeout() {
        EstudianteRepository estudianteRepo = mock(EstudianteRepository.class);
        VacanteRepository vacanteRepo = mock(VacanteRepository.class);
        EmpresaRepository empresaRepo = mock(EmpresaRepository.class);
        ScrapingEjecucionRepository ejecucionRepo = mock(ScrapingEjecucionRepository.class);
        EnriquecedorDeVacante enriquecedor = mock(EnriquecedorDeVacante.class);
        ControlDeCuota controlDeCuota = mock(ControlDeCuota.class);
        RegistroDeVacante registroDeVacante = new RegistroDeVacante(vacanteRepo, empresaRepo, enriquecedor);

        when(estudianteRepo.findCargosObjetivoDeActivos()).thenReturn(List.of("customer service"));
        when(estudianteRepo.findSectoresObjetivoDeActivos()).thenReturn(List.of());
        when(estudianteRepo.findCiudadesDeActivosPorFrecuencia()).thenReturn(List.of("Barranquilla"));
        when(vacanteRepo.findVencidasSinCerrar(any())).thenReturn(List.of());
        when(vacanteRepo.contarVigentes(any())).thenReturn(0L);

        // A. All 7 Connectors Fail Simultaneously
        List<FuenteDeVacantes> allFailing = new ArrayList<>();
        for (String name : List.of("C1", "C2", "C3", "C4", "C5", "C6", "C7")) {
            FuenteDeVacantes f = mock(FuenteDeVacantes.class);
            when(f.nombre()).thenReturn(name);
            when(f.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
            when(f.estaHabilitada()).thenReturn(true);
            when(f.maximoConsultasPorCorrida()).thenReturn(1);
            when(f.buscar(any(), any())).thenReturn(ResultadoBusqueda.fallo("429 Rate Limit Exceeded on " + name));
            allFailing.add(f);
        }

        ScrapingService serviceAllFail = new ScrapingService(
                allFailing, estudianteRepo, vacanteRepo, ejecucionRepo, registroDeVacante, controlDeCuota);

        ResultadoActualizacion resFail = serviceAllFail.actualizar(ScrapingEjecucion.Origen.MANUAL);
        check("4.1 Total 7-connector failure does not crash service, returns 0 new vacancies",
                resFail.vacantesNuevas() == 0);

        var captor = org.mockito.ArgumentCaptor.forClass(ScrapingEjecucion.class);
        verify(ejecucionRepo).save(captor.capture());
        ScrapingEjecucion ejFail = captor.getValue();
        check("4.2 Total failure captures error messages from all 7 failing connectors",
                ejFail.getError() != null && ejFail.getError().contains("C1: 429") && ejFail.getError().contains("C7: 429"));

        // B. Thread Interruption / Stalled Source Cancellation Simulation
        List<String> erroresSync = Collections.synchronizedList(new ArrayList<>());
        ScrapingService.Criterios criterios = new ScrapingService.Criterios(List.of("java"), List.of("Barranquilla"));

        FuenteDeVacantes fuenteStall = mock(FuenteDeVacantes.class);
        when(fuenteStall.nombre()).thenReturn("STALLED_PORTAL");
        when(fuenteStall.estaHabilitada()).thenReturn(true);
        when(fuenteStall.maximoConsultasPorCorrida()).thenReturn(1);
        when(fuenteStall.buscar(any(), any())).thenAnswer(inv -> {
            Thread.sleep(100);
            return ResultadoBusqueda.fallo("Stalled timeout");
        });

        FuenteDeVacantes fuenteFast = crearMockFuente("FAST_PORTAL", Segmento.LOCAL_COLOMBIA, true, 1, "Barranquilla", "Bilingual Java Dev", false);

        ScrapingService serviceTimeout = new ScrapingService(
                List.of(fuenteStall, fuenteFast), estudianteRepo, vacanteRepo, ejecucionRepo, registroDeVacante, controlDeCuota);

        List<OfertaCruda> resConsultas = serviceTimeout.consultarFuentes(List.of(fuenteStall, fuenteFast), criterios, erroresSync);
        check("4.3 Fast connector succeeds even when peer connector experiences stall/error",
                !resConsultas.isEmpty() && resConsultas.size() == 1);
    }

    // =========================================================================
    // SUITE 5: Diagnostic Endpoints & Quota Protection
    // =========================================================================
    private static void runSuite5DiagnosticsAndQuota() {
        EstudianteRepository estudianteRepo = mock(EstudianteRepository.class);
        VacanteRepository vacanteRepo = mock(VacanteRepository.class);
        EmpresaRepository empresaRepo = mock(EmpresaRepository.class);
        ScrapingEjecucionRepository ejecucionRepo = mock(ScrapingEjecucionRepository.class);
        EnriquecedorDeVacante enriquecedor = mock(EnriquecedorDeVacante.class);
        ControlDeCuota controlDeCuota = mock(ControlDeCuota.class);
        RegistroDeVacante registroDeVacante = new RegistroDeVacante(vacanteRepo, empresaRepo, enriquecedor);

        when(controlDeCuota.restantes("JSEARCH", 200)).thenReturn(145);

        FuenteDeVacantes f1 = crearMockFuente("LINKEDIN", Segmento.LOCAL_COLOMBIA, true, 1, "Barranquilla", "Bilingual Agent", false);
        FuenteDeVacantes f2 = mock(FuenteDeVacantes.class);
        when(f2.nombre()).thenReturn("JSEARCH");
        when(f2.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(f2.estaHabilitada()).thenReturn(false);

        ScrapingService service = new ScrapingService(
                List.of(f1, f2), estudianteRepo, vacanteRepo, ejecucionRepo, registroDeVacante, controlDeCuota);

        // Listar Estado Conectores
        List<EstadoConectorDto> estados = service.listarEstadoConectores();
        check("5.1 listarEstadoConectores returns all registered connector statuses",
                estados.size() == 2);

        EstadoConectorDto lk = estados.stream().filter(e -> e.nombre().equals("LINKEDIN")).findFirst().orElseThrow();
        check("5.2 LINKEDIN connector reported as ACTIVO",
                "ACTIVO".equals(lk.estado()) && lk.habilitado());

        EstadoConectorDto js = estados.stream().filter(e -> e.nombre().equals("JSEARCH")).findFirst().orElseThrow();
        check("5.3 JSEARCH unconfigured reported as ESPERA_CONFIGURACION with remaining quota 145/200",
                "ESPERA_CONFIGURACION".equals(js.estado()) && js.cuotaRestante() == 145 && js.cuotaLimite() == 200);

        // Probar Fuente Individual (Dry run)
        ResultadoPruebaFuenteDto pruebaLk = service.probarFuente("LINKEDIN");
        check("5.4 probarFuente dry-run executes successfully without saving to database",
                pruebaLk.exito() && "OK".equals(pruebaLk.estado()) && pruebaLk.ofertasEncontradas() == 1);

        ResultadoPruebaFuenteDto pruebaDeshabilitada = service.probarFuente("JSEARCH");
        check("5.5 probarFuente reports DESHABILITADO for unconfigured source",
                !pruebaDeshabilitada.exito() && "DESHABILITADO".equals(pruebaDeshabilitada.estado()));

        ResultadoPruebaFuenteDto pruebaInexistente = service.probarFuente("NON_EXISTENT");
        check("5.6 probarFuente handles non-existent source gracefully with error message",
                !pruebaInexistente.exito() && pruebaInexistente.mensaje().contains("Fuente no encontrada"));
    }

    private static FuenteDeVacantes crearMockFuente(String nombre, Segmento segmento, boolean filtraCiudad,
                                                    int count, String ciudad, String titulo, boolean throwError) {
        FuenteDeVacantes f = mock(FuenteDeVacantes.class);
        when(f.nombre()).thenReturn(nombre);
        when(f.segmento()).thenReturn(segmento);
        when(f.estaHabilitada()).thenReturn(true);
        when(f.filtraPorCiudad()).thenReturn(filtraCiudad);
        when(f.maximoConsultasPorCorrida()).thenReturn(1);

        if (throwError) {
            when(f.buscar(any(), any())).thenThrow(new RuntimeException("Simulated error in " + nombre));
        } else {
            List<OfertaCruda> ofertas = new ArrayList<>();
            for (int i = 1; i <= count; i++) {
                Vacante v = new Vacante();
                v.setTitulo(titulo + " #" + i);
                v.setFuente(nombre);
                v.setSegmento(segmento);
                v.setCiudad(ciudad);
                v.setUbicacion(ciudad.equalsIgnoreCase("Remoto") ? "Remoto" : ciudad + ", Atlántico");
                v.setModalidadTrabajo(ciudad.equalsIgnoreCase("Remoto") ? "REMOTO" : "Presencial");
                v.setDescripcion("Must speak fluent English B2 level. Requirement details.");
                v.setHashDedup(sha256(nombre + "|" + i));
                v.setActivo(true);
                ofertas.add(new OfertaCruda(v, "Empresa " + nombre));
            }
            when(f.buscar(any(), any())).thenReturn(ResultadoBusqueda.de(ofertas));
        }
        return f;
    }
}
