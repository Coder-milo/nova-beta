package com.novacrm.matching;

import com.novacrm.catalogo.nivel_ingles.NivelIngles;
import com.novacrm.config.MatchingConfig;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class MatchingMultiPerfilTest {

    @Autowired
    private SkillSynonyms skillSynonyms;

    @Autowired
    private MatchingConfig matchingConfig;

    private MatchingService matchingService;

    @BeforeEach
    void setup() {
        matchingService = new MatchingService(
                null, null, null, skillSynonyms, matchingConfig,
                null, null, null, null, null);
    }

    private Estudiante candidatoTech() {
        var e = new Estudiante();
        e.setNombre("Candidato");
        e.setApellido("Tecnologia");
        e.setCargoObjetivo("Backend Developer");
        e.setPerfilProfesional("Desarrollador de software con experiencia en Java, Spring Boot, REST APIs y SQL.");
        e.setCompetencias("Java, Python, Spring Boot, RESTful APIs, PostgreSQL, Git, VS Code, Basic Networking");
        e.setSectorObjetivo("Tecnología / TI");
        e.setSectorExperiencia("Tecnología / TI");
        e.setUltimoCargo("Desarrollador Junior");
        e.setCiudad("Barranquilla");
        e.setTieneComputador(true);
        e.setTieneInternet(true);
        e.setAniosExperiencia(2);

        var nivel = new NivelIngles();
        nivel.setCodigo("B2");
        e.setNivelIngles(nivel);
        e.setResultadoPruebaOral("B1");
        e.setResultadoPruebaEscrita("B2");
        return e;
    }

    private Estudiante candidatoDocente() {
        var e = new Estudiante();
        e.setNombre("Candidata");
        e.setApellido("Educacion");
        e.setCargoObjetivo("Docente Bilingüe");
        e.setPerfilProfesional("Licenciada en educación y ciencias sociales con dominio de inglés para colegios bilingües.");
        e.setCompetencias("Pedagogía, Ciencias Sociales, Docencia, Bilingüismo, Planificación Curricular");
        e.setSectorObjetivo("Educación");
        e.setSectorExperiencia("Educación");
        e.setProgramaAcademico("Licenciatura en Ciencias Sociales");
        e.setCiudad("Puerto Colombia");
        e.setTieneComputador(true);
        e.setTieneInternet(true);
        e.setAniosExperiencia(3);

        var nivel = new NivelIngles();
        nivel.setCodigo("B2");
        e.setNivelIngles(nivel);
        e.setResultadoPruebaOral("B2");
        e.setResultadoPruebaEscrita("B2");
        return e;
    }

    private Vacante vacante(String titulo, String desc, String ciudad, Segmento seg, String nivelIngles, Integer exp) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setDescripcion(desc);
        v.setRequisitos(desc);
        v.setCiudad(ciudad);
        v.setSegmento(seg);
        v.setNivelInglesRequerido(nivelIngles);
        v.setAniosExperienciaRequeridos(exp);
        v.setActivo(true);
        v.setRevisada(true);
        return v;
    }

    @Test
    void perfilesDiversosHacenMatchConSusRespectivasAreas() {
        var tech = candidatoTech();
        var docente = candidatoDocente();

        var vacantes = List.of(
                vacante("Junior Java Backend Developer", "Desarrollo de APIs REST con Java, Spring Boot y PostgreSQL", "Barranquilla", Segmento.LOCAL_COLOMBIA, "B1", 1),
                vacante("Profesor Sociales Bilingüe Barranquilla", "Docente de ciencias sociales en colegio bilingüe", "Puerto Colombia", Segmento.LOCAL_COLOMBIA, "B1", null),
                vacante("Mecánico de maquinaria pesada", "Reparación de motores diesel y maquinaria amarilla", "Soledad", Segmento.LOCAL_COLOMBIA, "B1", 5)
        );

        List<Set<String>> docs = vacantes.stream()
                .map(v -> skillSynonyms.tokenize(v.getTitulo(), v.getDescripcion(), v.getRequisitos()))
                .toList();
        var pesos = PesosPorRareza.de(docs);

        // Evaluar perfil Tech
        var terminosTech = skillSynonyms.tokenize(tech.getCargoObjetivo(), tech.getSectorObjetivo(), tech.getPerfilProfesional());
        var compTech = skillSynonyms.tokenize(tech.getCompetencias());
        var desgloseTechDev = matchingService.calcularPuntaje(tech, vacantes.get(0), terminosTech, docs.get(0), compTech, docs.get(0), pesos);
        assertTrue(matchingService.superaElCorte(desgloseTechDev, matchingConfig.getUmbralMinimo()), "Candidato Tech debe hacer match con Java Developer");

        // Evaluar perfil Docente
        var terminosDoc = skillSynonyms.tokenize(docente.getCargoObjetivo(), docente.getSectorObjetivo(), docente.getPerfilProfesional());
        var compDoc = skillSynonyms.tokenize(docente.getCompetencias());
        var desgloseDocente = matchingService.calcularPuntaje(docente, vacantes.get(1), terminosDoc, docs.get(1), compDoc, docs.get(1), pesos);
        assertTrue(matchingService.superaElCorte(desgloseDocente, matchingConfig.getUmbralMinimo()), "Candidato Docente debe hacer match con Profesor Bilingüe");

        // Evaluar vacante no afín
        var desgloseMecanico = matchingService.calcularPuntaje(tech, vacantes.get(2), terminosTech, docs.get(2), compTech, docs.get(2), pesos);
        assertFalse(matchingService.superaElCorte(desgloseMecanico, matchingConfig.getUmbralMinimo()), "Vacante no afín no debe hacer match");
    }
}
