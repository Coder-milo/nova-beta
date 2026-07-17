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
     * Un usuario cuyo unico rol es ESTUDIANTE solo puede acceder a los datos del
     * estudiante cuyo email coincide con el suyo (subject del JWT). ADMIN y
     * COORDINADOR no tienen restriccion.
     */
    public void verificarAccesoEstudiante(Authentication auth, UUID estudianteId) {
        if (tieneRolPrivilegiado(auth)) {
            return;
        }
        var propio = estudianteRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("No existe un estudiante asociado a este usuario"));
        if (!propio.getId().equals(estudianteId)) {
            throw new AccessDeniedException("No puedes acceder a datos de otro estudiante");
        }
    }

    private boolean tieneRolPrivilegiado(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_COORDINADOR"));
    }
}
