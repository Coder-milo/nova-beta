package com.novacrm.estudiante;

import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.exception.ConflictException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.estudiante.dto.EstudianteRequest;
import com.novacrm.estudiante.dto.EstudianteResponse;
import com.novacrm.programa.ProgramaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class EstudianteService {

    private final EstudianteRepository estudianteRepository;
    private final ProgramaRepository programaRepository;
    private final NivelInglesRepository nivelInglesRepository;
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;
    private final com.novacrm.colocacion.ColocacionRepository colocacionRepository;
    private final com.novacrm.documento.StorageService storageService;
    private final com.novacrm.hv.PlantillaHvRepository plantillaHvRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public EstudianteService(EstudianteRepository estudianteRepository,
                             ProgramaRepository programaRepository,
                             NivelInglesRepository nivelInglesRepository,
                             com.novacrm.auditoria.AuditoriaService auditoriaService,
                             com.novacrm.colocacion.ColocacionRepository colocacionRepository,
                             com.novacrm.documento.StorageService storageService,
                             com.novacrm.hv.PlantillaHvRepository plantillaHvRepository) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.nivelInglesRepository = nivelInglesRepository;
        this.auditoriaService = auditoriaService;
        this.colocacionRepository = colocacionRepository;
        this.storageService = storageService;
        this.plantillaHvRepository = plantillaHvRepository;
    }

    public Page<EstudianteResponse> listarPorPrograma(UUID programaId, Pageable pageable) {
        return estudianteRepository.findByProgramaIdAndActivoTrue(programaId, pageable)
                .map(this::toResponse);
    }

    public Page<EstudianteResponse> listarConDatosFaltantes(Pageable pageable) {
        return estudianteRepository.buscarActivosConDatosFaltantes(pageable)
                .map(this::toResponse);
    }

    /** Búsqueda avanzada sin exigir programa: nombre/documento/email, ciudad y estados. */
    public Page<EstudianteResponse> buscarAvanzado(String q, UUID programaId, String ciudad,
                                                   EstadoAcademico estadoAcademico,
                                                   EstadoEmpleabilidad estadoEmpleabilidad,
                                                   Pageable pageable) {
        return estudianteRepository.buscarAvanzado(
                        (q == null || q.isBlank()) ? null : q.trim(),
                        programaId,
                        (ciudad == null || ciudad.isBlank()) ? null : ciudad.trim(),
                        estadoAcademico, estadoEmpleabilidad, pageable)
                .map(this::toResponse);
    }

    /** Vincular (mover) un estudiante a otro programa. */
    @Transactional
    public EstudianteResponse vincularPrograma(UUID id, UUID programaId) {
        var estudiante = buscar(id);
        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + programaId));
        estudiante.setPrograma(programa);
        return toResponse(estudianteRepository.save(estudiante));
    }

    @Transactional
    public EstudianteResponse actualizarFoto(UUID id, String fotoUrl) {
        var estudiante = buscar(id);
        if (estudiante.getFotoUrl() != null && !estudiante.getFotoUrl().isBlank()) {
            try {
                storageService.eliminar(estudiante.getFotoUrl());
            } catch (Exception ignored) {
                // Si la foto anterior no existía en storage, continuar sin fallar
            }
        }
        estudiante.setFotoUrl(fotoUrl);
        return toResponse(estudianteRepository.save(estudiante));
    }

    @Transactional
    public EstudianteResponse eliminarFoto(UUID id) {
        var estudiante = buscar(id);
        if (estudiante.getFotoUrl() != null && !estudiante.getFotoUrl().isBlank()) {
            try {
                storageService.eliminar(estudiante.getFotoUrl());
            } catch (Exception ignored) {
            }
            estudiante.setFotoUrl(null);
        }
        return toResponse(estudianteRepository.save(estudiante));
    }

    @Transactional
    public EstudianteResponse actualizarPlantillaPreferida(UUID id, UUID plantillaId) {
        var estudiante = buscar(id);
        if (plantillaId == null) {
            estudiante.setPlantillaPreferida(null);
        } else {
            var plantilla = plantillaHvRepository.findById(plantillaId)
                    .orElseThrow(() -> new ResourceNotFoundException("Plantilla no encontrada: " + plantillaId));
            estudiante.setPlantillaPreferida(plantilla);
        }
        return toResponse(estudianteRepository.save(estudiante));
    }

    public EstudianteResponse obtener(UUID id) {
        return toResponse(buscar(id));
    }

    /**
     * Da de alta a un participante.
     *
     * <p>El correo y el documento se comprueban antes de guardar. La base ya
     * tiene el correo como unico, pero dejar que salte alli convertia un dato
     * repetido en un 500 «Internal server error»: la pantalla no podia decir
     * que pasaba y quedaba en el log como fallo del servidor. Y hay un caso muy
     * comun detras —una persona ya matriculada en otro proyecto, o en la
     * papelera— que merece un mensaje que diga donde esta, no «revisa los
     * campos».
     */
    @Transactional
    public EstudianteResponse crear(EstudianteRequest request) {
        var programa = programaRepository.findById(request.programaId())
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado"));
        verificarQueNoExista(request);
        var estudiante = new Estudiante();
        aplicarRequest(estudiante, request);
        estudiante.setPrograma(programa);
        var creado = estudianteRepository.save(estudiante);
        auditoriaService.registrar("Estudiantes", "Creación", "Estudiante",
                creado.getId().toString(), creado.getNombre() + " " + creado.getApellido(), null, null);
        return toResponse(creado);
    }

    @Transactional
    public EstudianteResponse actualizar(UUID id, EstudianteRequest request) {
        var estudiante = buscar(id);
        aplicarRequest(estudiante, request);
        var actualizado = estudianteRepository.save(estudiante);
        auditoriaService.registrar("Estudiantes", "Actualización", "Estudiante",
                id.toString(), actualizado.getNombre() + " " + actualizado.getApellido(), null, null);
        return toResponse(actualizado);
    }

    /**
     * Lo que el propio estudiante puede cambiar de su ficha.
     *
     * <p>Existe aparte de {@link #actualizar} porque {@code /mi-perfil} recibe
     * el mismo DTO completo, y aplicarlo entero convertia el formulario del
     * portal en una via para autocertificarse: el estudiante podia escribir su
     * propio {@code resultadoPruebaEscrita} y {@code resultadoPruebaOral} —de
     * donde sale el nivel de ingles que pesa en el matching y que decide la
     * elegibilidad para las vacantes remotas en ingles—, darse por GRADUADO o
     * por COLOCADO, y mover los contadores de postulaciones enviadas y empresas
     * contactadas, que son los numeros con los que se mide el programa.
     *
     * <p>La lista es la de datos que la persona conoce mejor que nadie:
     * contacto, ubicacion y el contenido de su hoja de vida. Todo lo que sea
     * una <em>valoracion</em> —nivel medido, estado, vinculacion a un programa,
     * documento de identidad, correo de acceso— lo sigue escribiendo quien
     * gestiona, por {@code PUT /estudiantes/{id}}.
     *
     * <p>La restriccion es del endpoint y no del rol: un coordinador que edite
     * <em>su propia</em> ficha por aqui tambien pasa por esta lista, y para lo
     * demas tiene la ruta de gestion. Asi no hay que preguntarle a la sesion
     * quien es para saber que se puede tocar.
     */
    @Transactional
    public EstudianteResponse actualizarMiPerfil(UUID id, EstudianteRequest r) {
        var e = buscar(id);

        if (r.telefono() != null) e.setTelefono(r.telefono());
        if (r.celular() != null) e.setCelular(r.celular());
        if (r.ciudad() != null) e.setCiudad(r.ciudad());
        if (r.barrio() != null) e.setBarrio(r.barrio());
        if (r.direccion() != null) e.setDireccion(r.direccion());
        if (r.perfilProfesional() != null) e.setPerfilProfesional(r.perfilProfesional());
        if (r.cargoObjetivo() != null) e.setCargoObjetivo(r.cargoObjetivo());
        if (r.sectorObjetivo() != null) e.setSectorObjetivo(r.sectorObjetivo());
        if (r.competencias() != null) e.setCompetencias(r.competencias());
        if (r.idiomas() != null) e.setIdiomas(r.idiomas());
        if (r.referencias() != null) e.setReferencias(r.referencias());
        if (r.disponibilidad() != null) e.setDisponibilidad(r.disponibilidad());
        if (r.disponibilidadLaboral() != null) e.setDisponibilidadLaboral(r.disponibilidadLaboral());
        if (r.disponibilidadMovilidad() != null) e.setDisponibilidadMovilidad(r.disponibilidadMovilidad());
        if (r.motivacion() != null) e.setMotivacion(r.motivacion());
        if (r.linkedinUrl() != null) e.setLinkedinUrl(vacioANulo(r.linkedinUrl()));

        var actualizado = estudianteRepository.save(e);
        auditoriaService.registrar("Estudiantes", "Actualización de perfil propio", "Estudiante",
                id.toString(), actualizado.getNombre() + " " + actualizado.getApellido(), null, null);
        return toResponse(actualizado);
    }

    @Transactional
    public void softDelete(UUID id) {
        var estudiante = buscar(id);
        estudiante.setActivo(false);
        estudiante.setDeletedAt(Instant.now());
        estudianteRepository.save(estudiante);
        auditoriaService.registrar("Estudiantes", "Eliminación", "Estudiante",
                id.toString(), estudiante.getNombre() + " " + estudiante.getApellido(), null, null);
    }

    public Page<EstudianteResponse> listarPapelera(UUID programaId, Pageable pageable) {
        return estudianteRepository.findByProgramaIdAndActivoFalse(programaId, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public EstudianteResponse restaurar(UUID id) {
        var estudiante = estudianteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + id));
        if (estudiante.isActivo()) {
            throw new com.novacrm.exception.BusinessException("El estudiante ya está activo");
        }
        estudiante.setActivo(true);
        estudiante.setDeletedAt(null);
        return toResponse(estudianteRepository.save(estudiante));
    }

    public long contarPapelera(UUID programaId) {
        return estudianteRepository.countByProgramaIdAndActivoFalse(programaId);
    }

    public long contarPorPrograma(UUID programaId) {
        return estudianteRepository.countByProgramaIdAndActivoTrue(programaId);
    }

    private Estudiante buscar(UUID id) {
        return estudianteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + id));
    }

    /**
     * Corta el alta cuando esa persona ya esta registrada.
     *
     * <p>El mensaje nombra el proyecto donde esta y avisa si esta en la
     * papelera: son los dos casos reales. Alguien abre el proyecto nuevo, ve la
     * lista vacia y vuelve a dar de alta a gente que ya existe en otro; y
     * alguien que se elimino sigue ocupando su correo, porque el borrado es
     * logico y la restriccion de la base no distingue.
     */
    private void verificarQueNoExista(EstudianteRequest request) {
        if (request.email() != null && !request.email().isBlank()) {
            estudianteRepository.findByEmailIgnoreCase(request.email().trim())
                    .ifPresent(existente -> {
                        throw new ConflictException(
                                "Ya hay un estudiante con el correo " + existente.getEmail()
                                        + " (" + descripcionDe(existente) + ")");
                    });
        }
        if (request.numeroDocumento() != null && !request.numeroDocumento().isBlank()) {
            estudianteRepository.findByDocumentoNormalizado(request.numeroDocumento().trim())
                    .ifPresent(existente -> {
                        throw new ConflictException(
                                "Ya hay un estudiante con el documento " + existente.getNumeroDocumento()
                                        + " (" + descripcionDe(existente) + ")");
                    });
        }
    }

    /** «Nombre Apellido, Ruta Accelerator» o «…, en la papelera». */
    private static String descripcionDe(Estudiante e) {
        String nombre = (safe(e.getNombre()) + " " + safe(e.getApellido())).trim();
        if (nombre.isEmpty()) nombre = "sin nombre";
        if (!e.isActivo()) {
            return nombre + ", en la papelera";
        }
        var programa = e.getPrograma();
        return programa == null ? nombre : nombre + ", " + programa.getNombre();
    }

    private static String safe(String valor) {
        return valor == null ? "" : valor;
    }

    private void aplicarRequest(Estudiante e, EstudianteRequest r) {
        if (r.nombre() != null) e.setNombre(r.nombre());
        if (r.apellido() != null) e.setApellido(r.apellido());
        if (r.email() != null) e.setEmail(r.email());
        if (r.telefono() != null) e.setTelefono(r.telefono());
        if (r.celular() != null) e.setCelular(r.celular());
        if (r.ciudad() != null) e.setCiudad(r.ciudad());
        if (r.barrio() != null) e.setBarrio(r.barrio());
        if (r.tipoDocumento() != null) e.setTipoDocumento(r.tipoDocumento());
        if (r.numeroDocumento() != null) e.setNumeroDocumento(r.numeroDocumento());
        if (r.genero() != null) e.setGenero(r.genero());
        if (r.nacionalidad() != null) e.setNacionalidad(r.nacionalidad());
        if (r.nivelEducativo() != null) e.setNivelEducativo(r.nivelEducativo());
        if (r.titulo() != null) e.setTitulo(r.titulo());
        if (r.aniosExperiencia() != null) e.setAniosExperiencia(r.aniosExperiencia());
        if (r.sectorExperiencia() != null) e.setSectorExperiencia(r.sectorExperiencia());
        if (r.ultimoCargo() != null) e.setUltimoCargo(r.ultimoCargo());
        if (r.perfilProfesional() != null) e.setPerfilProfesional(r.perfilProfesional());
        if (r.sectorObjetivo() != null) e.setSectorObjetivo(r.sectorObjetivo());
        if (r.cargoObjetivo() != null) e.setCargoObjetivo(r.cargoObjetivo());
        if (r.disponibilidadMovilidad() != null) e.setDisponibilidadMovilidad(r.disponibilidadMovilidad());
        if (r.clasificacionSisben() != null) e.setClasificacionSisben(r.clasificacionSisben());
        if (r.situacionLaboral() != null) e.setSituacionLaboral(r.situacionLaboral());
        if (r.ingresoMensual() != null) e.setIngresoMensual(r.ingresoMensual());
        if (r.responsableEconomico() != null) e.setResponsableEconomico(r.responsableEconomico());
        if (r.haTrabajado() != null) e.setHaTrabajado(r.haTrabajado());
        if (r.tieneComputador() != null) e.setTieneComputador(r.tieneComputador());
        if (r.tieneInternet() != null) e.setTieneInternet(r.tieneInternet());
        if (r.motivacion() != null) e.setMotivacion(r.motivacion());
        if (r.interesMigratorio() != null) e.setInteresMigratorio(r.interesMigratorio());
        if (r.resultadoPruebaEscrita() != null) e.setResultadoPruebaEscrita(r.resultadoPruebaEscrita());
        if (r.resultadoPruebaOral() != null) e.setResultadoPruebaOral(r.resultadoPruebaOral());
        if (r.institucionEducativa() != null) e.setInstitucionEducativa(r.institucionEducativa());
        if (r.programaAcademico() != null) e.setProgramaAcademico(r.programaAcademico());
        if (r.areaFormacion() != null) e.setAreaFormacion(r.areaFormacion());
        if (r.estadoFormacion() != null) e.setEstadoFormacion(r.estadoFormacion());
        if (r.disponibilidadLaboral() != null) e.setDisponibilidadLaboral(r.disponibilidadLaboral());
        if (r.estadoBusqueda() != null) e.setEstadoBusqueda(r.estadoBusqueda());
        if (r.postulacionesEnviadas() != null) e.setPostulacionesEnviadas(r.postulacionesEnviadas());
        if (r.empresasContactadas() != null) e.setEmpresasContactadas(r.empresasContactadas());
        if (r.estadoAcademico() != null) e.setEstadoAcademico(r.estadoAcademico());
        if (r.estadoEmpleabilidad() != null) e.setEstadoEmpleabilidad(r.estadoEmpleabilidad());
        if (r.direccion() != null) e.setDireccion(r.direccion());
        if (r.competencias() != null) e.setCompetencias(r.competencias());
        if (r.idiomas() != null) e.setIdiomas(r.idiomas());
        if (r.referencias() != null) e.setReferencias(r.referencias());
        if (r.disponibilidad() != null) e.setDisponibilidad(r.disponibilidad());
        aplicarPreparacion(e, r);
    }

    /**
     * Campos que solo se tocan cuando llegan.
     *
     * <p>El resto de la ficha se sobrescribe entera —es un PUT— pero estos no
     * pueden: el portal del estudiante manda un formulario mas corto, y si
     * arrastrara los hitos a nulo, guardar el perfil desde ahi borraria lo que
     * el coordinador acaba de marcar. Nulo significa "no lo cambies".
     */
    private void aplicarPreparacion(Estudiante e, EstudianteRequest r) {
        var p = e.getPreparacion();
        if (r.hitoCvListo() != null) p.setCvListo(r.hitoCvListo());
        if (r.hitoCvIngles() != null) p.setCvEnIngles(r.hitoCvIngles());
        if (r.hitoLinkedinCreado() != null) p.setLinkedinCreado(r.hitoLinkedinCreado());
        if (r.hitoLinkedinOptimizado() != null) p.setLinkedinOptimizado(r.hitoLinkedinOptimizado());
        if (r.hitoPerfilOcupacional() != null) p.setPerfilOcupacional(r.hitoPerfilOcupacional());

        if (r.carpetaUrl() != null) e.setCarpetaUrl(vacioANulo(r.carpetaUrl()));
        if (r.linkedinUrl() != null) e.setLinkedinUrl(vacioANulo(r.linkedinUrl()));
        if (r.edadAlRegistrar() != null) {
            e.setEdadAlRegistrar(r.edadAlRegistrar());
            // Sin la fecha de captura la edad no se puede envejecer y queda
            // inservible; si no la mandan, se toma hoy.
            e.setFechaCapturaEdad(
                    r.fechaCapturaEdad() != null ? r.fechaCapturaEdad() : LocalDate.now());
        }
        // La fecha de nacimiento existia en la entidad y no la escribia nadie:
        // llegaba en el request y se perdia por el camino.
        if (r.fechaNacimiento() != null && !r.fechaNacimiento().isBlank()) {
            try {
                e.setFechaNacimiento(LocalDate.parse(r.fechaNacimiento().trim()));
            } catch (java.time.format.DateTimeParseException ex) {
                throw new com.novacrm.exception.BusinessException(
                        "La fecha de nacimiento debe venir como AAAA-MM-DD");
            }
        }
    }

    private static String vacioANulo(String valor) {
        return valor.isBlank() ? null : valor.trim();
    }

    /**
     * Cambia solo los hitos de preparacion de un participante.
     *
     * <p>Existe aparte del PUT completo porque es lo que el equipo mueve a
     * diario: mandar la ficha entera para marcar una casilla arriesga pisar el
     * resto con lo que tuviera cargado el formulario.
     */
    @Transactional
    public EstudianteResponse actualizarPreparacion(UUID id, PreparacionRequest cambios) {
        var estudiante = buscar(id);
        var p = estudiante.getPreparacion();
        if (cambios.cvListo() != null) p.setCvListo(cambios.cvListo());
        if (cambios.cvEnIngles() != null) p.setCvEnIngles(cambios.cvEnIngles());
        if (cambios.linkedinCreado() != null) p.setLinkedinCreado(cambios.linkedinCreado());
        if (cambios.linkedinOptimizado() != null) p.setLinkedinOptimizado(cambios.linkedinOptimizado());
        if (cambios.perfilOcupacional() != null) p.setPerfilOcupacional(cambios.perfilOcupacional());
        if (cambios.carpetaUrl() != null) estudiante.setCarpetaUrl(vacioANulo(cambios.carpetaUrl()));
        if (cambios.linkedinUrl() != null) estudiante.setLinkedinUrl(vacioANulo(cambios.linkedinUrl()));
        // Estos campos pertenecen al mismo corte de empleabilidad. Mantenerlos
        // en este PATCH evita que el equipo tenga que reenviar la ficha completa
        // (y terminar sobrescribiendo datos personales) para actualizar los
        // cargos sugeridos o el perfil trabajado en una tutoría.
        if (cambios.sectorObjetivo() != null) estudiante.setSectorObjetivo(vacioANulo(cambios.sectorObjetivo()));
        if (cambios.cargoObjetivo() != null) estudiante.setCargoObjetivo(vacioANulo(cambios.cargoObjetivo()));
        if (cambios.perfilProfesional() != null) estudiante.setPerfilProfesional(vacioANulo(cambios.perfilProfesional()));
        if (cambios.competencias() != null) estudiante.setCompetencias(vacioANulo(cambios.competencias()));
        return toResponse(estudianteRepository.save(estudiante));
    }

    /**
     * Marca el mismo hito en varios participantes de una vez.
     *
     * <p>Ponerse al dia con 107 fichas de una en una es lo que hace que el
     * equipo vuelva a la hoja de calculo. Solo un hito por llamada: cambiar
     * varios a la vez en bloque casi siempre significa marcar algo que no se ha
     * revisado.
     *
     * @return cuantas fichas se modificaron
     */
    @Transactional
    public int actualizarPreparacionMasiva(List<UUID> ids, String hito, EstadoHito valor) {
        if (ids == null || ids.isEmpty() || valor == null) {
            return 0;
        }
        var estudiantes = estudianteRepository.findAllById(ids);
        for (var e : estudiantes) {
            var p = e.getPreparacion();
            switch (hito == null ? "" : hito.trim().toUpperCase()) {
                case "CV_LISTO" -> p.setCvListo(valor);
                case "CV_INGLES" -> p.setCvEnIngles(valor);
                case "LINKEDIN_CREADO" -> p.setLinkedinCreado(valor);
                case "LINKEDIN_OPTIMIZADO" -> p.setLinkedinOptimizado(valor);
                case "PERFIL_OCUPACIONAL" -> p.setPerfilOcupacional(valor);
                default -> throw new com.novacrm.exception.BusinessException(
                        "Hito desconocido: " + hito + ". Valores validos: CV_LISTO, CV_INGLES, "
                                + "LINKEDIN_CREADO, LINKEDIN_OPTIMIZADO, PERFIL_OCUPACIONAL");
            }
        }
        estudianteRepository.saveAll(estudiantes);
        return estudiantes.size();
    }

    /** Cambios sobre los hitos. Todo opcional: lo nulo no se toca. */
    public record PreparacionRequest(
            EstadoHito cvListo,
            EstadoHito cvEnIngles,
            EstadoHito linkedinCreado,
            EstadoHito linkedinOptimizado,
            EstadoHito perfilOcupacional,
            String carpetaUrl,
            String linkedinUrl,
            String sectorObjetivo,
            String cargoObjetivo,
            String perfilProfesional,
            String competencias) {}

    /** Porcentaje de perfil completado: campos clave para generar una HV de calidad. */
    private static int calcularCompletitud(Estudiante e) {
        String[] campos = {
                e.getNombre(), e.getApellido(), e.getEmail(),
                e.getCelular() != null ? e.getCelular() : e.getTelefono(),
                e.getNumeroDocumento(), e.getCiudad(), e.getDireccion(),
                e.getPerfilProfesional(), e.getNivelEducativo(), e.getTitulo(),
                e.getCargoObjetivo(), e.getCompetencias()
        };
        int llenos = 0;
        for (var c : campos) if (c != null && !c.isBlank()) llenos++;
        return Math.round(llenos * 100f / campos.length);
    }

    private EstudianteResponse toResponse(Estudiante e) {
        var prep = e.getPreparacion();
        boolean colocado = colocacionRepository.existsByEstudianteIdAndActivaTrue(e.getId());
        return new EstudianteResponse(
                e.getId(), e.getNombre(), e.getApellido(), e.getEmail(),
                e.getTelefono(), e.getCelular(), e.getCiudad(), e.getBarrio(),
                e.getTipoDocumento(), e.getNumeroDocumento(),
                e.getNivelEducativo(), e.getTitulo(), e.getAniosExperiencia(),
                e.getSectorExperiencia(), e.getUltimoCargo(), e.getPerfilProfesional(),
                e.getSectorObjetivo(), e.getCargoObjetivo(), e.getDisponibilidadMovilidad(),
                e.getNacionalidad(), e.getClasificacionSisben(), e.getSituacionLaboral(),
                e.getIngresoMensual(), e.getResponsableEconomico(), e.getHaTrabajado(),
                e.getTieneComputador(), e.getTieneInternet(), e.getMotivacion(),
                e.getInteresMigratorio(), e.getResultadoPruebaEscrita(), e.getResultadoPruebaOral(),
                e.getInstitucionEducativa(), e.getProgramaAcademico(), e.getAreaFormacion(),
                e.getEstadoFormacion(), e.getDisponibilidadLaboral(), e.getEstadoBusqueda(),
                e.getPostulacionesEnviadas(), e.getEmpresasContactadas(),
                e.getEstadoAcademico(), e.getEstadoEmpleabilidad(),
                e.getNivelIngles() != null ? e.getNivelIngles().getNombre() : null,
                e.getPrograma().getId(), e.getPrograma().getNombre(),
                e.isActivo(), e.getCreatedAt(), e.getDeletedAt(),
                e.getDireccion(), e.getFotoUrl(), e.getCompetencias(),
                e.getIdiomas(), e.getReferencias(), e.getDisponibilidad(),
                calcularCompletitud(e),
                prep.getCvListo().name(),
                prep.getCvEnIngles().name(),
                prep.getLinkedinCreado().name(),
                prep.getLinkedinOptimizado().name(),
                prep.getPerfilOcupacional().name(),
                prep.cumplidos(),
                prep.pendientes(),
                PuntajeEmpleabilidad.porcentaje(prep, colocado),
                colocado,
                e.getFechaNacimiento(),
                e.getEdadAlRegistrar(),
                e.getFechaCapturaEdad(),
                e.edad(LocalDate.now()),
                e.getCarpetaUrl(),
                e.getLinkedinUrl(),
                e.getPlantillaPreferida() != null ? e.getPlantillaPreferida().getId() : null
        );
    }

    @Transactional
    public void softDeleteMasivo(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return;
        estudianteRepository.softDeleteByIdIn(ids);
    }

    @Transactional
    public void hardDeleteMasivo(List<UUID> ids) {
        BorradoEstudiante.borrarEnCadena(entityManager, ids);
    }
}
