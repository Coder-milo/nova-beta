package com.novacrm.perfil;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "experiencia_laboral")
public class ExperienciaLaboral extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @Column(nullable = false)
    private String empresa;

    @Column(nullable = false)
    private String cargo;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Column(nullable = false)
    private boolean relacionada = false;

    @Column(columnDefinition = "TEXT")
    private String funciones;

    @Column(nullable = false)
    private boolean actual = false;

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public String getEmpresa() { return empresa; }
    public void setEmpresa(String empresa) { this.empresa = empresa; }
    public String getCargo() { return cargo; }
    public void setCargo(String cargo) { this.cargo = cargo; }
    public LocalDate getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(LocalDate fechaInicio) { this.fechaInicio = fechaInicio; }
    public LocalDate getFechaFin() { return fechaFin; }
    public void setFechaFin(LocalDate fechaFin) { this.fechaFin = fechaFin; }
    public boolean isRelacionada() { return relacionada; }
    public void setRelacionada(boolean relacionada) { this.relacionada = relacionada; }
    public String getFunciones() { return funciones; }
    public void setFunciones(String funciones) { this.funciones = funciones; }
    public boolean isActual() { return actual; }
    public void setActual(boolean actual) { this.actual = actual; }
}
