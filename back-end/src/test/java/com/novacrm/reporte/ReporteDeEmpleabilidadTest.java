package com.novacrm.reporte;

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

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El reporte de empleabilidad que se exporta y se manda fuera.
 *
 * <p>Agrupaba por el enum {@code estadoEmpleabilidad} de la ficha, que escriben
 * la importacion antigua y la edicion manual y nada mas. A quien se coloca por
 * el CRM nadie se lo cambia, asi que el documento con el que se rinden cuentas
 * de un programa de empleabilidad dejaba fuera las colocaciones que consiguio
 * el programa.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ReporteDeEmpleabilidadTest {

    @Autowired private ReporteService reportes;
    @Autowired private EstudianteRepository estudiantes;
    @Autowired private ColocacionRepository colocaciones;
    @Autowired private ProgramaRepository programas;

    private Programa programa() {
        var p = new Programa();
        p.setNombre("Programa " + UUID.randomUUID());
        return programas.saveAndFlush(p);
    }

    private Estudiante estudiante(Programa programa, EstadoEmpleabilidad estado) {
        var e = new Estudiante();
        e.setNombre("Ana");
        e.setApellido("Perez");
        e.setEmail("reporte-" + UUID.randomUUID() + "@cac.test");
        e.setPrograma(programa);
        e.setEstadoEmpleabilidad(estado);
        return estudiantes.saveAndFlush(e);
    }

    private void colocar(Estudiante estudiante) {
        var c = new Colocacion();
        c.setEstudiante(estudiante);
        c.setEmpresaNombre("Solvo S.A.S.");
        c.setCargo("Asesora bilingue");
        c.setFechaInicio(LocalDate.now());
        c.setActiva(true);
        colocaciones.saveAndFlush(c);
    }

    private String csv(Programa programa) {
        return new String(reportes.exportar("empleabilidad", "csv", programa.getId()),
                StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("quien tiene colocacion vigente sale como empleado, diga lo que diga su ficha")
    void laColocacionCuentaEnElReporte() {
        var programa = programa();
        colocar(estudiante(programa, EstadoEmpleabilidad.BUSCANDO));
        estudiante(programa, EstadoEmpleabilidad.BUSCANDO);

        String csv = csv(programa);

        assertThat(csv).contains("EMPLEADO;1");
        assertThat(csv).contains("BUSCANDO;1");
    }

    /** Las tres filas suman el total: nadie se cae del reporte al recontar. */
    @Test
    @DisplayName("el total no cambia al mover a alguien de casilla")
    void nadieDesapareceDelReporte() {
        var programa = programa();
        colocar(estudiante(programa, EstadoEmpleabilidad.BUSCANDO));
        estudiante(programa, EstadoEmpleabilidad.BUSCANDO);
        estudiante(programa, EstadoEmpleabilidad.SIN_INFO);

        int total = csv(programa).lines()
                .filter(l -> l.matches("(EMPLEADO|BUSCANDO|SIN_INFO);\\d+"))
                .mapToInt(l -> Integer.parseInt(l.split(";")[1]))
                .sum();

        assertThat(total).isEqualTo(3);
    }
}
