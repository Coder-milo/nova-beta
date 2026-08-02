package com.novacrm.vacante;

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
    void unaVacanteNulaNoRompe() {
        assertDoesNotThrow(() -> enriquecedor.enriquecer(null));
    }
}
