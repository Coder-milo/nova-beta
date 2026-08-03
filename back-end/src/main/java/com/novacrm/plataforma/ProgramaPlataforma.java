package com.novacrm.plataforma;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

/**
 * Visibilidad de una plataforma en un programa. Primera l�nea del filtro:
 * el programa ofrece un subconjunto del catalogo, y dentro de eso el
 * coordinador a�n puede quitarle plataformas a un estudiante concreto.
 */
@Entity
@Table(name = "programa_plataforma",
        uniqueConstraints = @UniqueConstraint(name = "uq_programa_plataforma", columnNames = {"programa_id", "plataforma_id"}))
public class ProgramaPlataforma extends BaseEntity {

    @Column(name = "programa_id", nullable = false)
    private UUID programaId;

    @Column(name = "plataforma_id", nullable = false)
    private UUID plataformaId;

    public UUID getProgramaId() { return programaId; }
    public void setProgramaId(UUID programaId) { this.programaId = programaId; }
    public UUID getPlataformaId() { return plataformaId; }
    public void setPlataformaId(UUID plataformaId) { this.plataformaId = plataformaId; }
}