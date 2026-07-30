package com.novacrm.estudiante;

import com.novacrm.catalogo.nivel_ingles.NivelIngles;
import com.novacrm.programa.Programa;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "estudiante", indexes = {
    @Index(name = "idx_estudiante_programa_activo", columnList = "programa_id, activo"),
    @Index(name = "idx_estudiante_email", columnList = "email")
})
public class Estudiante extends BaseEntity {

    @Column(nullable = false)
    private String nombre;

    @Column(name = "apellidos", nullable = false)
    private String apellido;

    @Column(nullable = false, unique = true)
    private String email;

    private String telefono;

    private String celular;

    private String ciudad;

    private String barrio;

    @Column(name = "tipo_documento")
    private String tipoDocumento;

    @Column(name = "numero_documento")
    private String numeroDocumento;

    @Column(name = "fecha_nacimiento")
    private java.time.LocalDate fechaNacimiento;

    private String genero;

    @Column(name = "nivel_educativo")
    private String nivelEducativo;

    private String titulo;

    @Column(name = "anios_experiencia")
    private Integer aniosExperiencia;

    @Column(name = "sector_experiencia")
    private String sectorExperiencia;

    @Column(name = "ultimo_cargo")
    private String ultimoCargo;

    @Column(name = "perfil_profesional", columnDefinition = "TEXT")
    private String perfilProfesional;

    @Column(name = "sector_objetivo")
    private String sectorObjetivo;

    @Column(name = "cargo_objetivo")
    private String cargoObjetivo;

    @Column(name = "disponibilidad_movilidad")
    private Boolean disponibilidadMovilidad;

    @Column(nullable = false)
    private boolean activo = true;

    @Column(name = "deleted_at")
    private java.time.Instant deletedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_academico", nullable = false)
    private EstadoAcademico estadoAcademico = EstadoAcademico.ACTIVO;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_empleabilidad", nullable = false)
    private EstadoEmpleabilidad estadoEmpleabilidad = EstadoEmpleabilidad.SIN_INFO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programa_id", nullable = false)
    private Programa programa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nivel_ingles_id")
    private NivelIngles nivelIngles;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "linkedin_user_id")
    private String linkedinUserId;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "linkedin_access_token", columnDefinition = "TEXT")
    private String linkedinAccessToken;

    private String nacionalidad;

    private String direccion;

    @Column(name = "foto_url", columnDefinition = "TEXT")
    private String fotoUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plantilla_preferida_id")
    private com.novacrm.hv.PlantillaHv plantillaPreferida;

    @Column(columnDefinition = "TEXT")
    private String competencias;

    @Column(columnDefinition = "TEXT")
    private String idiomas;

    @Column(columnDefinition = "TEXT")
    private String referencias;

    private String disponibilidad;

    @Column(name = "clasificacion_sisben")
    private String clasificacionSisben;

    @Column(name = "situacion_laboral")
    private String situacionLaboral;

    @Column(name = "ingreso_mensual")
    private String ingresoMensual;

    @Column(name = "responsable_economico")
    private Boolean responsableEconomico;

    @Column(name = "ha_trabajado")
    private Boolean haTrabajado;

    @Column(name = "tiene_computador")
    private Boolean tieneComputador;

    @Column(name = "tiene_internet")
    private Boolean tieneInternet;

    @Column(columnDefinition = "TEXT")
    private String motivacion;

    @Column(name = "interes_migratorio")
    private Boolean interesMigratorio;

    @Column(name = "resultado_prueba_escrita")
    private String resultadoPruebaEscrita;

    @Column(name = "resultado_prueba_oral")
    private String resultadoPruebaOral;

    @Column(name = "institucion_educativa")
    private String institucionEducativa;

    @Column(name = "programa_academico")
    private String programaAcademico;

    @Column(name = "area_formacion")
    private String areaFormacion;

    @Column(name = "estado_formacion")
    private String estadoFormacion;

    @Column(name = "disponibilidad_laboral")
    private String disponibilidadLaboral;

    @Column(name = "estado_busqueda")
    private String estadoBusqueda;

    @Column(name = "postulaciones_enviadas")
    private Integer postulacionesEnviadas;

    @Column(name = "empresas_contactadas")
    private Integer empresasContactadas;

    // ── Edad ────────────────────────────────────────────────────────────────

    /**
     * Edad tal y como la trae la hoja de seguimiento, junto a la fecha en que
     * se capturo.
     *
     * <p>Una edad suelta caduca: reimportar el archivo el año que viene dejaria
     * a los 107 participantes con la edad del año pasado. Guardando cuando se
     * capturo se puede envejecer, y en cuanto alguien registre la fecha de
     * nacimiento real deja de usarse.
     */
    @Column(name = "edad_al_registrar")
    private Integer edadAlRegistrar;

    @Column(name = "fecha_captura_edad")
    private java.time.LocalDate fechaCapturaEdad;

    // ── Enlaces de trabajo ──────────────────────────────────────────────────

    /** Carpeta de Drive del participante: HV, certificados, soportes. */
    @Column(name = "carpeta_url", length = 1000)
    private String carpetaUrl;

    /**
     * Perfil publico de LinkedIn.
     *
     * <p>Distinto de {@link #linkedinUserId}, que es el identificador de OAuth
     * y no sirve para abrir nada. Este es el enlace que el equipo revisa cuando
     * evalua si el perfil esta optimizado.
     */
    @Column(name = "linkedin_url", length = 1000)
    private String linkedinUrl;

    /**
     * Los cinco hitos de preparacion, cada uno con tres estados.
     *
     * <p>Se capturan; no se deducen. Ver {@link PreparacionEmpleabilidad}.
     */
    @Embedded
    private PreparacionEmpleabilidad preparacion = new PreparacionEmpleabilidad();

    /** La edad a dia de hoy, venga de donde venga. */
    public Integer edad(java.time.LocalDate hoy) {
        return EdadParticipante.resolver(fechaNacimiento, edadAlRegistrar, fechaCapturaEdad, hoy);
    }

    public Integer getEdadAlRegistrar() { return edadAlRegistrar; }
    public void setEdadAlRegistrar(Integer edadAlRegistrar) { this.edadAlRegistrar = edadAlRegistrar; }
    public java.time.LocalDate getFechaCapturaEdad() { return fechaCapturaEdad; }
    public void setFechaCapturaEdad(java.time.LocalDate f) { this.fechaCapturaEdad = f; }
    public String getCarpetaUrl() { return carpetaUrl; }
    public void setCarpetaUrl(String carpetaUrl) { this.carpetaUrl = carpetaUrl; }
    public String getLinkedinUrl() { return linkedinUrl; }
    public void setLinkedinUrl(String linkedinUrl) { this.linkedinUrl = linkedinUrl; }
    public PreparacionEmpleabilidad getPreparacion() {
        if (preparacion == null) {
            preparacion = new PreparacionEmpleabilidad();
        }
        return preparacion;
    }
    public void setPreparacion(PreparacionEmpleabilidad p) { this.preparacion = p; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }
    public String getCelular() { return celular; }
    public void setCelular(String celular) { this.celular = celular; }
    public String getCiudad() { return ciudad; }
    public void setCiudad(String ciudad) { this.ciudad = ciudad; }
    public String getBarrio() { return barrio; }
    public void setBarrio(String barrio) { this.barrio = barrio; }
    public String getTipoDocumento() { return tipoDocumento; }
    public void setTipoDocumento(String tipoDocumento) { this.tipoDocumento = tipoDocumento; }
    public String getNumeroDocumento() { return numeroDocumento; }
    public void setNumeroDocumento(String numeroDocumento) { this.numeroDocumento = numeroDocumento; }
    public java.time.LocalDate getFechaNacimiento() { return fechaNacimiento; }
    public void setFechaNacimiento(java.time.LocalDate fechaNacimiento) { this.fechaNacimiento = fechaNacimiento; }
    public String getGenero() { return genero; }
    public void setGenero(String genero) { this.genero = genero; }
    public String getNivelEducativo() { return nivelEducativo; }
    public void setNivelEducativo(String nivelEducativo) { this.nivelEducativo = nivelEducativo; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public Integer getAniosExperiencia() { return aniosExperiencia; }
    public void setAniosExperiencia(Integer aniosExperiencia) { this.aniosExperiencia = aniosExperiencia; }
    public String getSectorExperiencia() { return sectorExperiencia; }
    public void setSectorExperiencia(String sectorExperiencia) { this.sectorExperiencia = sectorExperiencia; }
    public String getUltimoCargo() { return ultimoCargo; }
    public void setUltimoCargo(String ultimoCargo) { this.ultimoCargo = ultimoCargo; }
    public String getPerfilProfesional() { return perfilProfesional; }
    public void setPerfilProfesional(String perfilProfesional) { this.perfilProfesional = perfilProfesional; }
    public String getSectorObjetivo() { return sectorObjetivo; }
    public void setSectorObjetivo(String sectorObjetivo) { this.sectorObjetivo = sectorObjetivo; }
    public String getCargoObjetivo() { return cargoObjetivo; }
    public void setCargoObjetivo(String cargoObjetivo) { this.cargoObjetivo = cargoObjetivo; }
    public Boolean getDisponibilidadMovilidad() { return disponibilidadMovilidad; }
    public void setDisponibilidadMovilidad(Boolean disponibilidadMovilidad) { this.disponibilidadMovilidad = disponibilidadMovilidad; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public java.time.Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(java.time.Instant deletedAt) { this.deletedAt = deletedAt; }
    public EstadoAcademico getEstadoAcademico() { return estadoAcademico; }
    public void setEstadoAcademico(EstadoAcademico estadoAcademico) { this.estadoAcademico = estadoAcademico; }
    public EstadoEmpleabilidad getEstadoEmpleabilidad() { return estadoEmpleabilidad; }
    public void setEstadoEmpleabilidad(EstadoEmpleabilidad estadoEmpleabilidad) { this.estadoEmpleabilidad = estadoEmpleabilidad; }
    public Programa getPrograma() { return programa; }
    public void setPrograma(Programa programa) { this.programa = programa; }
    public NivelIngles getNivelIngles() { return nivelIngles; }
    public void setNivelIngles(NivelIngles nivelIngles) { this.nivelIngles = nivelIngles; }
    public String getLinkedinUserId() { return linkedinUserId; }
    public void setLinkedinUserId(String linkedinUserId) { this.linkedinUserId = linkedinUserId; }
    public String getLinkedinAccessToken() { return linkedinAccessToken; }
    public void setLinkedinAccessToken(String linkedinAccessToken) { this.linkedinAccessToken = linkedinAccessToken; }
    public String getNacionalidad() { return nacionalidad; }
    public void setNacionalidad(String nacionalidad) { this.nacionalidad = nacionalidad; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }
    public String getFotoUrl() { return fotoUrl; }
    public void setFotoUrl(String fotoUrl) { this.fotoUrl = fotoUrl; }
    public String getCompetencias() { return competencias; }
    public void setCompetencias(String competencias) { this.competencias = competencias; }
    public String getIdiomas() { return idiomas; }
    public void setIdiomas(String idiomas) { this.idiomas = idiomas; }
    public String getReferencias() { return referencias; }
    public void setReferencias(String referencias) { this.referencias = referencias; }
    public String getDisponibilidad() { return disponibilidad; }
    public void setDisponibilidad(String disponibilidad) { this.disponibilidad = disponibilidad; }
    public String getClasificacionSisben() { return clasificacionSisben; }
    public void setClasificacionSisben(String clasificacionSisben) { this.clasificacionSisben = clasificacionSisben; }
    public String getSituacionLaboral() { return situacionLaboral; }
    public void setSituacionLaboral(String situacionLaboral) { this.situacionLaboral = situacionLaboral; }
    public String getIngresoMensual() { return ingresoMensual; }
    public void setIngresoMensual(String ingresoMensual) { this.ingresoMensual = ingresoMensual; }
    public Boolean getResponsableEconomico() { return responsableEconomico; }
    public void setResponsableEconomico(Boolean responsableEconomico) { this.responsableEconomico = responsableEconomico; }
    public Boolean getHaTrabajado() { return haTrabajado; }
    public void setHaTrabajado(Boolean haTrabajado) { this.haTrabajado = haTrabajado; }
    public Boolean getTieneComputador() { return tieneComputador; }
    public void setTieneComputador(Boolean tieneComputador) { this.tieneComputador = tieneComputador; }
    public Boolean getTieneInternet() { return tieneInternet; }
    public void setTieneInternet(Boolean tieneInternet) { this.tieneInternet = tieneInternet; }
    public String getMotivacion() { return motivacion; }
    public void setMotivacion(String motivacion) { this.motivacion = motivacion; }
    public Boolean getInteresMigratorio() { return interesMigratorio; }
    public void setInteresMigratorio(Boolean interesMigratorio) { this.interesMigratorio = interesMigratorio; }
    public String getResultadoPruebaEscrita() { return resultadoPruebaEscrita; }
    public void setResultadoPruebaEscrita(String resultadoPruebaEscrita) { this.resultadoPruebaEscrita = resultadoPruebaEscrita; }
    public String getResultadoPruebaOral() { return resultadoPruebaOral; }
    public void setResultadoPruebaOral(String resultadoPruebaOral) { this.resultadoPruebaOral = resultadoPruebaOral; }
    public String getInstitucionEducativa() { return institucionEducativa; }
    public void setInstitucionEducativa(String institucionEducativa) { this.institucionEducativa = institucionEducativa; }
    public String getProgramaAcademico() { return programaAcademico; }
    public void setProgramaAcademico(String programaAcademico) { this.programaAcademico = programaAcademico; }
    public String getAreaFormacion() { return areaFormacion; }
    public void setAreaFormacion(String areaFormacion) { this.areaFormacion = areaFormacion; }
    public String getEstadoFormacion() { return estadoFormacion; }
    public void setEstadoFormacion(String estadoFormacion) { this.estadoFormacion = estadoFormacion; }
    public String getDisponibilidadLaboral() { return disponibilidadLaboral; }
    public void setDisponibilidadLaboral(String disponibilidadLaboral) { this.disponibilidadLaboral = disponibilidadLaboral; }
    public String getEstadoBusqueda() { return estadoBusqueda; }
    public void setEstadoBusqueda(String estadoBusqueda) { this.estadoBusqueda = estadoBusqueda; }
    public Integer getPostulacionesEnviadas() { return postulacionesEnviadas; }
    public void setPostulacionesEnviadas(Integer postulacionesEnviadas) { this.postulacionesEnviadas = postulacionesEnviadas; }
    public Integer getEmpresasContactadas() { return empresasContactadas; }
    public void setEmpresasContactadas(Integer empresasContactadas) { this.empresasContactadas = empresasContactadas; }
    public com.novacrm.hv.PlantillaHv getPlantillaPreferida() { return plantillaPreferida; }
    public void setPlantillaPreferida(com.novacrm.hv.PlantillaHv plantillaPreferida) { this.plantillaPreferida = plantillaPreferida; }
}
