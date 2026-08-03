package com.novacrm.configuracion;

import com.novacrm.config.MatchingConfig;
import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * La configuracion de la instalacion se guarda en el servidor y manda de verdad.
 *
 * <p>Vivia en {@code localStorage}: cada navegador tenia su propia version de
 * los datos de la institucion. Y el umbral de match era peor que eso —la
 * pantalla lo ofrecia y arrancaba en 70 mientras el motor cortaba por el 55 del
 * YAML—, asi que quien lo subia a 80 seguia recibiendo exactamente los mismos
 * matches sin nada que se lo advirtiera.
 */
class ConfiguracionGlobalTest {

    private ConfiguracionRepository repositorio;
    private ConfiguracionService servicio;

    @BeforeEach
    void configurar() {
        repositorio = mock(ConfiguracionRepository.class);

        // Sin leer el YAML de verdad: lo que importa aqui es que el valor de
        // partida sale de MatchingConfig, no cual es hoy ese valor.
        var matchingConfig = new MatchingConfig();
        ReflectionTestUtils.setField(matchingConfig, "umbralMinimo", 55);

        servicio = new ConfiguracionService(repositorio, matchingConfig);
    }

    private static ConfiguracionRequest peticionVacia() {
        return new ConfiguracionRequest(null, null, null, null, null, null, null,
                null, null, null, null, null, null, null);
    }

    @Test
    void sinFilaDevuelveLosValoresPorDefectoYNoDiceQueEstaGuardado() {
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA)).thenReturn(Optional.empty());

        var respuesta = servicio.obtener();

        assertFalse(respuesta.guardado());
        assertEquals(55, respuesta.umbralMatchMinimo());
        assertEquals(ConfiguracionService.DIAS_RETENCION_POR_DEFECTO,
                respuesta.diasRetencionPapelera());
        // Ni NIT ni resolucion de ejemplo: nadie los ha escrito.
        assertNull(respuesta.nombreOficial());
        assertNull(respuesta.nit());
    }

    /**
     * El umbral que se enseña es el que corta de verdad. La pantalla arrancaba
     * en 70 sin que nada en el sistema usara ese numero.
     */
    @Test
    void elUmbralPorDefectoEsElDelMotorNoUnoInventado() {
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA)).thenReturn(Optional.empty());

        assertEquals(55, servicio.umbralDeMatch());
        assertEquals(55, servicio.obtener().umbralPorDefecto());
    }

    @Test
    void elUmbralGuardadoGanaAlDelYaml() {
        var fila = new ConfiguracionGlobal();
        fila.setUmbralMatchMinimo(80);
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA)).thenReturn(Optional.of(fila));

        assertEquals(80, servicio.umbralDeMatch());
    }

    /** Columna a null en una fila que si existe: sigue mandando el YAML. */
    @Test
    void unaFilaSinUmbralCaeAlValorDelYaml() {
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA))
                .thenReturn(Optional.of(new ConfiguracionGlobal()));

        assertEquals(55, servicio.umbralDeMatch());
    }

    @Test
    void losDiasDeRetencionGuardadosGananAlos30DeSiempre() {
        var fila = new ConfiguracionGlobal();
        fila.setDiasRetencionPapelera(90);
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA)).thenReturn(Optional.of(fila));

        assertEquals(90, servicio.diasRetencionPapelera());
    }

    /**
     * El segundo guardado actualiza la fila que ya existe. Si insertara otra,
     * habria dos configuraciones y ninguna forma de saber cual gana —y la
     * restriccion {@code id = 1} de la tabla rechazaria la insercion—.
     */
    @Test
    void elSegundoGuardadoActualizaLaFilaNoCreaOtra() {
        var existente = new ConfiguracionGlobal();
        existente.setNombreOficial("Nombre viejo");
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA))
                .thenReturn(Optional.of(existente));

        servicio.guardar(new ConfiguracionRequest("Nombre nuevo", null, null, null, null,
                null, null, null, null, null, null, null, null, null));

        var guardada = ArgumentCaptor.forClass(ConfiguracionGlobal.class);
        verify(repositorio).save(guardada.capture());
        assertSame(existente, guardada.getValue());
        assertEquals("Nombre nuevo", guardada.getValue().getNombreOficial());
        assertEquals(ConfiguracionGlobal.FILA_UNICA, guardada.getValue().getId());
    }

    @Test
    void elPrimerGuardadoCreaLaFilaConElIdFijo() {
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA)).thenReturn(Optional.empty());

        servicio.guardar(peticionVacia());

        var guardada = ArgumentCaptor.forClass(ConfiguracionGlobal.class);
        verify(repositorio).save(guardada.capture());
        assertEquals(ConfiguracionGlobal.FILA_UNICA, guardada.getValue().getId());
    }

    /** Una cadena vacia y un null significan lo mismo; se guarda una sola forma. */
    @Test
    void losCamposEnBlancoSeGuardanComoNulo() {
        when(repositorio.findById(ConfiguracionGlobal.FILA_UNICA)).thenReturn(Optional.empty());

        servicio.guardar(new ConfiguracionRequest("  ", "", null, null, null, null, null,
                null, null, null, null, "   ", null, null));

        var guardada = ArgumentCaptor.forClass(ConfiguracionGlobal.class);
        verify(repositorio).save(guardada.capture());
        assertNull(guardada.getValue().getNombreOficial());
        assertNull(guardada.getValue().getNit());
        assertNull(guardada.getValue().getCohorteActiva());
    }

    @Test
    void unUmbralFueraDeRangoNoSeGuarda() {
        var peticion = new ConfiguracionRequest(null, null, null, null, null, null, null,
                null, null, null, null, null, 140, null);

        assertThrows(BusinessException.class, () -> servicio.guardar(peticion));
        verify(repositorio, never()).save(any());
    }

    @Test
    void unaRetencionDeCeroDiasNoSeGuarda() {
        var peticion = new ConfiguracionRequest(null, null, null, null, null, null, null,
                null, null, null, null, null, null, 0);

        assertThrows(BusinessException.class, () -> servicio.guardar(peticion));
        verify(repositorio, never()).save(any());
    }

    /**
     * Todos los motivos de rechazo en el mismo mensaje: uno por viaje obliga a
     * guardar, corregir y volver a guardar tantas veces como errores haya.
     */
    @Test
    void losDosErroresSalenJuntos() {
        var peticion = new ConfiguracionRequest(null, null, null, null, null, null, null,
                null, null, null, null, null, 140, 0);

        var error = assertThrows(BusinessException.class, () -> servicio.guardar(peticion));

        assertTrue(error.getMessage().contains("umbral"), error.getMessage());
        assertTrue(error.getMessage().contains("retencion"), error.getMessage());
    }
}
