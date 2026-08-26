package com.novacrm.hv;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuditoriaLinkedinServiceTest {

    private AuditoriaLinkedinService auditoriaService;

    @BeforeEach
    void setUp() {
        auditoriaService = new AuditoriaLinkedinService();
    }

    @Test
    void auditarTexto_conPerfilRealHectorSuarez() {
        String textoOcr = """
                Contactar
                hectorluissuarezarroyo@gmail.com
                www.linkedin.com/in/héctor-suárez-001415242 (LinkedIn)
                Aptitudes principales
                Formación
                Educación primaria y secundaria
                Technical Support
                Languages
                Inglés (Native or Bilingual)
                Español (Native or Bilingual)
                Certifications
                ONE | Inmersión Agentes de IA
                Formación Lógica de programación con JavaScript
                Formación Principiante en Programación G7 - ONE
                Formación Emprendimiento, Agilidad y Protagonismo Profesional G7 - ONE
                Héctor Suárez
                Profesor de Ciencias Sociales | Técnico en Mantenimiento y Ensamblaje de Computadores | Desarrollador Backend en Java
                Soledad, Atlántico, Colombia
                Extracto
                Soy Profesor de Ciencias Sociales y Técnico en Mantenimiento y Ensamblaje de Computadores, apasionado por la tecnología y la innovación educativa. Combino mis conocimientos en educación con el desarrollo tecnológico para crear soluciones que generen impacto real.
                Actualmente me enfoco en el desarrollo como Backend Developer en Java y en el desarrollo web, fortaleciendo mis habilidades en programación, lógica y resolución de problemas.
                Me destaco por mi capacidad de aprendizaje rápido, pensamiento analítico y compromiso con la mejora continua. Busco oportunidades donde pueda aportar valor, crecer profesionalmente y desarrollar soluciones tecnológicas eficientes.
                Experiencia
                COLEGIO GENESIS
                Profesor de ciencias sociales
                febrero de 2025 - abril de 2025 (3 meses)
                Barranquilla, Atlántico, Colombia
                Desempeño como docente de Ciencias Sociales, impartiendo clases sobre temas históricos, sociales y culturales, promoviendo el pensamiento crítico y la participación de los estudiantes.
                Planificación y ejecución de actividades académicas, evaluación del desempeño estudiantil y acompañamiento en el proceso de aprendizaje.
                Universidad del Atlántico
                Monitor
                octubre de 2023 - septiembre de 2024 (1 año)
                Puerto Colombia, Atlántico, Colombia
                Apoyo en la Oficina de Informática, brindando asistencia técnica en el mantenimiento de equipos de cómputo, soporte a usuarios y gestión básica de sistemas.
                Participación en actividades orientadas al buen funcionamiento de los recursos tecnológicos institucionales.
                Educación
                Universidad del Atlántico
                Licenciatura, Ciencias sociales · (agosto de 2019 - diciembre de 2025)
                CAC - Eurocentres
                English Language Studies, English Language · (febrero de 2026)
                ETDH Centro Social Don Bosco
                Técnico Laboral, Reparación y Ensamble de Computadores · (febrero de 2016 - diciembre de 2018)
                Universidad del Atlántico
                Estudios en Idioma Inglés, Lenguas Extranjeras · (febrero de 2025 - diciembre de 2026)
                Page 1 of 2
                Page 2 of 2
                """;

        var resultado = auditoriaService.auditarTexto(textoOcr);

        assertThat(resultado.puntuacion()).isGreaterThanOrEqualTo(85);
        assertThat(resultado.optimizado()).isTrue();
        assertThat(resultado.nivel()).isIn("Avanzado", "Estelar / All-Star");

        var d = resultado.datosExtraidos();
        assertThat(d.nombre()).contains("Héctor");
        assertThat(d.apellido()).contains("Suárez");
        assertThat(d.email()).isEqualTo("hectorluissuarezarroyo@gmail.com");
        assertThat(d.linkedinUrl()).contains("héctor-suárez-001415242");
        assertThat(d.cargoObjetivo()).contains("Profesor de Ciencias Sociales");
        assertThat(d.perfilProfesional()).contains("Backend Developer");
        assertThat(d.nivelIngles()).isEqualTo("C2");
        assertThat(d.experiencias()).isNotEmpty();
        assertThat(d.formaciones()).isNotEmpty();

        assertThat(resultado.fortalezas()).isNotEmpty();
    }

    @Test
    void auditarTexto_conPerfilVacio_noAlcanzaOptimizacion() {
        String textoMinimo = """
                Contactar
                usuario@ejemplo.com
                www.linkedin.com/in/usuario-test
                Juan Perez
                Estudiante
                Colombia
                """;

        var resultado = auditoriaService.auditarTexto(textoMinimo);

        assertThat(resultado.puntuacion()).isLessThan(70);
        assertThat(resultado.optimizado()).isFalse();
        assertThat(resultado.recomendaciones()).isNotEmpty();
    }
}
