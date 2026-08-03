package com.novacrm.configuracion;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;

/**
 * Configuracion de la instalacion: identidad de la institucion y los parametros
 * de operacion que decide el equipo.
 *
 * <p><strong>Una sola fila</strong>, con {@code id = 1} fijo. No es
 * configuracion de un programa ni de un usuario: el NIT de la institucion es
 * uno. La restriccion vive tambien en la tabla, porque una segunda fila serian
 * dos configuraciones compitiendo sin forma de saber cual gana.
 *
 * <p>Que no exista la fila es un estado valido y significa "nadie ha guardado
 * nada todavia": {@link ConfiguracionService} responde entonces los valores por
 * defecto en vez de crear una fila vacia al arrancar.
 */
@Entity
@Table(name = "configuracion_global")
public class ConfiguracionGlobal {

    /** La unica fila que puede existir. */
    public static final Integer FILA_UNICA = 1;

    @Id
    private Integer id = FILA_UNICA;

    @Column(name = "nombre_oficial", columnDefinition = "TEXT")
    private String nombreOficial;

    @Column(name = "nit", columnDefinition = "TEXT")
    private String nit;

    @Column(name = "registro_educativo", columnDefinition = "TEXT")
    private String registroEducativo;

    @Column(name = "sede_principal", columnDefinition = "TEXT")
    private String sedePrincipal;

    @Column(name = "telefono_contacto", columnDefinition = "TEXT")
    private String telefonoContacto;

    @Column(name = "whatsapp_soporte", columnDefinition = "TEXT")
    private String whatsappSoporte;

    @Column(name = "email_contacto", columnDefinition = "TEXT")
    private String emailContacto;

    @Column(name = "email_soporte", columnDefinition = "TEXT")
    private String emailSoporte;

    @Column(name = "sitio_web", columnDefinition = "TEXT")
    private String sitioWeb;

    @Column(name = "linkedin_url", columnDefinition = "TEXT")
    private String linkedinUrl;

    @Column(name = "instagram_url", columnDefinition = "TEXT")
    private String instagramUrl;

    @Column(name = "cohorte_activa", columnDefinition = "TEXT")
    private String cohorteActiva;

    /** Null = usar el {@code umbral_minimo} de {@code matching-config.yml}. */
    @Column(name = "umbral_match_minimo")
    private Integer umbralMatchMinimo;

    /** Null = 30 dias, que es lo que hacia la purga antes de existir esto. */
    @Column(name = "dias_retencion_papelera")
    private Integer diasRetencionPapelera;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    private Long version;

    public ConfiguracionGlobal() {}

    /** Marca la fila como tocada. Se llama desde el servicio al guardar. */
    public void tocar() {
        this.updatedAt = Instant.now();
    }

    public Integer getId() { return id; }

    public String getNombreOficial() { return nombreOficial; }
    public void setNombreOficial(String v) { this.nombreOficial = v; }

    public String getNit() { return nit; }
    public void setNit(String v) { this.nit = v; }

    public String getRegistroEducativo() { return registroEducativo; }
    public void setRegistroEducativo(String v) { this.registroEducativo = v; }

    public String getSedePrincipal() { return sedePrincipal; }
    public void setSedePrincipal(String v) { this.sedePrincipal = v; }

    public String getTelefonoContacto() { return telefonoContacto; }
    public void setTelefonoContacto(String v) { this.telefonoContacto = v; }

    public String getWhatsappSoporte() { return whatsappSoporte; }
    public void setWhatsappSoporte(String v) { this.whatsappSoporte = v; }

    public String getEmailContacto() { return emailContacto; }
    public void setEmailContacto(String v) { this.emailContacto = v; }

    public String getEmailSoporte() { return emailSoporte; }
    public void setEmailSoporte(String v) { this.emailSoporte = v; }

    public String getSitioWeb() { return sitioWeb; }
    public void setSitioWeb(String v) { this.sitioWeb = v; }

    public String getLinkedinUrl() { return linkedinUrl; }
    public void setLinkedinUrl(String v) { this.linkedinUrl = v; }

    public String getInstagramUrl() { return instagramUrl; }
    public void setInstagramUrl(String v) { this.instagramUrl = v; }

    public String getCohorteActiva() { return cohorteActiva; }
    public void setCohorteActiva(String v) { this.cohorteActiva = v; }

    public Integer getUmbralMatchMinimo() { return umbralMatchMinimo; }
    public void setUmbralMatchMinimo(Integer v) { this.umbralMatchMinimo = v; }

    public Integer getDiasRetencionPapelera() { return diasRetencionPapelera; }
    public void setDiasRetencionPapelera(Integer v) { this.diasRetencionPapelera = v; }

    public Instant getUpdatedAt() { return updatedAt; }
}
