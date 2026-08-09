package com.novacrm.dashboard;

import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El aviso que le dice al equipo que hay ofertas esperando validacion.
 *
 * <p>Una oferta que registra un participante entra sin revisar y el matching la
 * excluye hasta que alguien la mira. Sin este aviso, nadie se entera de que
 * esta ahi: no es una tarea pendiente que se acumula a la vista, es una
 * oportunidad que caduca sola y en silencio.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AvisoDeVacanteSinRevisarTest {

    @Autowired private DashboardService dashboard;
    @Autowired private VacanteRepository vacantes;
    @Autowired private EmpresaRepository empresas;

    private Vacante vacante(boolean revisada, LocalDateTime expira) {
        var v = new Vacante();
        v.setTitulo("Asesor bilingue de prueba");
        v.setActivo(true);
        v.setRevisada(revisada);
        v.setFechaExpiracion(expira);
        return vacantes.saveAndFlush(v);
    }

    private long avisosDeVacante() {
        return dashboard.alertas().stream()
                .filter(a -> a.tipo().equals("VACANTE_SIN_REVISAR"))
                .count();
    }

    @Test
    @DisplayName("una oferta sin revisar genera el aviso, con la ruta para resolverlo")
    void laOfertaSinRevisarAvisa() {
        vacante(false, null);

        var aviso = dashboard.alertas().stream()
                .filter(a -> a.tipo().equals("VACANTE_SIN_REVISAR"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no se emitió el aviso"));

        assertThat(aviso.severidad()).isEqualTo("ALTA");
        assertThat(aviso.ruta())
                .as("el aviso tiene que llevar a donde se valida")
                .isEqualTo("/vacantes");
    }

    @Test
    @DisplayName("una oferta ya validada no genera aviso")
    void laValidadaNoAvisa() {
        long antes = avisosDeVacante();
        vacante(true, null);
        assertThat(avisosDeVacante()).isEqualTo(antes);
    }

    @Test
    @DisplayName("una oferta vencida no reclama revisión")
    void laVencidaNoReclama() {
        // Revisarla ya no sirve de nada: no va a recomendarse a nadie.
        long antes = avisosDeVacante();
        vacante(false, LocalDateTime.now().minusDays(1));
        assertThat(avisosDeVacante()).isEqualTo(antes);
    }
}
