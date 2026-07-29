package com.novacrm.auditoria;

import com.novacrm.auditoria.dto.AuditoriaResponse;
import com.novacrm.exception.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AuditoriaService {

    private final AuditoriaRepository auditoriaRepository;

    public AuditoriaService(AuditoriaRepository auditoriaRepository) {
        this.auditoriaRepository = auditoriaRepository;
    }

    public Page<AuditoriaResponse> buscar(String usuario, String modulo, String accion,
                                          String registroId, Pageable pageable) {
        return auditoriaRepository.buscar(vacioANulo(usuario), vacioANulo(modulo),
                        vacioANulo(accion), vacioANulo(registroId), pageable)
                .map(this::toResponse);
    }

    public AuditoriaResponse obtener(UUID id) {
        return auditoriaRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Registro de auditoría no encontrado: " + id));
    }

    public List<Auditoria> porRegistro(String registroId) {
        return auditoriaRepository.findByRegistroIdOrderByFechaDesc(registroId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrar(String modulo, String accion, String entidad, String registroId,
                          String registroNombre, String datosAnteriores, String datosNuevos) {
        var auditoria = new Auditoria();
        auditoria.setFecha(LocalDateTime.now());
        auditoria.setUsuario(usuarioActual());
        auditoria.setModulo(modulo);
        auditoria.setAccion(accion);
        auditoria.setEntidad(entidad);
        auditoria.setRegistroId(registroId);
        auditoria.setRegistroNombre(registroNombre);
        auditoria.setDatosAnteriores(datosAnteriores);
        auditoria.setDatosNuevos(datosNuevos);
        auditoria.setIp(ipActual());
        auditoriaRepository.save(auditoria);
    }

    private String usuarioActual() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
                return auth.getName();
            }
        } catch (Exception ignored) {
            // sin contexto de seguridad disponible
        }
        return "sistema";
    }

    private String ipActual() {
        try {
            var attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes servletAttrs) {
                HttpServletRequest request = servletAttrs.getRequest();
                String forwarded = request.getHeader("X-Forwarded-For");
                if (forwarded != null && !forwarded.isBlank()) {
                    return forwarded.split(",")[0].trim();
                }
                return request.getRemoteAddr();
            }
        } catch (Exception ignored) {
            // fuera de un contexto de petición HTTP
        }
        return null;
    }

    private String vacioANulo(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor;
    }

    private AuditoriaResponse toResponse(Auditoria a) {
        return new AuditoriaResponse(
                a.getId(), a.getFecha(), a.getUsuario(), a.getModulo(), a.getAccion(),
                a.getEntidad(), a.getRegistroId(), a.getRegistroNombre(),
                a.getDatosAnteriores(), a.getDatosNuevos(), a.getIp()
        );
    }
}
