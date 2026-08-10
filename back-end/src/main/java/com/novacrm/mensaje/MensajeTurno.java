package com.novacrm.mensaje;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.LinkedHashSet;
import java.util.Set;

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
     * Orden de llegada dentro del hilo, puesto por la base al insertar.
     *
     * <p>Existe porque {@code createdAt} no basta para ordenar: lo pone el reloj
     * del sistema y dos intervenciones escritas en el mismo milisegundo salen
     * con el mismo valor, con lo que la conversación puede leerse al revés.
     *
     * <p>No lo escribe la aplicación —de ahí {@code insertable=false}—: si lo
     * pusiera ella volveríamos a depender del reloj, que es el problema.
     */
    @Column(name = "secuencia", insertable = false, updatable = false)
    private Long secuencia;

    public Long getSecuencia() { return secuencia; }

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

    /**
     * Conjuntos y no listas para poder traer las dos de una sola consulta.
     *
     * <p>Hibernate se niega a hacer «fetch» de dos colecciones de tipo lista a
     * la vez —el producto cartesiano le impide saber cuántas filas de cada una
     * son reales— y falla al arrancar con MultipleBagFetchException. Con
     * conjuntos sí puede, y aquí no se pierde nada: ni un adjunto ni una
     * reacción se repiten. A cambio el orden deja de estar garantizado, así
     * que quien los lee ordena de forma explícita.
     */
    @OneToMany(mappedBy = "turno", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<MensajeReaccion> reacciones = new LinkedHashSet<>();

    @OneToMany(mappedBy = "turno")
    private Set<MensajeAdjunto> adjuntos = new LinkedHashSet<>();

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

    public Set<MensajeReaccion> getReacciones() { return reacciones; }

    public Set<MensajeAdjunto> getAdjuntos() { return adjuntos; }
}
