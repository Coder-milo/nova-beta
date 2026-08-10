package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

/**
 * Una denuncia de un estudiante sobre otro por lo que le llegó en el chat.
 *
 * <p>Guarda copia del mensaje denunciado en vez de apuntar a él. Quien acosa
 * borra, y un reporte que apunta a un mensaje borrado no le sirve a nadie: el
 * equipo abriría la ficha y no encontraría nada de lo que se denunció.
 */
@Entity
@Table(name = "chat_reporte", indexes = {
        @Index(name = "idx_chat_reporte_estado", columnList = "estado"),
        @Index(name = "idx_chat_reporte_denunciado", columnList = "denunciado_id")
})
public class ReporteDeChat extends BaseEntity {

    /** Quién reporta. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "denunciante_id", nullable = false)
    private Estudiante denunciante;

    /** A quién se reporta. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "denunciado_id", nullable = false)
    private Estudiante denunciado;

    /** Lo que el estudiante quiera contar. Puede estar vacío. */
    @Column(length = 1000)
    private String motivo;

    /**
     * Copia de los últimos mensajes de esa conversación al reportar.
     *
     * <p>Es la prueba, y por eso se copia: ver más abajo por qué no se apunta
     * al mensaje original.
     */
    @Column(columnDefinition = "TEXT")
    private String extracto;

    @Column(nullable = false, length = 20)
    private String estado = ABIERTO;

    public static final String ABIERTO = "ABIERTO";
    public static final String REVISADO = "REVISADO";

    public Estudiante getDenunciante() { return denunciante; }
    public void setDenunciante(Estudiante denunciante) { this.denunciante = denunciante; }

    public Estudiante getDenunciado() { return denunciado; }
    public void setDenunciado(Estudiante denunciado) { this.denunciado = denunciado; }

    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }

    public String getExtracto() { return extracto; }
    public void setExtracto(String extracto) { this.extracto = extracto; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}
