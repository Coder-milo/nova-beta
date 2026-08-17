package com.novacrm.postulacion;

import com.novacrm.empresa.Empresa;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import com.novacrm.vacante.Vacante;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una postulacion concreta de un estudiante a una empresa.
 *
 * <p>Sustituye al booleano {@code Match.postulado}, que no daba para mas que
 * "se postulo o no": ni a que, ni cuando, ni en que quedo. La hoja de
 * seguimiento llevaba esto aparte justo por eso.
 *
 * <p><strong>La vacante es opcional.</strong> Buena parte de las postulaciones
 * salen de una feria, de un contacto directo o de una oferta que encontro el
 * propio participante, y exigir una vacante registrada obligaria a inventarla
 * para poder anotar la postulacion. Por eso el nombre de la empresa y el cargo
 * van tambien como texto: la postulacion tiene que seguir siendo legible
 * aunque la vacante se cierre o la empresa nunca se diera de alta.
 */
@Entity
@Table(name = "postulacion", indexes = {
        @Index(name = "idx_postulacion_estudiante", columnList = "estudiante_id, fecha_postulacion"),
        @Index(name = "idx_postulacion_estado", columnList = "estado")
})
public class Postulacion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vacante_id")
    private Vacante vacante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    @Column(name = "empresa_nombre", nullable = false)
    private String empresaNombre;

    @Column(nullable = false)
    private String cargo;

    /**
     * Por donde se postulo: LinkedIn, Computrabajo, Magneto, feria, contacto
     * directo.
     *
     * <p>Texto libre y no enumerado, al reves que el canal de consecucion de
     * una colocacion. Los portales aparecen y desaparecen, y no compensa una
     * migracion cada vez que el equipo empieza a usar uno nuevo. El canal de
     * consecucion si es enumerado porque es una categoria de atribucion que se
     * reporta y tiene que ser estable.
     */
    @Column(length = 60)
    private String canal;

    @Column(name = "fecha_postulacion", nullable = false)
    private LocalDate fechaPostulacion = LocalDate.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoPostulacion estado = EstadoPostulacion.ENVIADA;

    @Column(name = "fecha_respuesta")
    private LocalDate fechaRespuesta;

    @Column(columnDefinition = "TEXT")
    private String resultado;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    /** Correo de quien la lleva. Puede ser el propio estudiante. */
    @Column(name = "gestionada_por")
    private String gestionadaPor;

    /**
     * La creo el estudiante desde su cuenta.
     *
     * <p>No cambia permisos —eso lo decide el rol—, sirve para que el equipo
     * distinga en el tablero lo que reporta el participante de lo que registro
     * el programa.
     */
    @Column(name = "registrada_por_estudiante", nullable = false)
    private boolean registradaPorEstudiante = false;

    @Column(name = "url_oferta", length = 1000)
    private String urlOferta;

    // ── La cita ─────────────────────────────────────────────────────────────

    /**
     * Cuando es la entrevista, con hora.
     *
     * <p>El estado {@link EstadoPostulacion#ENTREVISTA_AGENDADA} existia desde
     * el principio, pero no habia donde apuntar cuando era: la cita acababa
     * dentro de {@code observaciones} en texto libre. Eso impedia las dos cosas
     * para las que sirve tenerla: avisar al estudiante antes de que se le pase y
     * sacar la agenda de la semana del equipo.
     *
     * <p>Es {@code LocalDateTime} y no {@code LocalDate} porque a una cita se
     * llega a una hora. Sin zona horaria a proposito: el programa opera en una
     * sola —Colombia no tiene horario de verano—, y guardar un instante absoluto
     * obligaria a convertir en cada lectura para acabar mostrando exactamente lo
     * que se escribio.
     */
    @Column(name = "fecha_hora_entrevista")
    private LocalDateTime fechaHoraEntrevista;

    @Enumerated(EnumType.STRING)
    @Column(name = "modalidad_entrevista", length = 20)
    private ModalidadEntrevista modalidadEntrevista;

    /**
     * Direccion si es presencial, enlace de la reunion si es virtual.
     *
     * <p>Un solo campo para las dos cosas porque son excluyentes: la modalidad
     * ya dice como interpretarlo, y dos columnas de las que siempre hay una
     * vacia se acaban rellenando cruzadas.
     */
    @Column(name = "lugar_entrevista", length = 1000)
    private String lugarEntrevista;

    /** Con quien es la cita, del lado de la empresa. */
    @Column(name = "contacto_nombre", length = 160)
    private String contactoNombre;

    @Column(name = "contacto_email", length = 160)
    private String contactoEmail;

    @Column(name = "contacto_telefono", length = 40)
    private String contactoTelefono;

    /**
     * Cuando hay que volver a mirar esta postulacion.
     *
     * <p>Lo que se pierde no son las postulaciones con respuesta sino las que se
     * quedan calladas: sin una fecha en la que reaparezcan, una postulacion
     * enviada hace tres semanas no vuelve a la vista de nadie.
     */
    @Column(name = "proximo_seguimiento")
    private LocalDate proximoSeguimiento;

    /**
     * Mueve la postulacion de estado dejando la fecha de respuesta puesta.
     *
     * <p>Se hace aqui y no desde fuera para que no quede una postulacion en
     * "entrevista agendada" sin fecha de respuesta: sin ella no se puede
     * calcular cuanto tarda cada empresa en contestar, que es la unica forma
     * de saber a cual vale la pena volver.
     */
    public void moverA(EstadoPostulacion nuevo, LocalDate cuando) {
        this.estado = nuevo;
        if (nuevo.implicaRespuesta() && this.fechaRespuesta == null) {
            this.fechaRespuesta = cuando;
        }
    }

    /** Hay cita puesta y todavia no ha pasado. */
    public boolean tieneEntrevistaPendiente() {
        return fechaHoraEntrevista != null && fechaHoraEntrevista.isAfter(LocalDateTime.now());
    }

    /**
     * La cita quedo sin atender.
     *
     * <p>Ya paso la hora y el proceso sigue en "entrevista agendada": o se hizo
     * y nadie lo anoto, o no se presento. En ambos casos hace falta que alguien
     * mire, y es lo que separa una agenda util de un calendario que solo
     * acumula citas viejas.
     */
    public boolean entrevistaVencidaSinCerrar() {
        return fechaHoraEntrevista != null
                && fechaHoraEntrevista.isBefore(LocalDateTime.now())
                && estado == EstadoPostulacion.ENTREVISTA_AGENDADA;
    }

    /** Nombre de la empresa preferiendo la ficha registrada. */
    public String nombreEmpresa() {
        return empresa != null && empresa.getNombre() != null ? empresa.getNombre() : empresaNombre;
    }

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public Vacante getVacante() { return vacante; }
    public void setVacante(Vacante vacante) { this.vacante = vacante; }
    public Empresa getEmpresa() { return empresa; }
    public void setEmpresa(Empresa empresa) { this.empresa = empresa; }
    public String getEmpresaNombre() { return empresaNombre; }
    public void setEmpresaNombre(String empresaNombre) { this.empresaNombre = empresaNombre; }
    public String getCargo() { return cargo; }
    public void setCargo(String cargo) { this.cargo = cargo; }
    public String getCanal() { return canal; }
    public void setCanal(String canal) { this.canal = canal; }
    public LocalDate getFechaPostulacion() { return fechaPostulacion; }
    public void setFechaPostulacion(LocalDate f) { this.fechaPostulacion = f; }
    public EstadoPostulacion getEstado() { return estado; }
    public void setEstado(EstadoPostulacion estado) { this.estado = estado; }
    public LocalDate getFechaRespuesta() { return fechaRespuesta; }
    public void setFechaRespuesta(LocalDate f) { this.fechaRespuesta = f; }
    public String getResultado() { return resultado; }
    public void setResultado(String resultado) { this.resultado = resultado; }
    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }
    public String getGestionadaPor() { return gestionadaPor; }
    public void setGestionadaPor(String gestionadaPor) { this.gestionadaPor = gestionadaPor; }
    public boolean isRegistradaPorEstudiante() { return registradaPorEstudiante; }
    public void setRegistradaPorEstudiante(boolean v) { this.registradaPorEstudiante = v; }
    public String getUrlOferta() { return urlOferta; }
    public void setUrlOferta(String urlOferta) { this.urlOferta = urlOferta; }
    public LocalDateTime getFechaHoraEntrevista() { return fechaHoraEntrevista; }
    public void setFechaHoraEntrevista(LocalDateTime f) { this.fechaHoraEntrevista = f; }
    public ModalidadEntrevista getModalidadEntrevista() { return modalidadEntrevista; }
    public void setModalidadEntrevista(ModalidadEntrevista m) { this.modalidadEntrevista = m; }
    public String getLugarEntrevista() { return lugarEntrevista; }
    public void setLugarEntrevista(String lugarEntrevista) { this.lugarEntrevista = lugarEntrevista; }
    public String getContactoNombre() { return contactoNombre; }
    public void setContactoNombre(String contactoNombre) { this.contactoNombre = contactoNombre; }
    public String getContactoEmail() { return contactoEmail; }
    public void setContactoEmail(String contactoEmail) { this.contactoEmail = contactoEmail; }
    public String getContactoTelefono() { return contactoTelefono; }
    public void setContactoTelefono(String contactoTelefono) { this.contactoTelefono = contactoTelefono; }
    public LocalDate getProximoSeguimiento() { return proximoSeguimiento; }
    public void setProximoSeguimiento(LocalDate proximoSeguimiento) { this.proximoSeguimiento = proximoSeguimiento; }
}
