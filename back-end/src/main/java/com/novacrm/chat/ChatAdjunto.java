package com.novacrm.chat;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

/**
 * Un archivo enviado dentro del chat entre estudiantes.
 *
 * <p>Cuelga del mensaje: un adjunto sin su mensaje no significa nada, y borrar
 * el mensaje se lo lleva. Como {@code chat_directo_mensaje} ya se borra en
 * cascada con el estudiante (V23), dar de baja a alguien tambien limpia lo que
 * mando.
 */
@Entity
@Table(name = "chat_adjunto", indexes = {
        @Index(name = "idx_chat_adjunto_mensaje", columnList = "mensaje_id")
})
public class ChatAdjunto extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mensaje_id", nullable = false)
    private ChatDirectoMensaje mensaje;

    /** Como lo llamo quien lo mando, ya saneado. */
    @Column(nullable = false, length = 255)
    private String nombre;

    /** Donde esta guardado. Nunca viaja al navegador. */
    @Column(name = "object_key", nullable = false, columnDefinition = "TEXT")
    private String objectKey;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private long tamano;

    /**
     * Segundos que dura una nota de voz; nulo en lo que no es audio.
     *
     * <p>La pantalla la pinta antes de descargar el archivo. Sacarla del propio
     * audio obligaria a bajarlo entero solo para saber si dura tres segundos o
     * dos minutos.
     */
    @Column(name = "duracion_segundos")
    private Integer duracionSegundos;

    public ChatDirectoMensaje getMensaje() { return mensaje; }
    public void setMensaje(ChatDirectoMensaje mensaje) { this.mensaje = mensaje; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public long getTamano() { return tamano; }
    public void setTamano(long tamano) { this.tamano = tamano; }

    public Integer getDuracionSegundos() { return duracionSegundos; }
    public void setDuracionSegundos(Integer duracionSegundos) { this.duracionSegundos = duracionSegundos; }

    /** Si es una nota de voz, para que la pantalla pinte un reproductor. */
    public boolean esAudio() {
        return contentType != null && contentType.startsWith("audio/");
    }
}
