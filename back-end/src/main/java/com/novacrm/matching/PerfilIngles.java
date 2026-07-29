package com.novacrm.matching;

import com.novacrm.catalogo.nivel_ingles.NivelMcer;
import com.novacrm.estudiante.Estudiante;

import java.util.Optional;

/**
 * Nivel de ingles de un estudiante distinguiendo lo declarado de lo medido.
 *
 * <p>La distincion no es teorica. En la primera cohorte, 89 de 102
 * participantes declararon un nivel superior al que arrojaron sus pruebas, y 44
 * de ellos por dos niveles completos. Puntuar las vacantes con el nivel
 * declarado enviaba a entrevista a gente que no podia sostenerla, y el fallo no
 * se veia en el sistema: se veia ante la empresa.
 *
 * <p>La brecha se concentra en el oral: la prueba escrita situaba a la mayoria
 * en B1, y la oral al 81% en A1. Por eso las vacantes de voz se puntuan contra
 * el nivel oral y no contra el general.
 */
public record PerfilIngles(
        Optional<NivelMcer> declarado,
        Optional<NivelMcer> escritoMedido,
        Optional<NivelMcer> oralMedido) {

    public static PerfilIngles de(Estudiante estudiante) {
        return new PerfilIngles(
                estudiante.getNivelIngles() == null
                        ? Optional.empty()
                        : NivelMcer.desdeTexto(estudiante.getNivelIngles().getCodigo()),
                NivelMcer.desdeTexto(estudiante.getResultadoPruebaEscrita()),
                NivelMcer.desdeTexto(estudiante.getResultadoPruebaOral()));
    }

    /** Hay al menos una prueba con resultado. */
    public boolean tieneMedicion() {
        return escritoMedido.isPresent() || oralMedido.isPresent();
    }

    /**
     * Nivel a usar para una vacante generica: el menor de los medidos, porque
     * el desempeno real lo marca la destreza mas floja. Si no hay pruebas se
     * recurre al declarado, que es lo unico disponible.
     */
    public Optional<NivelMcer> efectivo() {
        var medido = NivelMcer.menor(escritoMedido, oralMedido);
        return medido.isPresent() ? medido : declarado;
    }

    /**
     * Nivel a usar para una vacante de voz. Si no se midio el oral no se
     * sustituye por el escrito —serian dos destrezas distintas— y se cae al
     * declarado.
     */
    public Optional<NivelMcer> paraVacanteDeVoz() {
        return oralMedido.isPresent() ? oralMedido : declarado;
    }

    /**
     * Cuantos niveles se sobreestima respecto a lo medido. 0 si no hay medicion
     * o si el declarado no supera al medido.
     */
    public int nivelesDeSobreestimacion() {
        var medido = NivelMcer.menor(escritoMedido, oralMedido);
        if (declarado.isEmpty() || medido.isEmpty()) {
            return 0;
        }
        return Math.max(0, declarado.get().getOrden() - medido.get().getOrden());
    }
}
