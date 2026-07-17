package com.novacrm.habilidad;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "catalogo_habilidad")
public class Habilidad extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String nombre;

    private String categoria;

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getCategoria() { return categoria; }
    public void setCategoria(String categoria) { this.categoria = categoria; }
}
