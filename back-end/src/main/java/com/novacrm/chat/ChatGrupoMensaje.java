package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "chat_grupo_mensaje", indexes = {
        @Index(name = "idx_chat_grupo_mensaje_fecha", columnList = "grupo_id, created_at")
})
public class ChatGrupoMensaje extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "grupo_id", nullable = false)
    private ChatGrupo grupo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "remitente_id", nullable = false)
    private Estudiante remitente;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    @Column(nullable = false)
    private boolean editado = false;

    @Column(name = "en_respuesta_a")
    private UUID enRespuestaA;

    @Column(nullable = false)
    private boolean reenviado = false;

    public ChatGrupo getGrupo() { return grupo; }
    public void setGrupo(ChatGrupo grupo) { this.grupo = grupo; }

    public Estudiante getRemitente() { return remitente; }
    public void setRemitente(Estudiante remitente) { this.remitente = remitente; }

    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }

    public boolean isEditado() { return editado; }
    public void setEditado(boolean editado) { this.editado = editado; }

    public UUID getEnRespuestaA() { return enRespuestaA; }
    public void setEnRespuestaA(UUID enRespuestaA) { this.enRespuestaA = enRespuestaA; }

    public boolean isReenviado() { return reenviado; }
    public void setReenviado(boolean reenviado) { this.reenviado = reenviado; }
}
