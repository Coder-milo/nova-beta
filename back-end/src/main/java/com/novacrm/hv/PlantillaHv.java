package com.novacrm.hv;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "plantilla_hv")
public class PlantillaHv extends BaseEntity {

    @Column(nullable = false)
    private String nombre;

    @Column(name = "codigo", length = 50, unique = true)
    private String codigo;

    /** Archivo de referencia subido por el usuario (opcional). */
    @Column(name = "object_key", columnDefinition = "TEXT")
    private String objectKey;

    @Column(name = "content_type")
    private String contentType;

    /** Color institucional usado por el generador de PDF. */
    @Column(name = "color_primario", nullable = false)
    private String colorPrimario = "#1C315E";

    /** HTML plano de la plantilla (sin custom elements, listo para reemplazo de placeholders). */
    @Column(name = "contenido_html", columnDefinition = "TEXT")
    private String contenidoHtml;

    /** Manifest JSON con la definición de campos y secciones de la plantilla. */
    @Column(name = "field_manifest", columnDefinition = "TEXT")
    private String fieldManifest;

    @Column(nullable = false)
    private boolean predeterminada = false;

    @Column(nullable = false)
    private boolean activo = true;

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getColorPrimario() { return colorPrimario; }
    public void setColorPrimario(String colorPrimario) { this.colorPrimario = colorPrimario; }
    public String getContenidoHtml() { return contenidoHtml; }
    public void setContenidoHtml(String contenidoHtml) { this.contenidoHtml = contenidoHtml; }
    public String getFieldManifest() { return fieldManifest; }
    public void setFieldManifest(String fieldManifest) { this.fieldManifest = fieldManifest; }
    public boolean isPredeterminada() { return predeterminada; }
    public void setPredeterminada(boolean predeterminada) { this.predeterminada = predeterminada; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
}
