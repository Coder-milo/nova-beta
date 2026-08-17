package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El colador bilingüe.
 *
 * <p>Lo que fija esta prueba es sobre todo <strong>qué no cuenta como prueba de
 * inglés</strong>. Un filtro demasiado generoso no se nota —el tablón se llena
 * de ofertas monolingües y nadie sabe por qué— y uno demasiado estricto tampoco,
 * porque lo que descarta de más no lo ve nadie.
 */
class FiltroBilingueTest {

    private static Vacante oferta(String titulo, String descripcion) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setDescripcion(descripcion);
        v.setSegmento(Segmento.LOCAL_COLOMBIA);
        return v;
    }

    @Test
    @DisplayName("pasa la que dice bilingue, con tilde o sin ella")
    void bilingueEnElTitulo() {
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                oferta("Asesor Bilingüe Call Center", "Turnos rotativos."))).isTrue();
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                oferta("Agente bilingue", "BPO en Barranquilla."))).isTrue();
    }

    @Test
    @DisplayName("pasa la que pide ingles en la descripcion aunque el titulo no lo diga")
    void elIdiomaPuedeEstarSoloEnElCuerpo() {
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                oferta("Asesor de servicio al cliente",
                       "Requisito: ingles conversacional para atender clientes de USA.")))
                .isTrue();
    }

    @Test
    @DisplayName("cae la que no menciona el idioma por ningun lado")
    void sinIdiomaNoPasa() {
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                oferta("Asesor comercial", "Ventas en punto fijo, horario de lunes a sabado.")))
                .isFalse();
    }

    @Test
    @DisplayName("un cargo en ingles no prueba que el trabajo sea en ingles")
    void elCargoEnInglesNoBasta() {
        // Los portales colombianos publican cargos en ingles para plazas
        // enteramente en espanol. Si esto pasara, el filtro no filtraria nada:
        // media pagina de Computrabajo se titula «Customer Service Agent».
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                oferta("Customer Service Agent", "Atencion a usuarios en Barranquilla.")))
                .isFalse();
    }

    @Test
    @DisplayName("el nombre de un BPO tampoco prueba nada")
    void laEmpresaNoEsPrueba() {
        // Los grandes BPO del Atlantico contratan tambien para campanas en
        // espanol. El filtro no mira la empresa a proposito.
        var v = oferta("Asesor de servicio", "Vacante en contact center, campana nacional.");
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isFalse();
    }

    @Test
    @DisplayName("un anuncio escrito en ingles no es, por eso, una plaza que pida ingles")
    void escritoEnInglesNoEsPedirIngles() {
        // Caso real: una oferta de Remotive de 14.000 caracteres en ingles que
        // decia «fluent written communication» y ni una vez «English» como
        // requisito. «fluent» y «conversational» estuvieron en la lista de
        // pruebas y solo podian decidir algo cuando el idioma no se nombraba
        // —justo cuando no prueban nada—.
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(oferta(
                "Head of Marketing & Communications",
                "We are hiring a Head of Marketing to tell the story across the internet. "
                        + "You bring fluent written communication and a conversational tone.")))
                .isFalse();
    }

    @Test
    @DisplayName("un B2 pegado a idioma cuenta; un B2 de otra cosa, no")
    void elNivelSoloCuentaSiEsDeIdioma() {
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                oferta("Agente de soporte", "Nivel de idioma B2 requerido.")))
                .isTrue();
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                oferta("Operario de planta", "Zona B2, turno nocturno, pago quincenal.")))
                .as("«zona B2» no es un nivel de idioma")
                .isFalse();
    }

    @Test
    @DisplayName("lo que ya nace en ingles no se examina")
    void elRemotoEnInglesPasaSiempre() {
        var v = oferta("Senior Backend Engineer", "Remote position, competitive salary.");
        v.setSegmento(Segmento.REMOTO_INGLES);
        // Pedirle a Remotive que ademas diga «bilingue» seria descartarla toda:
        // publica en ingles para empresas de fuera, no anuncia el idioma porque
        // es el unico que hay.
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
    }

    @Test
    @DisplayName("si la propia oferta declara nivel de ingles, se cree")
    void elCampoDeNivelBasta() {
        var v = oferta("Agente de soporte", "Turnos rotativos.");
        v.setNivelInglesRequerido("B2");
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
    }

    @Test
    @DisplayName("una oferta nula no revienta el filtro")
    void nadaNoPasa() {
        // El filtro corre sobre todo lo que llega de los portales; que una
        // oferta mal parseada lo tumbe pararia la corrida entera.
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(null)).isFalse();
        assertThat(FiltroBilingue.esDeTrabajoEnIngles(oferta(null, null))).isFalse();
    }
}
