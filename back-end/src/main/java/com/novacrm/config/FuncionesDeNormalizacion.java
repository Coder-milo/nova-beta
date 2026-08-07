package com.novacrm.config;

import org.hibernate.boot.model.FunctionContributions;
import org.hibernate.boot.model.FunctionContributor;
import org.hibernate.type.StandardBasicTypes;

/**
 * Presenta a Hibernate las funciones de normalizacion que viven en la base.
 *
 * <p>Sin esto, {@code FUNCTION('novacrm_normalizar', x)} compila pero Hibernate
 * no sabe que devuelve y la trata como {@code Object}; en cuanto el resultado
 * toca un LIKE, la consulta se rechaza al arrancar con «Operand of 'like' is of
 * type 'java.lang.Object'». El fallo no es en tiempo de consulta sino al crear
 * el repositorio, asi que tumba el contexto entero de la aplicacion.
 *
 * <p>Se registra por {@code META-INF/services/org.hibernate.boot.model.FunctionContributor}.
 * Las funciones se crean en las migraciones V38 y V39; si alguna se renombra
 * alli, hay que renombrarla aqui o las consultas que la usan dejan de arrancar.
 */
public class FuncionesDeNormalizacion implements FunctionContributor {

    @Override
    public void contributeFunctions(FunctionContributions funciones) {
        var texto = funciones.getTypeConfiguration()
                .getBasicTypeRegistry()
                .resolve(StandardBasicTypes.STRING);

        for (String nombre : new String[]{
                "novacrm_normalizar",
                "novacrm_normalizar_empresa",
                "novacrm_solo_alfanumerico"}) {
            funciones.getFunctionRegistry()
                    .registerPattern(nombre, nombre + "(?1)", texto);
        }
    }
}
