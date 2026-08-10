package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

/**
 * Una conversación que alguien apartó de su bandeja.
 *
 * <p>Es de cada uno: que yo archive una conversación no la archiva para el
 * otro, igual que guardar una carta en un cajón no se la quita a quien la
 * escribió. Por eso la clave es el par (quien archiva, con quién).
 *
 * <p>Archivar no borra ni corta nada. Si llega un mensaje nuevo despues de
 * archivar, la conversación vuelve a la bandeja: apartar algo no puede
 * significar dejar de enterarse de lo que pasa en ello. De ahí que importe
 * cuándo se archivó y no solo que se archivara.
 */
@Entity
@Table(name = "chat_archivada", uniqueConstraints = @UniqueConstraint(
        name = "uk_chat_archivada", columnNames = {"estudiante_id", "contacto_id"}))
public class ConversacionArchivada extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contacto_id", nullable = false)
    private Estudiante contacto;

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }

    public Estudiante getContacto() { return contacto; }
    public void setContacto(Estudiante contacto) { this.contacto = contacto; }
}
