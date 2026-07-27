package com.novacrm.branding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * Identidad visual de un programa: el color del que se deriva la paleta, el
 * encabezado del panel y las imagenes de la cabecera y el pie de sus correos.
 *
 * <p>La clave primaria es el propio {@code programa_id}: cada programa tiene
 * como mucho una identidad, y modelarlo asi hace imposible que existan dos
 * configuraciones compitiendo para el mismo programa.
 *
 * <p><strong>Que no exista fila es un estado valido</strong> y significa "usa
 * la gama global del panel". Por eso no hereda de {@code BaseEntity} ni se
 * crean filas vacias al dar de alta un programa: la ausencia de personalizacion
 * se representa con la ausencia del registro.
 */
@Entity
@Table(name = "programa_branding")
public class ProgramaBranding {

    @Id
    @Column(name = "programa_id")
    private UUID programaId;

    /** Hex {@code #RRGGBB}. Null = gama global del panel. */
    @Column(name = "color_primario", length = 7)
    private String colorPrimario;

    @Column(name = "titulo_header", length = 120)
    private String tituloHeader;

    @Column(name = "subtitulo_header", length = 200)
    private String subtituloHeader;

    @Column(name = "banner_panel_url", columnDefinition = "TEXT")
    private String bannerPanelUrl;

    @Column(name = "banner_panel_ancho")
    private Integer bannerPanelAncho;

    @Column(name = "banner_panel_alto")
    private Integer bannerPanelAlto;

    @Column(name = "correo_header_url", columnDefinition = "TEXT")
    private String correoHeaderUrl;

    @Column(name = "correo_header_ancho")
    private Integer correoHeaderAncho;

    @Column(name = "correo_header_alto")
    private Integer correoHeaderAlto;

    @Column(name = "correo_pie_url", columnDefinition = "TEXT")
    private String correoPieUrl;

    @Column(name = "correo_pie_ancho")
    private Integer correoPieAncho;

    @Column(name = "correo_pie_alto")
    private Integer correoPieAlto;

    @Column(name = "correo_texto_pie", columnDefinition = "TEXT")
    private String correoTextoPie;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    private Long version;

    protected ProgramaBranding() {}

    public ProgramaBranding(UUID programaId) {
        this.programaId = programaId;
    }

    /** Marca la fila como tocada. Se llama desde el servicio al guardar. */
    public void tocar() {
        this.updatedAt = Instant.now();
    }

    public UUID getProgramaId() { return programaId; }

    public String getColorPrimario() { return colorPrimario; }
    public void setColorPrimario(String colorPrimario) { this.colorPrimario = colorPrimario; }

    public String getTituloHeader() { return tituloHeader; }
    public void setTituloHeader(String tituloHeader) { this.tituloHeader = tituloHeader; }

    public String getSubtituloHeader() { return subtituloHeader; }
    public void setSubtituloHeader(String subtituloHeader) { this.subtituloHeader = subtituloHeader; }

    public String getBannerPanelUrl() { return bannerPanelUrl; }
    public void setBannerPanelUrl(String v) { this.bannerPanelUrl = v; }

    public Integer getBannerPanelAncho() { return bannerPanelAncho; }
    public void setBannerPanelAncho(Integer v) { this.bannerPanelAncho = v; }

    public Integer getBannerPanelAlto() { return bannerPanelAlto; }
    public void setBannerPanelAlto(Integer v) { this.bannerPanelAlto = v; }

    public String getCorreoHeaderUrl() { return correoHeaderUrl; }
    public void setCorreoHeaderUrl(String v) { this.correoHeaderUrl = v; }

    public Integer getCorreoHeaderAncho() { return correoHeaderAncho; }
    public void setCorreoHeaderAncho(Integer v) { this.correoHeaderAncho = v; }

    public Integer getCorreoHeaderAlto() { return correoHeaderAlto; }
    public void setCorreoHeaderAlto(Integer v) { this.correoHeaderAlto = v; }

    public String getCorreoPieUrl() { return correoPieUrl; }
    public void setCorreoPieUrl(String v) { this.correoPieUrl = v; }

    public Integer getCorreoPieAncho() { return correoPieAncho; }
    public void setCorreoPieAncho(Integer v) { this.correoPieAncho = v; }

    public Integer getCorreoPieAlto() { return correoPieAlto; }
    public void setCorreoPieAlto(Integer v) { this.correoPieAlto = v; }

    public String getCorreoTextoPie() { return correoTextoPie; }
    public void setCorreoTextoPie(String v) { this.correoTextoPie = v; }
}
