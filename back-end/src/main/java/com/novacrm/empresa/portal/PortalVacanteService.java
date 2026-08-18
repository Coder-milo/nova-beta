package com.novacrm.empresa.portal;

import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.vacante.MotivoCierre;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Las vacantes vistas desde el lado de la empresa.
 *
 * <p>Todo lo que entra por aqui nace <strong>sin revisar</strong>. Es la misma
 * regla que ya se aplicaba a las vacantes que registra un estudiante, y por el
 * mismo motivo, escrito en {@code Vacante.revisada}: una oferta sin mirar que
 * entra al matching es el camino por el que una estafa de empleo llega a toda
 * una cohorte. Que ahora quien publique sea una empresa registrada no cambia
 * nada — registrarse es barato y el dano es el mismo.
 */
@Service
public class PortalVacanteService {

    private final VacanteRepository vacanteRepository;
    private final EmpresaRepository empresaRepository;
    private final AccesoDelPortal acceso;

    public PortalVacanteService(VacanteRepository vacanteRepository,
                                EmpresaRepository empresaRepository,
                                AccesoDelPortal acceso) {
        this.vacanteRepository = vacanteRepository;
        this.empresaRepository = empresaRepository;
        this.acceso = acceso;
    }

    /** Lo que la empresa manda al crear o editar. Sin campos de moderacion. */
    public record DatosDeVacante(
            String titulo,
            String descripcion,
            String requisitos,
            String ciudad,
            String modalidadTrabajo,
            String tipoContrato,
            String jornada,
            String rangoSalarial,
            String nivelInglesRequerido,
            Integer aniosExperienciaRequeridos,
            LocalDateTime fechaExpiracion) {}

    public record VacanteDelPortal(
            UUID id,
            String titulo,
            String descripcion,
            String requisitos,
            String ciudad,
            String modalidadTrabajo,
            String tipoContrato,
            String jornada,
            String rangoSalarial,
            String nivelInglesRequerido,
            Integer aniosExperienciaRequeridos,
            LocalDateTime fechaPublicacion,
            LocalDateTime fechaExpiracion,
            /** BORRADOR · EN_REVISION · RECHAZADA · PUBLICADA · CERRADA */
            String estado,
            /**
             * Lo que el equipo dijo al rechazarla.
             *
             * <p>Es la razon de que RECHAZADA exista como estado separado de
             * CERRADA: la empresa lee que hay que corregir, lo corrige y la
             * reenvia sin volver a escribirla entera.
             */
            String motivoRechazo,
            /** Cuantas personas se han postulado. Cero mientras no este publicada. */
            long postulantes) {}

    @Transactional(readOnly = true)
    public List<VacanteDelPortal> mias(UUID empresaId) {
        return vacanteRepository.findByEmpresaIdOrderByCreatedAtDesc(empresaId)
                .stream()
                .map(this::aRespuesta)
                .toList();
    }

    @Transactional
    public VacanteDelPortal crear(UUID empresaId, DatosDeVacante datos, boolean comoBorrador, String autor) {
        Empresa empresa = empresaRepository.findById(empresaId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        validar(datos, comoBorrador);

        var vacante = new Vacante();
        // La empresa se toma de la sesion, nunca de lo que llega en el cuerpo:
        // aceptarla del payload permitiria publicar en nombre de otra.
        vacante.setEmpresa(empresa);
        vacante.setCreadaPor(autor);
        vacante.setFuente("PORTAL_EMPRESA");
        vacante.setActivo(true);
        vacante.setBorrador(comoBorrador);
        vacante.setRevisada(false);
        aplicar(vacante, datos);

        return aRespuesta(vacanteRepository.save(vacante));
    }

    /**
     * Edita una vacante propia.
     *
     * <p>Si ya estaba publicada, la edicion <strong>la devuelve a revision</strong>.
     * Sin eso, la moderacion no serviria de nada: bastaria con publicar un texto
     * limpio, esperar la aprobacion y cambiarlo despues por cualquier otra cosa.
     */
    @Transactional
    public VacanteDelPortal editar(UUID vacanteId, UUID empresaId, DatosDeVacante datos, boolean enviar) {
        Vacante vacante = acceso.exigirVacantePropia(vacanteId, empresaId);

        if (!vacante.isActivo()) {
            throw new BusinessException("La vacante esta cerrada; abre una nueva");
        }

        boolean estabaPublicada = vacante.isRevisada() && !vacante.isBorrador();
        boolean quedaComoBorrador = vacante.isBorrador() && !enviar;

        validar(datos, quedaComoBorrador);
        aplicar(vacante, datos);
        vacante.setBorrador(quedaComoBorrador);

        // Corregir lo que el equipo señaló borra el señalamiento. Si no, la
        // empresa reenvía la corrección y sigue viendo el reproche anterior
        // encima de un texto que ya no dice eso.
        if (!quedaComoBorrador) {
            vacante.olvidarRechazo();
        }

        if (estabaPublicada) {
            vacante.setRevisada(false);
            vacante.setFechaPublicacion(null);
        }

        return aRespuesta(vacanteRepository.save(vacante));
    }

    /** Saca el borrador de la gaveta y lo manda a la cola del equipo. */
    @Transactional
    public VacanteDelPortal enviarARevision(UUID vacanteId, UUID empresaId) {
        Vacante vacante = acceso.exigirVacantePropia(vacanteId, empresaId);
        if (!vacante.isBorrador()) {
            throw new BusinessException("Esta vacante ya no es un borrador");
        }
        exigirCompleta(vacante);
        vacante.setBorrador(false);
        vacante.setRevisada(false);
        vacante.olvidarRechazo();
        return aRespuesta(vacanteRepository.save(vacante));
    }

    /**
     * La empresa cierra su propia vacante.
     *
     * <p>No la borra: una vacante con postulaciones detras es el contexto de
     * esas postulaciones, y borrarla dejaria a cada estudiante con un proceso
     * que apunta a la nada.
     */
    @Transactional
    public VacanteDelPortal cerrar(UUID vacanteId, UUID empresaId, MotivoCierre motivo) {
        Vacante vacante = acceso.exigirVacantePropia(vacanteId, empresaId);
        if (!vacante.isActivo()) {
            return aRespuesta(vacante);
        }
        // Sin motivo declarado se asume RETIRADA y no CUBIERTA. Suponer que se
        // cubrio inflaria las cifras de colocacion con puestos que quiza nadie
        // ocupo, y esas cifras son las que se reportan al cierre de cohorte.
        vacante.cerrar(motivo == null ? MotivoCierre.RETIRADA : motivo, LocalDateTime.now());
        return aRespuesta(vacanteRepository.save(vacante));
    }

    // ── Interno ─────────────────────────────────────────────────────────────

    /**
     * Un borrador puede estar a medias; lo que se envia, no.
     *
     * <p>Es la razon de que exista el borrador: sin el, o se exige todo desde el
     * primer guardado —y no se puede dejar a medias— o no se exige nunca y el
     * equipo revisa fichas incompletas.
     */
    private static void validar(DatosDeVacante datos, boolean esBorrador) {
        if (datos.titulo() == null || datos.titulo().isBlank()) {
            throw new BusinessException("La vacante necesita al menos un titulo");
        }
        if (esBorrador) {
            return;
        }
        if (datos.descripcion() == null || datos.descripcion().isBlank()) {
            throw new BusinessException("Falta la descripcion del puesto");
        }
        if (datos.ciudad() == null || datos.ciudad().isBlank()) {
            throw new BusinessException("Falta la ciudad");
        }
        if (datos.fechaExpiracion() != null && datos.fechaExpiracion().isBefore(LocalDateTime.now())) {
            throw new BusinessException("La fecha de cierre ya paso");
        }
    }

    private static void exigirCompleta(Vacante v) {
        if (v.getDescripcion() == null || v.getDescripcion().isBlank()) {
            throw new BusinessException("Falta la descripcion del puesto");
        }
        if (v.getCiudad() == null || v.getCiudad().isBlank()) {
            throw new BusinessException("Falta la ciudad");
        }
    }

    private static void aplicar(Vacante v, DatosDeVacante d) {
        v.setTitulo(d.titulo().trim());
        v.setDescripcion(d.descripcion());
        v.setRequisitos(d.requisitos());
        v.setCiudad(d.ciudad());
        v.setUbicacion(d.ciudad());
        v.setModalidadTrabajo(d.modalidadTrabajo());
        v.setTipoContrato(d.tipoContrato());
        v.setJornada(d.jornada());
        v.setRangoSalarial(d.rangoSalarial());
        v.setNivelInglesRequerido(d.nivelInglesRequerido());
        v.setAniosExperienciaRequeridos(d.aniosExperienciaRequeridos());
        v.setFechaExpiracion(d.fechaExpiracion());
    }

    private VacanteDelPortal aRespuesta(Vacante v) {
        return new VacanteDelPortal(
                v.getId(),
                v.getTitulo(),
                v.getDescripcion(),
                v.getRequisitos(),
                v.getCiudad(),
                v.getModalidadTrabajo(),
                v.getTipoContrato(),
                v.getJornada(),
                v.getRangoSalarial(),
                v.getNivelInglesRequerido(),
                v.getAniosExperienciaRequeridos(),
                v.getFechaPublicacion(),
                v.getFechaExpiracion(),
                v.estadoDePublicacion(),
                v.getMotivoRechazo(),
                v.getId() == null ? 0 : vacanteRepository.contarPostulacionesDe(v.getId()));
    }
}
