package com.novacrm.colocacion;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.util.ArrayList;
import java.util.List;

/**
 * Verificaciones que el programa hace tras colocar a alguien.
 *
 * <p>No es papeleo: es lo que separa una colocacion de una colocacion digna.
 * Comprobar que hay contrato firmado, que la vacante era real, que el salario
 * esta en el rango del mercado y que la persona recibio el reglamento y su
 * primera colilla de pago es la forma de detectar a tiempo que a un
 * participante lo engancharon en condiciones que no son las que le ofrecieron.
 *
 * <p><strong>Cada casilla tiene tres estados, no dos.</strong> {@code null}
 * significa que nadie lo ha mirado; {@code false}, que se miro y no cumple. Con
 * un booleano las dos cosas se ven igual en el tablero, y la unica que hay que
 * perseguir es la segunda.
 */
@Embeddable
public class ChecklistIngreso {

    @Column(name = "chk_contrato")
    private Boolean contrato;

    @Column(name = "chk_verificacion_vacante")
    private Boolean verificacionVacante;

    @Column(name = "chk_benchmark")
    private Boolean benchmark;

    @Column(name = "chk_reglamento_interno")
    private Boolean reglamentoInterno;

    @Column(name = "chk_colilla_pago")
    private Boolean colillaPago;

    private record Item(String nombre, Boolean valor) {}

    private List<Item> items() {
        return List.of(
                new Item("Contrato firmado", contrato),
                new Item("Verificacion de la vacante", verificacionVacante),
                new Item("Benchmark salarial", benchmark),
                new Item("Reglamento interno entregado", reglamentoInterno),
                new Item("Colilla de pago recibida", colillaPago));
    }

    /** Total de verificaciones. Sirve para pintar "3 de 5". */
    public int total() {
        return items().size();
    }

    public int verificados() {
        return (int) items().stream().filter(i -> Boolean.TRUE.equals(i.valor())).count();
    }

    /** Miradas y no cumplen. Es lo unico que hay que perseguir. */
    public List<String> incumplidos() {
        var salida = new ArrayList<String>();
        items().stream().filter(i -> Boolean.FALSE.equals(i.valor()))
                .forEach(i -> salida.add(i.nombre()));
        return salida;
    }

    /** Sin revisar todavia. */
    public List<String> sinRevisar() {
        var salida = new ArrayList<String>();
        items().stream().filter(i -> i.valor() == null).forEach(i -> salida.add(i.nombre()));
        return salida;
    }

    public boolean completo() {
        return verificados() == total();
    }

    /** Resumen legible para el listado: "Completo", "Falta X", "3 sin revisar". */
    public String resumen() {
        if (!incumplidos().isEmpty()) {
            return "No cumple: " + String.join(", ", incumplidos());
        }
        if (completo()) {
            return "Completo";
        }
        return sinRevisar().size() + " sin revisar";
    }

    public Boolean getContrato() { return contrato; }
    public void setContrato(Boolean contrato) { this.contrato = contrato; }
    public Boolean getVerificacionVacante() { return verificacionVacante; }
    public void setVerificacionVacante(Boolean v) { this.verificacionVacante = v; }
    public Boolean getBenchmark() { return benchmark; }
    public void setBenchmark(Boolean benchmark) { this.benchmark = benchmark; }
    public Boolean getReglamentoInterno() { return reglamentoInterno; }
    public void setReglamentoInterno(Boolean v) { this.reglamentoInterno = v; }
    public Boolean getColillaPago() { return colillaPago; }
    public void setColillaPago(Boolean colillaPago) { this.colillaPago = colillaPago; }
}
