package com.novacrm.config;

import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Inicializador de datos semilla y alias de funciones PostgreSQL en H2 para pruebas automatizadas.
 */
@Component
@Profile("test")
public class TestProgramaInitializer implements CommandLineRunner {

    private final ProgramaRepository programaRepository;
    private final JdbcTemplate jdbcTemplate;

    public TestProgramaInitializer(ProgramaRepository programaRepository, JdbcTemplate jdbcTemplate) {
        this.programaRepository = programaRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        try {
            jdbcTemplate.execute("CREATE ALIAS IF NOT EXISTS NOVACRM_NORMALIZAR FOR \"com.novacrm.config.H2Functions.normalizar\"");
            jdbcTemplate.execute("CREATE ALIAS IF NOT EXISTS NOVACRM_NORMALIZAR_EMPRESA FOR \"com.novacrm.config.H2Functions.normalizarEmpresa\"");
            jdbcTemplate.execute("CREATE ALIAS IF NOT EXISTS NOVACRM_NORMALIZAR_DOCUMENTO FOR \"com.novacrm.config.H2Functions.normalizarDocumento\"");
            jdbcTemplate.execute("CREATE ALIAS IF NOT EXISTS NOVACRM_SOLO_ALFANUMERICO FOR \"com.novacrm.config.H2Functions.soloAlfanumerico\"");
            jdbcTemplate.execute("CREATE ALIAS IF NOT EXISTS DATE_PART FOR \"com.novacrm.config.H2Functions.datePart\"");
        } catch (Exception e) {
            // Ignorar si no es H2
        }

        if (programaRepository.count() == 0) {
            Programa p = new Programa();
            p.setNombre("CAC Eurocentres Barranquilla");
            p.setActivo(true);
            programaRepository.save(p);
        }
    }
}
