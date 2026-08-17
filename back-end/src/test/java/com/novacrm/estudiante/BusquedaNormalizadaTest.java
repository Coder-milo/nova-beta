package com.novacrm.estudiante;

import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La busqueda de estudiantes contra Postgres de verdad.
 *
 * <p>Va contra la base y no con dobles porque lo que se esta probando es
 * justamente el SQL: {@code novacrm_normalizar} vive en la base (V38) y se
 * invoca desde JPQL con {@code FUNCTION(...)}. Un doble del repositorio
 * confirmaria que el metodo se llama y no que la consulta compila ni que la
 * funcion existe, que es lo unico que aqui puede romperse.
 *
 * <p>Todo va dentro de una transaccion que se deshace al terminar: esta base de
 * desarrollo tiene los datos reales del programa y una prueba no puede dejar
 * fichas sueltas en ella.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BusquedaNormalizadaTest {

    @Autowired
    private EstudianteRepository estudianteRepository;

    @Autowired
    private ProgramaRepository programaRepository;

    private UUID programaId;
    private String sufijo;

    @BeforeEach
    void prepararParticipante() {
        // Sufijo unico: el correo es unico en la tabla y esta base ya tiene
        // datos, asi que un valor fijo chocaria con lo que hubiera.
        sufijo = UUID.randomUUID().toString().substring(0, 8);
        Programa programa = programaRepository.findAll().stream().findFirst().orElseThrow();
        programaId = programa.getId();

        var estudiante = new Estudiante();
        estudiante.setNombre("José Andrés");
        estudiante.setApellido("Pérez Gómez");
        estudiante.setEmail("Jose.Perez." + sufijo + "@Correo.COM");
        estudiante.setNumeroDocumento("1.234." + sufijo.substring(0, 3));
        estudiante.setCiudad("Barranquilla");
        estudiante.setPrograma(programa);
        estudiante.setActivo(true);
        estudianteRepository.saveAndFlush(estudiante);
    }

    @Test
    @DisplayName("se encuentra escribiendo el nombre sin tildes")
    void encuentraSinTildes() {
        var resultado = estudianteRepository.buscarAvanzado(
                "jose andres", programaId, null, null, null, PageRequest.of(0, 20));

        assertThat(resultado.getContent())
                .extracting(Estudiante::getApellido)
                .contains("Pérez Gómez");
    }

    @Test
    @DisplayName("se encuentra escribiendo el nombre completo, que vive en dos columnas")
    void encuentraPorNombreCompleto() {
        assertThat(estudianteRepository.buscarAvanzado(
                "jose andres perez gomez", programaId, null, null, null, PageRequest.of(0, 20)))
                .isNotEmpty();

        // Los listados exportados invierten el orden.
        assertThat(estudianteRepository.buscarAvanzado(
                "perez gomez jose", programaId, null, null, null, PageRequest.of(0, 20)))
                .isNotEmpty();
    }

    @Test
    @DisplayName("se encuentra en MAYUSCULAS y con el documento escrito con puntos o sin ellos")
    void encuentraIgnorandoCajaYPuntuacion() {
        assertThat(estudianteRepository.buscarAvanzado(
                "PÉREZ GÓMEZ", programaId, null, null, null, PageRequest.of(0, 20))).isNotEmpty();

        String documentoSinPuntos = "1234" + sufijo.substring(0, 3);
        assertThat(estudianteRepository.buscarAvanzado(
                documentoSinPuntos, programaId, null, null, null, PageRequest.of(0, 20))).isNotEmpty();
    }

    @Test
    @DisplayName("un nombre que no existe no devuelve a nadie")
    void noInventaResultados() {
        assertThat(estudianteRepository.buscarAvanzado(
                "zzz no existe nadie asi", programaId, null, null, null, PageRequest.of(0, 20)))
                .isEmpty();
    }

    @Test
    @DisplayName("la busqueda recorre toda la cohorte y no solo una pagina")
    void buscaSobreTodaLaTabla() {
        var programa = programaRepository.findById(programaId).orElseThrow();
        var estudiante2 = new Estudiante();
        estudiante2.setNombre("Maria");
        estudiante2.setApellido("Gomez");
        estudiante2.setEmail("maria." + sufijo + "@correo.com");
        estudiante2.setPrograma(programa);
        estudiante2.setActivo(true);
        estudianteRepository.saveAndFlush(estudiante2);

        // La pagina 0 con tamano 1 tiene un solo elemento, pero el total dice
        // cuantos hay de verdad: es lo que permite a la interfaz buscar entre
        // los 108 y no entre los 20 que tenia cargados.
        var primeraPagina = estudianteRepository.buscarAvanzado(
                null, programaId, null, null, null, PageRequest.of(0, 1));

        assertThat(primeraPagina.getContent()).hasSize(1);
        assertThat(primeraPagina.getTotalElements()).isGreaterThan(1L);
    }

    @Test
    @DisplayName("el correo se reconoce aunque cambie la caja, y el documento aunque lleve puntos")
    void deduplicacionReconoceLasVariantes() {
        assertThat(estudianteRepository.findByEmailIgnoreCase("jose.perez." + sufijo + "@correo.com"))
                .as("mismo correo en minúsculas")
                .isPresent();

        assertThat(estudianteRepository.findByDocumentoNormalizado("1234" + sufijo.substring(0, 3)))
                .as("mismo documento sin los puntos de miles")
                .isPresent();

        assertThat(estudianteRepository.buscarPorNombreCompletoNormalizado("JOSE ANDRES PEREZ GOMEZ"))
                .as("mismo nombre en mayúsculas y sin tildes")
                .hasSize(1);
    }
}
