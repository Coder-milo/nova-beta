package com.novacrm.colocacion;

import com.novacrm.empresa.Empresa;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Una persona colocada laboralmente.
 *
 * <p>Es el dato que se reporta y el que no existia. Habia un
 * {@code EstadoEmpleabilidad.EMPLEADO} —un valor de enum— sin nada detras: ni
 * en que empresa, ni desde cuando, ni por cuanto, ni si lo consiguio el
 * programa. Con eso no se puede responder a la unica pregunta que importa al
 * cierre de una cohorte.
 *
 * <p>Se permite mas de una colocacion por persona, con {@link #activa} para la
 * vigente. Alguien que cambia de trabajo dentro del programa no borra la
 * primera colocacion: el historial es lo que permite ver que la retencion en el
 * primer empleo es baja, que es un hallazgo, no un error de datos.
 */
@Entity
@Table(name = "colocacion", indexes = {
        @Index(name = "idx_colocacion_estudiante", columnList = "estudiante_id, activa")
})
public class Colocacion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    /** De que proceso salio, si salio de uno registrado. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "postulacion_id")
    private Postulacion postulacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    @Column(name = "empresa_nombre", nullable = false)
    private String empresaNombre;

    private String cargo;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_vinculacion", nullable = false, length = 30)
    private TipoVinculacion tipoVinculacion = TipoVinculacion.EMPLEADO;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Enumerated(EnumType.STRING)
    @Column(name = "canal_consecucion", length = 40)
    private CanalConsecucion canalConsecucion;

    /** Salario mensual en pesos. */
    @Column(precision = 12, scale = 2)
    private BigDecimal salario;

    private String bonificaciones;

    /** Presencial, Remoto o Hibrido. */
    @Column(length = 40)
    private String modalidad;

    @Column(name = "tipo_contrato", length = 60)
    private String tipoContrato;

    @Embedded
    private ChecklistIngreso checklist = new ChecklistIngreso();

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    @Column(nullable = false)
    private boolean activa = true;

    /**
     * Cuanto se separa el salario de la meta del programa.
     *
     * <p>No se guarda: se calcula con la meta que este configurada en ese
     * momento. Guardar la resta dejaria filas que mienten en cuanto la meta
     * cambie —y cambia todos los años con el salario minimo—, y ademas seria la
     * misma decision tomada en dos sitios.
     *
     * @return positivo si esta por encima de la meta, negativo si por debajo;
     *         nulo si no hay salario registrado
     */
    public BigDecimal diferenciaVsMeta(BigDecimal meta) {
        if (salario == null || meta == null) {
            return null;
        }
        return salario.subtract(meta);
    }

    public boolean superaMeta(BigDecimal meta) {
        var diferencia = diferenciaVsMeta(meta);
        return diferencia != null && diferencia.signum() >= 0;
    }

    public String nombreEmpresa() {
        return empresa != null && empresa.getNombre() != null ? empresa.getNombre() : empresaNombre;
    }

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public Postulacion getPostulacion() { return postulacion; }
    public void setPostulacion(Postulacion postulacion) { this.postulacion = postulacion; }
    public Empresa getEmpresa() { return empresa; }
    public void setEmpresa(Empresa empresa) { this.empresa = empresa; }
    public String getEmpresaNombre() { return empresaNombre; }
    public void setEmpresaNombre(String empresaNombre) { this.empresaNombre = empresaNombre; }
    public String getCargo() { return cargo; }
    public void setCargo(String cargo) { this.cargo = cargo; }
    public TipoVinculacion getTipoVinculacion() { return tipoVinculacion; }
    public void setTipoVinculacion(TipoVinculacion t) { this.tipoVinculacion = t; }
    public LocalDate getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(LocalDate fechaInicio) { this.fechaInicio = fechaInicio; }
    public CanalConsecucion getCanalConsecucion() { return canalConsecucion; }
    public void setCanalConsecucion(CanalConsecucion c) { this.canalConsecucion = c; }
    public BigDecimal getSalario() { return salario; }
    public void setSalario(BigDecimal salario) { this.salario = salario; }
    public String getBonificaciones() { return bonificaciones; }
    public void setBonificaciones(String bonificaciones) { this.bonificaciones = bonificaciones; }
    public String getModalidad() { return modalidad; }
    public void setModalidad(String modalidad) { this.modalidad = modalidad; }
    public String getTipoContrato() { return tipoContrato; }
    public void setTipoContrato(String tipoContrato) { this.tipoContrato = tipoContrato; }
    public ChecklistIngreso getChecklist() {
        if (checklist == null) {
            checklist = new ChecklistIngreso();
        }
        return checklist;
    }
    public void setChecklist(ChecklistIngreso checklist) { this.checklist = checklist; }
    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean activa) { this.activa = activa; }
}
