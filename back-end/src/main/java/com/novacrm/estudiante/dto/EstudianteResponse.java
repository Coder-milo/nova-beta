package com.novacrm.estudiante.dto;

import com.novacrm.estudiante.EstadoAcademico;
import com.novacrm.estudiante.EstadoEmpleabilidad;

import java.time.Instant;
import java.util.UUID;

public record EstudianteResponse(
        UUID id,
        String nombre,
        String apellido,
        String email,
        String telefono,
        String celular,
        String ciudad,
        String barrio,
        String tipoDocumento,
        String numeroDocumento,
        String nivelEducativo,
        String titulo,
        Integer aniosExperiencia,
        String sectorExperiencia,
        String ultimoCargo,
        String perfilProfesional,
        String sectorObjetivo,
        String cargoObjetivo,
        Boolean disponibilidadMovilidad,
        String nacionalidad,
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
        String nivelIngles,
        UUID programaId,
        String programaNombre,
        boolean activo,
        Instant createdAt,
        Instant deletedAt,
        String direccion,
        String fotoUrl,
        String competencias,
        String idiomas,
        String referencias,
        String disponibilidad,
        int porcentajeCompletitud,

        // ── Hitos de preparacion ────────────────────────────────────────────
        String hitoCvListo,
        String hitoCvIngles,
        String hitoLinkedinCreado,
        String hitoLinkedinOptimizado,
        String hitoPerfilOcupacional,
        /** Cuantos de los cinco estan terminados. */
        int hitosCumplidos,
        /** Lo que falta, en el orden en que conviene hacerlo. */
        java.util.List<String> pendientesPreparacion,

        /**
         * El "% de empleabilidad" que reporta el programa.
         *
         * <p>Derivado, no guardado: sale de los cinco hitos y de tener
         * colocacion vigente. Guardarlo obligaria a recalcularlo a mano cada
         * vez que cambia un hito, que es como la hoja acabo con la columna
         * desfasada.
         */
        int porcentajeEmpleabilidad,
        /** Si tiene una colocacion vigente registrada. */
        boolean colocado,

        // ── Edad ────────────────────────────────────────────────────────────
        java.time.LocalDate fechaNacimiento,
        Integer edadAlRegistrar,
        java.time.LocalDate fechaCapturaEdad,
        /** Resuelta a dia de hoy; nula si no hay con que calcularla. */
        Integer edad,

        // ── Enlaces de trabajo ──────────────────────────────────────────────
        String carpetaUrl,
        String linkedinUrl,
        UUID plantillaPreferidaId
) {}
