package com.novacrm.perfil.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Un empleo de la hoja de vida, tal y como lo escribe el propio estudiante.
 *
 * <p>Los topes son los de las columnas, no una cifra inventada: sin ellos, un
 * texto mas largo que la columna llega hasta la base y sale un 22001 crudo —un
 * 500 sin explicacion— en vez de un mensaje que diga que hay que acortar. La
 * importacion ya recorta por esta misma razon; aqui, que es donde escribe una
 * persona a mano, no habia nada.
 *
 * <p>{@code funciones} es TEXT y no tenia limite ninguno. Es el endpoint que
 * alcanza el rol con menos permisos, y lo que se guarde ahi se lee en cada
 * analisis de completitud y se pinta en cada hoja de vida generada. Cinco mil
 * caracteres son varias paginas: de sobra para contar un empleo.
 */
public record ExperienciaRequest(
        @NotBlank @Size(max = 255) String empresa,
        @NotBlank @Size(max = 255) String cargo,
        @Size(max = 255) String ciudad,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        boolean relacionada,
        @Size(max = 5000) String funciones,
        boolean actual
) {}
