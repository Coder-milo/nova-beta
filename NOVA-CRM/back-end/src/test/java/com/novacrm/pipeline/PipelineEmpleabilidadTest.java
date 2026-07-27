package com.novacrm.pipeline;

import com.novacrm.pipeline.PipelineEmpleabilidadService.Hechos;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Deduccion de la etapa del embudo a partir de hechos del sistema.
 *
 * <p>La deduccion es una funcion pura, asi que se ejercita sin base de datos ni
 * mocks: mismos hechos, mismo resultado.
 */
class PipelineEmpleabilidadTest {

    private static final UUID ID = UUID.randomUUID();

    private PipelineEmpleabilidad calcular(Hechos hechos) {
        return PipelineEmpleabilidadService.construir(ID, "Ana Perez", hechos);
    }

    private Hechos hechos(boolean hv, boolean linkedin, boolean simulacro,
                          long postulaciones, long empresas, boolean empleado) {
        return new Hechos(hv, linkedin, simulacro, postulaciones, empresas, empleado);
    }

    @Test
    void sinHojaDeVidaEstaSinPerfil() {
        var p = calcular(hechos(false, false, false, 0, 0, false));

        assertEquals(EtapaEmpleabilidad.SIN_PERFIL, p.etapa());
        assertEquals(0, p.porcentajeAvance());
        assertEquals(3, p.pendientes().size());
    }

    @Test
    void conHojaDeVidaPeroSinPreparacionEstaPerfilListo() {
        var p = calcular(hechos(true, false, false, 0, 0, false));

        assertEquals(EtapaEmpleabilidad.PERFIL_LISTO, p.etapa());
        assertEquals(33, p.porcentajeAvance());
        assertTrue(p.pendientes().contains("Optimizar el perfil de LinkedIn"));
        assertTrue(p.pendientes().contains("Realizar el simulacro de entrevista"));
        assertFalse(p.pendientes().contains("Generar la hoja de vida"));
    }

    @Test
    void conLosTresHitosEstaPreparado() {
        var p = calcular(hechos(true, true, true, 0, 0, false));

        assertEquals(EtapaEmpleabilidad.PREPARADO, p.etapa());
        assertEquals(100, p.porcentajeAvance());
        assertTrue(p.pendientes().isEmpty());
    }

    @Test
    void conPostulacionesEstaPostulando() {
        var p = calcular(hechos(true, true, true, 5, 3, false));

        assertEquals(EtapaEmpleabilidad.POSTULANDO, p.etapa());
        assertEquals(5, p.postulacionesEnviadas());
        assertEquals(3, p.empresasContactadas());
    }

    @Test
    void empleadoEstaColocado() {
        var p = calcular(hechos(true, true, true, 8, 4, true));

        assertEquals(EtapaEmpleabilidad.COLOCADO, p.etapa());
        assertEquals(100, p.porcentajeAvance());
    }

    /**
     * Un estudiante ya colocado no debe retroceder de etapa porque falte
     * registrar un hito de preparacion: el resultado final manda sobre el
     * proceso.
     */
    @Test
    void elColocadoNoRetrocedeAunqueFaltenHitos() {
        var p = calcular(hechos(false, false, false, 0, 0, true));

        assertEquals(EtapaEmpleabilidad.COLOCADO, p.etapa());
        assertEquals(100, p.porcentajeAvance(),
                "estar colocado es el objetivo del embudo, no un avance parcial");
    }

    /**
     * Si hay postulaciones enviadas la etapa es POSTULANDO aunque no se haya
     * registrado el simulacro: la postulacion es un hecho mas fuerte.
     */
    @Test
    void lasPostulacionesPesanMasQueLosHitosDePreparacion() {
        var p = calcular(hechos(true, false, false, 2, 1, false));

        assertEquals(EtapaEmpleabilidad.POSTULANDO, p.etapa());
        assertEquals(33, p.porcentajeAvance(),
                "el avance de preparacion sigue reflejando lo que falta");
        assertFalse(p.pendientes().isEmpty());
    }

    @Test
    void cadaEtapaIndicaLaProximaAccion() {
        for (var etapa : EtapaEmpleabilidad.values()) {
            assertNotNull(etapa.getProximaAccion());
            assertFalse(etapa.getProximaAccion().isBlank(),
                    () -> "la etapa " + etapa + " debe decir que hacer a continuacion");
        }
    }

    @Test
    void laProximaAccionCorrespondeALaEtapaDeducida() {
        var p = calcular(hechos(false, false, false, 0, 0, false));

        assertEquals(EtapaEmpleabilidad.SIN_PERFIL.getProximaAccion(), p.proximaAccion());
    }

    /** El modelo es de solo lectura: la lista de pendientes no debe mutarse. */
    @Test
    void losPendientesSonInmutables() {
        var p = calcular(hechos(false, false, false, 0, 0, false));

        assertThrows(UnsupportedOperationException.class, () -> p.pendientes().add("otra cosa"));
    }
}
