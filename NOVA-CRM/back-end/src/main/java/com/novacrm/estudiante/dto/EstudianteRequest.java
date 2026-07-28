package com.novacrm.estudiante.dto;

import com.novacrm.estudiante.EstadoAcademico;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.estudiante.EstadoHito;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Alta y edicion de la ficha de un participante.
 *
 * <p><strong>Los campos nulos no se tocan.</strong> Lo aplica
 * {@code EstudianteService.aplicarRequest} y es deliberado para los hitos de
 * preparacion: el portal del estudiante manda su propio formulario, mas corto,
 * y sin esa regla guardar el perfil desde ahi borraria los hitos que el
 * coordinador acaba de marcar.
 */
public record EstudianteRequest(
        @NotBlank String nombre,
        @NotBlank String apellido,
        @NotBlank @Email String email,
        String telefono,
        String celular,
        String ciudad,
        String barrio,
        String tipoDocumento,
        String numeroDocumento,
        String fechaNacimiento,
        String genero,
        String nacionalidad,
        String nivelEducativo,
        String titulo,
        Integer aniosExperiencia,
        String sectorExperiencia,
        String ultimoCargo,
        String perfilProfesional,
        String sectorObjetivo,
        String cargoObjetivo,
        Boolean disponibilidadMovilidad,
        String clasificacionSisben,
        String situacionLaboral,
        String ingresoMensual,
        Boolean responsableEconomico,
        Boolean haTrabajado,
        Boolean tieneComputador,
        Boolean tieneInternet,
        String motivacion,
        Boolean interesMigratorio,
        String resultadoPruebaEscrita,
        String resultadoPruebaOral,
        String institucionEducativa,
        String programaAcademico,
        String areaFormacion,
        String estadoFormacion,
        String disponibilidadLaboral,
        String estadoBusqueda,
        Integer postulacionesEnviadas,
        Integer empresasContactadas,
        EstadoAcademico estadoAcademico,
        EstadoEmpleabilidad estadoEmpleabilidad,
        UUID programaId,
        String direccion,
        String competencias,
        String idiomas,
        String referencias,
        String disponibilidad,

        // ── Hitos de preparacion ────────────────────────────────────────────
        // Tres estados (NO / EN_PROCESO / SI). Nulo significa "no lo cambies".
        EstadoHito hitoCvListo,
        EstadoHito hitoCvIngles,
        EstadoHito hitoLinkedinCreado,
        EstadoHito hitoLinkedinOptimizado,
        EstadoHito hitoPerfilOcupacional,

        // ── Enlaces de trabajo ──────────────────────────────────────────────
        /** Carpeta de Drive del participante. */
        @Size(max = 1000) String carpetaUrl,
        /** Perfil publico de LinkedIn, distinto del id de OAuth. */
        @Size(max = 1000) String linkedinUrl,

        /** Edad importada de la hoja, con la fecha en que se capturo. */
        Integer edadAlRegistrar,
        LocalDate fechaCapturaEdad
) {}
