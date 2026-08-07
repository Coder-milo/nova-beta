package com.novacrm.seguridad;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.estudiante.EstudianteService;
import com.novacrm.estudiante.dto.EstudianteRequest;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Que puede y que no puede cambiarse el propio estudiante de su ficha.
 *
 * <p>{@code PUT /estudiantes/mi-perfil} recibe el mismo DTO completo que usa la
 * gestion. Aplicado entero, el formulario del portal se convertia en una via
 * para autocertificarse: escribirse el resultado de la prueba de ingles —de
 * donde sale el nivel que pesa en el matching y que decide la elegibilidad para
 * vacantes remotas en ingles— y darse por colocado, que es el numero con el que
 * se mide el programa.
 *
 * <p>Va contra la base porque lo que se prueba es el efecto de guardar, no que
 * se llame a un metodo. Todo dentro de una transaccion que se deshace: esta
 * base tiene los participantes reales.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AutoedicionDePerfilTest {

    @Autowired
    private EstudianteService estudianteService;

    @Autowired
    private EstudianteRepository estudianteRepository;

    @Autowired
    private ProgramaRepository programaRepository;

    private UUID estudianteId;
    private UUID otroProgramaId;

    @BeforeEach
    void crearFicha() {
        Programa programa = programaRepository.findAll().stream().findFirst().orElseThrow();
        otroProgramaId = programaRepository.findAll().stream()
                .map(Programa::getId)
                .filter(id -> !id.equals(programa.getId()))
                .findFirst()
                .orElse(programa.getId());

        var e = new Estudiante();
        e.setNombre("Prueba");
        e.setApellido("Autoedicion");
        e.setEmail("prueba.autoedicion." + UUID.randomUUID() + "@correo.com");
        e.setPrograma(programa);
        e.setActivo(true);
        e.setResultadoPruebaEscrita("A2");
        e.setResultadoPruebaOral("A1");
        e.setEstadoEmpleabilidad(com.novacrm.estudiante.EstadoEmpleabilidad.SIN_INFO);
        e.setEstadoAcademico(com.novacrm.estudiante.EstadoAcademico.ACTIVO);
        e.setPostulacionesEnviadas(0);
        estudianteId = estudianteRepository.saveAndFlush(e).getId();
    }

    /**
     * Una peticion que intenta cambiarlo todo a la vez, legitimo y no.
     *
     * <p>Es el cuerpo que se enviaria a mano contra {@code /mi-perfil}: el
     * formulario del portal no ofrece estos campos, pero el endpoint recibe el
     * DTO completo y nada impide rellenarlos.
     */
    private EstudianteRequest peticionQueIntentaEscalar() {
        return new EstudianteRequest(
                "Prueba", // nombre
                "Autoedicion", // apellido
                "otro.correo@ejemplo.com", // email
                null,
                "3001234567", // celular
                "Soledad", // ciudad
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "BPO", // sectorObjetivo
                "Asesor bilingue", // cargoObjetivo
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "C1", // resultadoPruebaEscrita
                "C1", // resultadoPruebaOral
                null,
                null,
                null,
                null,
                null,
                null,
                99, // postulacionesEnviadas
                null,
                com.novacrm.estudiante.EstadoAcademico.GRADUADO,
                com.novacrm.estudiante.EstadoEmpleabilidad.EMPLEADO,
                otroProgramaId, // programaId
                "Calle 1", // direccion
                "Zendesk, Excel", // competencias
                "Espanol, Ingles", // idiomas
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    @Test
    @DisplayName("el estudiante no puede escribirse su propio nivel de ingles medido")
    void noPuedeAutocertificarseElIngles() {
        estudianteService.actualizarMiPerfil(estudianteId, peticionQueIntentaEscalar());

        var guardado = estudianteRepository.findById(estudianteId).orElseThrow();
        assertThat(guardado.getResultadoPruebaEscrita())
                .as("la prueba escrita la registra quien evalúa, no el evaluado")
                .isEqualTo("A2");
        assertThat(guardado.getResultadoPruebaOral()).isEqualTo("A1");
    }

    @Test
    @DisplayName("el estudiante no puede darse por colocado ni por graduado")
    void noPuedeCambiarSuEstado() {
        estudianteService.actualizarMiPerfil(estudianteId, peticionQueIntentaEscalar());

        var guardado = estudianteRepository.findById(estudianteId).orElseThrow();
        assertThat(guardado.getEstadoEmpleabilidad())
                .isEqualTo(com.novacrm.estudiante.EstadoEmpleabilidad.SIN_INFO);
        assertThat(guardado.getEstadoAcademico())
                .isEqualTo(com.novacrm.estudiante.EstadoAcademico.ACTIVO);
    }

    @Test
    @DisplayName("el estudiante no puede cambiarse de programa ni cambiar su correo de acceso")
    void noPuedeCambiarProgramaNiCorreo() {
        var antes = estudianteRepository.findById(estudianteId).orElseThrow();
        String correoOriginal = antes.getEmail();
        UUID programaOriginal = antes.getPrograma().getId();

        estudianteService.actualizarMiPerfil(estudianteId, peticionQueIntentaEscalar());

        var guardado = estudianteRepository.findById(estudianteId).orElseThrow();
        assertThat(guardado.getEmail()).isEqualTo(correoOriginal);
        assertThat(guardado.getPrograma().getId()).isEqualTo(programaOriginal);
    }

    @Test
    @DisplayName("si puede corregir su contacto y el contenido de su hoja de vida")
    void siPuedeEditarLoSuyo() {
        estudianteService.actualizarMiPerfil(estudianteId, peticionQueIntentaEscalar());

        var guardado = estudianteRepository.findById(estudianteId).orElseThrow();
        assertThat(guardado.getCelular()).isEqualTo("3001234567");
        assertThat(guardado.getCiudad()).isEqualTo("Soledad");
        assertThat(guardado.getDireccion()).isEqualTo("Calle 1");
        assertThat(guardado.getCargoObjetivo()).isEqualTo("Asesor bilingue");
        assertThat(guardado.getCompetencias()).isEqualTo("Zendesk, Excel");
    }

    @Test
    @DisplayName("la ruta de gestión sí escribe la ficha entera")
    void laRutaDeGestionSiEscribeTodo() {
        estudianteService.actualizar(estudianteId, peticionQueIntentaEscalar());

        var guardado = estudianteRepository.findById(estudianteId).orElseThrow();
        assertThat(guardado.getResultadoPruebaEscrita())
                .as("quien coordina sí registra el resultado de la prueba")
                .isEqualTo("C1");
    }
}
