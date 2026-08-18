package com.novacrm.shared;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Las reglas con las que se decide si dos filas hablan de lo mismo.
 *
 * <p>Fijan tambien el contrato de la funcion SQL {@code novacrm_normalizar}
 * (V38): las dos tienen que dar el mismo resultado, porque la primera aparicion
 * de un nombre en el archivo se busca en la base con la de SQL y las siguientes
 * se comparan en memoria con esta.
 */
class ClaveNormalizadaTest {

    @Test
    @DisplayName("mayusculas, tildes y signos dejan de distinguir un nombre")
    void nombreIgualPeseAMayusculasTildesYSignos() {
        String esperado = "jose andres perez gomez";

        assertThat(ClaveNormalizada.de("José Andrés Pérez Gómez")).isEqualTo(esperado);
        assertThat(ClaveNormalizada.de("JOSE ANDRES PEREZ GOMEZ")).isEqualTo(esperado);
        assertThat(ClaveNormalizada.de("  josé   andrés  pérez-gómez  ")).isEqualTo(esperado);
    }

    @Test
    @DisplayName("dos personas distintas siguen siendo distintas")
    void noJuntaPersonasDistintas() {
        assertThat(ClaveNormalizada.de("Ana María Pérez"))
                .isNotEqualTo(ClaveNormalizada.de("Ana Maria Perez Gómez"));
        // Las particulas forman parte del apellido y no se quitan.
        assertThat(ClaveNormalizada.de("Juan de la Cruz"))
                .isNotEqualTo(ClaveNormalizada.de("Juan Cruz"));
    }

    @Test
    @DisplayName("en una razon social el punto y el espacio son ruido")
    void razonSocialIgnoraPuntosYEspacios() {
        assertThat(ClaveNormalizada.deEmpresa("Solvo S.A.S."))
                .isEqualTo(ClaveNormalizada.deEmpresa("SOLVO SAS"))
                .isEqualTo(ClaveNormalizada.deEmpresa("solvo s a s"));

        assertThat(ClaveNormalizada.deEmpresa("Teleperformance Colombia"))
                .isNotEqualTo(ClaveNormalizada.deEmpresa("Teleperformance Peru"));
    }

    @Test
    @DisplayName("la regla de empresas no vale para personas: ahi el espacio separa")
    void laReglaDeEmpresasNoSeAplicaAPersonas() {
        // Con la regla de empresas estas dos caerian en "anamariaperez"; con la
        // de personas, «Ana Mariaperez» conserva su propio nombre.
        assertThat(ClaveNormalizada.de("Ana Maria Perez"))
                .isNotEqualTo(ClaveNormalizada.de("Ana Mariaperez"));
    }

    @Test
    @DisplayName("el documento pierde los puntos de miles pero no se parte en trozos")
    void documentoSinSignos() {
        assertThat(ClaveNormalizada.deDocumento("1.234.567")).isEqualTo("1234567");
        assertThat(ClaveNormalizada.deDocumento(" 1234567 ")).isEqualTo("1234567");
        assertThat(ClaveNormalizada.deDocumento("CC-1234567")).isEqualTo("cc1234567");
    }

    @Test
    @DisplayName("nulo y vacio no revientan y no valen como clave")
    void nuloYVacio() {
        assertThat(ClaveNormalizada.de(null)).isEmpty();
        assertThat(ClaveNormalizada.de("   ")).isEmpty();
        assertThat(ClaveNormalizada.deEmpresa(null)).isEmpty();
        assertThat(ClaveNormalizada.deDocumento(null)).isEmpty();
    }
}
