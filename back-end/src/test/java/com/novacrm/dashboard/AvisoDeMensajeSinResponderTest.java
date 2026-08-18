package com.novacrm.dashboard;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.mensaje.EstadoMensaje;
import com.novacrm.mensaje.MensajeEstudiante;
import com.novacrm.mensaje.MensajeEstudianteRepository;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El aviso de que alguien escribio al equipo y sigue esperando.
 *
 * <p>La lista de avisos cubria los reportes del chat, las ofertas sin validar,
 * los datos incompletos y los programas por terminar. No cubria el canal
 * ordinario por el que un estudiante pide algo: escribir un mensaje.
 *
 * <p>Existia el contador de la campana, que dice cuantos hilos hay abiertos.
 * Con un numero a secas, un mensaje de hace tres semanas se ve igual que uno de
 * esta manana, y lo que importa es justo cuanto lleva esperando alguien.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AvisoDeMensajeSinResponderTest {

    @Autowired private DashboardService dashboard;
    @Autowired private MensajeEstudianteRepository mensajes;
    @Autowired private EstudianteRepository estudiantes;
    @Autowired private ProgramaRepository programas;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager em;

    private Estudiante estudiante() {
        var programa = new Programa();
        programa.setNombre("Programa " + UUID.randomUUID());
        programas.saveAndFlush(programa);

        var e = new Estudiante();
        e.setNombre("Ana");
        e.setApellido("Perez");
        e.setEmail("aviso-" + UUID.randomUUID() + "@cac.test");
        e.setPrograma(programa);
        return estudiantes.saveAndFlush(e);
    }

    /**
     * {@code createdAt} lo pone la auditoria de JPA y la columna no es
     * actualizable, asi que para simular un mensaje viejo hay que retrasarlo
     * por SQL despues de guardarlo.
     */
    private void mensajeAbiertoDeHace(Duration antiguedad) {
        var m = new MensajeEstudiante();
        m.setEstudiante(estudiante());
        m.setAsunto("Necesito ayuda con mi hoja de vida");
        m.setContenido("Buenos dias, no consigo generar el PDF.");
        m.setEstado(EstadoMensaje.ABIERTO);
        var guardado = mensajes.saveAndFlush(m);
        em.createNativeQuery("UPDATE mensaje_estudiante SET created_at = :cuando WHERE id = :id")
                .setParameter("cuando", Instant.now().minus(antiguedad))
                .setParameter("id", guardado.getId())
                .executeUpdate();
        em.clear();
    }

    private long avisosDeMensaje() {
        return dashboard.alertas().stream()
                .filter(a -> a.tipo().equals("MENSAJE_SIN_RESPONDER"))
                .count();
    }

    @Test
    @DisplayName("un mensaje sin responder desde hace dias sale en los avisos")
    void elQueLlevaEsperandoSeAvisa() {
        assertThat(avisosDeMensaje()).isZero();

        mensajeAbiertoDeHace(Duration.ofDays(9));

        assertThat(avisosDeMensaje()).isOne();
        assertThat(dashboard.alertas().stream()
                .filter(a -> a.tipo().equals("MENSAJE_SIN_RESPONDER"))
                .findFirst().orElseThrow().severidad())
                .isEqualTo("ALTA");
    }

    @Test
    @DisplayName("el de esta manana no: todavia no es un descuido")
    void elRecienteNoMolesta() {
        mensajeAbiertoDeHace(Duration.ofHours(2));

        assertThat(avisosDeMensaje()).isZero();
    }
}
