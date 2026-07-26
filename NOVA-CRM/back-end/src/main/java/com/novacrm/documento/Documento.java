package com.novacrm.documento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.programa.Programa;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "documento", indexes = {
    @Index(name = "idx_documento_estudiante", columnList = "estudiante_id"),
    @Index(name = "idx_documento_grupo", columnList = "grupo_id")
})
public class Documento extends BaseEntity {

    /** Mismo grupo = mismo documento lógico; cada reemplazo incrementa numeroVersion. */
    @Column(name = "grupo_id", nullable = false)
    private UUID grupoId;

    @Column(name = "numero_version", nullable = false)
    private int numeroVersion = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id")
    private Estudiante estudiante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programa_id")
    private Programa programa;

    @Column(nullable = false)
    private String tipo;

    @Column(nullable = false)
    private String nombre;

    @Column(name = "object_key", nullable = false, columnDefinition = "TEXT")
    private String objectKey;

    @Column(name = "content_type")
    private String contentType;

    @Column(nullable = false)
    private long tamano;

    @Column(name = "subido_por")
    private String subidoPor;

    /** true solo en la versión vigente del grupo. */
    @Column(nullable = false)
    private boolean actual = true;

    public UUID getGrupoId() { return grupoId; }
    public void setGrupoId(UUID grupoId) { this.grupoId = grupoId; }
    public int getNumeroVersion() { return numeroVersion; }
    public void setNumeroVersion(int numeroVersion) { this.numeroVersion = numeroVersion; }
    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public Programa getPrograma() { return programa; }
    public void setPrograma(Programa programa) { this.programa = programa; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getTamano() { return tamano; }
    public void setTamano(long tamano) { this.tamano = tamano; }
    public String getSubidoPor() { return subidoPor; }
    public void setSubidoPor(String subidoPor) { this.subidoPor = subidoPor; }
    public boolean isActual() { return actual; }
    public void setActual(boolean actual) { this.actual = actual; }
}
