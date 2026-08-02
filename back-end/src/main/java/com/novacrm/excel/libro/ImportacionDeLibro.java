package com.novacrm.excel.libro;

import com.novacrm.excel.ImportacionCrmService;
import com.novacrm.excel.dto.ResultadoImportacionLibro;
import com.novacrm.excel.dto.ResultadoImportacionLibro.HojaProcesada;
import com.novacrm.ia.ReconocimientoConIa;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Importa un libro de Excel completo, hoja por hoja.
 *
 * <p>El equipo lleva el seguimiento del programa en un solo archivo con siete
 * pestañas: participantes, dos de empresas, postulaciones, colocaciones, un
 * tablero de indicadores y alguna preparada y vacia. Antes habia que subirlo
 * una vez por cada destino y, ademas, ninguno de los tres importadores lo leia:
 * los tres abrian la primera hoja —el tablero— y fallaban igual.
 *
 * <p>Aqui se abre una sola vez, se decide que hay en cada pestaña y cada una va
 * a su sitio. Lo que no se importa se informa con su motivo.
 */
@Service
public class ImportacionDeLibro {

    private static final Logger log = LoggerFactory.getLogger(ImportacionDeLibro.class);

    private final ImportacionCrmService importacionCrmService;
    private final ImportacionDeParticipantes importacionDeParticipantes;
    private final ImportacionDePostulaciones importacionDePostulaciones;
    private final ReconocimientoConIa reconocimientoConIa;

    public ImportacionDeLibro(ImportacionCrmService importacionCrmService,
                              ImportacionDeParticipantes importacionDeParticipantes,
                              ImportacionDePostulaciones importacionDePostulaciones,
                              ReconocimientoConIa reconocimientoConIa) {
        this.importacionCrmService = importacionCrmService;
        this.importacionDeParticipantes = importacionDeParticipantes;
        this.importacionDePostulaciones = importacionDePostulaciones;
        this.reconocimientoConIa = reconocimientoConIa;
    }

    /**
     * @param simular pasada en seco: mismas validaciones, sin escribir nada
     * @param autor   quien carga, para la traza de colocaciones y postulaciones
     */
    /**
     * Sin transaccion propia, y a proposito por dos razones.
     *
     * <p>La primera es que leer y clasificar ahora hace red: desde que el
     * reconocimiento se apoya en la IA hay una peticion por cada columna que el
     * diccionario no cubre, con hasta diez segundos de espera. Con una
     * transaccion abierta eso mantiene ocupada una conexion de la pool sin
     * usarla —el mismo problema que se corrigio en {@code ScrapingService}—.
     *
     * <p>La segunda es que cada importador ya abre la suya, asi que cada hoja
     * se confirma o se descarta por separado. Envolverlas todas en una hacia
     * que el mensaje de "una hoja que revienta no puede llevarse las demas"
     * fuera falso: una violacion de restriccion en la ultima pestaña marcaba la
     * transaccion como rollback-only y tiraba tambien las anteriores, que se
     * habian reportado como importadas.
     */
    public ResultadoImportacionLibro importar(MultipartFile archivo, boolean simular, String autor) {
        var clasificadas = LectorDeLibro.leer(archivo, reconocimientoConIa);
        var procesadas = new ArrayList<HojaProcesada>();

        // Los participantes primero, y las empresas antes que lo que las
        // referencia: una postulacion o una colocacion necesitan que la persona
        // y la empresa existan. En el libro real las pestañas no vienen en ese
        // orden, asi que importar en el orden del archivo dejaria fuera filas
        // que si tenian con que resolverse.
        for (var clasificada : ordenadas(clasificadas)) {
            if (!clasificada.importable()) {
                procesadas.add(HojaProcesada.omitida(clasificada.nombre(), clasificada.motivo()));
                continue;
            }
            try {
                var detalle = switch (clasificada.destino()) {
                    case PARTICIPANTES -> importacionDeParticipantes.importar(clasificada.hoja(), simular);
                    case EMPRESAS -> importacionCrmService.importarEmpresas(clasificada.hoja(), simular);
                    case POSTULACIONES -> importacionDePostulaciones.importar(clasificada.hoja(), simular, autor);
                    case COLOCACIONES -> importacionCrmService.importarColocaciones(clasificada.hoja(), simular, autor);
                };
                procesadas.add(new HojaProcesada(clasificada.nombre(),
                        clasificada.destino().getEtiqueta(), null, detalle,
                        new ArrayList<>(clasificada.columnasPorIa()),
                        clasificada.destinoPorIa()));
            } catch (RuntimeException e) {
                // Una hoja que revienta no puede llevarse las demas: el resto
                // del libro sigue siendo importable y quien carga necesita ver
                // cual fallo y por que.
                log.warn("La hoja «{}» no se pudo importar: {}", clasificada.nombre(), e.getMessage());
                procesadas.add(HojaProcesada.omitida(clasificada.nombre(),
                        e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }

        // Se devuelven en el orden del libro, que es como las ve quien carga.
        var enOrdenDelLibro = clasificadas.stream()
                .map(c -> procesadas.stream()
                        .filter(p -> p.nombre().equals(c.nombre()))
                        .findFirst()
                        .orElseGet(() -> HojaProcesada.omitida(c.nombre(), "No se proceso")))
                .toList();

        return new ResultadoImportacionLibro(simular, enOrdenDelLibro);
    }

    /** Orden de dependencia: primero lo que las demas hojas referencian. */
    private static List<LectorDeLibro.HojaClasificada> ordenadas(
            List<LectorDeLibro.HojaClasificada> hojas) {
        return hojas.stream()
                .sorted(Comparator.comparingInt(ImportacionDeLibro::prioridad))
                .toList();
    }

    private static int prioridad(LectorDeLibro.HojaClasificada hoja) {
        if (hoja.destino() == null) {
            return 9;
        }
        return switch (hoja.destino()) {
            case PARTICIPANTES -> 0;
            case EMPRESAS -> 1;
            case POSTULACIONES -> 2;
            case COLOCACIONES -> 3;
        };
    }
}
