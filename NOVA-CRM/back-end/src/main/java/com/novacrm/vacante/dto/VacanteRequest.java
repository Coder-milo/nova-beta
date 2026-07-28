package com.novacrm.vacante.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * Alta manual de una oferta.
 *
 * <p>Hay dos formas de registrarla y las dos tienen que funcionar:
 *
 * <ul>
 *   <li><strong>Con enlace.</strong> Basta con pegarlo: el titulo y la
 *       descripcion se completan leyendo la pagina.</li>
 *   <li><strong>Sin enlace.</strong> Una oferta que llega en una feria, por un
 *       contacto directo o por un grupo de mensajeria no tiene URL. El enlace
 *       era obligatorio, y eso dejaba fuera justo las ofertas que no estan en
 *       ningun portal, que son las que el programa aporta de verdad.</li>
 * </ul>
 *
 * <p>Por eso no hay un campo obligatorio fijo, sino la condicion de que llegue
 * uno de los dos: sin enlace ni titulo no hay oferta que guardar.
 */
public record VacanteRequest(

        /** Enlace a la oferta original. Opcional si viene el titulo. */
        @Pattern(regexp = "^$|^https?://.+", message = "El enlace debe empezar por http:// o https://")
        @Size(max = 1000) String url,

        /** Nombre del cargo. Opcional solo si viene el enlace, de donde se lee. */
        @Size(max = 255) String titulo,

        String descripcion,
        String requisitos,

        /** Texto libre del anuncio: "Barranquilla - Zona norte, presencial". */
        @Size(max = 255) String ubicacion,

        /** Ciudad limpia, aparte del texto del anuncio, para poder filtrar. */
        @Size(max = 255) String ciudad,

        @Size(max = 255) String rangoSalarial,

        /** Figura juridica: indefinido, termino fijo, obra o labor. */
        @Size(max = 255) String tipoContrato,

        /** Tiempo completo, medio tiempo, por horas. */
        @Size(max = 40) String jornada,

        /** Presencial, remoto o hibrido. */
        @Size(max = 255) String modalidadTrabajo,

        @Size(max = 255) String nivelInglesRequerido,
        Integer aniosExperienciaRequeridos,
        @Size(max = 255) String empresaNombre,

        /** Donde se aplica, si es distinto del enlace del anuncio. */
        @Pattern(regexp = "^$|^https?://.+", message = "El enlace debe empezar por http:// o https://")
        @Size(max = 1000) String urlAplicar,

        /** Cuando deja de estar vigente. Sin fecha, permanece abierta. */
        LocalDateTime fechaExpiracion) {

    @AssertTrue(message = "Pega el enlace de la oferta o escribe al menos el titulo del cargo")
    public boolean isIdentificable() {
        return !vacio(url) || !vacio(titulo);
    }

    private static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }
}
