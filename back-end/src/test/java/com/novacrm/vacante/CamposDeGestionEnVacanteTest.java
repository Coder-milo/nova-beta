package com.novacrm.vacante;

import com.novacrm.vacante.dto.VacanteResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Que campos de una oferta ve un estudiante y cuales no.
 *
 * <p>{@code creadaPor} y {@code motivoCierre} describen como gestiona el equipo
 * la oferta, no la oferta. El detalle por identificador ya estaba restringido a
 * gestion justo por eso, pero el listado —que si alcanza el estudiante—
 * devolvia los mismos campos: filtraba por vigencia y no por campo.
 *
 * <p>En una oferta que sugirio un participante, {@code creadaPor} es el correo
 * de <em>otro participante</em>. Con 107 personas reales en el programa, eso es
 * repartir el directorio.
 */
class CamposDeGestionEnVacanteTest {

    // Sin colaboradores: la conversion a respuesta no toca ninguno.
    private final VacanteService servicio = new VacanteService(null, null, null, null);

    private Vacante ofertaSugerida() {
        var v = new Vacante();
        v.setTitulo("Asesor bilingue");
        v.setCreadaPor("otro.participante@correo.com");
        v.setMotivoCierre(MotivoCierre.CUBIERTA);
        v.setFechaCierre(LocalDateTime.now());
        v.setRevisada(false);
        return v;
    }

    /** El metodo es privado: se prueba el efecto, que es lo que sale por la API. */
    private VacanteResponse convertir(Vacante v, boolean paraGestion) {
        return (VacanteResponse) ReflectionTestUtils.invokeMethod(
                servicio, "toResponse", v, paraGestion);
    }

    @Test
    @DisplayName("el estudiante no recibe el correo de quien registró la oferta")
    void elEstudianteNoRecibeElCorreoDeQuienLaRegistro() {
        var respuesta = convertir(ofertaSugerida(), false);

        assertThat(respuesta.creadaPor())
                .as("es el correo de otro participante")
                .isNull();
        assertThat(respuesta.motivoCierre())
                .as("el motivo de cierre es nota interna del equipo")
                .isNull();
    }

    @Test
    @DisplayName("el estudiante sí ve el anuncio y si está validada")
    void elEstudianteSiVeElAnuncio() {
        var respuesta = convertir(ofertaSugerida(), false);

        assertThat(respuesta.titulo()).isEqualTo("Asesor bilingue");
        assertThat(respuesta.revisada())
                .as("saber que está sin validar no es un dato interno")
                .isFalse();
    }

    @Test
    @DisplayName("quien gestiona sí recibe los campos internos")
    void quienGestionaSiLosRecibe() {
        var respuesta = convertir(ofertaSugerida(), true);

        assertThat(respuesta.creadaPor()).isEqualTo("otro.participante@correo.com");
        assertThat(respuesta.motivoCierre()).isEqualTo("CUBIERTA");
    }
}
