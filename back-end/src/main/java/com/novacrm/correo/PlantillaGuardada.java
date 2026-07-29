package com.novacrm.correo;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * Una plantilla de correo tal y como la escribe el coordinador.
 *
 * <p><strong>Guarda el contenido, no el HTML del correo.</strong> El armazon
 * —tablas, estilos en linea, cabecera y pie— lo pone {@code PlantillaCorreo} al
 * enviar. Si aqui se guardase el mensaje ya montado, cada arreglo de
 * compatibilidad con Outlook habria que repetirlo a mano en todas las
 * plantillas que ya existieran.
 */
@Entity
@Table(name = "plantilla_correo")
public class PlantillaGuardada extends BaseEntity {

    /** Null = comun a todos los proyectos; cada uno la envia con su marca. */
    @Column(name = "programa_id")
    private UUID programaId;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(length = 300)
    private String descripcion;

    @Column(nullable = false, length = 300)
    private String asunto;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String cuerpo;

    @Column(name = "boton_texto", length = 80)
    private String botonTexto;

    @Column(name = "boton_url", length = 500)
    private String botonUrl;

    @Column(name = "rol_minimo", nullable = false, length = 20)
    private String rolMinimo = "COORDINADOR";

    @Column(nullable = false)
    private boolean activa = true;

    /** Si lleva boton. Sin texto o sin destino no hay boton que pintar. */
    public boolean tieneBoton() {
        return botonTexto != null && !botonTexto.isBlank()
                && botonUrl != null && !botonUrl.isBlank();
    }

    public UUID getProgramaId() { return programaId; }
    public void setProgramaId(UUID programaId) { this.programaId = programaId; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public String getAsunto() { return asunto; }
    public void setAsunto(String asunto) { this.asunto = asunto; }

    public String getCuerpo() { return cuerpo; }
    public void setCuerpo(String cuerpo) { this.cuerpo = cuerpo; }

    public String getBotonTexto() { return botonTexto; }
    public void setBotonTexto(String botonTexto) { this.botonTexto = botonTexto; }

    public String getBotonUrl() { return botonUrl; }
    public void setBotonUrl(String botonUrl) { this.botonUrl = botonUrl; }

    public String getRolMinimo() { return rolMinimo; }
    public void setRolMinimo(String rolMinimo) { this.rolMinimo = rolMinimo; }

    public boolean isActiva() { return activa; }
    public void setActiva(boolean activa) { this.activa = activa; }
}
