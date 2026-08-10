package com.novacrm.admin;

import com.novacrm.config.JpaConfig;
import com.novacrm.config.PurgeScheduler;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.linkedin.LinkedinConfiguracion;
import com.novacrm.programa.Programa;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Tests de integración del flujo de papelera (soft delete → restaurar → purga)
 * contra un Postgres real con las migraciones Flyway aplicadas.
 *
 * Cubren las regresiones BE-01 (restaurar re-eliminaba) y BE-02 (la purga
 * omitía LinkedinConfiguracion y violaba la FK).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
// ConfiguracionService entra porque la purga le pregunta cuantos dias de
// retencion hay configurados —antes eran 30 escritos en el codigo—, y
// MatchingConfig porque es de quien ese servicio toma los valores de partida.
@Import({JpaConfig.class, AdminService.class, PurgeScheduler.class,
        com.novacrm.configuracion.ConfiguracionService.class,
        // Las operaciones masivas dejan constancia de quien las hizo, asi que
        // el contexto de esta prueba necesita el registro de auditoria.
        com.novacrm.auditoria.AuditoriaService.class,
        com.novacrm.config.MatchingConfig.class})
class PapeleraIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private EntityManager em;

    @Autowired
    private AdminService adminService;

    @Autowired
    private PurgeScheduler purgeScheduler;

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Programa crearPrograma() {
        var programa = new Programa();
        programa.setNombre("Programa Test " + UUID.randomUUID());
        em.persist(programa);
        return programa;
    }

    private Estudiante crearEstudiante(Programa programa) {
        var e = new Estudiante();
        e.setNombre("Ana");
        e.setApellido("Prueba");
        e.setEmail("test-" + UUID.randomUUID() + "@novacrm.com");
        e.setPrograma(programa);
        em.persist(e);
        return e;
    }

    private Estudiante crearEstudianteEnPapelera(Programa programa, Instant deletedAt) {
        var e = crearEstudiante(programa);
        e.setActivo(false);
        e.setDeletedAt(deletedAt);
        return e;
    }

    // ── BE-01: restaurar ─────────────────────────────────────────────────────

    @Test
    void restaurarDevuelveElConteoRealYNoReElimina() {
        var programa = crearPrograma();
        var activo = crearEstudiante(programa);
        var enPapelera = crearEstudianteEnPapelera(programa, Instant.now());
        em.flush();

        int restaurados = adminService.restaurarEstudiantesByPrograma(programa.getId());
        em.clear();

        assertThat(restaurados).isEqualTo(1);

        var activoRecargado = em.find(Estudiante.class, activo.getId());
        var restauradoRecargado = em.find(Estudiante.class, enPapelera.getId());
        assertThat(activoRecargado.isActivo()).isTrue();
        assertThat(restauradoRecargado.isActivo()).isTrue();
        assertThat(restauradoRecargado.getDeletedAt()).isNull();
    }

    // ── BE-02: purga con LinkedinConfiguracion ───────────────────────────────

    @Test
    void purgaAdminEliminaEstudianteConConfiguracionLinkedinSinViolarFk() {
        var programa = crearPrograma();
        var antiguo = crearEstudianteEnPapelera(programa, Instant.now().minus(Duration.ofDays(40)));
        var reciente = crearEstudianteEnPapelera(programa, Instant.now().minus(Duration.ofDays(5)));

        var linkedin = new LinkedinConfiguracion();
        linkedin.setId(antiguo.getId());
        linkedin.setLinkedinUserId("li-user");
        em.persist(linkedin);
        em.flush();

        UUID antiguoId = antiguo.getId();
        UUID recienteId = reciente.getId();

        assertThatCode(() -> adminService.purgarPapelera()).doesNotThrowAnyException();
        em.clear();

        assertThat(em.find(Estudiante.class, antiguoId)).isNull();
        assertThat(em.find(LinkedinConfiguracion.class, antiguoId)).isNull();
        // Con menos de 30 días en papelera, se conserva.
        assertThat(em.find(Estudiante.class, recienteId)).isNotNull();
    }

    @Test
    void purgaProgramadaEliminaEstudianteConConfiguracionLinkedinSinViolarFk() {
        var programa = crearPrograma();
        var antiguo = crearEstudianteEnPapelera(programa, Instant.now().minus(Duration.ofDays(45)));

        var linkedin = new LinkedinConfiguracion();
        linkedin.setId(antiguo.getId());
        linkedin.setLinkedinUserId("li-user-scheduler");
        em.persist(linkedin);
        em.flush();

        UUID antiguoId = antiguo.getId();

        assertThatCode(() -> purgeScheduler.purgarPapelera()).doesNotThrowAnyException();
        em.clear();

        assertThat(em.find(Estudiante.class, antiguoId)).isNull();
        assertThat(em.find(LinkedinConfiguracion.class, antiguoId)).isNull();
    }

    // ── La purga automatica y los dias configurados ──────────────────────────

    /**
     * Los dias de retencion los decide la configuracion, tambien de madrugada.
     *
     * <p>La purga manual ya los respetaba; la automatica llevaba 30 escritos en
     * el codigo. Y quien borra de verdad es la automatica: nadie purga a mano un
     * domingo a las tres. Subir la retencion a 90 desde la pantalla no salvaba
     * ninguna ficha del borrado del dia 31, que es irreversible.
     */
    @Test
    void laPurgaProgramadaRespetaLosDiasQueDiceLaConfiguracion() {
        var config = new com.novacrm.configuracion.ConfiguracionGlobal();
        config.setDiasRetencionPapelera(90);
        em.persist(config);

        var programa = crearPrograma();
        var deCuarentaDias = crearEstudianteEnPapelera(programa, Instant.now().minus(Duration.ofDays(40)));
        var deCienDias = crearEstudianteEnPapelera(programa, Instant.now().minus(Duration.ofDays(100)));
        em.flush();

        UUID dentroDePlazo = deCuarentaDias.getId();
        UUID fueraDePlazo = deCienDias.getId();

        purgeScheduler.purgarPapelera();
        em.clear();

        assertThat(em.find(Estudiante.class, dentroDePlazo))
                .as("con 90 dias configurados, una ficha de 40 no se toca")
                .isNotNull();
        assertThat(em.find(Estudiante.class, fueraDePlazo)).isNull();
    }

    /** Borrar fichas sin dejar rastro es justo lo que no puede pasar. */
    @Test
    void laPurgaProgramadaQuedaEnAuditoria() {
        var programa = crearPrograma();
        crearEstudianteEnPapelera(programa, Instant.now().minus(Duration.ofDays(40)));
        em.flush();

        purgeScheduler.purgarPapelera();
        em.flush();
        em.clear();

        Long anotaciones = em.createQuery(
                        "SELECT COUNT(a) FROM Auditoria a WHERE a.accion = 'PURGA_DE_PAPELERA'", Long.class)
                .getSingleResult();
        assertThat(anotaciones).isPositive();
    }

    // ── Grupos y reportes del chat ───────────────────────────────────────────

    /**
     * Misma trampa que BE-02, dos tablas mas tarde.
     *
     * <p>Las tablas de grupos y de reportes entraron con FK a estudiante sin
     * ON DELETE. Cualquiera que hubiera creado un grupo, escrito en uno o
     * aparecido en un reporte bloqueaba su propio borrado, y como la purga
     * borra el lote entero con un solo DELETE, esa persona se llevaba por
     * delante la purga de todas las demas.
     *
     * <p>Y no valia el CASCADE de siempre para las cuatro: el grupo tiene que
     * sobrevivir a quien lo creo —es de sus miembros— y el reporte tiene que
     * sobrevivir a las dos partes, porque si se fuera con el denunciado, dar de
     * baja la cuenta denunciada borraria la denuncia.
     */
    @Test
    void purgaEliminaAQuienCreoUnGrupoYAparecioEnUnReporteSinLlevarselosPorDelante() {
        var programa = crearPrograma();
        var antiguo = crearEstudianteEnPapelera(programa, Instant.now().minus(Duration.ofDays(40)));
        var companero = crearEstudiante(programa);

        var grupo = new com.novacrm.chat.ChatGrupo();
        grupo.setNombre("Grupo de la cohorte");
        grupo.setCreadoPor(antiguo);
        em.persist(grupo);

        for (var miembro : new Estudiante[]{antiguo, companero}) {
            var fila = new com.novacrm.chat.ChatGrupoMiembro();
            fila.setGrupo(grupo);
            fila.setEstudiante(miembro);
            em.persist(fila);
        }

        var mensaje = new com.novacrm.chat.ChatGrupoMensaje();
        mensaje.setGrupo(grupo);
        mensaje.setRemitente(antiguo);
        mensaje.setContenido("Hola a todos");
        em.persist(mensaje);

        var reporte = new com.novacrm.chat.ReporteDeChat();
        reporte.setDenunciante(companero);
        reporte.setDenunciado(antiguo);
        reporte.setMotivo("Mensajes ofensivos");
        reporte.setExtracto("[10:04] Ana: ...");
        em.persist(reporte);
        em.flush();

        UUID antiguoId = antiguo.getId();
        UUID grupoId = grupo.getId();
        UUID mensajeId = mensaje.getId();
        UUID reporteId = reporte.getId();

        assertThatCode(() -> adminService.purgarPapelera()).doesNotThrowAnyException();
        em.clear();

        assertThat(em.find(Estudiante.class, antiguoId)).isNull();

        var grupoRecargado = em.find(com.novacrm.chat.ChatGrupo.class, grupoId);
        assertThat(grupoRecargado)
                .as("el grupo es de sus miembros, no de quien pulso crear")
                .isNotNull();
        assertThat(grupoRecargado.getCreadoPor()).isNull();

        assertThat(em.find(com.novacrm.chat.ChatGrupoMensaje.class, mensajeId))
                .as("lo que alguien escribio no sobrevive a su ficha")
                .isNull();

        var reporteRecargado = em.find(com.novacrm.chat.ReporteDeChat.class, reporteId);
        assertThat(reporteRecargado)
                .as("borrar al denunciado no puede borrar la denuncia")
                .isNotNull();
        assertThat(reporteRecargado.getDenunciado()).isNull();
        assertThat(reporteRecargado.getExtracto()).isEqualTo("[10:04] Ana: ...");
        assertThat(reporteRecargado.getDenunciante()).isNotNull();
    }
}
