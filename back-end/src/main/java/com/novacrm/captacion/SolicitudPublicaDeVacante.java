package com.novacrm.captacion;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Lo que se acepta del formulario público.
 *
 * <p>Es una lista corta a propósito. Cada campo es algo que una persona del
 * equipo va a tener que leer en la cola de revisión, y cada campo de más es una
 * casilla que quien envía puede dejar mal y un texto más que moderar.
 *
 * <p><strong>No hay campo de enlace.</strong> El alta interna acepta una URL y
 * completa lo que falte leyéndola; hacerlo sin autenticar convertiría al
 * servidor en un cliente HTTP a las órdenes de cualquiera.
 *
 * <p>Los cinco obligatorios son los que hacen que la oferta se pueda evaluar y
 * responder: quién es, cómo se le contesta, qué puesto, y qué es el puesto. Sin
 * cualquiera de ellos lo único que puede hacer el equipo es adivinar.
 */
public record SolicitudPublicaDeVacante(

        @NotBlank(message = "Falta el nombre de la empresa")
        @Size(max = 200) String empresa,

        @NotBlank(message = "Falta el nombre de quien contactamos")
        @Size(max = 200) String contacto,

        @NotBlank(message = "Falta el correo de contacto")
        @Email(message = "Ese correo no parece valido")
        @Size(max = 255) String email,

        @Size(max = 40) String telefono,

        @NotBlank(message = "Falta el cargo que se ofrece")
        @Size(max = 200) String titulo,

        @NotBlank(message = "Falta describir el puesto")
        @Size(max = 5000, message = "La descripcion es demasiado larga")
        String descripcion,

        @Size(max = 3000) String requisitos,
        @Size(max = 255) String ciudad,
        @Size(max = 60) String modalidad,
        @Size(max = 60) String tipoContrato,
        @Size(max = 100) String rangoSalarial,

        /**
         * La trampa para robots: el formulario lo esconde y ninguna persona lo
         * ve. Si llega con algo escrito, se rechaza.
         *
         * <p>No frena a nadie que se moleste en mirar el HTML —para eso está el
         * límite de peticiones—, pero sí al robot que rellena todo lo que
         * encuentra, que es de donde viene el volumen.
         */
        @Size(max = 200) String apodo
) {}
