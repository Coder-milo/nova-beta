package com.novacrm.vacante;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Lectura de requisitos desde el texto del anuncio.
 *
 * <p>Los conectores nunca llenaban nivel de ingles, experiencia, ciudad ni
 * expiracion, y el motor leia esos huecos como "no exige nada": una vacante de
 * la que no se sabia nada puntuaba por encima del umbral contra cualquier
 * participante. El dato estaba escrito en la descripcion desde el principio.
 */
class EnriquecedorDeVacanteTest {

    private static final int DIAS_VIGENCIA = 30;

    private final EnriquecedorDeVacante enriquecedor = new EnriquecedorDeVacante(DIAS_VIGENCIA);

    /**
     * Requisitos tal cual los publica Sutherland para su oferta de
     * "Bilingual Customer Service Specialist" en Barranquilla, copiados de la
     * respuesta real de la API en agosto de 2026.
     *
     * <p>Es el perfil al que aspiran 71 de los 108 participantes, asi que si el
     * enriquecedor no sabe leer este texto concreto, la cadena entera —conector,
     * enriquecedor, motor— no le sirve a nadie por muy verde que este cada
     * pieza por separado.
     */
    private static final String REQUISITOS_REALES = """
            Required: B2+ English communication skills (minimum). High school             diploma or equivalent. Ability to multitask and navigate multiple             systems efficiently. Customer-focused mindset with strong             problem-solving abilities. Basic computer skills (CRM tools, email,             spreadsheets).
            """;

    @Test
    @DisplayName("lee el nivel de inglés de una oferta real de Barranquilla")
    void leeElInglesDeUnaOfertaReal() {
        // "B2+" no es un codigo MCER limpio: lo que se comprueba es que el
        // signo no impida reconocerlo, porque asi es como lo escribe el
        // empleador de verdad.
        var v = vacante("Bilingual Customer Service Specialist I", null);
        v.setRequisitos(REQUISITOS_REALES);

        enriquecedor.enriquecer(v);

        assertEquals("B2", v.getNivelInglesRequerido(),
                "sin esto el criterio de ingles queda sin datos y el par no llega a match");
    }

    private Vacante vacante(String titulo, String descripcion) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setDescripcion(descripcion);
        return v;
    }

    // --- Nivel de ingles ---------------------------------------------------

    @Test
    void tomaElCodigoMcerCuandoElAnuncioLoEscribe() {
        var v = vacante("Bilingual CSR", "Se requiere nivel B2 de ingles comprobable.");
        enriquecedor.enriquecer(v);
        assertEquals("B2", v.getNivelInglesRequerido());
    }

    @Test
    void reconoceBilingueComoB1() {
        var v = vacante("Agente bilingue", "Buscamos personal bilingue para atencion al cliente.");
        enriquecedor.enriquecer(v);
        assertEquals("B1", v.getNivelInglesRequerido());
    }

    @Test
    void inglesAvanzadoPesaMasQueUnaMencionPosteriorDeBasico() {
        var v = vacante("Customer Success",
                "Ingles avanzado indispensable. Deseable ingles basico en portugues.");
        enriquecedor.enriquecer(v);
        assertEquals("B2", v.getNivelInglesRequerido(),
                "la frase mas exigente manda, no la que aparezca antes en el texto");
    }

    @Test
    void exigirInglesSinDecirCuantoSeResuelveComoB1() {
        var v = vacante("Asesor comercial", "English required for this position.");
        enriquecedor.enriquecer(v);
        assertEquals("B1", v.getNivelInglesRequerido(),
                "B1 es la barrera real de una entrevista; suponer mas excluiria de mas");
    }

    @Test
    void noInventaNivelDeInglesCuandoElAnuncioNoLoMenciona() {
        var v = vacante("Auxiliar administrativo", "Manejo de Excel y archivo de documentos.");
        enriquecedor.enriquecer(v);
        assertNull(v.getNivelInglesRequerido(),
                "sin senal explicita el criterio queda sin datos, que ya no regala puntos");
    }

    @Test
    void noConfundeLicenciasConduccionNiUbicacionesConNivelDeIngles() {
        var vChofer = vacante("Conductor con Pase C1", "Transporte de mercancía, pase C1 al día.");
        enriquecedor.enriquecer(vChofer);
        assertNull(vChofer.getNivelInglesRequerido(), "Pase C1 no es un nivel de inglés");

        var vBodega = vacante("Operario de Bodega B1", "Cargue y descargue en bodega B1, nivel bachiller.");
        enriquecedor.enriquecer(vBodega);
        assertNull(vBodega.getNivelInglesRequerido(), "Bodega B1 no es un nivel de inglés");

        var vB2b = vacante("Ejecutivo B2B", "Ventas corporativas en sector B2B.");
        enriquecedor.enriquecer(vB2b);
        assertNull(vB2b.getNivelInglesRequerido(), "B2B no es un nivel de inglés");

        var vVit = vacante("Auxiliar de Farmacia", "Dispensación de Vitamina B1.");
        enriquecedor.enriquecer(vVit);
        assertNull(vVit.getNivelInglesRequerido(), "Vitamina B1 no es un nivel de inglés");
    }

    @Test
    void infiereNivelesMcerMultidisciplinares() {
        var vMcer = vacante("Business Analyst", "Levantamiento de procesos. Requisito: MCER B2.");
        enriquecedor.enriquecer(vMcer);
        assertEquals("B2", vMcer.getNivelInglesRequerido());

        var vCefr = vacante("Auditor Internacional", "Requisitos: Certificación CEFR C1 indispensable.");
        enriquecedor.enriquecer(vCefr);
        assertEquals("C1", vCefr.getNivelInglesRequerido());

        var vTech = vacante("Software Engineer", "Desarrollo backend en Java. Inglés C1 para reuniones diarias.");
        enriquecedor.enriquecer(vTech);
        assertEquals("C1", vTech.getNivelInglesRequerido());

        var vUi = vacante("UI/UX Designer", "Design systems, Figma. Professional working English required.");
        enriquecedor.enriquecer(vUi);
        assertEquals("C1", vUi.getNivelInglesRequerido());

        var vInd = vacante("Ingeniero Industrial", "Control de procesos de planta. Inglés técnico indispensable.");
        enriquecedor.enriquecer(vInd);
        assertEquals("B1", vInd.getNivelInglesRequerido());
    }

    @Test
    void noPisaUnNivelQueYaVenia() {
        var v = vacante("Agente bilingue", "Personal bilingue requerido.");
        v.setNivelInglesRequerido("C1");
        enriquecedor.enriquecer(v);
        assertEquals("C1", v.getNivelInglesRequerido(), "lo que trajo la fuente manda sobre lo inferido");
    }

    // --- Anios de experiencia ----------------------------------------------

    @Test
    void leeLosAniosDeExperienciaPedidos() {
        var v = vacante("Asesor comercial", "Se requiere 2 anos de experiencia en ventas.");
        enriquecedor.enriquecer(v);
        assertEquals(2, v.getAniosExperienciaRequeridos());
    }

    @Test
    void leeLosAniosEnIngles() {
        var v = vacante("Customer Service Rep", "Minimum 3 years of experience in a BPO environment.");
        enriquecedor.enriquecer(v);
        assertEquals(3, v.getAniosExperienciaRequeridos());
    }

    @Test
    void deUnRangoSeQuedaConElMinimo() {
        var v = vacante("Analista", "Experiencia de 2 a 4 anos en cargos similares.");
        enriquecedor.enriquecer(v);
        assertEquals(2, v.getAniosExperienciaRequeridos(),
                "el minimo del rango es el requisito de entrada real");
    }

    @Test
    void sinExperienciaSeRegistraComoCero() {
        var v = vacante("Agente call center", "No se requiere experiencia, nosotros te capacitamos.");
        enriquecedor.enriquecer(v);
        assertEquals(0, v.getAniosExperienciaRequeridos());
    }

    @Test
    void laAntiguedadDeLaEmpresaNoEsExperienciaDelCandidato() {
        var v = vacante("Auxiliar de bodega",
                "Somos una empresa con 15 anos en el mercado. Buscamos personal comprometido.");
        enriquecedor.enriquecer(v);
        assertNull(v.getAniosExperienciaRequeridos(),
                "el numero esta lejos de la palabra experiencia: no es un requisito");
    }

    // --- Ciudad ------------------------------------------------------------

    @Test
    void extraeLaCiudadDeLaUbicacion() {
        var v = vacante("Asesor", "Turnos rotativos.");
        v.setUbicacion("Barranquilla, Atlantico");
        enriquecedor.enriquecer(v);
        assertEquals("Barranquilla", v.getCiudad());
    }

    @Test
    void reconoceMunicipiosDelAreaMetropolitana() {
        var v = vacante("Operario", "Planta de produccion.");
        v.setUbicacion("Soledad");
        enriquecedor.enriquecer(v);
        assertEquals("Soledad", v.getCiudad(),
                "buena parte de los participantes reside en el area metropolitana de Barranquilla");
    }

    @Test
    void unaVacanteRemotaNoRecibeCiudadInventada() {
        var v = vacante("Customer Support", "Work from home. Bogota office optional.");
        v.setUbicacion("Worldwide");
        enriquecedor.enriquecer(v);
        assertNull(v.getCiudad(), "\"Worldwide\" no es un lugar donde alguien pueda presentarse");
    }

    @Test
    void caeAlTextoCuandoLaUbicacionNoTraeCiudad() {
        var v = vacante("Auxiliar contable", "El cargo se desempena en nuestra sede de Medellin.");
        enriquecedor.enriquecer(v);
        assertEquals("Medellin", v.getCiudad());
        assertEquals("Medellin", v.getUbicacion());
    }

    @Test
    void infiereCiudadDesdeDepartamento() {
        var v = vacante("Ingeniero de Sistemas", "Empresa ubicada en Cundinamarca.");
        enriquecedor.enriquecer(v);
        assertEquals("Bogotá, D.C.", v.getCiudad());
        assertEquals("Bogotá, D.C.", v.getUbicacion());

        var vAtl = vacante("Asesor Bilingüe", "Sede en Atlántico.");
        enriquecedor.enriquecer(vAtl);
        assertEquals("Barranquilla, Atlántico", vAtl.getCiudad());
    }

    @Test
    void sincronizaUbicacionSiSoloVeniaCiudad() {
        var v = vacante("Diseñador", "Trabajo en sede.");
        v.setCiudad("Galapa");
        enriquecedor.enriquecer(v);
        assertEquals("Galapa", v.getUbicacion());
    }

    // --- Vigencia ----------------------------------------------------------

    @Test
    void aplicaVigenciaPorDefectoSobreLaFechaDePublicacion() {
        var v = vacante("Asesor", "Descripcion.");
        var publicacion = LocalDateTime.of(2026, 7, 1, 9, 0);
        v.setFechaPublicacion(publicacion);
        enriquecedor.enriquecer(v);
        assertEquals(publicacion.plusDays(DIAS_VIGENCIA), v.getFechaExpiracion(),
                "sin expiracion la vacante no vence nunca y cerrarVencidas no puede retirarla");
    }

    @Test
    void respetaLaExpiracionQueTraeLaFuente() {
        var v = vacante("Asesor", "Descripcion.");
        var expiracion = LocalDateTime.of(2026, 8, 15, 0, 0);
        v.setFechaPublicacion(LocalDateTime.of(2026, 7, 1, 9, 0));
        v.setFechaExpiracion(expiracion);
        enriquecedor.enriquecer(v);
        assertEquals(expiracion, v.getFechaExpiracion());
    }

    @Test
    void infiereModalidadRemotaEHibrida() {
        var vRemota = vacante("Customer Service Agent", "Posición 100% remota con trabajo desde casa.");
        enriquecedor.enriquecer(vRemota);
        assertEquals("Remoto", vRemota.getModalidadTrabajo());

        var vHibrida = vacante("Team Lead", "Modalidad de trabajo híbrido con 2 días en oficina.");
        enriquecedor.enriquecer(vHibrida);
        assertEquals("Híbrido", vHibrida.getModalidadTrabajo());
    }

    @Test
    void infiereSalarioDesdeTextoDeLaDescripcion() {
        var vRango = vacante("Bilingual CSR", "Ofrecemos salario de $2.500.000 a $3.000.000 COP más bonos.");
        enriquecedor.enriquecer(vRango);
        assertEquals("$2.500.000 - $3.000.000 COP", vRango.getRangoSalarial());

        var vFijo = vacante("Agente BPO", "Salario: $2.800.000 COP con todas las prestaciones.");
        enriquecedor.enriquecer(vFijo);
        assertEquals("$2.800.000 COP", vFijo.getRangoSalarial());

        var vUsd = vacante("Software Developer", "Salary: USD $1200 - $1800 per month.");
        enriquecedor.enriquecer(vUsd);
        assertEquals("USD $1200 - $1800", vUsd.getRangoSalarial());
    }

    @Test
    void infiereRequisitosDesdeSeccionDedicada() {
        var v = vacante("Soporte Bilingüe", """
                Acerca de la empresa: BPO multinacional.
                
                Requisitos:
                - Bachiller o técnico.
                - Nivel de inglés B2.
                - Manejo de herramientas ofimáticas.
                
                Beneficios:
                - Medicina prepagada.
                """);
        enriquecedor.enriquecer(v);
        assertNotNull(v.getRequisitos());
        assertTrue(v.getRequisitos().contains("Nivel de inglés B2"));
    }

    @Test
    void unaVacanteNulaNoRompe() {
        assertDoesNotThrow(() -> enriquecedor.enriquecer(null));
    }
}
