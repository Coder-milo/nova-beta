package com.novacrm.chat;

import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Que se puede mandar por el chat entre estudiantes.
 *
 * <p>Solo imagen y audio, y no cualquier archivo como en la bandeja del equipo.
 * Alli tiene sentido mandar una hoja de vida en PDF a la coordinadora; aqui
 * sube un participante y descarga otro, sin nadie en medio.
 */
class AdjuntoDeChatTest {

    private static MockMultipartFile archivo(String nombre, String tipo, int bytes) {
        return new MockMultipartFile("archivo", nombre, tipo, new byte[bytes]);
    }

    @Test
    @DisplayName("una foto y una nota de voz pasan")
    void loQueSeEsperaPasa() {
        assertThat(AdjuntoDeChat.tipoValidado(archivo("foto.jpg", "image/jpeg", 1024)))
                .isEqualTo("image/jpeg");
        assertThat(AdjuntoDeChat.tipoValidado(archivo("nota.webm", "audio/webm", 2048)))
                .isEqualTo("audio/webm");
    }

    /** El navegador manda "audio/webm;codecs=opus" al grabar. */
    @Test
    @DisplayName("el tipo con parametros del navegador se reconoce igual")
    void elTipoConParametrosSeReconoce() {
        assertThat(AdjuntoDeChat.tipoValidado(archivo("nota.webm", "audio/webm;codecs=opus", 512)))
                .isEqualTo("audio/webm");
    }

    @Test
    @DisplayName("lo que no es imagen ni audio no entra, aunque el nombre diga otra cosa")
    void loDemasNoEntra() {
        assertThatThrownBy(() -> AdjuntoDeChat.tipoValidado(archivo("cv.pdf", "application/pdf", 100)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> AdjuntoDeChat.tipoValidado(archivo("virus.exe", "application/octet-stream", 100)))
                .isInstanceOf(BusinessException.class);
        // Renombrar un ejecutable a .jpg no lo convierte en una imagen: manda
        // el tipo declarado, no la extension.
        assertThatThrownBy(() -> AdjuntoDeChat.tipoValidado(archivo("foto.jpg", "application/x-msdownload", 100)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("un archivo enorme se rechaza con un motivo que se puede leer")
    void loEnormeSeRechaza() {
        var grande = archivo("foto.jpg", "image/jpeg", (int) AdjuntoDeChat.MAXIMO_BYTES + 1);

        assertThatThrownBy(() -> AdjuntoDeChat.tipoValidado(grande))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("10 MB");
    }

    @Test
    @DisplayName("el nombre no puede llevar barras ni saltos de linea")
    void elNombreSeSanea() {
        assertThat(AdjuntoDeChat.nombreSeguro("../../etc/passwd")).doesNotContain("/");
        assertThat(AdjuntoDeChat.nombreSeguro("foto\r\n.jpg")).doesNotContain("\n");
        assertThat(AdjuntoDeChat.nombreSeguro("   ")).isEqualTo("archivo");
        assertThat(AdjuntoDeChat.nombreSeguro(null)).isEqualTo("archivo");
        assertThat(AdjuntoDeChat.nombreSeguro("a".repeat(300))).hasSize(255);
    }

    /**
     * La duracion la manda el navegador, asi que no es un dato de fiar. Lo que
     * no encaja se guarda como desconocido en vez de rechazar el audio: es un
     * adorno de la pantalla, no una regla.
     */
    @Test
    @DisplayName("una duracion imposible se ignora, no tumba el envio")
    void laDuracionSeAcota() {
        assertThat(AdjuntoDeChat.duracionValidada(12, "audio/webm")).isEqualTo(12);
        assertThat(AdjuntoDeChat.duracionValidada(-5, "audio/webm")).isNull();
        assertThat(AdjuntoDeChat.duracionValidada(99_999, "audio/webm")).isNull();
        assertThat(AdjuntoDeChat.duracionValidada(30, "image/png"))
                .as("una imagen no dura segundos")
                .isNull();
    }
}
