package com.novacrm.plataforma;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "plataforma")
public class Plataforma extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String codigo;

    @Column(nullable = false)
    private String nombre;

    @Column(nullable = false, length = 1000)
    private String url;

    @Column(name = "icono_url", length = 1000)
    private String iconoUrl;

    @Column(nullable = false)
    private boolean activo = true;

    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getIconoUrl() { return iconoUrl; }
    public void setIconoUrl(String iconoUrl) { this.iconoUrl = iconoUrl; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
}