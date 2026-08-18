package com.novacrm.mensaje;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "mensaje_estudiante", indexes = {
        @Index(name = "idx_mensaje_estudiante_fecha", columnList = "estudiante_id, created_at"),
        @Index(name = "idx_mensaje_estado", columnList = "estado, created_at")
})
public class MensajeEstudiante extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @Column(nullable = false, length = 160)
    private String asunto;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoMensaje estado = EstadoMensaje.ABIERTO;

    @Column(columnDefinition = "TEXT")
    private String respuesta;

    @Column(name = "respondido_por")
    private String respondidoPor;

    @Column(name = "respondido_at")
    private Instant respondidoAt;

    /** Archivos que el estudiante adjuntó al mensaje. Se eliminan junto con él. */
    @OneToMany(mappedBy = "mensaje", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<MensajeAdjunto> adjuntos = new ArrayList<>();

    /**
     * Lo que se ha dicho en esta conversacion, en orden.
     *
     * <p>Esta fila es la cabecera del hilo —de quien es, sobre que, en que
     * estado—; el texto vive en los turnos. {@code contenido} y
     * {@code respuesta} siguen ahi mientras quede codigo que los lea, pero lo
     * que se escribe a partir de ahora entra por aqui.
     */
    @OneToMany(mappedBy = "mensaje", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<MensajeTurno> turnos = new ArrayList<>();

    public List<MensajeTurno> getTurnos() { return turnos; }

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public String getAsunto() { return asunto; }
    public void setAsunto(String asunto) { this.asunto = asunto; }
    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }
    public EstadoMensaje getEstado() { return estado; }
    public void setEstado(EstadoMensaje estado) { this.estado = estado; }
    public String getRespuesta() { return respuesta; }
    public void setRespuesta(String respuesta) { this.respuesta = respuesta; }
    public String getRespondidoPor() { return respondidoPor; }
    public void setRespondidoPor(String respondidoPor) { this.respondidoPor = respondidoPor; }
    public Instant getRespondidoAt() { return respondidoAt; }
    public void setRespondidoAt(Instant respondidoAt) { this.respondidoAt = respondidoAt; }
    public List<MensajeAdjunto> getAdjuntos() { return adjuntos; }
}
