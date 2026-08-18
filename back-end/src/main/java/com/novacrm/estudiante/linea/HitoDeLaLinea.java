package com.novacrm.estudiante.linea;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Un suceso en la historia de un estudiante.
 *
 * <p>Todo lo que le pasa a una persona en el programa está repartido en cuatro
 * módulos —postulaciones, seguimiento, documentos y colocaciones— y hasta ahora
 * reconstruir «qué ha pasado con esta persona» exigía abrir cuatro pestañas y
 * ordenar de cabeza. Aquí se unifican en una sola lista con una sola fecha.
 *
 * <p>Es deliberadamente plano y de solo lectura: no es una entidad, es una vista
 * compuesta. Nada se guarda con esta forma y nada se edita desde aquí — cada
 * suceso se corrige donde vive, y la línea vuelve a componerse al recargar.
 */
public record HitoDeLaLinea(
        /** Identificador del registro original, para poder abrirlo. */
        UUID referenciaId,

        /** POSTULACION · ENTREVISTA · SEGUIMIENTO · DOCUMENTO · COLOCACION */
        String tipo,

        /**
         * Cuándo ocurrió.
         *
         * <p>Siempre con hora, aunque el origen solo tenga fecha. Mezclar
         * `LocalDate` y `LocalDateTime` obligaría a cada consumidor a decidir
         * cómo ordenar los empates, y acabarían ordenando distinto.
         */
        LocalDateTime cuando,

        String titulo,
        String detalle,

        /** Quién lo hizo, si consta. */
        String responsable,

        /**
         * Ruta del panel donde se corrige.
         *
         * <p>Nula cuando el suceso no tiene pantalla propia. Una línea de tiempo
         * donde todo parece pulsable y la mitad no lleva a ningún sitio enseña
         * a no pulsar nada.
         */
        String ruta) {
}
