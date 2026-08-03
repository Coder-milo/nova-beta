package com.novacrm.whatsapp;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.programa.Programa;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

/**
 * Un mensaje de la conversacion de WhatsApp de un programa: lo que escribio un
 * estudiante al numero del negocio o un aviso que el sistema le envio.
 */
@Entity
@Table(name = "mensaje_whatsapp")
public class MensajeWhatsapp extends BaseEntity {

    public enum Tipo { ENTRANTE, SALIENTE }

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programa_id")
    private Programa programa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id")
    private Estudiante estudiante;

    @Column(name = "remitente", length = 16, nullable = false)
    private String remitente;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", length = 10, nullable = false)
    private Tipo tipo;

    @Column(name = "texto", nullable = false, columnDefinition = "TEXT")
    private String texto;

    public Programa getPrograma() { return programa; }
    public void setPrograma(Programa programa) { this.programa = programa; }

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }

    public String getRemitente() { return remitente; }
    public void setRemitente(String remitente) { this.remitente = remitente; }

    public Tipo getTipo() { return tipo; }
    public void setTipo(Tipo tipo) { this.tipo = tipo; }

    public String getTexto() { return texto; }
    public void setTexto(String texto) { this.texto = texto; }
}
