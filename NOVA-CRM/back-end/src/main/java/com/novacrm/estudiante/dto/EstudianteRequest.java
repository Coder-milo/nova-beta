package com.novacrm.estudiante.dto;

import com.novacrm.estudiante.EstadoAcademico;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

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
        UUID programaId
) {}
