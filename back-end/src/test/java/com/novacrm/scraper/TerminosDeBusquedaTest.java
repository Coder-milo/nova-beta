package com.novacrm.scraper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pruebas unitarias para el generador dinámico y multidisciplinar de términos de búsqueda bilingüe.
 */
class TerminosDeBusquedaTest {

    @Test
    @DisplayName("Extrae y enriquece términos para diversas disciplinas (Software, Contaduría, Diseño, Ingeniería, BPO)")
    void tomaLosTerminosDeLoQueDeclararonLosEstudiantesMultiDisciplina() {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                List.of("Desarrollador Java", "Contador Público", "Diseñador Gráfico"),
                List.of("Ingeniería de Software", "BPO y Servicios"));

        assertTrue(terminos.stream().anyMatch(t -> t.contains("desarrollador java")),
                () -> "debería incluir Software/Tech, fue: " + terminos);
        assertTrue(terminos.stream().anyMatch(t -> t.contains("contador")),
                () -> "debería incluir Contaduría/Finanzas, fue: " + terminos);
        assertTrue(terminos.stream().anyMatch(t -> t.contains("disenador")),
                () -> "debería incluir Diseño, fue: " + terminos);
        assertTrue(terminos.stream().anyMatch(t -> t.contains("ingenieria")),
                () -> "debería incluir Ingeniería, fue: " + terminos);
        assertTrue(terminos.stream().anyMatch(t -> t.contains("bpo")),
                () -> "debería incluir BPO, fue: " + terminos);
    }

    @Test
    @DisplayName("Enriquece cargos profesionales sin marca bilingüe con sufijo bilingüe")
    void enriqueceCargosProfesionalesSinMarcaBilingue() {
        assertEquals("desarrollador java bilingue", TerminosDeBusqueda.enriquecerTermino("desarrollador java"));
        assertEquals("contador publico bilingue", TerminosDeBusqueda.enriquecerTermino("contador publico"));
        assertEquals("disenador grafico bilingue", TerminosDeBusqueda.enriquecerTermino("disenador grafico"));
        assertEquals("ingeniero industrial bilingue", TerminosDeBusqueda.enriquecerTermino("ingeniero industrial"));

        // Roles en inglés reciben prefijo 'bilingual'
        assertEquals("bilingual software developer", TerminosDeBusqueda.enriquecerTermino("software developer"));
        assertEquals("bilingual data analyst", TerminosDeBusqueda.enriquecerTermino("data analyst"));
        assertEquals("bilingual graphic designer", TerminosDeBusqueda.enriquecerTermino("graphic designer"));
        assertEquals("bilingual devops engineer", TerminosDeBusqueda.enriquecerTermino("devops engineer"));
    }

    @Test
    @DisplayName("Preserva términos que ya tienen marca de idioma o bilingüe sin duplicar sufijos")
    void preservaTerminosQueYaTienenMarcaBilingue() {
        assertEquals("bilingual customer service", TerminosDeBusqueda.enriquecerTermino("bilingual customer service"));
        assertEquals("soporte bilingue", TerminosDeBusqueda.enriquecerTermino("soporte bilingue"));
        assertEquals("profesor de ingles", TerminosDeBusqueda.enriquecerTermino("profesor de ingles"));
        assertEquals("agente bpo", TerminosDeBusqueda.enriquecerTermino("agente bpo"));
        assertEquals("asesor ingles b2", TerminosDeBusqueda.enriquecerTermino("asesor ingles b2"));
    }

    @Test
    @DisplayName("Soporta la ingesta completa de 5 colecciones de datos académicos y profesionales")
    void soportaCincoCamposAcademicosDeEstudiantes() {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                List.of("Full Stack Developer"),           // cargosObjetivo
                List.of("Tecnología de la Información"),   // sectoresObjetivo
                List.of("Ingeniero de Sistemas"),          // titulos
                List.of("Desarrollo de Software"),         // programasAcademicos
                List.of("Ciencias de la Computación"));    // areasFormacion

        assertEquals(10, terminos.size());
        assertTrue(terminos.stream().anyMatch(t -> t.contains("full stack") || t.contains("developer")));
        assertTrue(terminos.stream().anyMatch(t -> t.contains("sistemas") || t.contains("ingeniero")));
        assertTrue(terminos.stream().anyMatch(t -> t.contains("software") || t.contains("desarrollo")));
    }

    @Test
    @DisplayName("Núcleo de respaldo balanceado y multidisciplinar en arranque en frío")
    void nucleoMultidisciplinarEquilibradoEnArranqueEnFrio() {
        var terminosVacio = TerminosDeBusqueda.desdeEstudiantes(List.of(), List.of());
        var terminosNull = TerminosDeBusqueda.desdeEstudiantes(null, null);

        assertEquals(TerminosDeBusqueda.RESPALDO, terminosVacio);
        assertEquals(TerminosDeBusqueda.RESPALDO, terminosNull);
        assertEquals(10, TerminosDeBusqueda.RESPALDO.size());

        // Verificar cobertura multidisciplinar del respaldo
        assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("desarrollador") || t.contains("software")));
        assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("datos") || t.contains("analista")));
        assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("contador")));
        assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("ingeniero")));
        assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("disenador")));
        assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("marketing")));
        assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("customer service") || t.contains("soporte")));
    }

    @Test
    @DisplayName("Completa con núcleo multidisciplinar cuando los estudiantes aportan menos de 10 términos")
    void completaConNucleoMultidisciplinarCuandoHayPocasFichas() {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                List.of("Desarrollador Python"),
                List.of());

        assertEquals(TerminosDeBusqueda.MAX_TERMINOS, terminos.size());
        assertEquals("desarrollador python bilingue", terminos.get(0));
        // Debe contener términos del respaldo para completar hasta 10
        assertTrue(terminos.contains("contador bilingue") || terminos.contains("bilingue"));
        assertEquals(terminos.size(), Set.copyOf(terminos).size(), "no debe haber duplicados");
    }

    /** Un mismo campo trae varias opciones separadas por barra, coma, punto y coma o conectores. */
    @Test
    @DisplayName("Separa opciones compuestas con múltiples delimitadores y conectores")
    void separaLasOpcionesDeUnMismoCampo() {
        var partes = TerminosDeBusqueda.trocear(
                "Customer Service Representative / Sales Agent, Data Entry; UI Designer & QA Tester y Finanzas");

        assertTrue(partes.contains("customer service representative"));
        assertTrue(partes.contains("sales agent"));
        assertTrue(partes.contains("data entry"));
        assertTrue(partes.contains("ui designer"));
        assertTrue(partes.contains("qa tester"));
        assertTrue(partes.contains("finanzas"));
    }

    @Test
    @DisplayName("Normaliza tildes, caracteres especiales y mayúsculas")
    void normalizaTildesYMayusculas() {
        var partes = TerminosDeBusqueda.trocear("Atención al Cliente");
        assertEquals(List.of("atencion al cliente"), partes);

        var partesDiacriticas = TerminosDeBusqueda.trocear("Diseño Gráfico & Programación");
        assertTrue(partesDiacriticas.contains("diseno grafico"));
        assertTrue(partesDiacriticas.contains("programacion"));
    }

    /** Las frases largas devuelven poco en los portales. */
    @Test
    @DisplayName("Recorta frases largas a un máximo de palabras manejable por los portales")
    void recortaLasFrasesDemasiadoLargas() {
        var partes = TerminosDeBusqueda.trocear(
                "Bilingual Customer Service Representative for International Accounts Division");

        assertEquals(1, partes.size());
        assertTrue(partes.get(0).split(" ").length <= 4,
                () -> "debería quedarse en cuatro palabras como máximo, fue '" + partes.get(0) + "'");
    }

    @Test
    @DisplayName("Descarta fragmentos demasiado cortos")
    void descartaLosFragmentosDemasiadoCortos() {
        var partes = TerminosDeBusqueda.trocear("BPO / y / de");
        assertEquals(List.of("bpo"), partes);
    }

    @Test
    @DisplayName("Limita la cantidad de términos generados al tope máximo configurado")
    void limitaCuantosTerminosSeConsultan() {
        var muchos = List.of("uno", "dos", "tres", "cuatro", "cinco",
                "seis", "siete", "ocho", "nueve", "diez", "once", "doce");

        var terminos = TerminosDeBusqueda.desdeEstudiantes(muchos, muchos);

        assertTrue(terminos.size() <= TerminosDeBusqueda.MAX_TERMINOS,
                "cada término es una petición más al portal, debe ser <= " + TerminosDeBusqueda.MAX_TERMINOS);
    }

    @Test
    @DisplayName("No repite términos en la lista generada")
    void noRepiteTerminos() {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                List.of("Customer Service", "customer service"),
                List.of("CUSTOMER SERVICE"));

        assertEquals(terminos.size(), Set.copyOf(terminos).size(),
                () -> "cada término repetido es una petición tirada, fue " + terminos);
    }

    @Test
    @DisplayName("Ordena por frecuencia descendente de aparición")
    void loQueMasSeRepiteVaPrimero() {
        var cargos = List.of(
                "Desarrollador Java",
                "Bilingual Customer Service Agent",
                "Bilingual Customer Service Agent",
                "Bilingual Customer Service Agent");

        var derivados = TerminosDeBusqueda.porFrecuencia(cargos, List.of());

        assertEquals("bilingual customer service agent", derivados.get(0),
                () -> "el término más frecuente debe ir de primero, fue " + derivados);
    }

    @Test
    @DisplayName("El orden de generación es estable y determinista")
    void elOrdenEsEstable() {
        var cargos = List.of("Bilingual Data Entry Clerk", "Bilingual Chat Support Agent");

        assertEquals(TerminosDeBusqueda.desdeEstudiantes(cargos, List.of()),
                TerminosDeBusqueda.desdeEstudiantes(cargos, List.of()),
                "dos corridas con los mismos datos deben producir idéntico resultado");
    }

    @Test
    @DisplayName("Extrae ciudades únicas ordenadas por frecuencia")
    void buscaEnLasCiudadesDondeHayEstudiantes() {
        var ciudades = TerminosDeBusqueda.ciudades(
                List.of("Barranquilla", "Soledad", "Barranquilla"));

        assertEquals(List.of("Barranquilla", "Soledad"), ciudades,
                "sin repetir, y en orden de frecuencia");
    }

    @Test
    @DisplayName("Sin ciudades registradas busca a nivel nacional")
    void sinCiudadesRegistradasBuscaANivelNacional() {
        assertEquals(List.of(TerminosDeBusqueda.CIUDAD_POR_DEFECTO),
                TerminosDeBusqueda.ciudades(List.of()));
        assertEquals(List.of(TerminosDeBusqueda.CIUDAD_POR_DEFECTO),
                TerminosDeBusqueda.ciudades(null));
    }
}
