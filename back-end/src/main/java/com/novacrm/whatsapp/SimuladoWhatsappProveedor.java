package com.novacrm.whatsapp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Proveedor de WhatsApp simulado para desarrollo local o tests automatizados.
 */
@Component
public class SimuladoWhatsappProveedor implements ProveedorWhatsapp {

    private static final Logger log = LoggerFactory.getLogger(SimuladoWhatsappProveedor.class);

    @Override
    public String nombre() {
        return "simulado";
    }

    @Override
    public boolean estaConfigurado(UUID programaId) {
        return true;
    }

    @Override
    public WhatsappSender.Canal activo(UUID programaId) {
        return new WhatsappSender.Canal("simulado-phone-id", "simulado-token");
    }

    @Override
    public WhatsappSender.Resultado enviarTexto(UUID programaId, String celularDestino, String texto) {
        String destino = WhatsappSender.normalizarDestino(celularDestino);
        if (destino == null) {
            return WhatsappSender.Resultado.fallo("Celular de destino no valido: " + celularDestino);
        }
        log.info("[SIMULADO] WhatsApp de texto enviado a {} (programa {}): {}", destino, programaId, texto);
        return WhatsappSender.Resultado.ok();
    }

    @Override
    public WhatsappSender.Resultado enviarPlantilla(UUID programaId, String celularDestino, String nombrePlantilla,
                                                     List<String> parametrosCuerpo,
                                                     List<WhatsappSender.BotonRapido> botones) {
        String destino = WhatsappSender.normalizarDestino(celularDestino);
        if (destino == null) {
            return WhatsappSender.Resultado.fallo("Celular de destino no valido: " + celularDestino);
        }
        log.info("[SIMULADO] WhatsApp de plantilla '{}' enviado a {} (programa {})", nombrePlantilla, destino, programaId);
        return WhatsappSender.Resultado.ok();
    }
}
