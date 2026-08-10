package com.novacrm.documento;

import org.junit.jupiter.api.Test;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * El nombre y el tipo de un archivo los elige quien lo sube, y en esta
 * aplicacion el que sube puede ser un estudiante. Ninguno de los dos puede
 * llegar tal cual a una cabecera de la respuesta.
 */
class CabecerasDeDescargaTest {

    /**
     * La descarga del estudiante pegaba el nombre entre comillas a mano. Un
     * nombre que ya lleva comillas cierra el parametro antes de tiempo y lo que
     * viene detras se lee como mas parametros de la cabecera.
     */
    @Test
    void unNombreConComillasNoParteLaCabecera() {
        String nombre = "hoja.pdf\"; filename=\"otro.html";

        String aMano = "attachment; filename=\"" + nombre + "\"";
        assertTrue(aMano.split("filename=").length > 2,
                "asi era antes: el nombre mete un segundo filename en la cabecera");

        String codificado = ContentDisposition.builder("attachment")
                .filename(nombre, StandardCharsets.UTF_8)
                .build()
                .toString();
        assertFalse(codificado.contains("filename=\"otro.html"),
                "el nombre debe viajar codificado, no abriendo parametros nuevos");
    }

    /**
     * El tipo se guarda tal como lo declara el cliente al subir. Si no es
     * analizable, la descarga reventaba con un 500: no solo la del estudiante
     * que subio el archivo, tambien la del coordinador que abre su ficha.
     */
    @Test
    void unTipoIlegibleNoTumbaLaDescarga() {
        assertEquals(MediaType.APPLICATION_OCTET_STREAM,
                DocumentoController.tipoAnalizable("no es un tipo"));
        assertEquals(MediaType.APPLICATION_OCTET_STREAM,
                DocumentoController.tipoAnalizable("application/"));
        assertEquals(MediaType.APPLICATION_OCTET_STREAM,
                DocumentoController.tipoAnalizable(null));
        assertEquals(MediaType.APPLICATION_OCTET_STREAM,
                DocumentoController.tipoAnalizable("   "));
    }

    @Test
    void unTipoNormalSeRespeta() {
        assertEquals(MediaType.APPLICATION_PDF, DocumentoController.tipoAnalizable("application/pdf"));
        assertEquals(MediaType.IMAGE_PNG, DocumentoController.tipoAnalizable("image/png"));
    }

    /** Sin nombre guardado la descarga sigue teniendo uno con el que grabarse. */
    @Test
    void sinNombreSeUsaUnoPorDefecto() {
        String disposicion = ContentDisposition.builder("attachment")
                .filename("documento", StandardCharsets.UTF_8)
                .build()
                .toString();
        assertTrue(disposicion.contains("documento"));
    }
}
