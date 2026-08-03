package com.novacrm.mensaje;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Archivo adjunto a un mensaje del portal de estudiante. */
@Entity
@Table(name = "mensaje_adjunto", indexes = {
        @Index(name = "idx_mensaje_adjunto_mensaje", columnList = "mensaje_id, created_at")
})
public class MensajeAdjunto extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mensaje_id", nullable = false)
    private MensajeEstudiante mensaje;

    @Column(nullable = false, length = 255)
    private String nombre;

    @Column(name = "object_key", nullable = false, columnDefinition = "TEXT")
    private String objectKey;

    @Column(name = "content_type", nullable = false, length = 255)
    private String contentType;

    @Column(name = "tamano", nullable = false)
    private long tamano;

    /** Distingue los archivos enviados por el equipo de los del estudiante. */
    @Column(name = "es_respuesta", nullable = false)
    private boolean respuesta;

    public MensajeEstudiante getMensaje() { return mensaje; }
    public void setMensaje(MensajeEstudiante mensaje) { this.mensaje = mensaje; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getTamano() { return tamano; }
    public void setTamano(long tamano) { this.tamano = tamano; }
    public boolean isRespuesta() { return respuesta; }
    public void setRespuesta(boolean respuesta) { this.respuesta = respuesta; }
}
