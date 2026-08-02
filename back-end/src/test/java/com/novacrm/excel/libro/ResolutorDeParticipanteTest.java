package com.novacrm.excel.libro;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Identificacion del participante por nombre.
 *
 * <p>Las tres hojas de participantes del libro de seguimiento no traen correo
 * ni documento: identifican a la persona por su nombre completo y un numero de
 * orden. Los importadores solo sabian buscar por correo o documento, asi que
 * exigian una columna que el archivo real no tiene.
 *
 * <p>Buscar por nombre es menos fiable, y por eso lo que importa de estas
 * pruebas es lo que <em>no</em> hace: no adivinar.
 */
class ResolutorDeParticipanteTest {

    private static Estudiante participante(String nombre, String apellido) {
        var e = new Estudiante();
        e.setNombre(nombre);
        e.setApellido(apellido);
        return e;
    }

    private static ResolutorDeParticipante con(Estudiante... activos) {
        var repo = mock(EstudianteRepository.class);
        when(repo.findAllByActivoTrue()).thenReturn(List.of(activos));
        return new ResolutorDeParticipante(repo);
    }

    @Test
    void encuentraPorNombreYApellido() {
        var ana = participante("Ana", "Ruiz Gómez");
        var resultado = con(ana).buscar("Ana Ruiz Gómez");

        assertInstanceOf(ResolutorDeParticipante.Resultado.Encontrado.class, resultado);
        assertSame(ana, ((ResolutorDeParticipante.Resultado.Encontrado) resultado).estudiante());
    }

    /** La hoja se escribe a mano: tildes y mayúsculas no pueden decidir. */
    @Test
    void ignoraTildesMayusculasYEspaciosDeSobra() {
        var ana = participante("Ana", "Ruiz Gómez");
        var resolutor = con(ana);

        assertInstanceOf(ResolutorDeParticipante.Resultado.Encontrado.class,
                resolutor.buscar("  ANA   RUIZ GOMEZ "));
        assertInstanceOf(ResolutorDeParticipante.Resultado.Encontrado.class,
                resolutor.buscar("ana ruiz gomez"));
    }

    /** Algunos listados se exportan como "Apellidos Nombre". */
    @Test
    void encuentraTambienConElOrdenInvertido() {
        var ana = participante("Ana", "Ruiz Gómez");

        assertInstanceOf(ResolutorDeParticipante.Resultado.Encontrado.class,
                con(ana).buscar("Ruiz Gómez Ana"));
    }

    /**
     * El caso que obliga a que esta clase exista: asignarle a la persona
     * equivocada una colocación o una postulación es peor que dejar la fila sin
     * importar y decirlo.
     */
    @Test
    void conDosParticipantesDelMismoNombreNoElige() {
        var resultado = con(participante("Juan", "Pérez"), participante("Juan", "Pérez"))
                .buscar("Juan Pérez");

        assertInstanceOf(ResolutorDeParticipante.Resultado.Ambiguo.class, resultado);
        assertEquals(2, ((ResolutorDeParticipante.Resultado.Ambiguo) resultado).cuantos());
    }

    @Test
    void unNombreQueNoExisteSeInformaComoTal() {
        var resultado = con(participante("Ana", "Ruiz")).buscar("Pedro Gómez");

        assertInstanceOf(ResolutorDeParticipante.Resultado.NoExiste.class, resultado);
    }

    @Test
    void sinNombreNoHayNadaQueBuscar() {
        var resolutor = con(participante("Ana", "Ruiz"));

        assertInstanceOf(ResolutorDeParticipante.Resultado.NoExiste.class, resolutor.buscar(null));
        assertInstanceOf(ResolutorDeParticipante.Resultado.NoExiste.class, resolutor.buscar("   "));
    }

    /**
     * Las partículas forman parte del apellido: quitarlas juntaría a personas
     * distintas.
     */
    @Test
    void noConfundeApellidosParecidos() {
        var resolutor = con(participante("Juan", "De La Rosa"), participante("Juan", "Rosa"));

        assertInstanceOf(ResolutorDeParticipante.Resultado.Encontrado.class,
                resolutor.buscar("Juan De La Rosa"));
        assertInstanceOf(ResolutorDeParticipante.Resultado.Encontrado.class,
                resolutor.buscar("Juan Rosa"));
    }

    @Test
    void elMensajeDeErrorDiceQueHacer() {
        var resolutor = con(participante("Ana", "Ruiz"));

        String noExiste = ResolutorDeParticipante.explicar(
                resolutor.buscar("Pedro Gómez"), "Pedro Gómez");
        assertTrue(noExiste.contains("Créalo primero"), noExiste);

        var ambiguo = con(participante("Juan", "Pérez"), participante("Juan", "Pérez"));
        String duplicado = ResolutorDeParticipante.explicar(
                ambiguo.buscar("Juan Pérez"), "Juan Pérez");
        assertTrue(duplicado.contains("documento"), duplicado);
    }
}
