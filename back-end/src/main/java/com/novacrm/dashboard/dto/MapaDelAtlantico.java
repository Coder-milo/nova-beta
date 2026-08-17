package com.novacrm.dashboard.dto;

import java.util.List;

/**
 * Cuantos participantes hay en cada municipio del Atlantico.
 *
 * @param municipios los <strong>23</strong>, siempre, incluidos los que estan a
 *                   cero. Un municipio que desaparece del mapa cuando no tiene
 *                   a nadie deja un hueco blanco que se lee como un fallo de
 *                   dibujo, no como un cero
 * @param sinUbicar  valores de ciudad que no corresponden a ningun municipio del
 *                   departamento, con el texto tal y como esta escrito en la
 *                   ficha. Se ensena crudo porque es lo unico que dice que hay
 *                   que corregir: la ciudad entro del Excel como texto libre
 * @param sinDato    fichas sin ciudad. Aparte de {@code sinUbicar} porque son
 *                   dos arreglos distintos —a una le falta el dato, a la otra le
 *                   sobra o esta mal escrito—
 * @param total      participantes activos considerados. Municipios + sin ubicar
 *                   + sin dato tiene que dar exactamente esto, o el mapa esta
 *                   perdiendo gente por el camino
 */
public record MapaDelAtlantico(
        List<MunicipioConEstudiantes> municipios,
        List<ValorSinUbicar> sinUbicar,
        long sinDato,
        long total) {

    /** @param codigo codigo DANE de cinco digitos; es la clave con el dibujo */
    public record MunicipioConEstudiantes(String codigo, String nombre, long estudiantes) {}

    /** @param ciudad el texto tal cual esta escrito en la ficha */
    public record ValorSinUbicar(String ciudad, long estudiantes) {}
}
