package com.novacrm.dashboard;

import com.novacrm.colocacion.Colocacion;
import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La grafica de empleabilidad del panel.
 *
 * <p>Es la cifra de resultado de un programa de empleabilidad, la que se mira
 * para saber si esto funciona y la que se reporta fuera. Contaba solo el enum
 * {@code estadoEmpleabilidad} de la ficha, que escriben la importacion antigua
 * y la edicion manual y nada mas: a quien se coloca por el CRM nadie se lo
 * cambia. Es decir, la grafica dejaba fuera justamente las colocaciones que
 * consiguio el programa.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DonaDeEmpleabilidadTest {

    @Autowired private DashboardService dashboard;
    @Autowired private EstudianteRepository estudiantes;
    @Autowired private ColocacionRepository colocaciones;
    @Autowired private ProgramaRepository programas;

    private Estudiante estudiante(EstadoEmpleabilidad estado) {
        var programa = new Programa();
        programa.setNombre("Programa " + UUID.randomUUID());
        programas.saveAndFlush(programa);

        var e = new Estudiante();
        e.setNombre("Ana");
        e.setApellido("Perez");
        e.setEmail("dona-" + UUID.randomUUID() + "@cac.test");
        e.setPrograma(programa);
        e.setEstadoEmpleabilidad(estado);
        return estudiantes.saveAndFlush(e);
    }

    private long enLaDona(String etiqueta) {
        return dashboard.graficos().empleabilidad().stream()
                .filter(p -> p.label().equals(etiqueta))
                .findFirst()
                .orElseThrow()
                .value();
    }

    @Test
    @DisplayName("una colocacion vigente cuenta como empleado aunque la ficha diga «buscando»")
    void laColocacionMandaSobreElEnum() {
        long empleadosAntes = enLaDona("Empleado");
        long buscandoAntes = enLaDona("Buscando");

        var ana = estudiante(EstadoEmpleabilidad.BUSCANDO);
        var colocacion = new Colocacion();
        colocacion.setEstudiante(ana);
        colocacion.setEmpresaNombre("Solvo S.A.S.");
        colocacion.setCargo("Asesora bilingue");
        colocacion.setFechaInicio(LocalDate.now());
        colocacion.setActiva(true);
        colocaciones.saveAndFlush(colocacion);

        assertThat(enLaDona("Empleado"))
                .as("la colocacion registrada es lo que dice que esta trabajando")
                .isEqualTo(empleadosAntes + 1);
        assertThat(enLaDona("Buscando"))
                .as("y deja de contarse como que busca")
                .isEqualTo(buscandoAntes);
    }

    @Test
    @DisplayName("sin colocacion, sigue mandando lo que diga la ficha")
    void sinColocacionMandaElEnum() {
        long buscandoAntes = enLaDona("Buscando");

        estudiante(EstadoEmpleabilidad.BUSCANDO);

        assertThat(enLaDona("Buscando")).isEqualTo(buscandoAntes + 1);
    }
}
