package com.novacrm.scraper.fuente;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Guardian del cupo mensual de las fuentes de pago por uso.
 *
 * <p>Se consulta antes de cada peticion, no despues: gastar la ultima y
 * enterarse luego deja el resto del mes sin vacantes del unico sitio que
 * publica plazas colombianas.
 */
@Service
public class ControlDeCuota {

    private static final Logger log = LoggerFactory.getLogger(ControlDeCuota.class);

    private final CuotaFuenteRepository repositorio;

    public ControlDeCuota(CuotaFuenteRepository repositorio) {
        this.repositorio = repositorio;
    }

    /**
     * Reserva una peticion para la fuente, si queda cupo este mes.
     *
     * <p>En transaccion propia para que el contador quede firme aunque la
     * corrida que la pidio falle despues: la peticion al proveedor ya se hizo y
     * ya la cobro, asi que devolverla al cupo seria mentirse.
     *
     * @return true si se puede llamar al proveedor
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean intentarConsumir(String fuente, int limiteMensual) {
        String periodo = CuotaFuente.periodoDe(LocalDate.now());
        var cuota = repositorio.findByFuenteAndPeriodo(fuente, periodo)
                .orElseGet(() -> repositorio.save(new CuotaFuente(fuente, periodo, limiteMensual)));

        // El limite puede cambiar al subir de plan; manda la configuracion.
        if (cuota.getLimite() != limiteMensual) {
            cuota.setLimite(limiteMensual);
            repositorio.save(cuota);
        }

        boolean hayCupo = repositorio.consumirUna(fuente, periodo) == 1;
        if (!hayCupo) {
            log.warn("Cupo de {} agotado para {} ({} peticiones)", fuente, periodo, limiteMensual);
        }
        return hayCupo;
    }

    /** Cuantas peticiones quedan este mes; el limite entero si aun no hay registro. */
    @Transactional(readOnly = true)
    public int restantes(String fuente, int limiteMensual) {
        return repositorio.findByFuenteAndPeriodo(fuente, CuotaFuente.periodoDe(LocalDate.now()))
                .map(CuotaFuente::getRestantes)
                .orElse(limiteMensual);
    }
}
