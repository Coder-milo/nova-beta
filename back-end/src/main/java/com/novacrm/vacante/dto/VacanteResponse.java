package com.novacrm.vacante.dto;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

public record VacanteResponse(
        UUID id,
        String titulo,
        String descripcion,
        String requisitos,
        String ubicacion,
        String rangoSalarial,
        String tipoContrato,
        String modalidadTrabajo,
        String nivelInglesRequerido,
        Integer aniosExperienciaRequeridos,
        String fuente,
        String urlOrigen,
        String urlAplicar,
        String empresaNombre,
        LocalDateTime fechaPublicacion,
        Instant createdAt,
        /** Si sigue abierta. Una oferta cerrada se conserva pero no se recomienda. */
        boolean activa,
        LocalDateTime fechaExpiracion,
        /** EXPIRADA, CUBIERTA o RETIRADA; nulo mientras siga abierta. */
        String motivoCierre,
        /** Ciudad limpia, para filtrar; `ubicacion` es el texto del anuncio. */
        String ciudad,
        /** Tiempo completo, medio tiempo, por horas. */
        String jornada,
        /** Falso en ofertas que registro un estudiante y nadie ha validado. */
        boolean revisada,
        /** Correo de quien la registro; nulo si vino de un portal. */
        String creadaPor,

        /**
         * Lo que declaro quien mando el formulario publico, sin verificar.
         *
         * <p>Solo viaja hacia gestion, igual que {@code creadaPor}: son los
         * datos de contacto de una persona, y el estudiante que ve el anuncio no
         * tiene por que recibirlos. Nulos en todo lo que no venga de ahi.
         *
         * <p>{@code empresaDeclarada} no es {@code empresaNombre}: aquella es
         * una afirmacion sin comprobar y esta, una empresa del CRM. Van
         * separadas para que en la cola de revision se vea cual de las dos se
         * esta leyendo.
         */
        String empresaDeclarada,
        String contactoDeclarado,
        String emailDeclarado,
        String telefonoDeclarado
) {}
