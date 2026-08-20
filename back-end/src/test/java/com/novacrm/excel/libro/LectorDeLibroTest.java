package com.novacrm.excel.libro;

import org.junit.jupiter.api.Test;

import static com.novacrm.excel.libro.LibroDePrueba.fila;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Lectura de un libro con varias hojas.
 *
 * <p>Los importadores leian {@code getSheetAt(0)} y daban por hecho que la
 * cabecera era la primera fila. Con el libro que de verdad usa el equipo eso
 * significa abrir el tablero de indicadores y encontrar una cabecera de una
 * sola celda, con lo que los tres importadores fallaban igual: "no se reconocio
 * ninguna columna".
 *
 * <p>Las hojas de aqui reproducen la forma del archivo real —titulo, banda de
 * grupos, columnas en blanco, leyendas y filas de seccion— con datos inventados.
 */
class LectorDeLibroTest {

    /** Hoja de participantes: titulo, banda de grupos y cabecera en la fila 3. */
    private static LibroDePrueba conPerfiles() {
        return LibroDePrueba.nuevo().conHoja("Perfiles Empleabilidad",
                fila("PERFILES PARTICIPANTES  PROYECTO NOVA"),
                fila("PERFIL DEL PARTICIPANTE", null, null, null, null, null,
                        "PREPARACIÓN PARA LA EMPLEABILIDAD"),
                fila("N°", "Nombre completo", "Edad", "Nivel de inglés", "CV listo",
                        "LinkedIn optimizado", "Estado de empleabilidad"),
                fila("1", "Ana Ruiz Gómez", "24", "B1 (Puedo comunicarme)", "Sí",
                        "En proceso", "Sin iniciar"),
                fila("2", "Luis Pardo Vega", "31", "A2", "No", "No", "Empleado"));
    }

    @Test
    void encuentraLaCabeceraAunqueNoEsteEnLaPrimeraFila() {
        var c = LectorDeLibro.clasificar(conPerfiles().hoja("Perfiles Empleabilidad"));

        assertTrue(c.importable(), c.motivo());
        assertEquals(DestinoDeHoja.PARTICIPANTES, c.destino());
        assertEquals(3, c.hoja().filaCabecera(), "la cabecera está en la tercera fila");
        assertEquals(2, c.hoja().filas().size());
    }

    /** La banda de grupos tiene varias celdas pero no es la cabecera. */
    @Test
    void noConfundeLaBandaDeGruposConLaCabecera() {
        var c = LectorDeLibro.clasificar(conPerfiles().hoja("Perfiles Empleabilidad"));

        assertEquals("Ana Ruiz Gómez", c.hoja().filas().get(0).texto("nombreCompleto"));
        assertNotEquals(2, c.hoja().filaCabecera());
    }

    /**
     * El tablero de indicadores comparte titulos con la hoja de participantes
     * ("CV LISTO", "LINKEDIN OPTIMIZADO") pero no identifica a nadie. Se omite,
     * y se dice por que: una hoja que desaparece en silencio es indistinguible
     * de una que se importo vacia.
     */
    @Test
    void elTableroDeIndicadoresSeOmiteConSuMotivo() {
        var libro = LibroDePrueba.nuevo().conHoja("Dashboard",
                fila("SEGUIMIENTO DE EMPLEABILIDAD PROYECTO NOVA"),
                fila("Cuando Sabes Inglés Se Nota"),
                null,
                fila(null, "TOTAL PARTICIPANTES", null, "CV LISTO", null, "CV EN INGLÉS",
                        null, "LINKEDIN OPTIMIZADO"),
                fila(null, "104", null, "74", null, "70", null, "9"));

        var c = LectorDeLibro.clasificar(libro.hoja("Dashboard"));

        assertFalse(c.importable());
        assertTrue(c.motivo().contains("indicadores"), c.motivo());
    }

    @Test
    void noMandaALaIaElCodigoPegadoComoColumna() {
        var libro = LibroDePrueba.nuevo().conHoja("Seguimiento Postulaciones",
                fila("SEGUIMIENTO DE POSTULACIONES"),
                fila("N° Participante", "Nombre Completo", "Empresa", "Cargo Aplicado",
                        "Canal", "Fecha Postulación", "Estado",
                        "function crearTablaParticipantes() {", "Observaciones"),
                fila("80", "Ana Ruiz", "Solvo Global", "Agente", "LinkedIn", "2026-07-15", "Enviado",
                        "var ss = SpreadsheetApp.getActiveSpreadsheet();", "Primera postulación"));
        var ia = org.mockito.Mockito.mock(com.novacrm.ia.ReconocimientoConIa.class);
        org.mockito.Mockito.when(ia.disponible()).thenReturn(true);

        var clasificada = LectorDeLibro.clasificar(
                libro.hoja("Seguimiento Postulaciones"), ia);

        assertTrue(clasificada.importable(), clasificada.motivo());
        assertNull(clasificada.hoja().columnas().get("function crearTablaParticipantes() {"));
        org.mockito.Mockito.verify(ia, org.mockito.Mockito.never())
                .sugerirCampos(org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void unaHojaVaciaSeOmiteSinRomperNada() {
        var libro = LibroDePrueba.nuevo().conHoja("CRM Empresas");

        var c = LectorDeLibro.clasificar(libro.hoja("CRM Empresas"));

        assertFalse(c.importable());
        assertTrue(c.motivo().contains("títulos"), c.motivo());
    }

    /**
     * La hoja de empresas por sector tiene la columna A en blanco, la C en
     * blanco, "Número de Contacto" repetida y filas de sección entre los datos.
     */
    @Test
    void leeUnaHojaConColumnasEnBlancoYFilasDeSeccion() {
        var libro = LibroDePrueba.nuevo().conHoja("Empresas por Sector",
                fila("DIRECTORIO DE EMPRESAS ALIADAS"),
                fila("Empresas bilingües en Barranquilla"),
                null,
                null,
                fila("BPO / ATENCIÓN AL CLIENTE"),
                fila(null, "Empresa", null, "Número de Contacto", "Tipo",
                        "Cargos típicos", "Notas", "Número de Contacto"),
                fila(null, "Contact Norte SAS", null, "3001112233", "BPO multinacional",
                        "Agente bilingüe", "Contrata sin experiencia"),
                fila("SECTOR SALUD"),
                fila(null, "Clínica del Caribe", null, "3004445566", "Salud",
                        "Auxiliar", "Turnos rotativos"));

        var c = LectorDeLibro.clasificar(libro.hoja("Empresas por Sector"));

        assertTrue(c.importable(), c.motivo());
        assertEquals(DestinoDeHoja.EMPRESAS, c.destino());
        assertEquals(6, c.hoja().filaCabecera());
        assertEquals(2, c.hoja().filas().size(),
                "las filas de sección no son empresas: su texto va en una columna sin mapear");
        assertEquals("Contact Norte SAS", c.hoja().filas().get(0).texto("nombre"));
        assertEquals("3001112233", c.hoja().filas().get(0).texto("telefono"),
                "de las dos columnas repetidas gana la primera, que es la que trae el dato");
    }

    /**
     * Entre la cabecera y los datos hay una leyenda que ocupa una sola celda.
     * Leerla como registro produce una fila de error que no le dice nada a
     * nadie.
     */
    @Test
    void saltaLaLeyendaQueVaDebajoDeLaCabecera() {
        var libro = LibroDePrueba.nuevo().conHoja("Seguimiento Postulaciones",
                fila("SEGUIMIENTO DE POSTULACIONES"),
                fila("Registra cada postulación enviada"),
                fila("N° Participante", "Nombre Completo", "Empresa", "Cargo Aplicado",
                        "Canal", "Fecha Postulación", "Estado"),
                fila("Estados posibles: Enviado / En proceso / Rechazado"),
                fila("80", "Ana Ruiz Gómez", "Solvo Global", "Freight Coordinator",
                        "LinkedIn", "2026-07-15", "Enviado"));

        var c = LectorDeLibro.clasificar(libro.hoja("Seguimiento Postulaciones"));

        assertTrue(c.importable(), c.motivo());
        assertEquals(DestinoDeHoja.POSTULACIONES, c.destino());
        assertEquals(1, c.hoja().filas().size(), "la leyenda no es una postulación");
        assertEquals("Solvo Global", c.hoja().filas().get(0).texto("empresaNombre"));
    }

    /** Una fila escasa en medio de los datos sí es un registro. */
    @Test
    void noDescartaUnaFilaEscasaQueVieneDespuesDeLosDatos() {
        var libro = LibroDePrueba.nuevo().conHoja("Empresas Contactadas",
                fila("EMPRESAS CONTACTADAS"),
                fila("Empresa", "Sector", "Estado Relación", "Próximo Paso"),
                fila("Solvo Global", "BPO", "Perfil enviado", "Seguimiento"),
                fila("Clínica Norte"));

        var c = LectorDeLibro.clasificar(libro.hoja("Empresas Contactadas"));

        assertEquals(2, c.hoja().filas().size(),
                "una empresa de la que solo se sabe el nombre sigue siendo una empresa");
        assertEquals("Clínica Norte", c.hoja().filas().get(1).texto("nombre"));
    }

    /** Cabecera de dos niveles: la banda de grupos va encima de los títulos. */
    @Test
    void distingueColocacionesDeParticipantesAunqueCompartanColumnas() {
        var libro = LibroDePrueba.nuevo().conHoja("Vinculados y Colocados",
                fila("VINCULADOS Y COLOCADOS"),
                fila("Meta salarial NOVA: $2,276,176"),
                fila("DATOS DEL PARTICIPANTE", null, null, null, null, "DATOS DE LA VINCULACIÓN"),
                fila("N°", "Nombre Completo", "Sector / Área", "Nivel Inglés", "% Empleabilidad",
                        "Empresa", "Cargo", "Tipo Vinculación", "Fecha Inicio",
                        "Canal de Consecución", "Salario (COP)", "Contrato ✓"),
                null,
                fila("1", "Ana Ruiz Gómez", "BPO", "B1", "92%", "Toeshee", "Inbound Agent",
                        "Empleado", "2026-06-22", "Open House", "2850000", "✅ Sí"));

        var c = LectorDeLibro.clasificar(libro.hoja("Vinculados y Colocados"));

        assertTrue(c.importable(), c.motivo());
        assertEquals(DestinoDeHoja.COLOCACIONES, c.destino(),
                "comparte «Nombre Completo» y «Sector» con participantes, pero manda lo demás");
        assertEquals(4, c.hoja().filaCabecera());
        assertEquals(1, c.hoja().filas().size());
        assertEquals("Toeshee", c.hoja().filas().get(0).texto("empresaNombre"));
        assertEquals("✅ Sí", c.hoja().filas().get(0).texto("checklistContrato"));
    }

    /** Cuando ningún destino saca ventaja, no se elige uno al azar. */
    @Test
    void unaCabeceraAmbiguaNoSeClasifica() {
        var libro = LibroDePrueba.nuevo().conHoja("Ambigua",
                fila("Empresa", "Observaciones"),
                fila("Solvo Global", "Nada que anotar"));

        var c = LectorDeLibro.clasificar(libro.hoja("Ambigua"));

        assertFalse(c.importable());
        assertTrue(c.motivo().contains("decidir"), c.motivo());
    }

    @Test
    void leerElLibroCompletoDevuelveUnaEntradaPorHojaYEnSuOrden() {
        var libro = LibroDePrueba.nuevo()
                .conHoja("Dashboard", fila("SEGUIMIENTO"), fila("Total", "104"))
                .conHoja("Perfiles Empleabilidad",
                        fila("PERFILES"),
                        fila("N°", "Nombre completo", "Edad", "Nivel de inglés", "CV listo"),
                        fila("1", "Ana Ruiz Gómez", "24", "B1", "Sí"))
                .conHoja("Empresas Contactadas",
                        fila("EMPRESAS"),
                        fila("Empresa", "Sector", "Estado Relación"),
                        fila("Solvo Global", "BPO", "Perfil enviado"));

        var hojas = LectorDeLibro.leer(libro.comoArchivo());

        assertEquals(3, hojas.size(), "se informa de todas, también de las omitidas");
        assertEquals("Dashboard", hojas.get(0).nombre());
        assertFalse(hojas.get(0).importable());
        assertEquals(DestinoDeHoja.PARTICIPANTES, hojas.get(1).destino());
        assertEquals(DestinoDeHoja.EMPRESAS, hojas.get(2).destino());
    }

    @Test
    void unArchivoQueNoEsExcelSeRechaza() {
        var archivo = new org.springframework.mock.web.MockMultipartFile(
                "archivo", "datos.csv", "text/csv", "a,b,c".getBytes());

        var e = assertThrows(com.novacrm.exception.BusinessException.class,
                () -> LectorDeLibro.leer(archivo));
        assertTrue(e.getMessage().contains(".xlsx"), e.getMessage());
    }
}
