package com.novacrm.hv.dto;

import java.util.List;

public record DatosHvDto(
    String nombre,
    String apellido,
    String cargoObjetivo,
    String email,
    String celular,
    String ciudad,
    String linkedinUserId,
    String perfilProfesional,
    String competencias,
    String idiomas,
    String titulo,
    String institucionEducativa,
    String nivelEducativo,
    List<ExperienciaDto> experiencias,
    List<FormacionDto> formaciones
) {}
