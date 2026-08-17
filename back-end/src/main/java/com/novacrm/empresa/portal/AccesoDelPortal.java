package com.novacrm.empresa.portal;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Quien pregunta, de que empresa es, y si puede ver lo que pide.
 *
 * <p>Todo el portal de empresas pasa por aqui. No es una capa de conveniencia:
 * es el unico sitio donde se decide que sale de la institucion, y por eso las
 * comprobaciones estan concentradas en vez de repartidas por los controladores.
 * Repartidas, la pregunta "¿esta consulta filtra por empresa?" hay que
 * responderla leyendo cada metodo, y basta con que uno se olvide.
 *
 * <p>Las anotaciones {@code @PreAuthorize} de los controladores comprueban el
 * rol —quien entra—, no de quien son los datos. Un usuario con rol EMPRESA que
 * pida la vacante de otra empresa pasa el filtro por URL sin problema; lo que
 * lo detiene es {@link #exigirVacantePropia}.
 */
@Service
public class AccesoDelPortal {

    private final UsuarioRepository usuarioRepository;
    private final VacanteRepository vacanteRepository;
    private final PostulacionRepository postulacionRepository;

    public AccesoDelPortal(UsuarioRepository usuarioRepository,
                           VacanteRepository vacanteRepository,
                           PostulacionRepository postulacionRepository) {
        this.usuarioRepository = usuarioRepository;
        this.vacanteRepository = vacanteRepository;
        this.postulacionRepository = postulacionRepository;
    }

    /**
     * La empresa de quien hace la peticion.
     *
     * @throws AccessDeniedException si la cuenta no es de empresa o no tiene
     *         ninguna asignada. Se niega en lugar de devolver vacio a
     *         proposito: una cuenta EMPRESA sin empresa es una cuenta mal dada
     *         de alta, y devolverle una lista vacia lo disimula durante meses.
     */
    @Transactional(readOnly = true)
    public UUID empresaDe(Authentication auth) {
        Usuario usuario = usuarioRepository.findByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("Cuenta no encontrada"));

        if (usuario.getRoles() == null || !usuario.getRoles().contains(Rol.EMPRESA)) {
            throw new AccessDeniedException("Esta cuenta no es del portal de empresas");
        }
        if (usuario.getEmpresa() == null) {
            throw new AccessDeniedException(
                    "La cuenta no tiene empresa asignada; avisa al equipo del programa");
        }
        return usuario.getEmpresa().getId();
    }

    /**
     * Comprueba que la vacante es de esa empresa y la devuelve.
     *
     * <p>Se responde 404 y no 403 cuando es de otra empresa. Un 403 confirma
     * que la vacante existe, y con identificadores en la URL eso permite a una
     * empresa averiguar cuantas vacantes gestiona el programa y cuando aparecen
     * nuevas. Desde fuera, "no es tuya" y "no existe" tienen que ser
     * indistinguibles.
     */
    @Transactional(readOnly = true)
    public Vacante exigirVacantePropia(UUID vacanteId, UUID empresaId) {
        Vacante vacante = vacanteRepository.findById(vacanteId)
                .orElseThrow(() -> new ResourceNotFoundException("Vacante no encontrada"));

        if (vacante.getEmpresa() == null || !empresaId.equals(vacante.getEmpresa().getId())) {
            throw new ResourceNotFoundException("Vacante no encontrada");
        }
        return vacante;
    }

    /**
     * Comprueba que esa postulacion es a una vacante de esa empresa.
     *
     * <p>Es la puerta por la que se llega al perfil de un estudiante, y por eso
     * el permiso no se pregunta sobre el estudiante sino sobre la postulacion:
     * la empresa no tiene acceso a personas, tiene acceso a <em>candidaturas a
     * sus propias vacantes</em>. Un estudiante que retire su postulacion deja
     * de ser visible sin que haya que revocar nada.
     */
    @Transactional(readOnly = true)
    public Postulacion exigirPostulacionPropia(UUID postulacionId, UUID empresaId) {
        Postulacion postulacion = postulacionRepository.findById(postulacionId)
                .orElseThrow(() -> new ResourceNotFoundException("Postulacion no encontrada"));

        Vacante vacante = postulacion.getVacante();
        boolean porVacante = vacante != null
                && vacante.getEmpresa() != null
                && empresaId.equals(vacante.getEmpresa().getId());

        // Una postulacion registrada a mano puede no tener vacante y apuntar a
        // la empresa directamente. Cuenta igual, pero solo por la ficha
        // registrada: el nombre en texto libre no sirve como permiso porque lo
        // escribe cualquiera.
        boolean porEmpresa = postulacion.getEmpresa() != null
                && empresaId.equals(postulacion.getEmpresa().getId());

        if (!porVacante && !porEmpresa) {
            throw new ResourceNotFoundException("Postulacion no encontrada");
        }
        return postulacion;
    }
}
