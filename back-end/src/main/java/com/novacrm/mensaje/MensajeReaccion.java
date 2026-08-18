package com.novacrm.mensaje;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

/**
 * Un emoji que alguien puso sobre un turno concreto.
 *
 * <p>Que una misma persona no repita el mismo emoji sobre el mismo turno lo
 * impone el indice unico de la tabla, no el codigo: comprobarlo antes de
 * insertar deja una carrera abierta entre dos pulsaciones seguidas, y
 * deduplicar al leer es tarde.
 */
@Entity
@Table(name = "mensaje_reaccion",
       uniqueConstraints = @UniqueConstraint(
           name = "uq_mensaje_reaccion",
           columnNames = {"turno_id", "autor_email", "emoji"}),
       indexes = @Index(name = "idx_mensaje_reaccion_turno", columnList = "turno_id"))
public class MensajeReaccion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "turno_id", nullable = false)
    private MensajeTurno turno;

    /** Correo de quien reacciona; permite quitar solo la suya. */
    @Column(name = "autor_email", nullable = false)
    private String autorEmail;

    @Column(nullable = false, length = 16)
    private String emoji;

    public MensajeTurno getTurno() { return turno; }
    public void setTurno(MensajeTurno turno) { this.turno = turno; }

    public String getAutorEmail() { return autorEmail; }
    public void setAutorEmail(String autorEmail) { this.autorEmail = autorEmail; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
}
