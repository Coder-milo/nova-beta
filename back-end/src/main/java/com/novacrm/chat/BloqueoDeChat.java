package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

/**
 * Alguien decidió que otra persona no le escriba más.
 *
 * <p>Se guarda en una dirección —quién bloqueó a quién— pero corta el chat en
 * las dos: mientras el bloqueo exista, ninguno de los dos puede escribir al
 * otro. Es a propósito. Si fuera solo de un lado, quien bloquea podría seguir
 * escribiendo a quien le bloqueó, y eso convierte una herramienta para
 * protegerse en una para insistir.
 *
 * <p>Lo ya escrito no se borra: sigue estando para leerlo y para reportarlo.
 */
@Entity
@Table(name = "chat_bloqueo", uniqueConstraints = @UniqueConstraint(
        name = "uk_chat_bloqueo", columnNames = {"bloqueador_id", "bloqueado_id"}))
public class BloqueoDeChat extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bloqueador_id", nullable = false)
    private Estudiante bloqueador;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bloqueado_id", nullable = false)
    private Estudiante bloqueado;

    public Estudiante getBloqueador() { return bloqueador; }
    public void setBloqueador(Estudiante bloqueador) { this.bloqueador = bloqueador; }

    public Estudiante getBloqueado() { return bloqueado; }
    public void setBloqueado(Estudiante bloqueado) { this.bloqueado = bloqueado; }
}
