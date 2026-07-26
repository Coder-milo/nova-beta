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
    private final com.novacrm.programa.ProgramaRepository programaRepository;

    public OwnershipService(EstudianteRepository estudianteRepository,
                            com.novacrm.programa.ProgramaRepository programaRepository) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
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

    @Transactional
    public com.novacrm.estudiante.Estudiante obtenerEstudianteAutenticado(Authentication auth) {
        String email = auth.getName();
        return estudianteRepository.findByEmail(email).orElseGet(() -> {
            var programas = programaRepository.findAll();
            if (programas.isEmpty()) {
                throw new com.novacrm.exception.ResourceNotFoundException("No hay programas configurados en el sistema");
            }
            var est = new com.novacrm.estudiante.Estudiante();
            est.setNombre("Estudiante");
            est.setApellido("CAC");
            est.setEmail(email);
            est.setPrograma(programas.get(0));
            return estudianteRepository.save(est);
        });
    }

    private boolean tieneRolPrivilegiado(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_COORDINADOR"));
    }
}
