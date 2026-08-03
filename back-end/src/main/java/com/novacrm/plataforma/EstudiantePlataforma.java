package com.novacrm.plataforma;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

/**
 * Asignaci�n final: la plataforma concreta que el estudiante tiene, dentro
 * de las que ofrece su programa. Ultima capa del filtro de dos niveles.
 */
@Entity
@Table(name = "estudiante_plataforma",
        uniqueConstraints = @UniqueConstraint(name = "uq_estudiante_plataforma", columnNames = {"estudiante_id", "plataforma_id"}))
public class EstudiantePlataforma extends BaseEntity {

    @Column(name = "estudiante_id", nullable = false)
    private UUID estudianteId;

    @Column(name = "plataforma_id", nullable = false)
    private UUID plataformaId;

    public UUID getEstudianteId() { return estudianteId; }
    public void setEstudianteId(UUID estudianteId) { this.estudianteId = estudianteId; }
    public UUID getPlataformaId() { return plataformaId; }
    public void setPlataformaId(UUID plataformaId) { this.plataformaId = plataformaId; }
}