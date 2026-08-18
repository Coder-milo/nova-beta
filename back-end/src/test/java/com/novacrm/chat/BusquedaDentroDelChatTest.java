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

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Buscar dentro de una conversacion, sin distinguir tildes ni mayusculas.
 *
 * <p>Va contra la base de datos porque lo que se prueba vive en la consulta:
 * {@code novacrm_normalizar} es una funcion de PostgreSQL y con mocks no se
 * ejecuta ninguna. Es la misma funcion que usa la busqueda de personas, y por
 * el mismo motivo: quien escribio «práctica» rara vez teclea la tilde al
 * buscarlo, y una busqueda que exige acertar el acento no encuentra lo que la
 * persona sabe que dijo. En esta cohorte 48 de 108 nombres llevan tilde.
 *
 * <p>Todo va dentro de una transaccion que se deshace al terminar: esta base de
 * desarrollo tiene los datos reales del programa.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BusquedaDentroDelChatTest {

    @Autowired
    private ChatDirectoMensajeRepository repository;

    @Autowired
    private EstudianteRepository estudianteRepository;

    @Autowired
    private ProgramaRepository programaRepository;

    private Estudiante ana;
    private Estudiante luis;

    @BeforeEach
    void prepararConversacion() {
        Programa programa = programaRepository.findAll().stream().findFirst().orElseThrow();
        ana = guardarEstudiante(programa, "Ana");
        luis = guardarEstudiante(programa, "Luis");

        guardarMensaje(ana, luis, "Mañana tengo la práctica en la empresa");
        guardarMensaje(luis, ana, "Suerte con la PRACTICA");
        guardarMensaje(ana, luis, "Gracias, te cuento el lunes");
    }

    private Estudiante guardarEstudiante(Programa programa, String nombre) {
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        var estudiante = new Estudiante();
        estudiante.setNombre(nombre);
        estudiante.setApellido("De Prueba");
        estudiante.setEmail(nombre.toLowerCase() + "." + sufijo + "@correo.test");
        estudiante.setNumeroDocumento("8" + sufijo);
        estudiante.setPrograma(programa);
        estudiante.setActivo(true);
        return estudianteRepository.save(estudiante);
    }

    private void guardarMensaje(Estudiante de, Estudiante para, String texto) {
        var mensaje = new ChatDirectoMensaje();
        mensaje.setRemitente(de);
        mensaje.setDestinatario(para);
        mensaje.setContenido(texto);
        repository.save(mensaje);
    }

    private List<ChatDirectoMensaje> buscar(String termino) {
        return repository.buscarEnLaConversacion(ana.getId(), luis.getId(), termino,
                PageRequest.of(0, 50));
    }

    @Test
    void encuentraLoEscritoConTildeBuscandoSinElla() {
        var resultados = buscar("practica");

        assertEquals(2, resultados.size(),
                "el que la escribio con tilde y el que la escribio en mayusculas");
    }

    @Test
    void encuentraLoEscritoSinTildeBuscandoConElla() {
        assertEquals(2, buscar("práctica").size());
    }

    @Test
    void noDistingueMayusculas() {
        assertEquals(2, buscar("PrÁcTiCa").size());
    }

    @Test
    void encuentraUnTrozoDePalabra() {
        assertEquals(1, buscar("lunes").size());
    }

    @Test
    void loQueNoEstaNoAparece() {
        assertTrue(buscar("entrevista").isEmpty());
    }

    /** De lo mas nuevo a lo mas viejo: se busca algo reciente. */
    @Test
    void devuelveLoMasNuevoPrimero() {
        var resultados = buscar("a");

        for (int i = 1; i < resultados.size(); i++) {
            assertFalse(resultados.get(i - 1).getCreatedAt().isBefore(resultados.get(i).getCreatedAt()),
                    "el orden debe ir de lo mas nuevo a lo mas viejo");
        }
    }

    /**
     * La busqueda es de esta conversacion, no de todas. Un mensaje entre otras
     * dos personas no puede salir aqui por mucho que coincida el texto.
     */
    @Test
    void noSeCuelaLoDeOtraConversacion() {
        Programa programa = programaRepository.findAll().stream().findFirst().orElseThrow();
        var ajena = guardarEstudiante(programa, "Sara");
        guardarMensaje(ajena, luis, "la práctica de Sara");

        var resultados = buscar("practica");

        assertEquals(2, resultados.size(), "sigue habiendo dos, no tres");
        assertTrue(resultados.stream().noneMatch(m -> m.getContenido().contains("Sara")));
    }
}
