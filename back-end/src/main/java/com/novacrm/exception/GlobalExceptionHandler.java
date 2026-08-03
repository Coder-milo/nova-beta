package com.novacrm.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", ex.getMessage(), Instant.now()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("BUSINESS_ERROR", ex.getMessage(), Instant.now()));
    }

    /**
     * Credenciales que no valen: 401.
     *
     * <p>Salia como 400 —lo lanzaba una {@link BusinessException}— y la pantalla
     * de login, que solo reconoce 401 y 403 como "credenciales incorrectas",
     * enseñaba «El servidor respondio con un error (400). Intenta mas tarde».
     * Quien se equivocaba de contrasena creia que el servidor estaba caido.
     */
    @ExceptionHandler(CredencialesInvalidasException.class)
    public ResponseEntity<ErrorResponse> handleCredenciales(CredencialesInvalidasException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse("UNAUTHORIZED", ex.getMessage(), Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        err -> err.getDefaultMessage() != null ? err.getDefaultMessage() : "invalid"
                ));
        return ResponseEntity.badRequest()
                .body(new ValidationErrorResponse("VALIDATION_ERROR", "Validation failed", errors, Instant.now()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse("FORBIDDEN", "Access denied", Instant.now()));
    }

    /**
     * Una URL que no existe es un 404, no un fallo del servidor.
     *
     * <p>Sin esto caia en el manejador generico y salia un 500: el cliente
     * creia que el servidor se habia roto cuando solo se habia equivocado de
     * ruta, y cada peticion a un endpoint mal escrito quedaba registrada como
     * "Unhandled exception", enterrando los errores de verdad.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleRutaInexistente(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", "El recurso solicitado no existe", Instant.now()));
    }

    /**
     * Cuerpo que no se puede leer: JSON mal formado, mal codificado o con un
     * tipo que no encaja. Es un 400 —el cliente mando algo invalido—, no un
     * 500. Salia como 500 y ademas con la traza en el log como si el servidor
     * se hubiera roto.
     *
     * <p>No se devuelve el detalle de Jackson: nombra clases y campos internos.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleCuerpoIlegible(HttpMessageNotReadableException ex) {
        log.warn("Cuerpo de peticion ilegible: {}", ex.getMessage());
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("BAD_REQUEST",
                        "El cuerpo de la peticion no es un JSON valido", Instant.now()));
    }

    /**
     * Falta un parametro obligatorio. Es un 400, y decir cual ahorra el viaje
     * de averiguarlo leyendo el codigo del controlador.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleParametroFaltante(
            MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("BAD_REQUEST",
                        "Falta el parametro obligatorio '" + ex.getParameterName() + "'",
                        Instant.now()));
    }

    /**
     * Un valor del tipo equivocado: un id que no es un UUID, un numero donde se
     * esperaba texto. Tambien culpa del cliente, tambien 400.
     *
     * <p>Se nombra el parametro pero no el valor recibido: puede venir de una
     * URL y acabar en los logs y en el mensaje de error.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTipoIncorrecto(
            MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("BAD_REQUEST",
                        "El valor de '" + ex.getName() + "' no tiene el formato esperado",
                        Instant.now()));
    }

    /** Metodo HTTP que ese endpoint no acepta: 405, tampoco un fallo del servidor. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMetodoNoSoportado(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(new ErrorResponse("METHOD_NOT_ALLOWED",
                        "El metodo " + ex.getMethod() + " no esta permitido en esta ruta", Instant.now()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("INTERNAL_ERROR", "Internal server error", Instant.now()));
    }

    public record ErrorResponse(String code, String message, Instant timestamp) {}
    public record ValidationErrorResponse(String code, String message, Map<String, String> errors, Instant timestamp) {}
}
