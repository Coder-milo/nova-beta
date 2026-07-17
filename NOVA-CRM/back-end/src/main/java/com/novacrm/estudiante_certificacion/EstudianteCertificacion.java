package com.novacrm.estudiante_certificacion;

import com.novacrm.certificacion.Certificacion;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "estudiante_certificacion", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"estudiante_id", "certificacion_id"})
})
public class EstudianteCertificacion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certificacion_id", nullable = false)
    private Certificacion certificacion;

    @Column(name = "fecha_emision", nullable = false)
    private LocalDate fechaEmision;

    @Column(nullable = false)
    private boolean emitida = false;

    @Column(name = "compartida_linkedin")
    private boolean compartidaLinkedin = false;

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public Certificacion getCertificacion() { return certificacion; }
    public void setCertificacion(Certificacion certificacion) { this.certificacion = certificacion; }
    public LocalDate getFechaEmision() { return fechaEmision; }
    public void setFechaEmision(LocalDate fechaEmision) { this.fechaEmision = fechaEmision; }
    public boolean isEmitida() { return emitida; }
    public void setEmitida(boolean emitida) { this.emitida = emitida; }
    public boolean isCompartidaLinkedin() { return compartidaLinkedin; }
    public void setCompartidaLinkedin(boolean compartidaLinkedin) { this.compartidaLinkedin = compartidaLinkedin; }
}
