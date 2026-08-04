package com.novacrm.branding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "branding_imagen")
public class BrandingImagen {

    @Id
    @Column(length = 160, nullable = false)
    private String clave;

    @Column(name = "content_type", length = 40, nullable = false)
    private String contentType;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] contenido;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    protected BrandingImagen() {}

    public BrandingImagen(String clave, String contentType, byte[] contenido) {
        this.clave = clave;
        this.contentType = contentType;
        this.contenido = contenido;
        this.creadoEn = Instant.now();
    }

    public String getClave() { return clave; }
    public String getContentType() { return contentType; }
    public byte[] getContenido() { return contenido; }
}

