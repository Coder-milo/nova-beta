package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Mensaje privado entre dos estudiantes del mismo proyecto. */
@Entity
@Table(name = "chat_directo_mensaje", indexes = {
        @Index(name = "idx_chat_directo_remitente", columnList = "remitente_id, created_at"),
        @Index(name = "idx_chat_directo_destinatario", columnList = "destinatario_id, created_at")
})
public class ChatDirectoMensaje extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "remitente_id", nullable = false)
    private Estudiante remitente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destinatario_id", nullable = false)
    private Estudiante destinatario;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    public Estudiante getRemitente() { return remitente; }
    public void setRemitente(Estudiante remitente) { this.remitente = remitente; }
    public Estudiante getDestinatario() { return destinatario; }
    public void setDestinatario(Estudiante destinatario) { this.destinatario = destinatario; }
    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }
}
