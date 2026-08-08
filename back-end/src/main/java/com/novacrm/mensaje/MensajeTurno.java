package com.novacrm.mensaje;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Una intervencion dentro de una conversacion.
 *
 * <p>Antes un mensaje guardaba la pregunta y la respuesta como dos columnas de
 * texto de la misma fila, asi que solo cabia un intercambio y no habia nada a
 * lo que apuntar para citar o reaccionar. {@link MensajeEstudiante} se queda
 * como cabecera del hilo —de quien es, sobre que, en que estado— y lo que se
 * dice vive aqui.
 */
@Entity
@Table(name = "mensaje_turno", indexes = {
    @Index(name = "idx_mensaje_turno_hilo", columnList = "mensaje_id, created_at")
})
public class MensajeTurno extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mensaje_id", nullable = false)
    private MensajeEstudiante mensaje;

    /**
     * Correo de quien escribe.
     *
     * <p>No es una referencia a la tabla de usuarios a proposito: el equipo
     * responde con cuentas que pueden darse de baja, y perder el autor de un
     * turno historico por eso seria peor que conservar un correo suelto.
     */
    @Column(name = "autor_email", nullable = false)
    private String autorEmail;

    /**
     * De que lado se pinta.
     *
     * <p>Se guarda en vez de deducirlo al leer: resolverlo por turno convierte
     * una bandeja en tantas consultas como mensajes tenga.
     */
    @Column(name = "autor_es_estudiante", nullable = false)
    private boolean autorEsEstudiante;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    /**
     * El turno al que responde este, si responde a alguno.
     *
     * <p>Nulo cuando es una intervencion suelta. Si el turno citado se borra,
     * la base lo deja a nulo en vez de arrastrar la respuesta: quedarse sin la
     * cita es recuperable, perder el texto no.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "en_respuesta_a")
    private MensajeTurno enRespuestaA;

    @OneToMany(mappedBy = "turno", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MensajeReaccion> reacciones = new ArrayList<>();

    @OneToMany(mappedBy = "turno")
    private List<MensajeAdjunto> adjuntos = new ArrayList<>();

    public MensajeEstudiante getMensaje() { return mensaje; }
    public void setMensaje(MensajeEstudiante mensaje) { this.mensaje = mensaje; }

    public String getAutorEmail() { return autorEmail; }
    public void setAutorEmail(String autorEmail) { this.autorEmail = autorEmail; }

    public boolean isAutorEsEstudiante() { return autorEsEstudiante; }
    public void setAutorEsEstudiante(boolean autorEsEstudiante) { this.autorEsEstudiante = autorEsEstudiante; }

    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }

    public MensajeTurno getEnRespuestaA() { return enRespuestaA; }
    public void setEnRespuestaA(MensajeTurno enRespuestaA) { this.enRespuestaA = enRespuestaA; }

    public List<MensajeReaccion> getReacciones() { return reacciones; }

    public List<MensajeAdjunto> getAdjuntos() { return adjuntos; }
}
