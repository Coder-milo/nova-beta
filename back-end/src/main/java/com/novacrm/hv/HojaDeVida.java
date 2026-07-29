package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "hoja_de_vida", indexes = {
    @Index(name = "idx_hv_estudiante", columnList = "estudiante_id")
})
public class HojaDeVida extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "estudiante_id")
    private Estudiante estudiante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plantilla_id")
    private PlantillaHv plantilla;

    @Column(name = "numero_version", nullable = false)
    private int numeroVersion = 1;

    @Column(name = "object_key", nullable = false, columnDefinition = "TEXT")
    private String objectKey;

    @Column(nullable = false)
    private boolean actual = true;

    @Column(name = "generada_por")
    private String generadaPor;

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public PlantillaHv getPlantilla() { return plantilla; }
    public void setPlantilla(PlantillaHv plantilla) { this.plantilla = plantilla; }
    public int getNumeroVersion() { return numeroVersion; }
    public void setNumeroVersion(int numeroVersion) { this.numeroVersion = numeroVersion; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    public boolean isActual() { return actual; }
    public void setActual(boolean actual) { this.actual = actual; }
    public String getGeneradaPor() { return generadaPor; }
    public void setGeneradaPor(String generadaPor) { this.generadaPor = generadaPor; }
}
