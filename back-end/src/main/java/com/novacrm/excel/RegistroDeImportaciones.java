package com.novacrm.excel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Deja constancia de cada importación.
 *
 * <p>La tabla existía desde el principio pero solo la escribía el importador de
 * participantes. Las cargas del CRM —empresas y vinculaciones— y las del libro
 * completo no dejaban rastro: al recargar la pantalla no quedaba nada de quién
 * importó qué ni cuándo. Una carga que metió cuarenta filas equivocadas no se
 * podía ni datar, y sin fecha no se sabe qué otras cosas pasaron después.
 *
 * <p>Está aquí y no repetido en cada servicio porque el bloque era idéntico en
 * los tres sitios y las tres copias se habrían separado: la primera vez que
 * alguien añada un campo lo añadirá en uno.
 */
@Component
public class RegistroDeImportaciones {

    private static final Logger log = LoggerFactory.getLogger(RegistroDeImportaciones.class);

    /** Tope del detalle. Es una ayuda para entender qué falló, no un log. */
    private static final int TOPE_DETALLE = 2_000;

    private final ImportacionHistorialRepository repositorio;

    public RegistroDeImportaciones(ImportacionHistorialRepository repositorio) {
        this.repositorio = repositorio;
    }

    /**
     * Anota una importación que de verdad escribió.
     *
     * <p><strong>Las simulaciones no se registran.</strong> Una previsualización
     * no cambia nada, y anotarla llenaría el historial de entradas que no
     * corresponden a ningún dato: al revisar qué pasó, la mitad de las líneas
     * serían cargas que nunca ocurrieron.
     *
     * <p>Nunca lanza. Perder el registro de una importación es malo; tirar por
     * tierra una importación que ya escribió sus filas, porque falló el apunte
     * del registro, es peor.
     */
    public void anotar(String origen, String archivo, UUID programaId,
                       int creados, int actualizados, int omitidos,
                       List<String> erroresDetalle) {
        try {
            var historial = new ImportacionHistorial();
            historial.setOrigen(origen);
            historial.setArchivo(archivo == null || archivo.isBlank() ? "(sin nombre)" : archivo);
            historial.setUsuario(quienEs());
            historial.setProgramaId(programaId);
            historial.setCreados(creados);
            historial.setActualizados(actualizados);
            historial.setOmitidos(omitidos);
            historial.setErrores(erroresDetalle == null ? 0 : erroresDetalle.size());

            String detalle = erroresDetalle == null ? "" : String.join("\n", erroresDetalle);
            historial.setDetalle(detalle.length() > TOPE_DETALLE
                    ? detalle.substring(0, TOPE_DETALLE) : detalle);

            repositorio.save(historial);
        } catch (RuntimeException e) {
            log.warn("No se pudo registrar la importacion de {}: {}", origen, e.getMessage());
        }
    }

    private static String quienEs() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null ? auth.getName() : "sistema";
    }
}
