package com.novacrm.vista;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

/**
 * Una combinacion de filtros con nombre, sobre una lista.
 *
 * <p>Lo que resuelve no es el ahorro de clics. Mientras cada coordinador arma
 * su propia consulta a mano, dos personas que dicen mirar «los activos sin
 * colocar» miran conjuntos distintos, y las cifras que llevan a la reunion no
 * cuadran sin que nadie sepa por que. Una vista compartida es un acuerdo sobre
 * que significa esa frase.
 */
@Entity
@Table(name = "vista_guardada")
public class VistaGuardada extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String nombre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ModuloDeVista modulo;

    /**
     * Los filtros, en JSON.
     *
     * <p>Opaco para el backend a proposito: cada modulo filtra por cosas
     * distintas y el servidor no gana nada entendiendolo. Quien lo interpreta
     * es la pantalla que lo guardo, que es la unica que sabe que significa cada
     * clave.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String filtros = "{}";

    /** Correo de quien la creo. Es quien puede editarla y borrarla. */
    @Column(nullable = false)
    private String propietario;

    /**
     * Visible para todo el equipo.
     *
     * <p>Compartir da lectura, nunca escritura: si cualquiera pudiera cambiar
     * la vista que el equipo usa a diario, la cambiaria sin que el resto se
     * entere y volveriamos al problema que esto viene a resolver.
     */
    @Column(nullable = false)
    private boolean compartida = false;

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public ModuloDeVista getModulo() { return modulo; }
    public void setModulo(ModuloDeVista modulo) { this.modulo = modulo; }
    public String getFiltros() { return filtros; }
    public void setFiltros(String filtros) { this.filtros = filtros; }
    public String getPropietario() { return propietario; }
    public void setPropietario(String propietario) { this.propietario = propietario; }
    public boolean isCompartida() { return compartida; }
    public void setCompartida(boolean compartida) { this.compartida = compartida; }

    /** Solo el dueño la toca, aunque este compartida. */
    public boolean laPuedeEditar(String correo) {
        return propietario != null && propietario.equalsIgnoreCase(correo);
    }
}
