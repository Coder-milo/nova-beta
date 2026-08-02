package com.novacrm.excel.libro;

import com.novacrm.catalogo.nivel_ingles.NivelIngles;
import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.estudiante.EstadoHito;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Volcado de la hoja de seguimiento sobre los participantes.
 *
 * <p>Lo importante de esta hoja es que <em>actualiza y no da de alta</em>: no
 * trae correo, y el correo es obligatorio y unico en la ficha.
 */
class ImportacionDeParticipantesTest {

    private EstudianteRepository estudianteRepository;
    private NivelInglesRepository nivelInglesRepository;
    private ImportacionDeParticipantes importacion;
    private Estudiante ana;

    @BeforeEach
    void configurar() {
        ana = new Estudiante();
        ana.setNombre("Ana");
        ana.setApellido("Ruiz Gómez");
        ana.setEmail("ana.ruiz@cac.edu.co");
        ana.setSectorObjetivo("BPO");

        estudianteRepository = mock(EstudianteRepository.class);
        when(estudianteRepository.findAllByActivoTrue()).thenReturn(List.of(ana));

        nivelInglesRepository = mock(NivelInglesRepository.class);
        when(nivelInglesRepository.findByCodigo(anyString())).thenAnswer(inv -> {
            var nivel = new NivelIngles();
            nivel.setCodigo(inv.getArgument(0));
            return Optional.of(nivel);
        });

        importacion = new ImportacionDeParticipantes(estudianteRepository, nivelInglesRepository);
    }

    private static HojaLeida hoja(Map<String, String>... filas) {
        var columnas = new LinkedHashMap<String, String>();
        columnas.put("Nombre completo", "nombreCompleto");
        var leidas = new java.util.ArrayList<HojaLeida.Fila>();
        int n = 4;
        for (Map<String, String> campos : filas) {
            leidas.add(new HojaLeida.Fila(n++, campos));
        }
        return new HojaLeida("Perfiles Empleabilidad", 3, columnas, leidas);
    }

    @Test
    void actualizaAlParticipanteQueYaExiste() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "cargoObjetivo", "Agente bilingüe",
                "competencias", "Zendesk, Excel")), false);

        assertEquals(1, resultado.actualizados());
        assertEquals(0, resultado.creados(), "esta hoja no da de alta a nadie");
        assertEquals("Agente bilingüe", ana.getCargoObjetivo());
        assertEquals("Zendesk, Excel", ana.getCompetencias());
        verify(estudianteRepository).save(ana);
    }

    /**
     * Sin correo no se puede crear: la columna es obligatoria y unica en la
     * ficha, e inventarla romperia el acceso del estudiante y sus avisos.
     */
    @Test
    void unNombreDesconocidoSeInformaEnVezDeCrearlo() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Pedro Gómez")), false);

        assertEquals(0, resultado.creados());
        assertEquals(0, resultado.actualizados());
        assertEquals(1, resultado.errores().size());
        assertTrue(resultado.errores().get(0).motivo().contains("Créalo primero"),
                resultado.errores().get(0).motivo());
        verify(estudianteRepository, never()).save(any());
    }

    @Test
    void enSimulacionNoSeEscribeNada() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "cargoObjetivo", "Agente bilingüe")), true);

        assertEquals(1, resultado.actualizados());
        assertTrue(resultado.simulacion());
        verify(estudianteRepository, never()).save(any());
    }

    /**
     * Los hitos tienen tres estados. Colapsar "En proceso" a No borra trabajo
     * hecho, y a Sí inventa trabajo sin terminar.
     */
    @Test
    void losHitosConservanElEstadoIntermedio() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "cvListo", "Sí",
                "cvEnIngles", "En proceso",
                "linkedinCreado", "No")), false);

        assertEquals(EstadoHito.SI, ana.getPreparacion().getCvListo());
        assertEquals(EstadoHito.EN_PROCESO, ana.getPreparacion().getCvEnIngles());
        assertEquals(EstadoHito.NO, ana.getPreparacion().getLinkedinCreado());
    }

    /** "Sin iniciar" empieza por "si" y significa lo contrario. */
    @Test
    void sinIniciarNoCuentaComoHitoCumplido() {
        ana.getPreparacion().setPerfilOcupacional(EstadoHito.EN_PROCESO);

        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "perfilOcupacional", "Sin iniciar")), false);

        assertEquals(EstadoHito.EN_PROCESO, ana.getPreparacion().getPerfilOcupacional(),
                "un valor que no dice ni sí ni no deja el hito como estaba");
    }

    /** Una celda vacía no borra lo que ya hay: la hoja se llena a ritmos distintos. */
    @Test
    void unaCeldaVaciaNoBorraLoQueYaEstaba() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "sectorObjetivo", "")), false);

        assertEquals("BPO", ana.getSectorObjetivo());
    }

    @Test
    void laEdadSeGuardaConLaFechaEnQueSeCapturo() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "edad", "24")), false);

        assertEquals(24, ana.getEdadAlRegistrar());
        assertNotNull(ana.getFechaCapturaEdad(),
                "una edad suelta caduca: sin la fecha no se puede envejecer");
    }

    /**
     * El caso que tumbaba la importación entera: en el libro real "Carrera /
     * Título" llega a 1115 caracteres contra una columna que era varchar(255).
     * Ahora es TEXT y se guarda completo.
     */
    @Test
    void losCamposDeTextoLibreSeGuardanCompletos() {
        String parrafo = "Comunicadora social y periodista. ".repeat(40);

        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "areaFormacion", parrafo,
                "cargoObjetivo", parrafo)), false);

        // El lector de celdas recorta los espacios de los extremos.
        assertEquals(parrafo.trim(), ana.getAreaFormacion(),
                "1115 caracteres en «Carrera / Título» no son un error del archivo");
        assertEquals(parrafo.trim(), ana.getCargoObjetivo());
        assertTrue(ana.getAreaFormacion().length() > 1000);
    }

    /**
     * Los que siguen siendo varchar(255) se recortan en vez de reventar el
     * UPDATE: perder la cola de un texto es mejor que perder las 107 filas.
     */
    @Test
    void losCamposCortosSeRecortanEnVezDeTumbarLaImportacion() {
        var resultado = importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "sectorExperiencia", "Atención al cliente ".repeat(40))), false);

        assertEquals(1, resultado.actualizados());
        assertEquals(0, resultado.errores().size());
        assertTrue(ana.getSectorExperiencia().length() <= 255,
                "quedó en " + ana.getSectorExperiencia().length());
    }

    /** Excel entrega los enteros como "24.0" cuando la celda es numérica. */
    @Test
    void leeLaEdadAunqueVengaComoDecimalDeExcel() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "edad", "24.0")), false);

        assertEquals(24, ana.getEdadAlRegistrar(), "el punto no es separador de miles aquí");
    }

    @Test
    void elNivelDeInglesSaleDelTextoLargoDelFormulario() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "nivelIngles", "B1 (Puedo comunicarme en situaciones sencillas)")), false);

        assertNotNull(ana.getNivelIngles());
        assertEquals("B1", ana.getNivelIngles().getCodigo());
    }

    /** "No estoy seguro/a" no es un nivel y no debe pisar el ya registrado. */
    @Test
    void noEstoySeguroNoBorraElNivelRegistrado() {
        var previo = new NivelIngles();
        previo.setCodigo("B2");
        ana.setNivelIngles(previo);

        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "nivelIngles", "No estoy seguro/a")), false);

        assertEquals("B2", ana.getNivelIngles().getCodigo());
    }

    @Test
    void elTiempoDeExperienciaLlegaComoRangoYSeTomaElExtremoInferior() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "tiempoExperiencia", "No tengo experiencia laboral aún")), false);
        assertEquals(0, ana.getAniosExperiencia());

        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "tiempoExperiencia", "Entre 1 y 2 años")), false);
        assertEquals(1, ana.getAniosExperiencia());

        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "tiempoExperiencia", "Más de 2 años")), false);
        assertEquals(3, ana.getAniosExperiencia());
    }

    /** "Sin iniciar" no dice que la persona dejó de buscar: dice que nadie anotó. */
    @Test
    void soloSeMueveElEstadoDeEmpleabilidadCuandoLaHojaDiceAlgo() {
        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "estadoEmpleabilidad", "Sin iniciar")), false);
        assertEquals(EstadoEmpleabilidad.SIN_INFO, ana.getEstadoEmpleabilidad());

        importacion.importar(hoja(Map.of(
                "nombreCompleto", "Ana Ruiz Gómez",
                "estadoEmpleabilidad", "Empleado")), false);
        assertEquals(EstadoEmpleabilidad.EMPLEADO, ana.getEstadoEmpleabilidad());
    }
}
