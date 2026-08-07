package com.novacrm.auth;

import com.novacrm.estudiante.EstudianteRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class OwnershipService {

    private final EstudianteRepository estudianteRepository;

    public OwnershipService(EstudianteRepository estudianteRepository) {
        this.estudianteRepository = estudianteRepository;
    }

    /**
     * Un usuario cuyo único rol es ESTUDIANTE solo puede acceder a los datos del
     * estudiante cuyo email coincide con el suyo (subject del JWT). ADMIN y
     * COORDINADOR no tienen restricción.
     */
    public void verificarAccesoEstudiante(Authentication auth, UUID estudianteId) {
        if (tieneRolPrivilegiado(auth)) {
            return;
        }
        var propio = obtenerEstudianteAutenticado(auth);
        if (!propio.getId().equals(estudianteId)) {
            throw new AccessDeniedException("No puedes acceder a datos de otro estudiante");
        }
    }

    /**
     * Devuelve el estudiante correspondiente al usuario autenticado.
     *
     * <p>No crea el registro si no existe. Antes lo hacia, y una simple
     * consulta de perfil acababa insertando un estudiante llamado
     * "Estudiante CAC" matriculado en {@code findAll().get(0)}: un programa
     * arbitrario, porque la consulta no lleva orden. Como el endpoint tambien
     * lo pueden usar coordinadores y administradores, bastaba con que uno
     * entrase a su perfil para ensuciar la base con matriculas falsas.
     *
     * <p>El vinculo entre usuario y estudiante se crea al importar la base o
     * al darlo de alta, no al leerlo.
     *
     * @throws ResourceNotFoundException si el usuario no tiene ficha de estudiante
     */
    public com.novacrm.estudiante.Estudiante obtenerEstudianteAutenticado(Authentication auth) {
        String email = auth.getName();
        // Ignorando la caja: los correos se cargan desde Excel tal y como
        // vengan escritos —7 de los 108 participantes tienen mayusculas— y el
        // subject del JWT sale de la tabla de usuarios. Con igualdad exacta,
        // una sola letra distinta entre las dos tablas deja a esa persona sin
        // acceso a NADA de su portal, porque todo el area del estudiante pasa
        // por aqui, y ademas con un mensaje que culpa a un dato que si existe.
        return estudianteRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException(
                        "El usuario " + email + " no tiene una ficha de estudiante asociada. "
                                + "Debe crearse desde la gestion de estudiantes o importarse."));
    }

    /**
     * Un estudiante solo puede mirar el programa en el que esta matriculado.
     *
     * <p>Esto cubre lo que {@link #verificarAccesoEstudiante} no llega a ver: un
     * estudiante puede no estar pidiendo la ficha de nadie y aun asi estar
     * asomandose a otro programa —su identidad visual, sus vacantes, su gente—.
     * Saber que existe el programa de otro cliente y con que marca opera ya es
     * informacion que no le corresponde.
     */
    public void verificarAccesoPrograma(Authentication auth, UUID programaId) {
        if (tieneRolPrivilegiado(auth)) {
            return;
        }
        var propio = obtenerEstudianteAutenticado(auth);
        if (propio.getPrograma() == null || !propio.getPrograma().getId().equals(programaId)) {
            throw new AccessDeniedException("Solo puedes ver el programa en el que estas matriculado");
        }
    }

    /** El programa del estudiante autenticado. Para no tener que pedirselo. */
    public UUID programaDelEstudianteAutenticado(Authentication auth) {
        var propio = obtenerEstudianteAutenticado(auth);
        if (propio.getPrograma() == null) {
            throw new com.novacrm.exception.ResourceNotFoundException(
                    "Tu ficha no esta asociada a ningun programa");
        }
        return propio.getPrograma().getId();
    }

    private boolean tieneRolPrivilegiado(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_COORDINADOR"));
    }
}
