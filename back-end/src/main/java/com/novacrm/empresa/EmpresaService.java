package com.novacrm.empresa;

import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.empresa.dto.EmpresaDtos.EmpresaResponse;
import com.novacrm.empresa.dto.EmpresaDtos.GuardarEmpresa;
import com.novacrm.empresa.dto.EmpresaDtos.ResumenCrm;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.vacante.VacanteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Directorio de empresas y estado de la relacion con cada una.
 *
 * <p>Es el CRM que faltaba: la empresa existia como catalogo para colgar
 * vacantes, y el trabajo real —a quien se le escribio, cuando, que contesto—
 * vivia en una hoja aparte.
 */
@Service
public class EmpresaService {

    private final EmpresaRepository empresaRepository;
    private final PostulacionRepository postulacionRepository;
    private final ColocacionRepository colocacionRepository;
    private final VacanteRepository vacanteRepository;
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;
    private final ContactoEmpresaRepository contactoEmpresaRepository;

    public EmpresaService(EmpresaRepository empresaRepository,
                          PostulacionRepository postulacionRepository,
                          ColocacionRepository colocacionRepository,
                          VacanteRepository vacanteRepository,
                          com.novacrm.auditoria.AuditoriaService auditoriaService,
                          ContactoEmpresaRepository contactoEmpresaRepository) {
        this.empresaRepository = empresaRepository;
        this.postulacionRepository = postulacionRepository;
        this.colocacionRepository = colocacionRepository;
        this.vacanteRepository = vacanteRepository;
        this.auditoriaService = auditoriaService;
        this.contactoEmpresaRepository = contactoEmpresaRepository;
    }

    @Transactional(readOnly = true)
    public Page<EmpresaResponse> buscar(String texto, String sector, EstadoRelacion estado, Pageable pageable) {
        return empresaRepository.buscar(texto, sector, estado, pageable).map(this::aResponse);
    }

    @Transactional(readOnly = true)
    public EmpresaResponse obtener(UUID id) {
        return aResponse(empresaRepository.findActivaById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada")));
    }

    @Transactional(readOnly = true)
    public List<String> sectores() {
        return empresaRepository.sectores();
    }

    @Transactional
    public EmpresaResponse crear(GuardarEmpresa datos) {
        empresaRepository.findByNombreIgnoreCaseActiva(datos.nombre().trim()).ifPresent(e -> {
            throw new BusinessException("Ya existe una empresa con ese nombre: " + e.getNombre());
        });
        var empresa = new Empresa();
        empresa.setNombre(datos.nombre().trim());
        aplicar(empresa, datos);
        // saveAndFlush y no save: el enganche de abajo es un UPDATE masivo, que
        // se salta el contexto de persistencia y va directo a la base. Sin
        // volcar antes la fila nueva, apunta a una empresa que todavia no
        // existe y la clave foranea revienta.
        var guardada = empresaRepository.saveAndFlush(empresa);

        // Lo habitual es dar de alta la empresa cuando la relacion ya lleva
        // meses: para entonces hay postulaciones y colocaciones anotadas con su
        // nombre y sin ficha. Se enganchan ahora para que la ficha nazca con su
        // historia y no aparentemente vacia.
        postulacionRepository.vincularPorNombre(guardada, guardada.getNombre());
        colocacionRepository.vincularPorNombre(guardada, guardada.getNombre());

        return aResponse(guardada);
    }

    @Transactional
    public EmpresaResponse actualizar(UUID id, GuardarEmpresa datos) {
        var empresa = empresaRepository.findActivaById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
        String nombreNuevo = datos.nombre().trim();
        if (!empresa.getNombre().equalsIgnoreCase(nombreNuevo)) {
            empresaRepository.findByNombreIgnoreCaseActiva(nombreNuevo).ifPresent(otra -> {
                throw new BusinessException("Ya existe otra empresa con ese nombre");
            });
            empresa.setNombre(nombreNuevo);
        }
        aplicar(empresa, datos);
        return aResponse(empresaRepository.save(empresa));
    }

    @Transactional
    public void eliminar(UUID id) {
        var empresa = empresaRepository.findActivaById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
        // Soft-delete: vacantes y contactos la referencian con FK RESTRICT, y
        // borrarla de verdad rompia la operacion con un 500 si tenia historial.
        empresa.setActivo(false);
        empresaRepository.save(empresa);
        auditoriaService.registrar("Empresas", "Eliminación", "Empresa",
                id.toString(), empresa.getNombre(), null, null);
    }

    /**
     * Registra un acercamiento y mueve el estado de la relación.
     *
     * <p>Endpoint aparte del de edicion porque es lo que se hace a diario y
     * porque la fecha del primer contacto no debe pisarse al volver a escribir:
     * es la que dice cuanto lleva abierta la relacion.
     *
     * <p>La nota se guarda como <strong>una fila</strong> en
     * {@code contacto_empresa}, no concatenada al campo {@code notas} de la
     * empresa. Antes se hacía así —{@code "2026-08-16: llamé y no contestan"}
     * pegado al texto anterior— y eso parece un hilo sin serlo: no se sabe
     * quién escribió cada línea, corregir una obliga a editar el bloque entero,
     * y dos personas guardando a la vez se pisan, porque las dos leyeron el
     * mismo texto antes de añadir la suya.
     *
     * <p>{@code empresa.notas} se queda como está y no se toca: son las notas
     * generales de la ficha, que además llegan desde la importación de Excel.
     * Lo que deja de hacer es acumular el historial de contactos.
     *
     * @param autor quién lo registra, del token. Es la mitad que faltaba: una
     *              nota sin autor no se puede repreguntar
     */
    @Transactional
    public EmpresaResponse registrarContacto(UUID id, EstadoRelacion nuevoEstado,
                                             String proximoPaso, String nota, String autor) {
        var empresa = empresaRepository.findActivaById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
        empresa.registrarContacto(
                nuevoEstado == null ? EstadoRelacion.CONTACTADA : nuevoEstado, LocalDate.now());
        if (proximoPaso != null) {
            empresa.setProximoPaso(proximoPaso);
        }

        if (nota != null && !nota.isBlank()) {
            var apunte = new ContactoEmpresa();
            apunte.setEmpresa(empresa);
            apunte.setFecha(java.time.LocalDateTime.now());
            apunte.setTipo(nuevoEstado == null ? "CONTACTO" : nuevoEstado.name());
            // El asunto es obligatorio en la tabla y este endpoint no lo pide:
            // se compone con el estado al que se movió, que es de lo que trata
            // el apunte. Inventarse un "Sin asunto" seria peor.
            apunte.setAsunto(empresa.getEstadoRelacion() == null
                    ? "Acercamiento" : empresa.getEstadoRelacion().getEtiqueta());
            apunte.setContacto(empresa.getContactoNombre());
            apunte.setResponsable(autor);
            apunte.setNotas(nota.trim());
            contactoEmpresaRepository.save(apunte);
        }
        return aResponse(empresaRepository.save(empresa));
    }

    /** El historial de acercamientos, lo más reciente primero. */
    @Transactional(readOnly = true)
    public List<com.novacrm.empresa.dto.ContactoEmpresaResponse> contactosDe(UUID empresaId) {
        return contactoEmpresaRepository.findByEmpresaIdOrderByFechaDesc(empresaId).stream()
                .map(c -> new com.novacrm.empresa.dto.ContactoEmpresaResponse(
                        c.getId(), c.getFecha(), c.getTipo(), c.getAsunto(),
                        c.getContacto(), c.getResponsable(), c.getNotas()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ResumenCrm resumen() {
        var recuento = new java.util.EnumMap<EstadoRelacion, Long>(EstadoRelacion.class);
        for (Object[] fila : empresaRepository.recuentoPorEstadoRelacion()) {
            recuento.put((EstadoRelacion) fila[0], (Long) fila[1]);
        }
        long total = recuento.values().stream().mapToLong(Long::longValue).sum();
        return new ResumenCrm(
                total,
                recuento.getOrDefault(EstadoRelacion.SIN_CONTACTAR, 0L),
                recuento.getOrDefault(EstadoRelacion.CONTACTADA, 0L)
                        + recuento.getOrDefault(EstadoRelacion.PERFIL_ENVIADO, 0L),
                recuento.getOrDefault(EstadoRelacion.EN_CONVERSACION, 0L),
                recuento.getOrDefault(EstadoRelacion.ALIADA, 0L),
                recuento.getOrDefault(EstadoRelacion.DESCARTADA, 0L));
    }

    private void aplicar(Empresa empresa, GuardarEmpresa d) {
        empresa.setSector(d.sector());
        empresa.setCiudad(d.ciudad());
        empresa.setSitioWeb(d.sitioWeb());
        empresa.setTelefono(d.telefono());
        empresa.setEmail(d.email());
        empresa.setDireccion(d.direccion());
        empresa.setContactoNombre(d.contactoNombre());
        empresa.setContactoEmail(d.contactoEmail());
        empresa.setContactoCanal(d.contactoCanal());
        empresa.setProximoPaso(d.proximoPaso());
        empresa.setNotas(d.notas());
        empresa.setCargosTipicos(d.cargosTipicos());
        empresa.setCanalPostulacion(d.canalPostulacion());
        if (d.estadoRelacion() != null) {
            empresa.setEstadoRelacion(d.estadoRelacion());
        }
        if (d.fechaPrimerContacto() != null) {
            empresa.setFechaPrimerContacto(d.fechaPrimerContacto());
        }
    }

    private EmpresaResponse aResponse(Empresa e) {
        Integer dias = e.getFechaPrimerContacto() == null ? null
                : (int) ChronoUnit.DAYS.between(e.getFechaPrimerContacto(), LocalDate.now());
        return new EmpresaResponse(
                e.getId(),
                e.getNombre(),
                e.getSector(),
                e.getCiudad(),
                e.getSitioWeb(),
                e.getTelefono(),
                e.getEmail(),
                e.getDireccion(),
                e.getContactoNombre(),
                e.getContactoEmail(),
                e.getContactoCanal(),
                e.getFechaPrimerContacto(),
                e.getEstadoRelacion().name(),
                e.getEstadoRelacion().getEtiqueta(),
                e.getProximoPaso(),
                e.getNotas(),
                e.getCargosTipicos(),
                e.getCanalPostulacion(),
                postulacionRepository.contarParticipantesDe(e.getId(), e.getNombre()),
                postulacionRepository.contarRespuestasDe(e.getId(), e.getNombre()),
                colocacionRepository.contarColocadosEn(e.getId(), e.getNombre()),
                vacanteRepository.countByEmpresaIdAndActivoTrue(e.getId()),
                dias,
                e.isActivo());
    }
}
