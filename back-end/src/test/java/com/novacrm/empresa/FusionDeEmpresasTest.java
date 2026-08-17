package com.novacrm.empresa;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La clave con la que se detectan fichas duplicadas.
 *
 * <p>Las duplicadas no llegan por descuido: el Excel de una feria trae «Manpower
 * Group Colombia», el rastreo de portales registra «ManpowerGroup» y el alta
 * manual escribe «Manpower». Lo que fija esta prueba es dónde está el límite
 * entre «es la misma» y «se parece»: pasarse une dos empresas distintas, y eso
 * no se puede deshacer.
 */
class FusionDeEmpresasTest {

    @Test
    @DisplayName("las tres formas del mismo nombre caen juntas")
    void elMismoNombreEscritoDeTresManeras() {
        // Los tres pares que hay hoy de verdad en la base.
        assertThat(FusionDeEmpresas.clave("ManpowerGroup"))
                .isEqualTo(FusionDeEmpresas.clave("Manpower Group Colombia"));
        assertThat(FusionDeEmpresas.clave("Gi Group"))
                .isEqualTo(FusionDeEmpresas.clave("Gi Group Colombia"));
        assertThat(FusionDeEmpresas.clave("TTEC"))
                .isEqualTo(FusionDeEmpresas.clave("TTEC Colombia"));
    }

    @Test
    @DisplayName("las coletillas societarias no distinguen a nadie")
    void lasColetillasSeIgnoran() {
        assertThat(FusionDeEmpresas.clave("ACTIVOS S A S"))
                .isEqualTo(FusionDeEmpresas.clave("Activos S.A.S."));
        assertThat(FusionDeEmpresas.clave("Solvo Global SAS BIC"))
                .isEqualTo(FusionDeEmpresas.clave("SOLVO GLOBAL"));
        assertThat(FusionDeEmpresas.clave("Alianza Ltda"))
                .isEqualTo(FusionDeEmpresas.clave("ALIANZA"));
    }

    @Test
    @DisplayName("tildes y puntuacion tampoco")
    void tildesYPuntuacion() {
        assertThat(FusionDeEmpresas.clave("Telefónica"))
                .isEqualTo(FusionDeEmpresas.clave("TELEFONICA"));
        assertThat(FusionDeEmpresas.clave("A&B Servicios"))
                .isEqualTo(FusionDeEmpresas.clave("A B  servicios"));
    }

    @Test
    @DisplayName("no junta dos empresas que solo se parecen")
    void loParecidoNoEsLoMismo() {
        // El riesgo real de esto: unir dos empresas distintas del mismo grupo.
        assertThat(FusionDeEmpresas.clave("Grupo Éxito"))
                .isNotEqualTo(FusionDeEmpresas.clave("Grupo Éxito Express"));
        assertThat(FusionDeEmpresas.clave("Atento"))
                .isNotEqualTo(FusionDeEmpresas.clave("Atenta"));
    }

    @Test
    @DisplayName("una coletilla dentro de una palabra no se recorta")
    void laColetillaVaConLimiteDePalabra() {
        // Sin límite de palabra, «SASSAFRAS» perdía su «SAS» y «COLOMBIANA»
        // dejaba de ser lo que es: dos nombres distintos acababan iguales.
        assertThat(FusionDeEmpresas.clave("Sassafras"))
                .isNotEqualTo(FusionDeEmpresas.clave("Safras"));
        assertThat(FusionDeEmpresas.clave("Colombiana de Servicios"))
                .isNotEqualTo(FusionDeEmpresas.clave("na de Servicios"));
    }

    @Test
    @DisplayName("un nombre vacio o nulo no revienta la deteccion")
    void nombresRaros() {
        // La detección recorre las 153 fichas; que una mal escrita la tumbe
        // dejaría sin ver también las buenas.
        assertThat(FusionDeEmpresas.clave(null)).isEmpty();
        assertThat(FusionDeEmpresas.clave("   ")).isEmpty();
        assertThat(FusionDeEmpresas.clave("...")).isEmpty();
    }
}
