package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Que el bloqueo corte en las dos direcciones vive en la consulta, no en el
 * servicio, y una prueba con mocks no lo tocaria: el servicio se limita a
 * preguntar. Asi que esta va contra la base de datos de verdad.
 *
 * <p>Importa porque es justo la clase de detalle que un refactor deja a medias
 * sin que nadie lo note: el bloqueo seguiria "funcionando" —quien bloquea deja
 * de recibir— mientras quien fue bloqueado sigue pudiendo escribir.
 *
 * <p>Todo va dentro de una transaccion que se deshace al terminar: esta base de
 * desarrollo tiene los datos reales del programa y una prueba no puede dejar
 * fichas sueltas en ella.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BloqueoEnLasDosDireccionesTest {

    @Autowired
    private BloqueoDeChatRepository bloqueoRepository;

    @Autowired
    private EstudianteRepository estudianteRepository;

    @Autowired
    private ProgramaRepository programaRepository;

    private Estudiante quienBloquea;
    private Estudiante quienEsBloqueado;

    @BeforeEach
    void prepararDos() {
        Programa programa = programaRepository.findAll().stream().findFirst().orElseThrow();
        quienBloquea = guardarEstudiante(programa, "Ana");
        quienEsBloqueado = guardarEstudiante(programa, "Luis");
    }

    private Estudiante guardarEstudiante(Programa programa, String nombre) {
        // Sufijo unico: el correo es unico en la tabla y esta base ya tiene
        // datos, asi que un valor fijo chocaria con lo que hubiera.
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        var estudiante = new Estudiante();
        estudiante.setNombre(nombre);
        estudiante.setApellido("De Prueba");
        estudiante.setEmail(nombre.toLowerCase() + "." + sufijo + "@correo.test");
        estudiante.setNumeroDocumento("9" + sufijo);
        estudiante.setPrograma(programa);
        estudiante.setActivo(true);
        return estudianteRepository.save(estudiante);
    }

    @Test
    void sinBloqueoNoHayNadaQueCortar() {
        assertFalse(bloqueoRepository.hayBloqueoEntre(
                quienBloquea.getId(), quienEsBloqueado.getId()));
    }

    @Test
    void elBloqueoCortaEnLasDosDirecciones() {
        var bloqueo = new BloqueoDeChat();
        bloqueo.setBloqueador(quienBloquea);
        bloqueo.setBloqueado(quienEsBloqueado);
        bloqueoRepository.save(bloqueo);

        assertTrue(bloqueoRepository.hayBloqueoEntre(
                        quienBloquea.getId(), quienEsBloqueado.getId()),
                "quien bloqueo no puede escribirle");
        assertTrue(bloqueoRepository.hayBloqueoEntre(
                        quienEsBloqueado.getId(), quienBloquea.getId()),
                "y quien fue bloqueado tampoco: si no, el bloqueo solo sirve "
                        + "para que quien bloquea siga insistiendo");
    }

    /** Lo que se usa para no ofrecer al buscar a quien no se puede escribir. */
    @Test
    void losDosDesaparecenDeLaBusquedaDelOtro() {
        var bloqueo = new BloqueoDeChat();
        bloqueo.setBloqueador(quienBloquea);
        bloqueo.setBloqueado(quienEsBloqueado);
        bloqueoRepository.save(bloqueo);

        assertTrue(bloqueoRepository.sinChatPosibleCon(quienBloquea.getId())
                .contains(quienEsBloqueado.getId()));
        assertTrue(bloqueoRepository.sinChatPosibleCon(quienEsBloqueado.getId())
                .contains(quienBloquea.getId()));
    }

    /** Solo lo deshace quien lo puso: por eso se guarda con direccion. */
    @Test
    void soloQuienBloqueoEncuentraSuBloqueo() {
        var bloqueo = new BloqueoDeChat();
        bloqueo.setBloqueador(quienBloquea);
        bloqueo.setBloqueado(quienEsBloqueado);
        bloqueoRepository.save(bloqueo);

        assertTrue(bloqueoRepository.findByBloqueadorIdAndBloqueadoId(
                quienBloquea.getId(), quienEsBloqueado.getId()).isPresent());
        assertTrue(bloqueoRepository.findByBloqueadorIdAndBloqueadoId(
                        quienEsBloqueado.getId(), quienBloquea.getId()).isEmpty(),
                "quien fue bloqueado no puede deshacer el bloqueo del otro");
    }
}
