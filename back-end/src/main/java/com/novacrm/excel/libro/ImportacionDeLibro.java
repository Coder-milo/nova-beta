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
    private final com.novacrm.excel.RegistroDeImportaciones registro;
    private final com.novacrm.excel.PlanesDeImportacion planes;

    public ImportacionDeLibro(ImportacionCrmService importacionCrmService,
                              ImportacionDeParticipantes importacionDeParticipantes,
                              ImportacionDePostulaciones importacionDePostulaciones,
                              ReconocimientoConIa reconocimientoConIa,
                              com.novacrm.excel.RegistroDeImportaciones registro,
                              com.novacrm.excel.PlanesDeImportacion planes) {
        this.importacionCrmService = importacionCrmService;
        this.importacionDeParticipantes = importacionDeParticipantes;
        this.importacionDePostulaciones = importacionDePostulaciones;
        this.reconocimientoConIa = reconocimientoConIa;
        this.registro = registro;
        this.planes = planes;
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
        return importar(archivo, simular, autor, null);
    }

    /**
     * @param planId análisis ya aprobado que hay que repetir tal cual. Con
     *               {@code null} se analiza el archivo de nuevo, que es lo que
     *               hace la previsualización
     */
    public ResultadoImportacionLibro importar(MultipartFile archivo, boolean simular, String autor,
                                              java.util.UUID planId) {
        // Con plan se repite el analisis aprobado; sin plan se hace uno. La
        // previsualizacion guarda el suyo y devuelve su identificador: es lo
        // que hace que confirmar ejecute lo que se reviso y no un reanalisis
        // que la IA puede resolver distinto.
        var clasificadas = planId == null
                ? LectorDeLibro.leer(archivo, reconocimientoConIa)
                : LectorDeLibro.releer(archivo, planes.recuperar(planId, archivo));
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

        // La simulacion guarda su analisis para que la importacion real lo
        // repita. Se guarda al final y no antes de importar porque un libro que
        // revienta al leerse no deja plan que confirmar.
        java.util.UUID plan = simular
                ? planes.guardar(archivo, AnalisisDeLibro.de(clasificadas))
                : planId;

        // Una sola línea de historial para todo el libro, no una por pestaña.
        // El libro se sube de una vez y se deshace de una vez; con una línea
        // por hoja, una carga de seis pestañas parecerían seis importaciones
        // distintas al revisar qué pasó.
        if (!simular) {
            int creados = 0;
            int actualizados = 0;
            var motivos = new java.util.ArrayList<String>();
            for (var hoja : enOrdenDelLibro) {
                if (hoja.detalle() != null) {
                    creados += hoja.detalle().creados();
                    actualizados += hoja.detalle().actualizados();
                    hoja.detalle().errores().forEach(e ->
                            motivos.add(hoja.nombre() + " · fila " + e.fila() + ": " + e.motivo()));
                } else if (hoja.motivo() != null) {
                    motivos.add(hoja.nombre() + ": " + hoja.motivo());
                }
            }
            registro.anotar("LIBRO",
                    archivo == null ? null : archivo.getOriginalFilename(),
                    null, creados, actualizados, 0, motivos);
        }

        return new ResultadoImportacionLibro(simular, enOrdenDelLibro, plan);
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
