package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * El porcentaje de la hoja de vida y la lista de lo que falta.
 *
 * <p>Es una pantalla que le dice a alguien que busca trabajo si su hoja de vida
 * esta lista. Si el numero no puede subir haga lo que haga, o si la lista de
 * «que te falta» sale siempre vacia, la pantalla deja de servir para lo unico
 * que hace: decirle a esa persona que hacer a continuacion.
 */
class CompletitudHvTest {

    private final EntityManager em = mock(EntityManager.class);
    private final CompletitudHvService servicio = new CompletitudHvService();

    private void datos(List<FormacionAdicional> formaciones, List<ExperienciaLaboral> experiencias) {
        ReflectionTestUtils.setField(servicio, "em", em);
        @SuppressWarnings("unchecked")
        TypedQuery<FormacionAdicional> consultaFormacion = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<ExperienciaLaboral> consultaExperiencia = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(FormacionAdicional.class))).thenReturn(consultaFormacion);
        when(em.createQuery(anyString(), eq(ExperienciaLaboral.class))).thenReturn(consultaExperiencia);
        when(consultaFormacion.setParameter(anyString(), any())).thenReturn(consultaFormacion);
        when(consultaExperiencia.setParameter(anyString(), any())).thenReturn(consultaExperiencia);
        when(consultaFormacion.getResultList()).thenReturn(formaciones);
        when(consultaExperiencia.getResultList()).thenReturn(experiencias);
    }

    private Estudiante estudianteCompleto() {
        var e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre("Ana");
        e.setApellido("Perez");
        e.setEmail("ana@cac.test");
        e.setCelular("3001234567");
        e.setCiudad("Barranquilla");
        e.setNacionalidad("Colombiana");
        e.setCargoObjetivo("Asesora bilingue de servicio al cliente");
        e.setPerfilProfesional("Tres años atendiendo clientes en ingles y español.");
        e.setCompetencias("Servicio al cliente, Zendesk, ingles B2");
        e.setIdiomas("Español nativo, ingles B2");
        e.setTitulo("Tecnica en gestion administrativa");
        e.setInstitucionEducativa("SENA");
        e.setNivelEducativo("Tecnico");
        e.setLinkedinUrl("https://linkedin.com/in/ana");
        e.setCarpetaUrl("https://drive.test/ana");
        return e;
    }

    private ExperienciaLaboral empleo() {
        var x = new ExperienciaLaboral();
        x.setCargo("Asesora de servicio al cliente");
        x.setEmpresa("Solvo S.A.S.");
        x.setFechaInicio(LocalDate.of(2023, 2, 1));
        x.setFechaFin(LocalDate.of(2025, 6, 30));
        x.setFunciones("Atencion de 60 casos diarios con 95% de satisfaccion.");
        return x;
    }

    private FormacionAdicional curso() {
        var f = new FormacionAdicional();
        f.setPrograma("Ingles conversacional B2");
        f.setInstitucion("CAC Academic");
        f.setFechaInicio(LocalDate.of(2024, 1, 15));
        f.setFechaFin(LocalDate.of(2024, 11, 30));
        return f;
    }

    /**
     * El techo estaba en 75%: cargo, empresa y fechas del empleo se buscaban con
     * un nombre que nadie ponia en el mapa, el enlace de LinkedIn y el
     * portafolio tampoco, y los dos campos manuales contaban como incompletos
     * para siempre. Nadie podia llegar al 100 rellenando.
     */
    @Test
    void quienLoTieneTodoLlegaAlCien() {
        datos(List.of(curso()), List.of(empleo()));

        var analisis = servicio.analizar(estudianteCompleto());

        assertThat(analisis.porcentajeTotal())
                .as("con la hoja de vida entera puesta, la barra se llena")
                .isEqualTo(100);
        assertThat(analisis.recomendaciones()).isEmpty();
    }

    /** La seccion de experiencia se quedaba en el 20% tuviera lo que tuviera. */
    @Test
    void laExperienciaSeMideConLaExperiencia() {
        datos(List.of(), List.of(empleo()));

        var experiencia = servicio.analizar(estudianteCompleto()).secciones().stream()
                .filter(s -> s.id().equals("experience"))
                .findFirst()
                .orElseThrow();

        assertThat(experiencia.porcentaje()).isEqualTo(100);
        // El campo manual sigue en la lista para que se vea, pero no cuenta.
        assertThat(experiencia.campos()).hasSize(5);
        assertThat(experiencia.camposTotales()).isEqualTo(4);
    }

    /**
     * Sin esto, la pantalla dice el porcentaje y no dice que rellenar: los
     * campos obligatorios se leian como opcionales porque `required` es un
     * booleano de JSON y el lector solo sabia leer cadenas.
     */
    @Test
    void loQueFaltaSeNombraCampoPorCampo() {
        datos(List.of(), List.of());
        var vacio = new Estudiante();
        vacio.setId(UUID.randomUUID());

        var analisis = servicio.analizar(vacio);

        assertThat(analisis.porcentajeTotal()).isZero();
        assertThat(analisis.recomendaciones())
                .as("cada obligatorio sin llenar se nombra")
                .anyMatch(r -> r.toLowerCase().contains("correo"))
                .anyMatch(r -> r.toLowerCase().contains("nombre completo"));
    }

    /** El año de graduacion y el fin del ultimo empleo no son el mismo dato. */
    @Test
    void elFinDelEmpleoNoMarcaElAnioDeEstudios() {
        datos(List.of(), List.of(empleo()));

        var educacion = servicio.analizar(estudianteCompleto()).secciones().stream()
                .filter(s -> s.id().equals("education"))
                .findFirst()
                .orElseThrow();

        var anio = educacion.campos().stream()
                .filter(c -> c.placeholder().equals("YEAR"))
                .findFirst()
                .orElseThrow();
        assertThat(anio.completo())
                .as("sin formacion registrada, el año de estudios sigue vacio")
                .isFalse();
    }
}
