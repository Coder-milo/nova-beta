package com.novacrm.chat;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Subir por una conversacion larga sin repetir ni saltarse nada.
 *
 * <p>Va contra la base de datos porque lo que se prueba es el corte: la
 * secuencia la asigna PostgreSQL al insertar, y con mocks no se asigna
 * ninguna. Y es justo la secuencia lo que evita que dos mensajes escritos en
 * el mismo instante hagan que uno se repita o se pierda en el borde entre dos
 * tramos.
 *
 * <p>Todo va dentro de una transaccion que se deshace al terminar: esta base de
 * desarrollo tiene los datos reales del programa.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SubirPorLaConversacionTest {

    @Autowired
    private ChatDirectoMensajeRepository repository;

    @Autowired
    private EstudianteRepository estudianteRepository;

    @Autowired
    private ProgramaRepository programaRepository;

    private Estudiante ana;
    private Estudiante luis;

    @BeforeEach
    void prepararConversacionLarga() {
        repository.deleteAll();
        Programa programa = programaRepository.findAll().stream().findFirst().orElseThrow();
        ana = guardarEstudiante(programa, "Ana");
        luis = guardarEstudiante(programa, "Luis");

        // Todos seguidos, para que varios compartan marca de tiempo: es el caso
        // en el que un corte por fecha a secas se equivoca.
        for (int i = 0; i < 12; i++) {
            var mensaje = new ChatDirectoMensaje();
            mensaje.setRemitente(i % 2 == 0 ? ana : luis);
            mensaje.setDestinatario(i % 2 == 0 ? luis : ana);
            mensaje.setContenido("mensaje " + i);
            repository.save(mensaje);
        }
        repository.flush();
    }

    private Estudiante guardarEstudiante(Programa programa, String nombre) {
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        var estudiante = new Estudiante();
        estudiante.setNombre(nombre);
        estudiante.setApellido("De Prueba");
        estudiante.setEmail(nombre.toLowerCase() + "." + sufijo + "@correo.test");
        estudiante.setNumeroDocumento("7" + sufijo);
        estudiante.setPrograma(programa);
        estudiante.setActivo(true);
        return estudianteRepository.save(estudiante);
    }

    /** Lo mas nuevo primero, que es como se acota al abrir el chat. */
    private List<ChatDirectoMensaje> ultimos(int cuantos) {
        return repository.ultimosDeLaConversacion(ana.getId(), luis.getId(),
                PageRequest.of(0, cuantos));
    }

    @Test
    void subirPorLaConversacionRecorreTodoUnaSolaVez() {
        var primerTramo = ultimos(5);
        assertEquals(5, primerTramo.size());

        var vistos = new ArrayList<>(primerTramo);
        var borde = primerTramo.get(primerTramo.size() - 1);

        // Se sube de cinco en cinco hasta que no queda nada.
        while (true) {
            var tramo = repository.anterioresA(ana.getId(), luis.getId(),
                    borde.getCreatedAt(), borde.getSecuencia(), PageRequest.of(0, 5));
            if (tramo.isEmpty()) break;
            vistos.addAll(tramo);
            borde = tramo.get(tramo.size() - 1);
        }

        assertEquals(12, vistos.size(), "los doce, ni uno mas");
        assertEquals(12, vistos.stream().map(ChatDirectoMensaje::getId).distinct().count(),
                "y ninguno repetido: sin la secuencia, los que comparten marca de "
                        + "tiempo se cuelan dos veces o se pierden en el borde");
    }

    @Test
    void loAnteriorAlMasViejoEstaVacio() {
        var todos = ultimos(50);
        var masViejo = todos.get(todos.size() - 1);

        var tramo = repository.anterioresA(ana.getId(), luis.getId(),
                masViejo.getCreatedAt(), masViejo.getSecuencia(), PageRequest.of(0, 5));

        assertTrue(tramo.isEmpty());
    }

    /** El corte no incluye el mensaje de referencia: si no, se repetiria. */
    @Test
    void elMensajeDeReferenciaNoVuelveAAparecer() {
        var todos = ultimos(50);
        var referencia = todos.get(3);

        var tramo = repository.anterioresA(ana.getId(), luis.getId(),
                referencia.getCreatedAt(), referencia.getSecuencia(), PageRequest.of(0, 50));

        assertTrue(tramo.stream().noneMatch(m -> m.getId().equals(referencia.getId())));
    }
}
