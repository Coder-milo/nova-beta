package com.novacrm.excel;

import com.novacrm.colocacion.CanalConsecucion;
import com.novacrm.empresa.EstadoRelacion;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Conversión de los valores que salen de una hoja de cálculo.
 *
 * <p>Es la clase donde un error no da la cara: la importación termina «bien» y
 * el dato entra mal. El caso que más duele es el salario: en Colombia el punto
 * agrupa los miles, así que leer "1.423.500" con el punto como decimal
 * convierte un sueldo en algo más de mil pesos y descuadra en silencio todos
 * los indicadores de cierre de cohorte.
 */
class LectorHojaTest {

    @Test
    @DisplayName("el punto agrupa miles, no separa decimales")
    void salarioConPuntosDeMiles() {
        assertThat(LectorHoja.dinero("1.423.500")).isEqualByComparingTo(new BigDecimal("1423500"));
        assertThat(LectorHoja.dinero("$ 1.423.500")).isEqualByComparingTo(new BigDecimal("1423500"));
        assertThat(LectorHoja.dinero("1423500")).isEqualByComparingTo(new BigDecimal("1423500"));
    }

    @Test
    @DisplayName("la coma final sí es el separador decimal")
    void salarioConDecimales() {
        assertThat(LectorHoja.dinero("1.423.500,50")).isEqualByComparingTo(new BigDecimal("1423500.50"));
    }

    @Test
    @DisplayName("un importe ilegible no revienta la fila, devuelve nulo")
    void salarioIlegible() {
        assertThat(LectorHoja.dinero("por definir")).isNull();
        assertThat(LectorHoja.dinero("")).isNull();
        assertThat(LectorHoja.dinero(null)).isNull();
    }

    @Test
    @DisplayName("las fechas llegan en varios formatos y todos valen")
    void fechasEnVariosFormatos() {
        var esperada = LocalDate.of(2025, 3, 7);
        assertThat(LectorHoja.fecha("2025-03-07")).isEqualTo(esperada);
        assertThat(LectorHoja.fecha("7/3/2025")).isEqualTo(esperada);
        assertThat(LectorHoja.fecha("7-3-2025")).isEqualTo(esperada);
        assertThat(LectorHoja.fecha("no aplica")).isNull();
    }

    /**
     * Las hojas que salen de un Drive en inglés agrupan los miles con coma. Con
     * la regla de «la última coma es el decimal», ese mismo sueldo se leía como
     * 1423,50: el error de tres ceros que este método existe para evitar, por
     * el otro lado.
     */
    @Test
    @DisplayName("la coma también agrupa miles cuando la hoja viene en inglés")
    void salarioConComasDeMiles() {
        assertThat(LectorHoja.dinero("1,423,500")).isEqualByComparingTo(new BigDecimal("1423500"));
        assertThat(LectorHoja.dinero("$ 1,423,500.50")).isEqualByComparingTo(new BigDecimal("1423500.50"));
        // Un solo separador con dos cifras detrás sí es decimal, venga como venga.
        assertThat(LectorHoja.dinero("1500,50")).isEqualByComparingTo(new BigDecimal("1500.50"));
        assertThat(LectorHoja.dinero("1500.50")).isEqualByComparingTo(new BigDecimal("1500.50"));
        // Y con tres detrás, agrupa: "1.500" son mil quinientos pesos.
        assertThat(LectorHoja.dinero("1.500")).isEqualByComparingTo(new BigDecimal("1500"));
        assertThat(LectorHoja.dinero("1,500")).isEqualByComparingTo(new BigDecimal("1500"));
    }

    @Test
    @DisplayName("sí/no se reconoce escrito como lo escribe la gente")
    void booleanos() {
        assertThat(LectorHoja.booleano("Sí")).isTrue();
        assertThat(LectorHoja.booleano("SI")).isTrue();
        assertThat(LectorHoja.booleano("x")).isTrue();
        assertThat(LectorHoja.booleano("No")).isFalse();
        assertThat(LectorHoja.booleano("0")).isFalse();
        assertThat(LectorHoja.booleano("tal vez")).isNull();
        // Las opciones reales del formulario no son "Sí" a secas.
        assertThat(LectorHoja.booleano("Sí, tengo acceso a un computador")).isTrue();
        assertThat(LectorHoja.booleano("✅ Sí")).isTrue();
        assertThat(LectorHoja.booleano("⏳ Pendiente")).isFalse();
    }

    /**
     * Lo que no se respondió no es un sí.
     *
     * <p>Decidir por el principio de la cadena hacía que «Sin verificar» —lo más
     * común en una casilla que nadie tocó— entrara como afirmación, y que
     * «Nombre» entrara como negación. La casilla que dice si una vinculación se
     * revisó acababa marcada como revisada sin que nadie la revisara.
     */
    @Test
    @DisplayName("«sin dato» no es ni sí ni no")
    void loQueNoSeRespondioNoEsUnSi() {
        assertThat(LectorHoja.booleano("Sin verificar")).isNull();
        assertThat(LectorHoja.booleano("Sin datos")).isNull();
        assertThat(LectorHoja.booleano("Sin información")).isNull();
        assertThat(LectorHoja.booleano("N/A")).isNull();
        assertThat(LectorHoja.booleano("Nombre")).isNull();
    }

    /**
     * Las hojas traen la etiqueta, no la constante interna. Pedirle al equipo
     * que escriba {@code EN_CONVERSACION} en vez de "En conversacion" es mover
     * el trabajo de sitio, no ahorrarlo.
     */
    @Test
    @DisplayName("los enums se reconocen por etiqueta y por nombre")
    void enumsPorEtiquetaOPorNombre() {
        assertThat(LectorHoja.enumDe(EstadoRelacion.class, "En conversacion", EstadoRelacion::getEtiqueta))
                .isEqualTo(EstadoRelacion.EN_CONVERSACION);
        assertThat(LectorHoja.enumDe(EstadoRelacion.class, "EN_CONVERSACION", EstadoRelacion::getEtiqueta))
                .isEqualTo(EstadoRelacion.EN_CONVERSACION);
        // Sin tildes ni mayusculas exactas tambien.
        assertThat(LectorHoja.enumDe(EstadoRelacion.class, "  aliada ", EstadoRelacion::getEtiqueta))
                .isEqualTo(EstadoRelacion.ALIADA);
        assertThat(LectorHoja.enumDe(CanalConsecucion.class, "Feria de empleo", CanalConsecucion::getEtiqueta))
                .isEqualTo(CanalConsecucion.FERIA);
        assertThat(LectorHoja.enumDe(EstadoRelacion.class, "inventado", EstadoRelacion::getEtiqueta)).isNull();
    }
}
