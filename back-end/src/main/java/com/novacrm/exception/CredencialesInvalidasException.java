package com.novacrm.exception;

/**
 * Fallo de autenticacion: 401, no 400.
 *
 * <p>Existe porque el login lanzaba {@link BusinessException} para "credenciales
 * invalidas" y esa se traduce a 400. El navegador no puede distinguir un 400 de
 * validacion —el email tiene mala forma— de un 400 de contrasena equivocada, asi
 * que la pantalla de login enseñaba «El servidor respondio con un error (400).
 * Intenta mas tarde» a quien solo se habia equivocado al teclear: el usuario
 * esperaba a que se arreglara un servidor que nunca estuvo roto.
 *
 * <p>El mensaje es siempre el mismo para usuario inexistente, contrasena mala y
 * cuenta desactivada: distinguirlos permite enumerar quien tiene cuenta.
 */
public class CredencialesInvalidasException extends RuntimeException {
    public CredencialesInvalidasException(String message) {
        super(message);
    }
}
