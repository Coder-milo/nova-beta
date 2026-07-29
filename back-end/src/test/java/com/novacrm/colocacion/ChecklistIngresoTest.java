package com.novacrm.colocacion;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class ChecklistIngresoTest {

    private static final BigDecimal META = new BigDecimal("2276176");

    @Test
    @DisplayName("sin revisar y revisado sin cumplir no son lo mismo")
    void sinRevisarYRevisadoSinCumplirNoSonLoMismo() {
        // Es la razon de que las casillas sean Boolean y no boolean: con un
        // booleano las dos cosas se ven igual en el tablero y solo una de ellas
        // hay que perseguirla.
        var checklist = new ChecklistIngreso();
        checklist.setContrato(false);

        assertThat(checklist.incumplidos()).containsExactly("Contrato firmado");
        assertThat(checklist.sinRevisar()).hasSize(4).doesNotContain("Contrato firmado");
    }

    @Test
    @DisplayName("un checklist recien creado esta entero sin revisar")
    void unChecklistRecienCreadoEstaEnteroSinRevisar() {
        var checklist = new ChecklistIngreso();

        assertThat(checklist.verificados()).isZero();
        assertThat(checklist.sinRevisar()).hasSize(5);
        assertThat(checklist.incumplidos()).isEmpty();
        assertThat(checklist.completo()).isFalse();
        assertThat(checklist.resumen()).isEqualTo("5 sin revisar");
    }

    @Test
    @DisplayName("el resumen antepone lo que no cumple a lo que falta por mirar")
    void elResumenAnteponeLoQueNoCumple() {
        var checklist = new ChecklistIngreso();
        checklist.setContrato(true);
        checklist.setBenchmark(false);

        assertThat(checklist.resumen()).isEqualTo("No cumple: Benchmark salarial");
    }

    @Test
    @DisplayName("con las cinco casillas verificadas el checklist esta completo")
    void conLasCincoCasillasVerificadasEstaCompleto() {
        var checklist = new ChecklistIngreso();
        checklist.setContrato(true);
        checklist.setVerificacionVacante(true);
        checklist.setBenchmark(true);
        checklist.setReglamentoInterno(true);
        checklist.setColillaPago(true);

        assertThat(checklist.completo()).isTrue();
        assertThat(checklist.verificados()).isEqualTo(checklist.total());
        assertThat(checklist.resumen()).isEqualTo("Completo");
    }

    @Test
    @DisplayName("un salario por encima de la meta da diferencia positiva")
    void unSalarioPorEncimaDeLaMetaDaDiferenciaPositiva() {
        var colocacion = new Colocacion();
        colocacion.setSalario(new BigDecimal("2850000"));

        assertThat(colocacion.diferenciaVsMeta(META)).isEqualByComparingTo("573824");
        assertThat(colocacion.superaMeta(META)).isTrue();
    }

    @Test
    @DisplayName("un salario por debajo de la meta da diferencia negativa")
    void unSalarioPorDebajoDeLaMetaDaDiferenciaNegativa() {
        var colocacion = new Colocacion();
        colocacion.setSalario(new BigDecimal("2200000"));

        assertThat(colocacion.diferenciaVsMeta(META)).isEqualByComparingTo("-76176");
        assertThat(colocacion.superaMeta(META)).isFalse();
    }

    @Test
    @DisplayName("sin salario registrado no se inventa una diferencia")
    void sinSalarioRegistradoNoSeInventaDiferencia() {
        var colocacion = new Colocacion();

        assertThat(colocacion.diferenciaVsMeta(META)).isNull();
        assertThat(colocacion.superaMeta(META)).isFalse();
    }

    @Test
    @DisplayName("un salario justo en la meta cuenta como que la alcanza")
    void unSalarioJustoEnLaMetaCuentaComoQueLaAlcanza() {
        var colocacion = new Colocacion();
        colocacion.setSalario(META);

        assertThat(colocacion.superaMeta(META)).isTrue();
    }

    @Test
    @DisplayName("una vinculacion a formacion no cuenta como empleo")
    void unaVinculacionAFormacionNoCuentaComoEmpleo() {
        // Sumarla al total de colocados infla el indicador con gente que sigue
        // estudiando; la hoja tambien la lleva en una casilla aparte.
        assertThat(TipoVinculacion.FORMACION.esEmpleo()).isFalse();
        assertThat(TipoVinculacion.EMPLEADO.esEmpleo()).isTrue();
        assertThat(TipoVinculacion.PRACTICANTE.esEmpleo()).isTrue();
    }

    @Test
    @DisplayName("lo autogestionado no se atribuye al programa")
    void loAutogestionadoNoSeAtribuyeAlPrograma() {
        assertThat(CanalConsecucion.AUTOGESTIONADO.esGestionadaPorElPrograma()).isFalse();
        assertThat(CanalConsecucion.OPEN_HOUSE.esGestionadaPorElPrograma()).isTrue();
        assertThat(CanalConsecucion.VISITA_CAC.esGestionadaPorElPrograma()).isTrue();
    }
}
