package com.novacrm.certificacion;

import com.novacrm.programa.Programa;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "certificacion")
public class Certificacion extends BaseEntity {

    @Column(nullable = false)
    private String nombre;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programa_id")
    private Programa programa;

    @Column(name = "horas_curriculares")
    private Integer horasCurriculares;

    @Column(name = "habilidades_cubiertas", columnDefinition = "TEXT")
    private String habilidadesCubiertas;

    @Column(name = "texto_compartir", columnDefinition = "TEXT")
    private String textoCompartir;

    @Column(nullable = false)
    private boolean activo = true;

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public Programa getPrograma() { return programa; }
    public void setPrograma(Programa programa) { this.programa = programa; }
    public Integer getHorasCurriculares() { return horasCurriculares; }
    public void setHorasCurriculares(Integer horasCurriculares) { this.horasCurriculares = horasCurriculares; }
    public String getHabilidadesCubiertas() { return habilidadesCubiertas; }
    public void setHabilidadesCubiertas(String habilidadesCubiertas) { this.habilidadesCubiertas = habilidadesCubiertas; }
    public String getTextoCompartir() { return textoCompartir; }
    public void setTextoCompartir(String textoCompartir) { this.textoCompartir = textoCompartir; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
}
