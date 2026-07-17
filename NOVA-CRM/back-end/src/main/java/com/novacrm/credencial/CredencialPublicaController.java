package com.novacrm.credencial;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@Controller
@Tag(name = "Credencial Publica")
public class CredencialPublicaController {

    private final CredencialRepository credencialRepository;

    public CredencialPublicaController(CredencialRepository credencialRepository) {
        this.credencialRepository = credencialRepository;
    }

    @GetMapping(value = "/credencial/{uuid}", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Pagina publica de verificacion de credencial")
    public String verCredencial(@PathVariable UUID uuid, Model model) {
        var credencial = credencialRepository.findByUuidPublico(uuid)
                .orElse(null);

        if (credencial == null || credencial.isRevocada()) {
            model.addAttribute("valida", false);
            model.addAttribute("revocada", credencial != null && credencial.isRevocada());
            return "credencial-invalida";
        }

        var estudiante = credencial.getEstudianteCertificacion().getEstudiante();
        var certificacion = credencial.getEstudianteCertificacion().getCertificacion();

        model.addAttribute("valida", true);
        model.addAttribute("nombreEstudiante", estudiante.getNombre() + " " + estudiante.getApellido());
        model.addAttribute("nombreCertificacion", certificacion.getNombre());
        model.addAttribute("fechaEmision", credencial.getEstudianteCertificacion().getFechaEmision());
        model.addAttribute("programa", certificacion.getPrograma() != null ? certificacion.getPrograma().getNombre() : "");
        model.addAttribute("uuid", uuid);
        return "credencial-valida";
    }
}
