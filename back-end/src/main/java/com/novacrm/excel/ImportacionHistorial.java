package com.novacrm.excel;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "importacion_historial")
public class ImportacionHistorial {

    @Id
    private UUID id = UUID.randomUUID();

    private String archivo;

    private String usuario;

    @Column(name = "programa_id")
    private UUID programaId;

    private int creados;

    private int actualizados;

    private int omitidos;

    private int errores;

    @Column(columnDefinition = "TEXT")
    private String detalle;

    /**
     * Que importador la hizo: {@code ESTUDIANTES}, {@code CRM} o {@code LIBRO}.
     *
     * <p>Con tres escribiendo en la misma tabla, «se importaron 40 registros» no
     * dice si eran participantes, empresas o vinculaciones — y son tres cosas
     * que se corrigen de forma distinta.
     */
    @Column(nullable = false, length = 20)
    private String origen = "ESTUDIANTES";

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public ImportacionHistorial() {
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getArchivo() { return archivo; }
    public void setArchivo(String archivo) { this.archivo = archivo; }
    public String getUsuario() { return usuario; }
    public void setUsuario(String usuario) { this.usuario = usuario; }
    public UUID getProgramaId() { return programaId; }
    public void setProgramaId(UUID programaId) { this.programaId = programaId; }
    public int getCreados() { return creados; }
    public void setCreados(int creados) { this.creados = creados; }
    public int getActualizados() { return actualizados; }
    public void setActualizados(int actualizados) { this.actualizados = actualizados; }
    public int getOmitidos() { return omitidos; }
    public void setOmitidos(int omitidos) { this.omitidos = omitidos; }
    public int getErrores() { return errores; }
    public void setErrores(int errores) { this.errores = errores; }
    public String getDetalle() { return detalle; }
    public void setDetalle(String detalle) { this.detalle = detalle; }
    public String getOrigen() { return origen; }
    public void setOrigen(String origen) { this.origen = origen; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
