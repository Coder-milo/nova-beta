package com.novacrm.matching;

import com.novacrm.catalogo.nivel_ingles.NivelMcer;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.Vacante;

/**
 * Si una oferta de un segmento le sirve realmente a un participante.
 *
 * <p>Es el filtro que faltaba. Con Remotive como unica fuente activa, a los 107
 * participantes se les recomendaba empleo remoto en ingles por igual: tambien a
 * quien no tiene computador propio, no tiene conexion estable o mide A1 oral.
 * Una recomendacion que la persona no puede tomar no es neutra —ocupa el sitio
 * de una que si, y desgasta la confianza en el sistema—.
 *
 * <p>Los tres campos que decide esto —{@code tieneComputador},
 * {@code tieneInternet} e {@code interesMigratorio}— ya estaban en la ficha del
 * estudiante y no los leia nadie.
 */
public final class ElegibilidadPorSegmento {

    /** Nivel minimo para sostener un trabajo en ingles con una empresa de fuera. */
    private static final NivelMcer MINIMO_REMOTO = NivelMcer.B1;

    private ElegibilidadPorSegmento() {
    }

    public static boolean esElegible(Estudiante estudiante, Vacante vacante) {
        if (vacante.getSegmento() == null) {
            // Las registradas a mano y las anteriores al campo no declaran
            // segmento. Se dejan pasar: es lo que se hacia hasta ahora, y
            // suponerles uno seria inventarse el dato.
            return true;
        }
        return esElegible(estudiante, vacante.getSegmento());
    }

    static boolean esElegible(Estudiante estudiante, Segmento segmento) {
        return switch (segmento) {
            case LOCAL_COLOMBIA -> true;
            case REMOTO_INGLES -> puedeTrabajarRemotoEnIngles(estudiante);
            case MIGRACION -> Boolean.TRUE.equals(estudiante.getInteresMigratorio());
        };
    }

    /**
     * Comprueba si el estudiante puede optar por empleo remoto en inglés.
     *
     * <p>Solo se descarta si el estudiante declaró expresamente no tener computador
     * o internet. Si tiene medición de inglés, debe cumplir el umbral mínimo (B1);
     * si aún no tiene prueba oral registrada, se permite que el motor de afinidad lo evalúe.
     */
    private static boolean puedeTrabajarRemotoEnIngles(Estudiante estudiante) {
        if (Boolean.FALSE.equals(estudiante.getTieneComputador())
                || Boolean.FALSE.equals(estudiante.getTieneInternet())) {
            return false;
        }
        var perfil = PerfilIngles.de(estudiante);
        if (perfil.tieneMedicion()) {
            return perfil.efectivo()
                    .filter(nivel -> nivel.getOrden() >= MINIMO_REMOTO.getOrden())
                    .isPresent();
        }
        return true;
    }
}
