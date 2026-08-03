package com.novacrm.whatsapp;

import java.util.List;
import java.util.UUID;

/**
 * Contrato unificado para proveedores de envío de mensajes por WhatsApp.
 * Permite alternar entre Meta Cloud API, un proveedor simulado para desarrollo/tests o conectores de terceros.
 */
public interface ProveedorWhatsapp {

    /** Nombre identificador del proveedor (ej. "meta", "simulado", "noop"). */
    String nombre();

    /** Si el programa especificado tiene un canal de WhatsApp activo y configurado. */
    boolean estaConfigurado(UUID programaId);

    /** Envía un mensaje de texto plano por WhatsApp. */
    WhatsappSender.Resultado enviarTexto(UUID programaId, String celularDestino, String texto);

    /** El canal del programa, con token descifrado, o null si no usable. */
    WhatsappSender.Canal activo(UUID programaId);

    /** Envía un mensaje basado en plantilla aprobada. */
    WhatsappSender.Resultado enviarPlantilla(UUID programaId, String celularDestino, String nombrePlantilla,
                                             List<String> parametrosCuerpo,
                                             List<WhatsappSender.BotonRapido> botones);
}
