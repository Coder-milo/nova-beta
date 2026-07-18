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
@Import({JpaConfig.class, AdminService.class, PurgeScheduler.class})
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
}
