package com.novacrm.estudiante;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.Optional;

/**
 * Reparte los participantes nuevos entre el equipo, si está encendido.
 *
 * <p><strong>Apagado por defecto</strong>, y no es prudencia de más: una regla
 * de reparto que no coincide con cómo trabaja el equipo se desactiva la primera
 * semana, y hasta entonces asigna mal. Que haya que encenderla obliga a que
 * alguien decida.
 *
 * <p>El único modo es «al de menos carga», y eso es deliberado frente a un
 * turno rotativo clásico:
 *
 * <ul>
 *   <li>Un puntero que rota necesita estado persistido y se descoloca en
 *       cuanto alguien entra, sale o se le reasignan casos a mano.
 *   <li>Mirar quién lleva menos <em>en ese momento</em> no guarda nada y se
 *       corrige solo: si alguien deja el programa y sus casos se liberan, las
 *       siguientes altas van hacia quien acabe de quedarse libre.
 * </ul>
 *
 * <p>Lo que asigna siempre se puede cambiar a mano: la asignación en lote de la
 * pantalla de estudiantes existe desde el punto 13, y es la salida cuando la
 * regla acierta poco.
 */
@Component
public class AsignacionAutomatica {

    private static final Logger log = LoggerFactory.getLogger(AsignacionAutomatica.class);

    /** Cómo se reparte. Se guarda en `configuracion_global.regla_asignacion`. */
    public enum Regla {
        /** Nadie se asigna solo. El reparto es manual, en lote o de uno en uno. */
        NINGUNA,
        /** Al miembro del equipo que menos casos lleve en ese momento. */
        ROTATIVO
    }

    private final UsuarioRepository usuarioRepository;
    private final EstudianteRepository estudianteRepository;
    private final com.novacrm.configuracion.ConfiguracionService configuracionService;

    public AsignacionAutomatica(UsuarioRepository usuarioRepository,
                                EstudianteRepository estudianteRepository,
                                com.novacrm.configuracion.ConfiguracionService configuracionService) {
        this.usuarioRepository = usuarioRepository;
        this.estudianteRepository = estudianteRepository;
        this.configuracionService = configuracionService;
    }

    /**
     * Pone responsable al participante si la regla lo pide y no tiene ya uno.
     *
     * <p>No pisa una asignación existente: si alguien la puso a mano, esa gana.
     * Y no lanza nunca — que falle el reparto no puede tumbar un alta ni una
     * importación de trescientas filas. Sin responsable es un estado normal, y
     * la pantalla tiene el filtro «Sin asignar» justo para eso.
     */
    public void asignarSiCorresponde(Estudiante estudiante) {
        if (estudiante == null || estudiante.getResponsable() != null) {
            return;
        }
        try {
            if (reglaActual() != Regla.ROTATIVO) {
                return;
            }
            elDeMenosCarga().ifPresent(estudiante::setResponsable);
        } catch (RuntimeException e) {
            log.warn("No se pudo asignar responsable automaticamente: {}", e.getMessage());
        }
    }

    public Regla reglaActual() {
        String valor = configuracionService.obtener().reglaAsignacion();
        if (valor == null || valor.isBlank()) {
            return Regla.NINGUNA;
        }
        try {
            return Regla.valueOf(valor.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            // Un valor que no reconocemos se trata como apagado, no como
            // "elige uno": repartir segun una regla que nadie escribio es peor
            // que no repartir.
            log.warn("Regla de asignacion desconocida en la configuracion: {}", valor);
            return Regla.NINGUNA;
        }
    }

    /**
     * La cuenta del equipo con menos participantes a cargo.
     *
     * <p>A igualdad, la primera por correo. Da igual cuál sea mientras sea
     * estable: con un desempate al azar, dos altas seguidas podrían ir a dos
     * personas distintas y el reparto dejaría de ser explicable.
     */
    private Optional<Usuario> elDeMenosCarga() {
        return usuarioRepository.findAll().stream()
                .filter(Usuario::isActivo)
                // `roles` puede venir nulo —lo asume ya `Usuario.esCuentaDeEmpresa`—
                // y aqui un NPE dejaria sin responsable a todo el mundo.
                .filter(u -> u.getRoles() != null && u.getRoles().stream()
                        .anyMatch(r -> r == Rol.COORDINADOR || r == Rol.ADMIN))
                .min(Comparator
                        .comparingLong((Usuario u) ->
                                estudianteRepository.countByResponsableIdAndActivoTrue(u.getId()))
                        .thenComparing(Usuario::getEmail));
    }
}
