package com.novacrm.exception;

/**
 * Lo que se intenta crear choca con algo que ya existe: 409.
 *
 * <p>Se separa de {@link BusinessException} —que sale como 400— porque el
 * cliente reacciona distinto. Un 400 dice "revisa lo que escribiste"; un 409
 * dice "esto ya esta en el sistema", y la pantalla puede ofrecer abrir la ficha
 * existente o recuperarla de la papelera en vez de pedir que se corrija el
 * formulario.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
