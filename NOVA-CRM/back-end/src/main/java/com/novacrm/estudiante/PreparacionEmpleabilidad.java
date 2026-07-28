package com.novacrm.estudiante;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.util.ArrayList;
import java.util.List;

/**
 * Los cinco hitos de preparacion para la empleabilidad.
 *
 * <p>Se capturan a mano porque no se pueden deducir. El sistema sabe si existe
 * una hoja de vida generada, pero no si esa hoja esta en ingles, ni si el
 * perfil de LinkedIn se trabajo mas alla de crearlo. Ese trabajo lo hace una
 * persona con el participante y solo esa persona sabe en que punto va.
 *
 * <p>Lo que si es derivado —etapa del embudo, postulaciones, colocacion— vive
 * en {@code com.novacrm.pipeline} y no se toca desde aqui.
 */
@Embeddable
public class PreparacionEmpleabilidad {

    @Enumerated(EnumType.STRING)
    @Column(name = "hito_cv_listo", nullable = false, length = 15)
    private EstadoHito cvListo = EstadoHito.NO;

    @Enumerated(EnumType.STRING)
    @Column(name = "hito_cv_ingles", nullable = false, length = 15)
    private EstadoHito cvEnIngles = EstadoHito.NO;

    @Enumerated(EnumType.STRING)
    @Column(name = "hito_linkedin_creado", nullable = false, length = 15)
    private EstadoHito linkedinCreado = EstadoHito.NO;

    /**
     * Perfil de LinkedIn trabajado: titular, extracto, experiencia y foto.
     *
     * <p>No se deduce de tener el perfil vinculado. Se hacia asi y era falso:
     * en el seguimiento hay 74 perfiles creados y 9 optimizados, o sea que el
     * CRM reportaba ocho veces mas de lo que el programa habia hecho.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "hito_linkedin_optimizado", nullable = false, length = 15)
    private EstadoHito linkedinOptimizado = EstadoHito.NO;

    @Enumerated(EnumType.STRING)
    @Column(name = "hito_perfil_ocupacional", nullable = false, length = 15)
    private EstadoHito perfilOcupacional = EstadoHito.NO;

    /** Hitos que faltan, en el orden en que conviene hacerlos. */
    public List<String> pendientes() {
        List<String> faltan = new ArrayList<>();
        if (!cvListo.cumplido()) {
            faltan.add("Terminar la hoja de vida");
        }
        if (!cvEnIngles.cumplido()) {
            faltan.add("Traducir la hoja de vida al ingles");
        }
        if (!linkedinCreado.cumplido()) {
            faltan.add("Crear el perfil de LinkedIn");
        }
        if (!linkedinOptimizado.cumplido()) {
            faltan.add("Optimizar el perfil de LinkedIn");
        }
        if (!perfilOcupacional.cumplido()) {
            faltan.add("Definir el perfil ocupacional");
        }
        return faltan;
    }

    /** Cuantos de los cinco hitos estan terminados. */
    public int cumplidos() {
        return (int) java.util.stream.Stream
                .of(cvListo, cvEnIngles, linkedinCreado, linkedinOptimizado, perfilOcupacional)
                .filter(EstadoHito::cumplido)
                .count();
    }

    public EstadoHito getCvListo() { return cvListo; }
    public void setCvListo(EstadoHito cvListo) { this.cvListo = valorOno(cvListo); }
    public EstadoHito getCvEnIngles() { return cvEnIngles; }
    public void setCvEnIngles(EstadoHito cvEnIngles) { this.cvEnIngles = valorOno(cvEnIngles); }
    public EstadoHito getLinkedinCreado() { return linkedinCreado; }
    public void setLinkedinCreado(EstadoHito linkedinCreado) { this.linkedinCreado = valorOno(linkedinCreado); }
    public EstadoHito getLinkedinOptimizado() { return linkedinOptimizado; }
    public void setLinkedinOptimizado(EstadoHito v) { this.linkedinOptimizado = valorOno(v); }
    public EstadoHito getPerfilOcupacional() { return perfilOcupacional; }
    public void setPerfilOcupacional(EstadoHito v) { this.perfilOcupacional = valorOno(v); }

    private static EstadoHito valorOno(EstadoHito estado) {
        return estado == null ? EstadoHito.NO : estado;
    }
}
