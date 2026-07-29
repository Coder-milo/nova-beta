package com.novacrm.credencial;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante_certificacion.EstudianteCertificacion;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "credencial")
public class Credencial {

    @Id
    private UUID id;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id")
    private EstudianteCertificacion estudianteCertificacion;

    @Column(name = "uuid_publico", nullable = false, unique = true, updatable = false)
    private UUID uuidPublico;

    @Column(name = "fecha_generacion", nullable = false)
    private LocalDateTime fechaGeneracion;

    @Column(name = "fecha_expiracion")
    private LocalDateTime fechaExpiracion;

    @Column(nullable = false)
    private boolean revocada = false;

    @Column(name = "pdf_url")
    private String pdfUrl;

    @Column(name = "token_verificacion", unique = true)
    private String tokenVerificacion;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public EstudianteCertificacion getEstudianteCertificacion() { return estudianteCertificacion; }
    public void setEstudianteCertificacion(EstudianteCertificacion estudianteCertificacion) { this.estudianteCertificacion = estudianteCertificacion; }
    public UUID getUuidPublico() { return uuidPublico; }
    public void setUuidPublico(UUID uuidPublico) { this.uuidPublico = uuidPublico; }
    public LocalDateTime getFechaGeneracion() { return fechaGeneracion; }
    public void setFechaGeneracion(LocalDateTime fechaGeneracion) { this.fechaGeneracion = fechaGeneracion; }
    public LocalDateTime getFechaExpiracion() { return fechaExpiracion; }
    public void setFechaExpiracion(LocalDateTime fechaExpiracion) { this.fechaExpiracion = fechaExpiracion; }
    public boolean isRevocada() { return revocada; }
    public void setRevocada(boolean revocada) { this.revocada = revocada; }
    public String getPdfUrl() { return pdfUrl; }
    public void setPdfUrl(String pdfUrl) { this.pdfUrl = pdfUrl; }
    public String getTokenVerificacion() { return tokenVerificacion; }
    public void setTokenVerificacion(String tokenVerificacion) { this.tokenVerificacion = tokenVerificacion; }
}
