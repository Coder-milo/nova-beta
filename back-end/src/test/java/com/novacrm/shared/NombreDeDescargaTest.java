package com.novacrm.shared;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El nombre con el que se descarga un archivo.
 *
 * <p>Las tres descargas de hoja de vida reemplazaban por «_» todo lo que no
 * fuera {@code [a-zA-Z0-9.-]}. Es seguro, pero se lleva por delante las tildes
 * y las eñes, y en esta cohorte 48 de 108 nombres llevan tilde: casi la mitad
 * de los participantes descargaba su hoja de vida llamada
 * «HV-CAC-Jos_-N__ez.pdf» y con ese nombre la mandaba a las empresas.
 */
class NombreDeDescargaTest {

    @Test
    @DisplayName("el nombre llega con sus tildes y sus eñes")
    void conservaLosAcentos() {
        String cabecera = NombreDeDescarga.adjunto("HV-CAC-José-Núñez.pdf");

        assertThat(cabecera).startsWith("attachment;");
        // RFC 5987: el nombre real viaja codificado en UTF-8.
        assertThat(cabecera).contains("filename*=UTF-8''");
        assertThat(cabecera).contains("Jos%C3%A9");
        assertThat(cabecera).doesNotContain("Jos_");
    }

    /**
     * Un nombre con comillas cerraba el parametro antes de tiempo y el resto de
     * la cabecera se leia como mas parametros. Es la razon por la que las
     * descargas de documentos ya no lo pegaban a mano.
     */
    @Test
    @DisplayName("unas comillas en el nombre no parten la cabecera")
    void noSePuedeRomperLaCabecera() {
        String cabecera = NombreDeDescarga.adjunto("informe\"; x=\"y.pdf");

        assertThat(cabecera).doesNotContain("x=\"y");
    }

    @Test
    @DisplayName("sin nombre no se manda una cabecera vacia")
    void sinNombreHayUnoPorDefecto() {
        assertThat(NombreDeDescarga.adjunto(null)).contains("archivo");
        assertThat(NombreDeDescarga.adjunto("   ")).contains("archivo");
    }

    @Test
    @DisplayName("en linea para lo que se abre en el navegador")
    void enLineaParaVerlo() {
        assertThat(NombreDeDescarga.enLinea("vista-previa.pdf")).startsWith("inline;");
    }
}
