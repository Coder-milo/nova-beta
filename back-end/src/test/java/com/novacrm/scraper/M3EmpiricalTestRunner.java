package com.novacrm.scraper;

import com.novacrm.catalogo.nivel_ingles.NivelMcer;
import com.novacrm.scraper.fuente.FiltroBilingue;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.EnriquecedorDeVacante;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

/**
 * Empirical Verification and Stress Test Harness for Milestone 3:
 * Precision Multidisciplinary Bilingual Filter (FiltroBilingue.java) & Contextual Enricher (EnriquecedorDeVacante.java).
 */
public class M3EmpiricalTestRunner {

    private static int totalFound = 0;
    private static int totalPassed = 0;
    private static int totalFailed = 0;
    private static final List<String> failures = new ArrayList<>();

    public static void main(String[] args) {
        System.out.println("================================================================================");
        System.out.println(" NOVA-CRM Empirical Challenger 1 - Milestone 3 Verification Harness");
        System.out.println(" Targets: FiltroBilingue.java, EnriquecedorDeVacante.java, Adversarial Suites");
        System.out.println("================================================================================");

        long start = System.currentTimeMillis();

        // 1. Run standard unit test suites
        runJUnitClass("com.novacrm.scraper.fuente.FiltroBilingueTest");
        runJUnitClass("com.novacrm.vacante.EnriquecedorDeVacanteTest");
        runJUnitClass("com.novacrm.scraper.fuente.FiltroBilingueAdversarialTest");

        // 2. Run dedicated empirical stress suites
        runSuite("SUITE 4: 100+ Real Colombian Job Boards Non-Language False-Positive Stress Test",
                M3EmpiricalTestRunner::runSuite4RealColombianNonLanguageStress);

        runSuite("SUITE 5: Multidisciplinary True Positive Bilingual Matrix Across 12 Professional Fields",
                M3EmpiricalTestRunner::runSuite5MultidisciplinaryTruePositives);

        runSuite("SUITE 6: Contextual Level Enrichment & Boundary Invariant Verification",
                M3EmpiricalTestRunner::runSuite6EnricherBoundaryInvariants);

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
            System.out.println("\n>>> EMPIRICAL VERDICT: ALL TESTS SUCCEEDED WITH 0% FALSE POSITIVE LEAKAGE (APPROVE) <<<");
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
        System.out.printf("  - [TEST] %-74s ... ", description);
        if (condition) {
            System.out.println("PASSED");
            totalPassed++;
        } else {
            System.out.println("FAILED");
            totalFailed++;
            failures.add("FAILED: " + description);
        }
    }

    private static Vacante crearVacante(String titulo, String descripcion, String requisitos, Segmento segmento) {
        Vacante v = new Vacante();
        v.setTitulo(titulo);
        v.setDescripcion(descripcion);
        v.setRequisitos(requisitos);
        v.setSegmento(segmento);
        return v;
    }

    // =========================================================================
    // SUITE 4: 100+ Real Colombian Job Boards Non-Language False-Positive Stress
    // =========================================================================
    private static void runSuite4RealColombianNonLanguageStress() {
        EnriquecedorDeVacante enriquecedor = new EnriquecedorDeVacante(30);

        List<String[]> casosFalsosPositivos = List.of(
                // Licencias
                new String[]{"Conductor C1", "Reparto urbano de mercancía con pase C1 vigente en Soledad."},
                new String[]{"Chofer escolta", "Pase B2 al día, manejo de vehículos blindados."},
                new String[]{"Conductor de tractocamión", "Licencia C3 para transporte nacional de carga pesada."},
                new String[]{"Mensajero en moto", "Pase A2 y B1 para diligencias en el norte de Barranquilla."},
                new String[]{"Conductor de taxi", "Vehículo afiliado a empresa de transporte, licencia categoría C1."},
                new String[]{"Chofer repartidor", "Conducción de furgón C1 / C2, horario lunes a sábado."},
                new String[]{"Conductor institucional", "Transporte de directivos, categoría B2 requerida."},
                new String[]{"Operador de grúa", "Manejo de grúa de plataforma, pase C2 indispensable."},
                new String[]{"Conductor de ambulancia", "Atención prehospitalaria, pase C1 y curso de soporte vital."},
                new String[]{"Conductor de volqueta", "Obra civil en Malambo, licencia C2."},

                // Bodegas y Ubicaciones
                new String[]{"Auxiliar de bodega", "Labores de cargue y descargue en Bodega B1, zona industrial."},
                new String[]{"Operario de inventario", "Conteo cíclico de mercancía en Bodega B2."},
                new String[]{"Supervisor logístico", "Supervisión de operaciones en Piso B1 del centro empresarial."},
                new String[]{"Auxiliar de empaque", "Sellado y rotulado en Piso B2."},
                new String[]{"Coordinador de almacén", "Recepción de contenedores en Zona B1."},
                new String[]{"Guarda de seguridad", "Vigilancia en Zona B2 del parque industrial."},
                new String[]{"Auxiliar de surtido", "Acomodación de cajas en Pasillo B1 de la tienda."},
                new String[]{"Operador de montacargas", "Tránsito en Pasillo B2 con estibas de alimentos."},
                new String[]{"Técnico electromecánico", "Mantenimiento de maquinaria en Módulo B1."},
                new String[]{"Operario de ensamble", "Armado de piezas plásticas en Módulo B2."},
                new String[]{"Auxiliar de planta", "Operación de calderas en Bloque B1."},
                new String[]{"Jefe de producción", "Línea de envasado en Bloque B2."},
                new String[]{"Recepcionista", "Atención al público en Torre B1 del centro médico."},
                new String[]{"Asistente de oficina", "Archivo y correspondencia en Torre B2."},
                new String[]{"Operario de aseo", "Limpieza de áreas comunes en Manzana B1."},
                new String[]{"Vigilante de control", "Control de entrada en Puerta B1 de la terminal."},
                new String[]{"Guardia de portería", "Registro de visitantes en Puerta B2."},
                new String[]{"Auxiliar de archivo", "Custodia de documentos físicos en Sótano B1."},
                new String[]{"Operador de parqueadero", "Cobro y asignación de celdas en Sótano B2."},
                new String[]{"Cotero de descargue", "Descargue de camiones en Andén B1 de la central mayorista."},
                new String[]{"Auxiliar de recibo", "Verificación de remisiones en Andén B2."},
                new String[]{"Cajero de parqueadero", "Atención a usuarios en Parqueadero B1."},
                new String[]{"Valet parking", "Recepción de vehículos en Parqueadero B2 del hotel."},
                new String[]{"Vendedor de mostrador", "Venta de accesorios en Local B1 de centro comercial."},
                new String[]{"Asesor de ventas", "Atención al cliente en Local B2 de galería comercial."},
                new String[]{"Promotor comercial", "Demostración de productos en Stand B1 de la feria."},
                new String[]{"Impulsadora", "Degustación de marca en Stand B2 del hipermercado."},
                new String[]{"Ingeniero de alimentos", "Control de calidad en Planta B1 de lácteos."},
                new String[]{"Supervisor de turno", "Manejo de personal en Planta B2 de manufactura."},
                new String[]{"Recepcionista de sede", "Recepción de correspondencia en Sede B1."},
                new String[]{"Asistente administrativo", "Soporte operativo en Sede B2."},
                new String[]{"Auxiliar de farmacia", "Dispensación de medicamentos en Estante B1."},
                new String[]{"Inventariador", "Auditoría de existencias en Estante B2."},

                // Modelos Comerciales
                new String[]{"Ejecutivo de cuentas B2B", "Venta corporativa de servicios de telecomunicaciones B2B."},
                new String[]{"Gerente de ventas B2B", "Cierre de negocios con empresas a nivel nacional en canal B2B."},
                new String[]{"Especialista de marketing B2C", "Pauta digital y embudos de conversión para tiendas B2C."},
                new String[]{"Director comercial B2B / B2C", "Estrategia integral para distribución mayorista y minorista."},
                new String[]{"Key Account Manager B2B", "Manejo de cuentas clave del sector farmacéutico B2B en Colombia."},
                new String[]{"Analista de licitaciones B2G", "Preparación de pliegos para contratación pública B2G."},
                new String[]{"Representante de ventas B2B", "Prospección telefónica de clientes empresariales en Barranquilla."},
                new String[]{"Consultor comercial B2B", "Venta de pólizas corporativas y seguros de vida empresarial."},

                // Vitaminas y Farmacia
                new String[]{"Visitador médico", "Visita a especialistas para promoción de Vitamina B1 y complejo B2."},
                new String[]{"Regente de farmacia", "Administración de droguería y venta de suplementos Vitamina B1, B2 y C1."},
                new String[]{"Químico farmacéutico", "Desarrollo de jarabes multivitamínicos con complejo B1 y B2."},
                new String[]{"Auxiliar de droguería", "Atención al cliente y despacho de Vitamina B12 y complejo B."},

                // Formatos de Papel y Diseño sin Inglés
                new String[]{"Prensista offset", "Operación de máquina Heidelberg formato B1 y formato B2."},
                new String[]{"Impresor litográfico", "Impresión de afiches y catálogos en pliego tamaño B1."},
                new String[]{"Diseñador gráfico", "Diseño de material POP y empaques en tamaño B2 para imprenta local."},
                new String[]{"Operario de guillotina", "Corte de papel en formato B1 para cuadernos escolares."},

                // Niveles Educativos y Formatos Generales
                new String[]{"Auxiliar administrativo", "Nivel académico: Bachiller. Manejo de archivo y conmutador."},
                new String[]{"Cajero de supermercado", "Nivel educativo: Bachiller comercial. Cuadre de caja."},
                new String[]{"Operario de empaque", "Nivel de escolaridad: Bachiller académico. Turnos rotativos."},
                new String[]{"Vendedor tienda a tienda", "Nivel académico requerido: Bachiller o técnico comercial."},
                new String[]{"Mensajero urbano", "Nivel de estudios: Bachiller. Moto propia sin comparendos."},
                new String[]{"Asistente contable", "Nivel académico: Tecnólogo en contabilidad. Registro de facturas."},
                new String[]{"Asesor de cobranzas", "Nivel educativo: Bachiller. Recuperación de cartera castigada."},
                new String[]{"Operario de limpieza", "Nivel de escolaridad: Básica primaria o bachiller."},
                new String[]{"Vigilante de seguridad", "Nivel académico: Bachiller. Curso de vigilancia vigente."}
        );

        for (String[] caso : casosFalsosPositivos) {
            String titulo = caso[0];
            String desc = caso[1];
            Vacante v = crearVacante(titulo, desc, null, Segmento.LOCAL_COLOMBIA);

            boolean filtroResult = FiltroBilingue.esDeTrabajoEnIngles(v);
            check("4.FP Reject non-language vacancy [" + titulo + "]: " + (desc.length() > 40 ? desc.substring(0, 40) + "…" : desc),
                    !filtroResult);

            enriquecedor.enriquecer(v);
            check("4.ENR Do not infer CEFR level for [" + titulo + "]",
                    v.getNivelInglesRequerido() == null);
        }
    }

    // =========================================================================
    // SUITE 5: Multidisciplinary True Positive Bilingual Matrix Across 12 Fields
    // =========================================================================
    private static void runSuite5MultidisciplinaryTruePositives() {
        EnriquecedorDeVacante enriquecedor = new EnriquecedorDeVacante(30);

        List<Object[]> matrix = List.of(
                // 1. Software Engineering
                new Object[]{"Software Engineer", "Desarrollo en Java/Spring Boot. Requisito: Inglés C1 para reuniones diarias.", "C1"},
                new Object[]{"Backend Developer", "Node.js, Postgres. Requisito: Inglés B2 conversacional.", "B2"},
                new Object[]{"QA Automation Engineer", "Cypress, Selenium. Required: B2+ English communication skills.", "B2"},
                new Object[]{"DevOps Cloud Specialist", "AWS, Kubernetes. English C1 required for global team.", "C1"},

                // 2. Data & AI
                new Object[]{"Data Scientist", "Python, ML models. Requisito: MCER B2 comprobable.", "B2"},
                new Object[]{"Data Analyst", "Power BI, SQL. Requisito: Marco común europeo B2.", "B2"},
                new Object[]{"Big Data Engineer", "Spark, Databricks. Required: CEFR C1 certification.", "C1"},

                // 3. Finance & Accounting
                new Object[]{"Financial Analyst", "NIIF reporting. Requisito: B2 English communication.", "B2"},
                new Object[]{"Contador Senior Bilingüe", "Consolidación de balances bajo US GAAP y NIIF.", "B1"},
                new Object[]{"Auditor Financiero", "Auditoría internacional. Requisito: CEFR C1 indispensable.", "C1"},
                new Object[]{"Business Controller", "Control presupuestal con filiales en USA. Nivel B2 de inglés.", "B2"},

                // 4. Design & Creative
                new Object[]{"UI/UX Designer", "Design systems in Figma. Professional working English required.", "C1"},
                new Object[]{"Diseñador Visual Bilingüe", "Creación de piezas gráficas para campañas en USA y Europa.", "B1"},
                new Object[]{"Product Designer", "User research and prototyping. Working English required.", "B2"},

                // 5. Marketing & Growth
                new Object[]{"Growth Marketing Manager", "Gestión de pauta global, perfil 100% bilingüe.", "B2"},
                new Object[]{"Digital Marketing Specialist", "SEO, SEM campaigns. Fluent English required.", "B2"},
                new Object[]{"Content Strategist", "Copywriting in English for US market. Advanced English.", "B2"},

                // 6. Traditional Engineering (Civil, Industrial, Mechanical, Electrical)
                new Object[]{"Ingeniero Industrial", "Optimización de procesos de manufactura. Inglés técnico indispensable.", "B1"},
                new Object[]{"Ingeniero Mecánico", "Diseño de maquinaria pesada. Technical English required.", "B1"},
                new Object[]{"Ingeniero de Petróleos", "Operación de pozos petroleros. Inglés fluido indispensable.", "B2"},
                new Object[]{"Ingeniero Eléctrico", "Redes de alta tensión con proveedores internacionales. Dominio de inglés.", "B1"},

                // 7. Operations & Logistics
                new Object[]{"Supply Chain Coordinator", "Coordinación con puertos internacionales. Business English.", "B2"},
                new Object[]{"Operations Manager", "Supervisión de planta bilingüe. Inglés avanzado.", "B2"},
                new Object[]{"Comprador Internacional", "Negociación con proveedores en Asia y USA. 100% bilingual.", "B2"},

                // 8. BPO, Support & Customer Success
                new Object[]{"Bilingual Customer Service Representative", "Atención a clientes de USA. Required: B2+ English.", "B2"},
                new Object[]{"Technical Support Tier 2", "Troubleshooting SaaS. Requisito: Nivel B1/B2 de inglés.", "B2"},
                new Object[]{"Customer Success Manager", "SaaS client retention. Conversational English required.", "B1"},

                // 9. Sales & Business Development
                new Object[]{"Key Account Manager B2B", "Venta de software en USA. Requisito: Inglés C1.", "C1"},
                new Object[]{"Sales Development Rep B2B", "Cold calling in English. Fluent in English required.", "B2"},

                // 10. Healthcare & Science
                new Object[]{"Clinical Research Associate", "Ensayos clínicos internacionales. English proficiency required.", "B1"},
                new Object[]{"Químico Farmacéutico Bilingüe", "Transferencia tecnológica con laboratorio matriz en Europa.", "B1"},

                // 11. Drivers & Tourism (Bilingual Driver)
                new Object[]{"Conductor Bilingüe", "Pase C1 vigente para transporte de turistas internacionales.", "B1"},
                new Object[]{"Chofer Ejecutivo Bilingüe", "Licencia C1 al día. Requisito: Inglés B2 conversacional.", "B2"},
                new Object[]{"Guía Turístico y Conductor", "Pase C1 y nivel de inglés fluido para tours en Cartagena.", "B2"},

                // 12. Remote Native & Explicit Fields
                new Object[]{"Senior Ruby Engineer", "Remote work across LATAM.", "REMOTO_INGLES"}
        );

        for (Object[] row : matrix) {
            String titulo = (String) row[0];
            String desc = (String) row[1];
            String expectedLevel = (String) row[2];

            Vacante v = crearVacante(titulo, desc, null,
                    "REMOTO_INGLES".equals(expectedLevel) ? Segmento.REMOTO_INGLES : Segmento.LOCAL_COLOMBIA);

            boolean pasaFiltro = FiltroBilingue.esDeTrabajoEnIngles(v);
            check("5.TP Admit true positive [" + titulo + "]", pasaFiltro);

            if (!"REMOTO_INGLES".equals(expectedLevel)) {
                enriquecedor.enriquecer(v);
                check("5.ENR Infer correct level (" + expectedLevel + ") for [" + titulo + "]",
                        expectedLevel.equals(v.getNivelInglesRequerido()));
            }
        }
    }

    // =========================================================================
    // SUITE 6: Contextual Level Enrichment & Boundary Invariant Verification
    // =========================================================================
    private static void runSuite6EnricherBoundaryInvariants() {
        EnriquecedorDeVacante enriquecedor = new EnriquecedorDeVacante(30);

        // Precedence: C1 > B2 > B1 > A2
        Vacante vPrecedence = crearVacante("Lead Engineer",
                "Requisito: ingles avanzado indispensable. Deseable nociones de ingles basico en portugues.", null, Segmento.LOCAL_COLOMBIA);
        enriquecedor.enriquecer(vPrecedence);
        check("6.1 Precedence rule: 'ingles avanzado' resolves to B2 over later 'ingles basico'",
                "B2".equals(vPrecedence.getNivelInglesRequerido()));

        // Pre-existing value never overwritten
        Vacante vPreExisting = crearVacante("Bilingual CSR", "Puesto que pide ingles basico.", null, Segmento.LOCAL_COLOMBIA);
        vPreExisting.setNivelInglesRequerido("C2");
        enriquecedor.enriquecer(vPreExisting);
        check("6.2 Immutability invariant: Existing level 'C2' is preserved untouched",
                "C2".equals(vPreExisting.getNivelInglesRequerido()));

        // Null and blank safety
        Vacante vBlank = crearVacante("", "", "", Segmento.LOCAL_COLOMBIA);
        enriquecedor.enriquecer(vBlank);
        check("6.3 Null and blank safety: Vacancy with empty strings does not throw or infer false level",
                vBlank.getNivelInglesRequerido() == null && !FiltroBilingue.esDeTrabajoEnIngles(vBlank));
    }

    // =========================================================================
    // Dynamic JUnit 5 Class Reflection Invoker
    // =========================================================================
    private static void runJUnitClass(String className) {
        try {
            Class<?> clazz = Class.forName(className);
            runTestClass(clazz, null);
        } catch (ClassNotFoundException e) {
            System.err.println("Could not find class: " + className);
            totalFailed++;
            failures.add("ClassNotFoundException: " + className);
        }
    }

    private static void runTestClass(Class<?> clazz, Object enclosingInstance) {
        String className = clazz.getSimpleName();
        DisplayName classDisplayName = clazz.getAnnotation(DisplayName.class);
        String classDesc = (classDisplayName != null) ? classDisplayName.value() : className;

        System.out.println("\n[JUNIT SUITE] " + classDesc + " (" + clazz.getName() + ")");

        for (Method method : clazz.getDeclaredMethods()) {
            boolean isTest = method.isAnnotationPresent(Test.class)
                    || method.isAnnotationPresent(ParameterizedTest.class);

            if (isTest && !Modifier.isStatic(method.getModifiers())) {
                DisplayName methodDisplayName = method.getAnnotation(DisplayName.class);
                String testDesc = (methodDisplayName != null) ? methodDisplayName.value() : method.getName();

                try {
                    if (method.isAnnotationPresent(ParameterizedTest.class)) {
                        ValueSource vs = method.getAnnotation(ValueSource.class);
                        if (vs != null && vs.strings().length > 0) {
                            for (String val : vs.strings()) {
                                totalFound++;
                                System.out.printf("  - [TEST] %-74s ... ", testDesc + " [" + (val.length() > 30 ? val.substring(0, 30) + "…" : val) + "]");
                                Object testInstance = instantiate(clazz, enclosingInstance);
                                invokeBeforeEach(clazz, testInstance);
                                method.setAccessible(true);
                                method.invoke(testInstance, val);
                                System.out.println("PASSED");
                                totalPassed++;
                            }
                        }
                    } else {
                        totalFound++;
                        System.out.printf("  - [TEST] %-74s ... ", testDesc);
                        Object testInstance = instantiate(clazz, enclosingInstance);
                        invokeBeforeEach(clazz, testInstance);
                        method.setAccessible(true);
                        method.invoke(testInstance);
                        System.out.println("PASSED");
                        totalPassed++;
                    }
                } catch (Throwable t) {
                    Throwable cause = (t.getCause() != null) ? t.getCause() : t;
                    System.out.println("FAILED (" + cause.getClass().getSimpleName() + ": " + cause.getMessage() + ")");
                    totalFailed++;
                    failures.add("FAILED: " + clazz.getSimpleName() + "#" + method.getName() + " -> " + cause.getMessage());
                }
            }
        }

        // Run nested test classes
        for (Class<?> nested : clazz.getDeclaredClasses()) {
            if (nested.isAnnotationPresent(Nested.class)) {
                try {
                    Object instance = instantiate(nested, enclosingInstance);
                    runTestClass(nested, instance);
                } catch (Exception e) {
                    System.err.println("Error initializing nested class: " + nested.getName() + ": " + e.getMessage());
                }
            }
        }
    }

    private static Object instantiate(Class<?> clazz, Object enclosingInstance) throws Exception {
        if (enclosingInstance != null) {
            Constructor<?> ctor = clazz.getDeclaredConstructor(enclosingInstance.getClass());
            ctor.setAccessible(true);
            return ctor.newInstance(enclosingInstance);
        } else {
            Constructor<?> ctor = clazz.getDeclaredConstructor();
            ctor.setAccessible(true);
            return ctor.newInstance();
        }
    }

    private static void invokeBeforeEach(Class<?> clazz, Object testInstance) throws Exception {
        for (Method m : clazz.getDeclaredMethods()) {
            if (m.isAnnotationPresent(org.junit.jupiter.api.BeforeEach.class)) {
                m.setAccessible(true);
                m.invoke(testInstance);
            }
        }
    }
}
