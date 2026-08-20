package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Escribe una versión de HV en una transacción independiente.
 *
 * <p>La generación masiva debe poder informar que un estudiante falló y
 * continuar con el siguiente. Si todas las versiones comparten una sola
 * transacción, el primer error de PostgreSQL la deja abortada y el lote
 * termina en {@code UnexpectedRollbackException}, aunque el bucle capture la
 * excepción. REQUIRES_NEW limita el fallo al estudiante correspondiente.</p>
 */
@Service
public class HvVersionService {

    private final HojaDeVidaRepository hvRepository;

    public HvVersionService(HojaDeVidaRepository hvRepository) {
        this.hvRepository = hvRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public HojaDeVida registrar(Estudiante estudiante, PlantillaHv plantilla,
                                String objectKey, String generadaPor) {
        var versiones = hvRepository.findVersionesForUpdate(estudiante.getId());
        int siguienteVersion = versiones.stream().findFirst()
                .map(h -> h.getNumeroVersion() + 1).orElse(1);

        boolean habiaActual = false;
        for (var version : versiones) {
            if (version.isActual()) {
                version.setActual(false);
                habiaActual = true;
            }
        }

        // La restricción parcial uq_hv_estudiante_actual solo admite una fila
        // vigente. Se fuerza primero el UPDATE de la anterior; sin este flush,
        // Hibernate podía ejecutar el INSERT antes y PostgreSQL devolvía 23505.
        if (habiaActual) {
            hvRepository.flush();
        }

        var hv = new HojaDeVida();
        hv.setEstudiante(estudiante);
        hv.setPlantilla(plantilla);
        hv.setNumeroVersion(siguienteVersion);
        hv.setObjectKey(objectKey);
        hv.setActual(true);
        hv.setGeneradaPor(generadaPor);
        return hvRepository.saveAndFlush(hv);
    }
}
