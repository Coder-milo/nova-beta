package com.novacrm.excel.dto;

import java.util.List;

/**
 * Resultado de importar empresas o colocaciones desde una hoja de cálculo.
 *
 * <p>Es el mismo objeto para la simulación y para la importación real: la
 * pantalla enseña exactamente lo que va a pasar antes de que pase, y quien
 * revisa no tiene que aprenderse dos formatos distintos.
 *
 * @param columnasReconocidas cabecera de la hoja → campo del sistema. Las
 *                            entradas con valor nulo son columnas que se
 *                            ignoran, y verlas es lo que explica por qué un
 *                            dato no llegó.
 * @param errores             una entrada por fila descartada, con su número de
 *                            fila tal como se ve en Excel
 */
public record ResultadoImportacionCrm(
        boolean simulacion,
        int filasLeidas,
        int creados,
        int actualizados,
        int omitidos,
        List<FilaConError> errores,
        List<ColumnaReconocida> columnasReconocidas) {

    public record FilaConError(int fila, String motivo) {}

    public record ColumnaReconocida(String cabecera, String campo) {}
}
