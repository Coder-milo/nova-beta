package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "chat_grupo_miembro", indexes = {
        @Index(name = "idx_chat_grupo_miembro", columnList = "grupo_id, estudiante_id", unique = true)
})
public class ChatGrupoMiembro extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "grupo_id", nullable = false)
    private ChatGrupo grupo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @Column(name = "es_admin", nullable = false)
    private boolean esAdmin = false;

    public ChatGrupo getGrupo() { return grupo; }
    public void setGrupo(ChatGrupo grupo) { this.grupo = grupo; }

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }

    public boolean isEsAdmin() { return esAdmin; }
    public void setEsAdmin(boolean esAdmin) { this.esAdmin = esAdmin; }
}
