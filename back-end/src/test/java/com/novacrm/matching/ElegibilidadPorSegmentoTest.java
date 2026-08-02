package com.novacrm.matching;

import com.novacrm.catalogo.nivel_ingles.NivelIngles;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * A quien le sirve realmente una oferta de cada segmento.
 *
 * <p>Con Remotive como unica fuente activa, empleo remoto en ingles se le
 * recomendaba a los 107 participantes por igual. La mayoria de este cohorte
 * mide A1 oral y buena parte no tiene computador propio: la recomendacion no
 * era debil, era imposible de tomar.
 */
class ElegibilidadPorSegmentoTest {

    private Estudiante conMediosYNivel() {
        var e = new Estudiante();
        e.setTieneComputador(true);
        e.setTieneInternet(true);
        e.setResultadoPruebaEscrita("B1");
        e.setResultadoPruebaOral("B1");
        return e;
    }

    @Test
    void elEmpleoLocalLeSirveACualquiera() {
        assertTrue(ElegibilidadPorSegmento.esElegible(new Estudiante(), Segmento.LOCAL_COLOMBIA));
    }

    @Test
    void elRemotoEnInglesExigeMediosYNivelMedido() {
        assertTrue(ElegibilidadPorSegmento.esElegible(conMediosYNivel(), Segmento.REMOTO_INGLES));
    }

    @Test
    void sinComputadorNoHayEmpleoRemotoPorMuchoInglesQueSeTenga() {
        var e = conMediosYNivel();
        e.setTieneComputador(false);

        assertFalse(ElegibilidadPorSegmento.esElegible(e, Segmento.REMOTO_INGLES));
    }

    @Test
    void sinInternetTampoco() {
        var e = conMediosYNivel();
        e.setTieneInternet(false);

        assertFalse(ElegibilidadPorSegmento.esElegible(e, Segmento.REMOTO_INGLES));
    }

    /** 89 de 102 participantes declararon mas nivel del que midieron. */
    @Test
    void elNivelDeclaradoNoBastaParaElRemotoEnIngles() {
        var e = conMediosYNivel();
        e.setResultadoPruebaEscrita(null);
        e.setResultadoPruebaOral(null);
        var declarado = new NivelIngles();
        declarado.setCodigo("B2");
        e.setNivelIngles(declarado);

        assertFalse(ElegibilidadPorSegmento.esElegible(e, Segmento.REMOTO_INGLES),
                "sin prueba no hay nivel que valga para trabajar con una empresa de fuera");
    }

    @Test
    void unA2MedidoNoAlcanzaParaTrabajarEnIngles() {
        var e = conMediosYNivel();
        e.setResultadoPruebaOral("A2+");

        assertFalse(ElegibilidadPorSegmento.esElegible(e, Segmento.REMOTO_INGLES),
                "manda la destreza mas floja de las medidas");
    }

    /** Un dato que falta no se toma por bueno. */
    @Test
    void sinResponderSiTieneComputadorNoRecibeOfertasRemotas() {
        var e = conMediosYNivel();
        e.setTieneComputador(null);

        assertFalse(ElegibilidadPorSegmento.esElegible(e, Segmento.REMOTO_INGLES));
    }

    @Test
    void migrarSoloSeLeOfreceAQuienLoBusca() {
        var interesado = new Estudiante();
        interesado.setInteresMigratorio(true);
        var sinInteres = new Estudiante();
        sinInteres.setInteresMigratorio(false);

        assertTrue(ElegibilidadPorSegmento.esElegible(interesado, Segmento.MIGRACION));
        assertFalse(ElegibilidadPorSegmento.esElegible(sinInteres, Segmento.MIGRACION));
        assertFalse(ElegibilidadPorSegmento.esElegible(new Estudiante(), Segmento.MIGRACION),
                "sin responder no se asume que quiere irse del pais");
    }

    /**
     * Las vacantes que registra el equipo a mano y las anteriores al campo no
     * declaran segmento. Se dejan pasar: es lo que se hacia hasta ahora, y
     * suponerles uno seria inventarse el dato.
     */
    @Test
    void unaVacanteSinSegmentoLlegaATodos() {
        var vacante = new Vacante();
        vacante.setTitulo("Auxiliar administrativo");

        assertTrue(ElegibilidadPorSegmento.esElegible(new Estudiante(), vacante));
    }

    @Test
    void elSegmentoDeLaVacanteEsElQueDecide() {
        var remota = new Vacante();
        remota.setTitulo("Customer Success Manager");
        remota.setSegmento(Segmento.REMOTO_INGLES);

        assertTrue(ElegibilidadPorSegmento.esElegible(conMediosYNivel(), remota));
        assertFalse(ElegibilidadPorSegmento.esElegible(new Estudiante(), remota));
    }
}
