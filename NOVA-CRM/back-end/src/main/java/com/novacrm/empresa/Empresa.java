package com.novacrm.empresa;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.LocalDate;

/**
 * Una empresa empleadora y el estado de la relacion con ella.
 *
 * <p>Nacio como catalogo para colgar vacantes y se quedo corta: el trabajo real
 * del programa es tocar puertas, y de eso no guardaba nada. A quien se le
 * escribio, cuando, por que canal y en que quedo vivia en una hoja aparte.
 *
 * <p><strong>Los contadores no son columnas.</strong> Cuantos participantes se
 * presentaron, cuantas respuestas hubo y cuantos entraron se cuentan desde
 * {@code postulacion} y {@code colocacion}. En la hoja eran columnas y decian
 * "104" en todas las filas: nadie actualiza a mano un numero que el sistema
 * puede contar.
 */
@Entity
@Table(name = "empresa", indexes = {
        @Index(name = "idx_empresa_estado_relacion", columnList = "estado_relacion")
})
public class Empresa extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String nombre;

    private String sector;

    private String sitioWeb;

    private String telefono;

    private String email;

    @Column(columnDefinition = "TEXT")
    private String direccion;

    private String ciudad;

    @Column(nullable = false)
    private boolean activo = true;

    // ── Relacion con el programa ────────────────────────────────────────────

    /** Persona concreta con la que se habla. Sin nombre no hay relacion. */
    @Column(name = "contacto_nombre")
    private String contactoNombre;

    @Column(name = "contacto_email")
    private String contactoEmail;

    /** Por donde se le habla: correo, LinkedIn, telefono, formulario web. */
    @Column(name = "contacto_canal")
    private String contactoCanal;

    @Column(name = "fecha_primer_contacto")
    private LocalDate fechaPrimerContacto;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_relacion", nullable = false, length = 30)
    private EstadoRelacion estadoRelacion = EstadoRelacion.SIN_CONTACTAR;

    /** Que toca hacer ahora. Es lo que evita que una empresa se enfrie sola. */
    @Column(name = "proximo_paso", columnDefinition = "TEXT")
    private String proximoPaso;

    @Column(columnDefinition = "TEXT")
    private String notas;

    /**
     * Cargos que esta empresa suele abrir.
     *
     * <p>Permite sugerirle una empresa a un participante aunque no haya
     * ninguna vacante publicada, que es como trabaja el equipo: se sabe que
     * Teleperformance contrata agentes bilingues todo el año sin mirar si hoy
     * hay un anuncio.
     */
    @Column(name = "cargos_tipicos", columnDefinition = "TEXT")
    private String cargosTipicos;

    /** Donde publica: Computrabajo, LinkedIn, Magneto, su propia web. */
    @Column(name = "canal_postulacion")
    private String canalPostulacion;

    /**
     * Registra un acercamiento dejando la fecha del primero intacta.
     *
     * <p>Se hace aqui para que la fecha de primer contacto no se pise cada vez
     * que se vuelve a escribir: es la que dice cuanto lleva abierta la relacion.
     */
    public void registrarContacto(EstadoRelacion nuevoEstado, LocalDate cuando) {
        if (fechaPrimerContacto == null && nuevoEstado.fueContactada()) {
            fechaPrimerContacto = cuando;
        }
        this.estadoRelacion = nuevoEstado;
    }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getSector() { return sector; }
    public void setSector(String sector) { this.sector = sector; }
    public String getSitioWeb() { return sitioWeb; }
    public void setSitioWeb(String sitioWeb) { this.sitioWeb = sitioWeb; }
    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }
    public String getCiudad() { return ciudad; }
    public void setCiudad(String ciudad) { this.ciudad = ciudad; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public String getContactoNombre() { return contactoNombre; }
    public void setContactoNombre(String contactoNombre) { this.contactoNombre = contactoNombre; }
    public String getContactoEmail() { return contactoEmail; }
    public void setContactoEmail(String contactoEmail) { this.contactoEmail = contactoEmail; }
    public String getContactoCanal() { return contactoCanal; }
    public void setContactoCanal(String contactoCanal) { this.contactoCanal = contactoCanal; }
    public LocalDate getFechaPrimerContacto() { return fechaPrimerContacto; }
    public void setFechaPrimerContacto(LocalDate f) { this.fechaPrimerContacto = f; }
    public EstadoRelacion getEstadoRelacion() { return estadoRelacion; }
    public void setEstadoRelacion(EstadoRelacion e) {
        this.estadoRelacion = e == null ? EstadoRelacion.SIN_CONTACTAR : e;
    }
    public String getProximoPaso() { return proximoPaso; }
    public void setProximoPaso(String proximoPaso) { this.proximoPaso = proximoPaso; }
    public String getNotas() { return notas; }
    public void setNotas(String notas) { this.notas = notas; }
    public String getCargosTipicos() { return cargosTipicos; }
    public void setCargosTipicos(String cargosTipicos) { this.cargosTipicos = cargosTipicos; }
    public String getCanalPostulacion() { return canalPostulacion; }
    public void setCanalPostulacion(String canalPostulacion) { this.canalPostulacion = canalPostulacion; }
}
