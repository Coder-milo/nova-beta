package com.novacrm.geo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El emparejado de la ciudad de una ficha con un municipio del Atlántico.
 *
 * <p>La ciudad es texto libre: entró del Excel de matrícula. Lo que fija esta
 * prueba es que lo que no se reconoce <strong>no se adivina</strong>: repartir
 * una ficha dudosa en el municipio más parecido daría un mapa más bonito y
 * mentiroso, y taparía justo lo que hay que corregir en la ficha.
 */
class MunicipiosDelAtlanticoTest {

    @Test
    @DisplayName("estan los 23 y cada uno con su codigo DANE")
    void elDepartamentoEntero() {
        var todos = MunicipiosDelAtlantico.todos();

        assertThat(todos).hasSize(23);
        assertThat(todos).allSatisfy(m -> assertThat(m.codigo()).matches("08\\d{3}"));
        assertThat(todos).extracting(MunicipiosDelAtlantico.Municipio::nombre)
                .contains("Barranquilla", "Soledad", "Malambo", "Galapa");
    }

    @Test
    @DisplayName("reconoce con tildes, sin ellas y en cualquier caja")
    void elTextoLibreVieneComoSea() {
        assertThat(codigoDe("Barranquilla")).isEqualTo("08001");
        assertThat(codigoDe("  BARRANQUILLA  ")).isEqualTo("08001");
        assertThat(codigoDe("manatí")).isEqualTo("08436");
        assertThat(codigoDe("MANATI")).isEqualTo("08436");
        assertThat(codigoDe("Santo Tomás")).isEqualTo("08685");
    }

    @Test
    @DisplayName("reconoce las formas con las que se escribe de verdad")
    void losAliasDeLaPlanilla() {
        assertThat(codigoDe("Barranquilla D.E.")).isEqualTo("08001");
        assertThat(codigoDe("Sto Tomas")).isEqualTo("08685");
        assertThat(codigoDe("Pto. Colombia")).isEqualTo("08573");
    }

    @Test
    @DisplayName("aguanta el adorno del departamento pegado a la ciudad")
    void ciudadConDepartamento() {
        assertThat(codigoDe("Barranquilla, Atlántico")).isEqualTo("08001");
        assertThat(codigoDe("Soledad (Atlántico)")).isEqualTo("08758");
    }

    @Test
    @DisplayName("no confunde Sabanagrande con Sabanalarga")
    void dosNombresQueSeParecen() {
        // Son dos municipios distintos y a 30 km uno del otro. Con una
        // comparacion por prefijo o por contencion mal ordenada, las fichas de
        // uno acabarian pintadas en el otro y nadie lo notaria.
        assertThat(codigoDe("Sabanagrande")).isEqualTo("08634");
        assertThat(codigoDe("Sabanalarga")).isEqualTo("08638");
        assertThat(codigoDe("Sabana Larga")).isEqualTo("08638");
    }

    @Test
    @DisplayName("lo que no es del Atlantico no se ubica")
    void loDeFueraNoSeInventa() {
        assertThat(MunicipiosDelAtlantico.desdeTextoLibre("Bogotá")).isEmpty();
        assertThat(MunicipiosDelAtlantico.desdeTextoLibre("Cartagena")).isEmpty();
    }

    @Test
    @DisplayName("«Otro» y el vacio tampoco se ubican")
    void loQueNoDiceNada() {
        // «Otro» es un valor real de la planilla de matricula. Cae fuera a
        // proposito: el mapa lo cuenta aparte para que se vea cuantas fichas
        // hay que arreglar.
        assertThat(MunicipiosDelAtlantico.desdeTextoLibre("Otro")).isEmpty();
        assertThat(MunicipiosDelAtlantico.desdeTextoLibre("")).isEmpty();
        assertThat(MunicipiosDelAtlantico.desdeTextoLibre("   ")).isEmpty();
        assertThat(MunicipiosDelAtlantico.desdeTextoLibre(null)).isEmpty();
    }

    private static String codigoDe(String texto) {
        return MunicipiosDelAtlantico.desdeTextoLibre(texto)
                .map(MunicipiosDelAtlantico.Municipio::codigo)
                .orElse(null);
    }
}
