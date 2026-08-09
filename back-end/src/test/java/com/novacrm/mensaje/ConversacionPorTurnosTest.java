package com.novacrm.mensaje;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * La conversacion por turnos: quien puede escribir en un hilo, a que puede
 * citar y como se comportan las reacciones.
 *
 * <p>Va contra la base porque lo que importa es el efecto de guardar —el
 * indice unico de reacciones y las claves ajenas viven alli, no en el codigo—.
 * Todo en una transaccion que se deshace: esta base tiene los participantes
 * reales del programa.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ConversacionPorTurnosTest {

    @Autowired private MensajeEstudianteService servicio;
    @Autowired private MensajeEstudianteRepository mensajes;
    @Autowired private EstudianteRepository estudiantes;
    @Autowired private ProgramaRepository programas;

    private Estudiante duenno;
    private Estudiante ajeno;
    private UUID hiloId;

    private Estudiante nuevoEstudiante(Programa programa, String prefijo) {
        var e = new Estudiante();
        e.setNombre(prefijo);
        e.setApellido("Prueba");
        e.setEmail(prefijo.toLowerCase() + "." + UUID.randomUUID() + "@correo.com");
        e.setPrograma(programa);
        e.setActivo(true);
        return estudiantes.saveAndFlush(e);
    }

    private Authentication como(String email, String rol) {
        return new UsernamePasswordAuthenticationToken(email, "n/a",
                List.of(new SimpleGrantedAuthority("ROLE_" + rol)));
    }

    @BeforeEach
    void prepararHilo() {
        Programa programa = programas.findAll().stream().findFirst().orElseThrow();
        duenno = nuevoEstudiante(programa, "Duenno");
        ajeno = nuevoEstudiante(programa, "Ajeno");

        var hilo = new MensajeEstudiante();
        hilo.setEstudiante(duenno);
        hilo.setAsunto("Consulta de prueba");
        hilo.setContenido("Texto original");
        hiloId = mensajes.saveAndFlush(hilo).getId();
    }

    @Test
    @DisplayName("el estudiante y el equipo escriben en el mismo hilo, cada uno de su lado")
    void ambosEscribenEnElMismoHilo() {
        servicio.escribirEnHilo(hiloId, "Hola, tengo una duda", null, List.of(),
                como(duenno.getEmail(), "ESTUDIANTE"));
        servicio.escribirEnHilo(hiloId, "Te leo, cuéntame", null, List.of(),
                como("coordinador@novacrm.com", "COORDINADOR"));

        var turnos = servicio.turnos(hiloId, como("coordinador@novacrm.com", "COORDINADOR"));

        assertThat(turnos).hasSize(2);
        assertThat(turnos.get(0).autorEsEstudiante()).isTrue();
        assertThat(turnos.get(1).autorEsEstudiante())
                .as("quien gestiona nunca se pinta del lado del estudiante")
                .isFalse();
    }

    @Test
    @DisplayName("un estudiante no puede leer ni escribir en el hilo de otro")
    void noSeMeteEnElHiloDeOtro() {
        Authentication elAjeno = como(ajeno.getEmail(), "ESTUDIANTE");

        assertThatThrownBy(() -> servicio.turnos(hiloId, elAjeno))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> servicio.escribirEnHilo(hiloId, "cotilleando", null, List.of(), elAjeno))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("no se puede citar un turno de otra conversación")
    void noSeCitaUnTurnoDeOtraConversacion() {
        var otro = new MensajeEstudiante();
        otro.setEstudiante(ajeno);
        otro.setAsunto("Otro hilo");
        otro.setContenido("Texto");
        UUID otroId = mensajes.saveAndFlush(otro).getId();

        Authentication equipo = como("coordinador@novacrm.com", "COORDINADOR");
        var turnoAjeno = servicio.escribirEnHilo(otroId, "Turno del otro hilo", null, List.of(), equipo);

        // Citar a través de hilos dejaría ver texto de una conversación ajena.
        assertThatThrownBy(() ->
                servicio.escribirEnHilo(hiloId, "cito lo de allá", turnoAjeno.id(), List.of(), equipo))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("citar un turno del propio hilo guarda la referencia y un extracto")
    void citarGuardaReferenciaYExtracto() {
        Authentication equipo = como("coordinador@novacrm.com", "COORDINADOR");
        var primero = servicio.escribirEnHilo(hiloId, "¿Cuándo es la feria de empleo?", null, List.of(),
                como(duenno.getEmail(), "ESTUDIANTE"));

        var respuesta = servicio.escribirEnHilo(hiloId, "El viernes", primero.id(), List.of(), equipo);

        assertThat(respuesta.enRespuestaA()).isEqualTo(primero.id());
        assertThat(respuesta.enRespuestaAExtracto()).contains("feria de empleo");
    }

    @Test
    @DisplayName("la misma reacción se pone y se quita; no se acumula")
    void laReaccionAlterna() {
        Authentication equipo = como("coordinador@novacrm.com", "COORDINADOR");
        var turno = servicio.escribirEnHilo(hiloId, "Gracias", null, List.of(),
                como(duenno.getEmail(), "ESTUDIANTE"));

        var puesta = servicio.alternarReaccion(turno.id(), "👍", equipo);
        assertThat(puesta).hasSize(1);
        assertThat(puesta.get(0).total()).isEqualTo(1);
        assertThat(puesta.get(0).mia()).isTrue();

        var quitada = servicio.alternarReaccion(turno.id(), "👍", equipo);
        assertThat(quitada)
                .as("pulsar dos veces retira, no acumula")
                .isEmpty();
    }

    @Test
    @DisplayName("un emoji fuera de la paleta se rechaza")
    void elEmojiFueraDeLaPaletaSeRechaza() {
        Authentication equipo = como("coordinador@novacrm.com", "COORDINADOR");
        var turno = servicio.escribirEnHilo(hiloId, "Texto", null, List.of(), equipo);

        assertThatThrownBy(() -> servicio.alternarReaccion(turno.id(), "<script>", equipo))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("no se admite un turno vacío sin adjuntos")
    void noSeAdmiteTurnoVacio() {
        Authentication equipo = como("coordinador@novacrm.com", "COORDINADOR");

        assertThatThrownBy(() -> servicio.escribirEnHilo(hiloId, "   ", null, List.of(), equipo))
                .isInstanceOf(BusinessException.class);
    }
}
