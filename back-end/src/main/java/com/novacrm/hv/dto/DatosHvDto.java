package com.novacrm.hv.dto;

import java.util.List;

/**
 * Datos ya normalizados que alimentan la plantilla CAC ATS.
 *
 * <p>Los seis ultimos componentes se anadieron cuando la plantilla dejo de
 * llevar logo y la linea de contacto paso a construirse en Java: hasta entonces
 * el telefono fijo, el pais, el portafolio y el nivel de ingles existian en la
 * ficha del estudiante pero no llegaban al PDF. Se dejan al final, con un
 * constructor de compatibilidad, para no reescribir las llamadas que ya montaban
 * el DTO por posicion.
 *
 * @param linkedinUserId identificador de la integracion OAuth; <b>no</b> es una
 *                       URL. El enlace del PDF sale de {@code linkedinUrl}.
 */
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
    List<FormacionDto> formaciones,
    String telefono,
    String nacionalidad,
    String linkedinUrl,
    String portafolioUrl,
    String nivelIngles,
    List<String> logros
) {

    /** Forma antigua del DTO, sin los campos de contacto ampliados. */
    public DatosHvDto(String nombre,
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
                      List<FormacionDto> formaciones) {
        this(nombre, apellido, cargoObjetivo, email, celular, ciudad, linkedinUserId,
                perfilProfesional, competencias, idiomas, titulo, institucionEducativa,
                nivelEducativo, experiencias, formaciones,
                null, null, null, null, null, null);
    }
}
