package com.novacrm.estudiante;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SincronizacionHitosTest {

    @Test
    @DisplayName("si completa cargo objetivo o perfil profesional, el hito pasa a SI automáticamente")
    void completaCargoObjetivoPasaASI() {
        var e = new Estudiante();
        e.setCargoObjetivo("Desarrollador Java");

        EstudianteService.sincronizarHitosConDatosReales(e);

        assertThat(e.getPreparacion().getPerfilOcupacional()).isEqualTo(EstadoHito.SI);
    }

    @Test
    @DisplayName("si borra cargo objetivo y perfil profesional, el hito retrocede a NO (desaparece el check)")
    void borraPerfilOcupacionalRetrocedeANO() {
        var e = new Estudiante();
        e.getPreparacion().setPerfilOcupacional(EstadoHito.SI);
        e.setCargoObjetivo(null);
        e.setPerfilProfesional("   ");

        EstudianteService.sincronizarHitosConDatosReales(e);

        assertThat(e.getPreparacion().getPerfilOcupacional()).isEqualTo(EstadoHito.NO);
    }

    @Test
    @DisplayName("si agrega URL de LinkedIn, el hito linkedinCreado pasa a SI automáticamente")
    void agregaLinkedinPasaASI() {
        var e = new Estudiante();
        e.setLinkedinUrl("https://linkedin.com/in/maria-lopez");

        EstudianteService.sincronizarHitosConDatosReales(e);

        assertThat(e.getPreparacion().getLinkedinCreado()).isEqualTo(EstadoHito.SI);
    }

    @Test
    @DisplayName("si borra la URL de LinkedIn, tanto creado como optimizado retroceden a NO (desaparecen los checks)")
    void borraLinkedinRetrocedeAmbosANO() {
        var e = new Estudiante();
        e.getPreparacion().setLinkedinCreado(EstadoHito.SI);
        e.getPreparacion().setLinkedinOptimizado(EstadoHito.SI);
        e.setLinkedinUrl(null);

        EstudianteService.sincronizarHitosConDatosReales(e);

        assertThat(e.getPreparacion().getLinkedinCreado()).isEqualTo(EstadoHito.NO);
        assertThat(e.getPreparacion().getLinkedinOptimizado()).isEqualTo(EstadoHito.NO);
    }
}
