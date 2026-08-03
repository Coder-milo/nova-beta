package com.novacrm.whatsapp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * Canal de WhatsApp Cloud API de un programa.
 *
 * <p>La clave primaria es el propio {@code programa_id}, igual que en
 * {@code programa_branding}: cada programa tiene como mucho un canal, y la
 * ausencia de fila es un estado valido que significa "sin WhatsApp
 * configurado".
 *
 * <p>El token viaja cifrado en la base ({@code token_cifrado}); el código
 * fuente, un respaldo o un acceso a la base no deben exponer un token que
 * permite hablar en nombre del negocio.
 */
@Entity
@Table(name = "programa_whatsapp")
public class ProgramaWhatsapp {

    @Id
    @Column(name = "programa_id")
    private UUID programaId;

    /** Numero de negocio en E.164 (con +, sin separadores). */
    @Column(name = "numero_whatsapp", length = 16)
    private String numeroWhatsapp;

    @Column(name = "phone_id", length = 64)
    private String phoneId;

    /** Token de acceso cifrado (AES-GCM). Caja opaca para la base. */
    @Column(name = "token_cifrado", columnDefinition = "TEXT")
    private String tokenCifrado;

    /** Si el canal debe usarse para los avisos automáticos. */
    @Column(name = "activo", nullable = false)
    private boolean activo = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    private Long version;

    protected ProgramaWhatsapp() {}

    public ProgramaWhatsapp(UUID programaId) {
        this.programaId = programaId;
    }

    /** Marca la fila como tocada. Se llama desde el servicio al guardar. */
    public void tocar() {
        this.updatedAt = Instant.now();
    }

    public UUID getProgramaId() { return programaId; }

    public String getNumeroWhatsapp() { return numeroWhatsapp; }
    public void setNumeroWhatsapp(String numeroWhatsapp) { this.numeroWhatsapp = numeroWhatsapp; }

    public String getPhoneId() { return phoneId; }
    public void setPhoneId(String phoneId) { this.phoneId = phoneId; }

    public String getTokenCifrado() { return tokenCifrado; }
    public void setTokenCifrado(String tokenCifrado) { this.tokenCifrado = tokenCifrado; }

    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
}
