package com.novacrm.empresa;

import com.novacrm.auditoria.AuditoriaService;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Unir dos fichas que son la misma empresa.
 *
 * <p>Las duplicadas no llegan por descuido: llegan por el camino normal. El
 * Excel de una feria trae «Manpower Group Colombia», el rastreo de portales
 * registra «ManpowerGroup» y el alta manual escribe «Manpower». Son tres filas
 * y una sola empresa.
 *
 * <p>El daño no es la fila de más. Es que el historial de acercamientos queda
 * repartido: se mira una ficha, se ve «sin contactar», se llama a alguien con
 * quien ya se habló el mes pasado —porque esa conversación está escrita en la
 * otra fila— y la empresa lo nota.
 *
 * <h2>Reglas de la fusión</h2>
 *
 * <ul>
 *   <li><strong>Nada se borra.</strong> La ficha absorbida se desactiva y
 *       conserva su nombre y su rastro; borrarla se llevaría por delante la
 *       auditoría de lo que se hizo con ella.
 *   <li><strong>Nada se pisa.</strong> Los campos de la ficha que se queda solo
 *       se rellenan donde estaban vacíos. Una fusión que sobrescribe obliga a
 *       elegir entre dos datos buenos sin poder ver los dos.
 *   <li><strong>Todo lo que apunta a la absorbida se mueve</strong>: vacantes,
 *       acercamientos, postulaciones, colocaciones y cuentas del portal. Lo que
 *       se quedara atrás desaparecería de la vista sin dejar de existir.
 *   <li><strong>No se puede deshacer</strong>, y por eso la pantalla enseña
 *       antes cuántas filas se van a mover.
 * </ul>
 */
@Service
public class FusionDeEmpresas {

    private static final Logger log = LoggerFactory.getLogger(FusionDeEmpresas.class);

    private final EmpresaRepository empresaRepository;
    private final EntityManager entityManager;
    private final AuditoriaService auditoriaService;

    public FusionDeEmpresas(EmpresaRepository empresaRepository,
                            EntityManager entityManager,
                            AuditoriaService auditoriaService) {
        this.empresaRepository = empresaRepository;
        this.entityManager = entityManager;
        this.auditoriaService = auditoriaService;
    }

    /**
     * Lo que se movería, para poder enseñarlo antes de hacerlo.
     *
     * @param vacantes      ofertas de la ficha absorbida
     * @param acercamientos filas del hilo de contactos
     * @param postulaciones postulaciones registradas contra ella
     * @param colocaciones  contrataciones ya conseguidas
     * @param cuentas       accesos al portal atados a ella
     */
    public record Resumen(long vacantes, long acercamientos, long postulaciones,
                          long colocaciones, long cuentas) {

        public long total() {
            return vacantes + acercamientos + postulaciones + colocaciones + cuentas;
        }
    }

    /** Cuántas filas cuelgan de una ficha. Sin tocar nada. */
    @Transactional(readOnly = true)
    public Resumen queSeMoveria(UUID empresaId) {
        return new Resumen(
                contar("vacante", empresaId),
                contar("contacto_empresa", empresaId),
                contar("postulacion", empresaId),
                contar("colocacion", empresaId),
                contar("usuario", empresaId));
    }

    private long contar(String tabla, UUID empresaId) {
        var valor = entityManager
                .createNativeQuery("SELECT COUNT(*) FROM " + tabla + " WHERE empresa_id = :id")
                .setParameter("id", empresaId)
                .getSingleResult();
        return ((Number) valor).longValue();
    }

    /**
     * Absorbe {@code origenId} dentro de {@code destinoId}.
     *
     * @param destinoId la ficha que se queda
     * @param origenId  la que se absorbe y se desactiva
     * @return lo que se movió
     */
    @Transactional
    public Resumen fusionar(UUID destinoId, UUID origenId) {
        if (destinoId.equals(origenId)) {
            throw new BusinessException("No se puede fusionar una ficha consigo misma");
        }
        Empresa destino = empresaRepository.findById(destinoId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa destino no encontrada"));
        Empresa origen = empresaRepository.findById(origenId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa a fusionar no encontrada"));

        var resumen = queSeMoveria(origenId);

        mover("vacante", destinoId, origenId);
        mover("contacto_empresa", destinoId, origenId);
        mover("postulacion", destinoId, origenId);
        mover("colocacion", destinoId, origenId);
        mover("usuario", destinoId, origenId);

        completarVacios(destino, origen);

        // El nombre de la absorbida se conserva en la nota de la que se queda:
        // sin eso, quien busque «Manpower Group Colombia» dentro de un mes no
        // encuentra nada y vuelve a crear la ficha.
        destino.setNotas(concatenar(destino.getNotas(),
                "Fusionada con la ficha «" + origen.getNombre() + "»."));

        origen.setActivo(false);
        empresaRepository.save(origen);
        empresaRepository.save(destino);

        // El identificador de la absorbida queda en la auditoría: es lo único
        // con lo que se puede reconstruir qué pasó si la fusión fue un error.
        auditoriaService.registrar("Empresas", "Fusion", "Empresa",
                destino.getId().toString(),
                origen.getNombre() + " → " + destino.getNombre(),
                "origen=" + origen.getId() + " (" + resumen.total() + " registros)",
                "destino=" + destino.getId());
        log.info("Empresas fusionadas: {} absorbida por {} ({} registros movidos)",
                origen.getNombre(), destino.getNombre(), resumen.total());
        return resumen;
    }

    private void mover(String tabla, UUID destinoId, UUID origenId) {
        entityManager
                .createNativeQuery("UPDATE " + tabla + " SET empresa_id = :destino WHERE empresa_id = :origen")
                .setParameter("destino", destinoId)
                .setParameter("origen", origenId)
                .executeUpdate();
    }

    /** Rellena de la absorbida solo lo que la que se queda tiene vacío. */
    private static void completarVacios(Empresa destino, Empresa origen) {
        if (vacio(destino.getSector())) destino.setSector(origen.getSector());
        if (vacio(destino.getSitioWeb())) destino.setSitioWeb(origen.getSitioWeb());
        if (vacio(destino.getTelefono())) destino.setTelefono(origen.getTelefono());
        if (vacio(destino.getEmail())) destino.setEmail(origen.getEmail());
        if (vacio(destino.getDireccion())) destino.setDireccion(origen.getDireccion());
        if (vacio(destino.getCiudad())) destino.setCiudad(origen.getCiudad());
        if (vacio(destino.getContactoNombre())) destino.setContactoNombre(origen.getContactoNombre());
        if (vacio(destino.getContactoEmail())) destino.setContactoEmail(origen.getContactoEmail());
        if (vacio(destino.getContactoCanal())) destino.setContactoCanal(origen.getContactoCanal());
        if (vacio(destino.getCargosTipicos())) destino.setCargosTipicos(origen.getCargosTipicos());
        if (vacio(destino.getCanalPostulacion())) destino.setCanalPostulacion(origen.getCanalPostulacion());
        if (vacio(destino.getProximoPaso())) destino.setProximoPaso(origen.getProximoPaso());
        // La fecha del primer contacto se queda con la más antigua de las dos:
        // es cuando empezó la relación de verdad, y la ficha nueva suele traer
        // la del día en que se importó.
        if (destino.getFechaPrimerContacto() == null
                || (origen.getFechaPrimerContacto() != null
                    && origen.getFechaPrimerContacto().isBefore(destino.getFechaPrimerContacto()))) {
            destino.setFechaPrimerContacto(origen.getFechaPrimerContacto());
        }
        // Las notas se suman, no se eligen: son dos textos escritos por
        // personas distintas y ninguno sobra.
        if (!vacio(origen.getNotas())) {
            destino.setNotas(concatenar(destino.getNotas(), origen.getNotas()));
        }
    }

    private static boolean vacio(String v) {
        return v == null || v.isBlank();
    }

    private static String concatenar(String actual, String añadido) {
        if (vacio(actual)) return añadido;
        if (actual.contains(añadido)) return actual;
        return actual + "\n\n" + añadido;
    }

    /**
     * Parejas de fichas activas que parecen la misma empresa.
     *
     * <p>Compara el nombre sin tildes, sin espacios, sin puntuación y sin las
     * coletillas que no distinguen a nadie: «S.A.S.», «Ltda», «Colombia». Así
     * «Gi Group» y «Gi Group Colombia» caen juntas.
     *
     * <p>Es una <strong>sugerencia</strong>, no una decisión. Fusionar
     * automáticamente lo que se parece uniría dos empresas distintas del mismo
     * grupo, y eso no se puede deshacer.
     */
    @Transactional(readOnly = true)
    public List<PosibleDuplicado> posiblesDuplicados() {
        var porClave = new java.util.LinkedHashMap<String, List<Empresa>>();
        for (Empresa e : empresaRepository.findByActivoTrueOrderByNombreAsc()) {
            porClave.computeIfAbsent(clave(e.getNombre()), k -> new java.util.ArrayList<>()).add(e);
        }
        var duplicados = new java.util.ArrayList<PosibleDuplicado>();
        for (var grupo : porClave.values()) {
            if (grupo.size() < 2) continue;
            duplicados.add(new PosibleDuplicado(grupo.stream()
                    .map(e -> new FichaBreve(e.getId(), e.getNombre(),
                            queSeMoveria(e.getId()).total()))
                    .toList()));
        }
        return duplicados;
    }

    public record PosibleDuplicado(List<FichaBreve> fichas) {}

    /** @param registros cuántas filas cuelgan; ayuda a decidir cuál se queda */
    public record FichaBreve(UUID id, String nombre, long registros) {}

    static String clave(String nombre) {
        String limpio = Normalizer.normalize(nombre == null ? "" : nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9 ]", " ");
        // Las coletillas van con límite de palabra: sin él, «SASSAFRAS» perdería
        // su «SAS» inicial y «COLOMBIANA DE X» dejaría de ser lo que es.
        limpio = limpio.replaceAll("\\b(S A S|SAS|S A|SA|LTDA|BIC|COLOMBIA|COLOMBIAS)\\b", " ");
        return limpio.replaceAll("\\s+", "");
    }
}
