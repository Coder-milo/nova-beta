package com.novacrm.auditoria;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "auditoria")
public class Auditoria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();

    @Column(nullable = false)
    private String usuario;

    @Column(nullable = false)
    private String modulo;

    @Column(nullable = false)
    private String accion;

    @Column(nullable = false)
    private String entidad;

    @Column(name = "registro_id")
    private String registroId;

    @Column(name = "registro_nombre")
    private String registroNombre;

    @Column(name = "datos_anteriores", columnDefinition = "TEXT")
    private String datosAnteriores;

    @Column(name = "datos_nuevos", columnDefinition = "TEXT")
    private String datosNuevos;

    private String ip;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public LocalDateTime getFecha() { return fecha; }
    public void setFecha(LocalDateTime fecha) { this.fecha = fecha; }
    public String getUsuario() { return usuario; }
    public void setUsuario(String usuario) { this.usuario = usuario; }
    public String getModulo() { return modulo; }
    public void setModulo(String modulo) { this.modulo = modulo; }
    public String getAccion() { return accion; }
    public void setAccion(String accion) { this.accion = accion; }
    public String getEntidad() { return entidad; }
    public void setEntidad(String entidad) { this.entidad = entidad; }
    public String getRegistroId() { return registroId; }
    public void setRegistroId(String registroId) { this.registroId = registroId; }
    public String getRegistroNombre() { return registroNombre; }
    public void setRegistroNombre(String registroNombre) { this.registroNombre = registroNombre; }
    public String getDatosAnteriores() { return datosAnteriores; }
    public void setDatosAnteriores(String datosAnteriores) { this.datosAnteriores = datosAnteriores; }
    public String getDatosNuevos() { return datosNuevos; }
    public void setDatosNuevos(String datosNuevos) { this.datosNuevos = datosNuevos; }
    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }
}
