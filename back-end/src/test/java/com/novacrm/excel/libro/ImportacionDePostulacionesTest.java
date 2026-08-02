package com.novacrm.excel.libro;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.postulacion.EstadoPostulacion;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.postulacion.PostulacionService;
import com.novacrm.postulacion.dto.PostulacionDtos.CrearPostulacion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Carga de la hoja de postulaciones, que no tenia importador.
 *
 * <p>El equipo la llevaba entera en Excel mientras el modulo de postulaciones
 * del CRM estaba vacio, asi que el tablero de empleabilidad no veia ni una.
 */
class ImportacionDePostulacionesTest {

    private PostulacionRepository postulacionRepository;
    private PostulacionService postulacionService;
    private ImportacionDePostulaciones importacion;
    private Estudiante ana;

    @BeforeEach
    void configurar() {
        ana = new Estudiante();
        ana.setNombre("Ana");
        ana.setApellido("Ruiz Gómez");

        var estudianteRepository = mock(EstudianteRepository.class);
        when(estudianteRepository.findAllByActivoTrue()).thenReturn(List.of(ana));

        postulacionRepository = mock(PostulacionRepository.class);
        when(postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(any()))
                .thenReturn(List.of());
        postulacionService = mock(PostulacionService.class);

        importacion = new ImportacionDePostulaciones(
                estudianteRepository, postulacionRepository, postulacionService);
    }

    @SafeVarargs
    private static HojaLeida hoja(Map<String, String>... filas) {
        var columnas = new LinkedHashMap<String, String>();
        columnas.put("Nombre Completo", "nombreCompleto");
        columnas.put("Empresa", "empresaNombre");
        var leidas = new java.util.ArrayList<HojaLeida.Fila>();
        int n = 5;
        for (Map<String, String> campos : filas) {
            leidas.add(new HojaLeida.Fila(n++, campos));
        }
        return new HojaLeida("Seguimiento Postulaciones", 3, columnas, leidas);
    }

    private CrearPostulacion capturarAlta() {
        var captor = ArgumentCaptor.forClass(CrearPostulacion.class);
        verify(postulacionService).crear(any(), captor.capture(), anyString(), anyBoolean());
        return captor.getValue();
    }

    @Test
    void creaLaPostulacionDeUnaFilaDeLaHoja() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Freight Coordinator bilingüe",
                "canal", "LinkedIn",
                "fechaPostulacion", "2026-07-15",
                "estado", "Enviado")), false, "coordinador@cac.edu.co");

        assertEquals(1, resultado.creados());
        var alta = capturarAlta();
        assertEquals("Solvo Global", alta.empresaNombre());
        assertEquals("Freight Coordinator bilingüe", alta.cargo());
        assertEquals(LocalDate.of(2026, 7, 15), alta.fechaPostulacion());
    }

    /** La hoja escribe el estado en masculino. */
    @Test
    void entiendeEnviadoEnMasculino() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Agente",
                "estado", "Enviado")), false, "equipo");

        assertEquals(EstadoPostulacion.ENVIADA, capturarAlta().estado());
    }

    /** A veces solo se anota el resultado y el estado queda en blanco. */
    @Test
    void siNoHayEstadoSeMiraElResultado() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Agente",
                "resultado", "Rechazado")), false, "equipo");

        assertEquals(EstadoPostulacion.RECHAZADO, capturarAlta().estado());
    }

    /**
     * La respuesta de la empresa no tiene campo propio en el alta. Se conserva
     * en las observaciones: es la única traza de que hubo contestación.
     */
    @Test
    void conservaLaRespuestaDeLaEmpresaEnLasObservaciones() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Agente",
                "observaciones", "Primera postulación",
                "resultado", "En entrevista",
                "fechaRespuesta", "2026-07-20")), false, "equipo");

        String observaciones = capturarAlta().observaciones();
        assertTrue(observaciones.contains("Primera postulación"), observaciones);
        assertTrue(observaciones.contains("En entrevista"), observaciones);
        assertTrue(observaciones.contains("2026-07-20"), observaciones);
    }

    /**
     * Reimportar el mismo libro es lo normal: se actualiza y se vuelve a subir.
     * Sin esto cada carga duplicaría todas las postulaciones.
     */
    @Test
    void noDuplicaUnaPostulacionYaRegistrada() {
        var yaExiste = new Postulacion();
        yaExiste.setEstudiante(ana);
        yaExiste.setEmpresaNombre("Solvo Global");
        yaExiste.setCargo("Freight Coordinator bilingüe");
        when(postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(ana.getId()))
                .thenReturn(List.of(yaExiste));

        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "solvo global",
                "cargo", "FREIGHT COORDINATOR BILINGÜE")), false, "equipo");

        assertEquals(0, resultado.creados());
        assertEquals(1, resultado.omitidos());
        verify(postulacionService, never()).crear(any(), any(), anyString(), anyBoolean());
    }

    @Test
    void noDuplicaDentroDelMismoArchivo() {
        var fila = Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Agente");

        var resultado = importacion.importar(hoja(fila, fila), false, "equipo");

        assertEquals(1, resultado.creados());
        assertEquals(1, resultado.omitidos());
    }

    @Test
    void unaFilaSinEmpresaSeReportaComoError() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "cargo", "Agente")), false, "equipo");

        assertEquals(1, resultado.errores().size());
        assertEquals("Sin empresa", resultado.errores().get(0).motivo());
    }

    @Test
    void unParticipanteDesconocidoSeReportaConSuFila() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Pedro Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Agente")), false, "equipo");

        assertEquals(0, resultado.creados());
        assertEquals(5, resultado.errores().get(0).fila(),
                "el número de fila debe ser el que se ve en Excel");
    }

    /** El acercamiento sin vacante concreta no debe perder la fila. */
    @Test
    void unaFilaSinCargoSeAnotaIgual() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global")), false, "equipo");

        assertEquals(1, resultado.creados());
        assertEquals("Sin cargo especificado", capturarAlta().cargo());
    }

    @Test
    void enSimulacionNoSeEscribeNada() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Agente")), true, "equipo");

        assertEquals(1, resultado.creados());
        verify(postulacionService, never()).crear(any(), any(), anyString(), anyBoolean());
    }

    /** Quien gestionó el acercamiento lo dice la hoja; si no, quien carga. */
    @Test
    void elGestorSaleDeLaHojaSiLaHojaLoDice() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "empresaNombre", "Solvo Global",
                "cargo", "Agente",
                "gestionadoPor", "Equipo NOVA")), false, "coordinador@cac.edu.co");

        verify(postulacionService).crear(any(), any(), eq("Equipo NOVA"), anyBoolean());
    }
}
