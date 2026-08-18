package com.novacrm.excel;

import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.colocacion.ColocacionService;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.empresa.EmpresaService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.excel.libro.HojaLeida;
import com.novacrm.ia.ReconocimientoConIa;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Dos filas del mismo participante en el mismo archivo.
 *
 * <p>Es el caso que se perdía en silencio: la segunda pisaba a la primera —por
 * la regla de «una colocación vigente por estudiante», que es correcta frente a
 * lo ya guardado pero no frente a otra fila del mismo archivo— y el resumen
 * contaba las dos como importadas. La persona acababa con un solo empleo y
 * nadie sabía cuál de los dos se había perdido.
 *
 * <p>La prueba está aquí para que la regla no se «optimice» de vuelta: un
 * {@code HashSet} que no parece hacer nada es exactamente lo que alguien quita.
 */
class ColisionEnElMismoArchivoTest {

    private ImportacionCrmService servicio;
    private ColocacionService colocacionService;
    private ColocacionRepository colocacionRepository;

    private final UUID idEstudiante = UUID.randomUUID();

    @BeforeEach
    void preparar() {
        var estudianteRepository = mock(EstudianteRepository.class);
        colocacionRepository = mock(ColocacionRepository.class);
        colocacionService = mock(ColocacionService.class);

        servicio = new ImportacionCrmService(
                new ColumnMapper(),
                mock(EmpresaRepository.class),
                mock(EmpresaService.class),
                estudianteRepository,
                colocacionRepository,
                colocacionService,
                mock(ReconocimientoConIa.class),
                mock(RegistroDeImportaciones.class),
                mock(PlanesDeImportacion.class));

        var estudiante = new Estudiante();
        estudiante.setNombre("Valentina");
        estudiante.setApellido("Ocampo");
        ponerId(estudiante, idEstudiante);

        // Las dos filas resuelven al mismo participante.
        when(estudianteRepository.findByDocumentoNormalizado(any()))
                .thenReturn(Optional.of(estudiante));
        when(colocacionRepository.findFirstByEstudianteIdAndActivaTrueOrderByFechaInicioDesc(any()))
                .thenReturn(Optional.empty());
    }

    private static void ponerId(Object e, UUID id) {
        try {
            Class<?> c = e.getClass();
            Field f = null;
            while (c != null && f == null) {
                try { f = c.getDeclaredField("id"); }
                catch (NoSuchFieldException ex) { c = c.getSuperclass(); }
            }
            f.setAccessible(true);
            f.set(e, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** Dos filas, mismo documento, empresas distintas. */
    private static HojaLeida dosFilasDelMismo() {
        var columnas = new java.util.LinkedHashMap<String, String>();
        columnas.put("Documento", "documento");
        columnas.put("Empresa", "empresaNombre");
        columnas.put("Cargo", "cargo");
        return new HojaLeida(
                "Colocaciones",
                1,
                columnas,
                List.of(
                        new HojaLeida.Fila(2, Map.of(
                                "documento", "1045882331",
                                "empresaNombre", "Solvo S.A.S.",
                                "cargo", "Asesora bilingue")),
                        new HojaLeida.Fila(3, Map.of(
                                "documento", "1045882331",
                                "empresaNombre", "Teleperformance",
                                "cargo", "Agente"))));
    }

    @Test
    @DisplayName("la segunda fila del mismo participante se avisa, no se pisa en silencio")
    void laSegundaFilaNoPisaALaPrimera() {
        var resultado = servicio.importarColocaciones(dosFilasDelMismo(), false, "coordinador@local.test");

        // Una sola escritura: la primera.
        verify(colocacionService, times(1)).registrar(any(), any());
        verify(colocacionService, never()).actualizar(any(), any(), any());

        assertThat(resultado.creados()).isEqualTo(1);
        assertThat(resultado.errores())
                .as("la fila descartada tiene que decirlo, no desaparecer del resumen")
                .hasSize(1);
        assertThat(resultado.errores().get(0).fila()).isEqualTo(3);
        assertThat(resultado.errores().get(0).motivo())
                .contains("ya aparece en otra fila");
    }

    @Test
    @DisplayName("en simulación tampoco se cuenta dos veces")
    void laSimulacionCuentaLoMismo() {
        var resultado = servicio.importarColocaciones(dosFilasDelMismo(), true, "coordinador@local.test");

        // Si la previsualización dijera «2 creados» y la importación real
        // hiciera 1, la previsualización estaría mintiendo justo sobre el caso
        // que viene a detectar.
        verify(colocacionService, never()).registrar(any(), any());
        assertThat(resultado.creados()).isEqualTo(1);
        assertThat(resultado.errores()).hasSize(1);
    }
}
