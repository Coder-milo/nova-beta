package com.novacrm.excel.libro;

import com.novacrm.exception.BusinessException;
import com.novacrm.ia.ReconocimientoConIa;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Lee un libro completo y decide que hay en cada hoja.
 *
 * <p>Los importadores leian {@code getSheetAt(0)} y daban por hecho que la
 * cabecera era la primera fila. Con el libro de seguimiento del programa eso
 * significa leer la hoja "Dashboard" y encontrar una cabecera de una sola celda
 * —"SEGUIMIENTO DE EMPLEABILIDAD PROYECTO NOVA"—, con lo que los tres
 * importadores fallan igual: "no se reconocio ninguna columna".
 *
 * <p>Aqui se recorren todas las hojas, se busca en cada una donde empieza la
 * tabla y se decide a que destino pertenece por el vocabulario de sus titulos.
 * Lo que no encaja se informa con su motivo, en vez de desaparecer: una hoja
 * omitida en silencio es indistinguible de una importada vacia.
 *
 * <p>Si llega un {@link ReconocimientoConIa}, se usa como capa de rescate en
 * los dos puntos donde el vocabulario se queda corto: hojas con titulos
 * renombrados y columnas que ningun sinonimo cubre. La IA solo sugiere y el
 * resultado se valida contra el vocabulario del sistema; si no responde, todo
 * sigue como antes.
 */
public final class LectorDeLibro {

    /** Tope de filas por hoja. Protege la memoria del servidor. */
    public static final int MAX_FILAS_POR_HOJA = 5000;

    /**
     * Ventaja minima sobre el segundo destino para aceptar la clasificacion.
     *
     * <p>Muchas hojas comparten titulos —"Empresa", "Cargo", "Observaciones"
     * salen en casi todas—, asi que un empate no significa que valgan las dos:
     * significa que no se sabe.
     */
    static final int VENTAJA_MINIMA = 2;

    /**
     * Tope de consultas a la IA por libro.
     *
     * <p>Se pregunta una vez por cada columna que ningun sinonimo cubre, y cada
     * consulta es una peticion HTTP con hasta diez segundos de espera. Un libro
     * con siete hojas y cabeceras anchas puede rozar el centenar de columnas
     * sueltas: sin tope, una importacion se convierte en varios minutos de
     * espera y en una factura. Agotado el presupuesto se sigue con el
     * diccionario, que es lo que se hacia antes de que existiera la IA.
     */
    static final int MAXIMO_CONSULTAS_IA = 25;

    /** Consultas que le quedan a un libro. Se comparte entre sus hojas. */
    static final class PresupuestoIa {

        private final ReconocimientoConIa ia;
        private int restantes;

        PresupuestoIa(ReconocimientoConIa ia, int maximo) {
            // Sin proveedor configurado no se gasta ni una: construir prompts y
            // recorrer columnas para recibir Optional.empty() es trabajo tirado.
            this.ia = ia != null && ia.disponible() ? ia : null;
            this.restantes = maximo;
        }

        boolean activo() {
            return ia != null && restantes > 0;
        }

        Optional<DestinoDeHoja> destino(String nombreHoja, List<String> titulos) {
            if (!activo()) {
                return Optional.empty();
            }
            restantes--;
            return ia.sugerirDestino(nombreHoja, titulos);
        }

        Optional<String> campo(String titulo, Set<String> camposPosibles) {
            if (!activo()) {
                return Optional.empty();
            }
            restantes--;
            return ia.sugerirCampo(titulo, camposPosibles);
        }
    }

    /**
     * Una hoja ya decidida: el plan que se tomó sobre ella y sus filas leídas.
     *
     * <p>El plan va aparte y no disuelto en campos sueltos porque es justo lo
     * que hay que guardar para poder repetir la misma lectura al confirmar. Los
     * accesores delegan para que quien solo quiere el destino o el motivo no
     * tenga que saber que existe.
     */
    public record HojaClasificada(AnalisisDeLibro.Hoja analisis, HojaLeida hoja) {

        public String nombre() {
            return analisis.nombre();
        }

        public DestinoDeHoja destino() {
            return analisis.destino();
        }

        public String motivo() {
            return analisis.motivo();
        }

        public List<String> columnasPorIa() {
            return analisis.columnasPorIa();
        }

        public boolean destinoPorIa() {
            return analisis.destinoPorIa();
        }

        public boolean importable() {
            return destino() != null && hoja != null;
        }

        static HojaClasificada omitida(String nombre, String motivo) {
            return new HojaClasificada(AnalisisDeLibro.Hoja.omitida(nombre, motivo), null);
        }
    }

    private LectorDeLibro() {
    }

    public static void validarArchivo(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new BusinessException("Adjunta un archivo de Excel (.xlsx o .xls)");
        }
        String nombre = archivo.getOriginalFilename() == null
                ? "" : archivo.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!nombre.endsWith(".xlsx") && !nombre.endsWith(".xls")) {
            throw new BusinessException("Solo se admiten archivos .xlsx o .xls");
        }
    }

    /** Lee y clasifica todas las hojas del libro, en su orden original. */
    public static List<HojaClasificada> leer(MultipartFile archivo) {
        return leer(archivo, null);
    }

    /** Igual que {@link #leer(MultipartFile)}, con rescate por IA. */
    public static List<HojaClasificada> leer(MultipartFile archivo, ReconocimientoConIa ia) {
        validarArchivo(archivo);
        try (var entrada = archivo.getInputStream();
             Workbook libro = WorkbookFactory.create(entrada)) {

            if (libro.getNumberOfSheets() == 0) {
                throw new BusinessException("El archivo no tiene ninguna hoja");
            }
            // El presupuesto es del libro entero, no de cada hoja: si la
            // primera pestaña se lleva las consultas, las siguientes se
            // clasifican con el diccionario y se sigue adelante.
            var presupuesto = new PresupuestoIa(ia, MAXIMO_CONSULTAS_IA);
            var resultado = new ArrayList<HojaClasificada>();
            for (int i = 0; i < libro.getNumberOfSheets(); i++) {
                resultado.add(clasificar(libro.getSheetAt(i), presupuesto));
            }
            return resultado;

        } catch (BusinessException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new BusinessException("No se pudo leer el archivo: " + e.getMessage());
        }
    }

    public static HojaClasificada clasificar(Sheet hoja) {
        return clasificar(hoja, new PresupuestoIa(null, 0));
    }

    static HojaClasificada clasificar(Sheet hoja, ReconocimientoConIa ia) {
        return clasificar(hoja, new PresupuestoIa(ia, MAXIMO_CONSULTAS_IA));
    }

    static HojaClasificada clasificar(Sheet hoja, PresupuestoIa ia) {
        String nombre = hoja.getSheetName();

        // Se busca la cabecera con el vocabulario de todos los destinos a la
        // vez: en este punto todavia no se sabe cual es, y usar el de uno solo
        // haria que la fila de titulos de las otras hojas pasara desapercibida.
        var cabecera = DeteccionDeCabecera.buscar(hoja, LectorDeLibro::loConoceAlguien);
        DestinoDeHoja destino = cabecera.flatMap(LectorDeLibro::mejorDestino).orElse(null);
        boolean destinoPorIa = false;

        if (destino == null && ia.activo()) {
            // Ni cabecera reconocible ni destino claro con el diccionario: se
            // pregunta a la IA antes de descartar la hoja.
            var cabeceraSugerida = cabecera.or(() -> cabeceraLaxa(hoja));
            if (cabeceraSugerida.isPresent()) {
                var sugerido = ia.destino(nombre,
                        new ArrayList<>(cabeceraSugerida.get().titulos().values()));
                if (sugerido.isPresent()) {
                    destino = sugerido.get();
                    destinoPorIa = true;
                    if (cabecera.isEmpty()) {
                        cabecera = cabeceraSugerida;
                    }
                }
            }
        }

        if (cabecera.isEmpty()) {
            return HojaClasificada.omitida(nombre,
                    "No se encontró una fila de títulos reconocible");
        }
        if (destino == null) {
            return HojaClasificada.omitida(nombre,
                    "Los títulos no permiten decidir a qué corresponde la hoja");
        }

        var porIndice = destino.mapear(cabecera.get().titulos());
        var faltan = destino.camposFaltantes(porIndice);
        if (!faltan.isEmpty()) {
            return HojaClasificada.omitida(nombre,
                    "Parece " + destino.getEtiqueta().toLowerCase(Locale.ROOT)
                            + " pero le falta " + describir(faltan));
        }

        // Columnas que ningun sinonimo reconoce: la IA puede proponer un campo.
        // Gana siempre la primera columna que lo reclamó, como en el diccionario.
        var columnasPorIa = new LinkedHashSet<String>();
        if (ia.activo()) {
            for (var entrada : cabecera.get().titulos().entrySet()) {
                if (porIndice.containsKey(entrada.getKey())) {
                    continue;
                }
                ia.campo(entrada.getValue(), destino.camposPosibles())
                        .filter(campo -> !porIndice.containsValue(campo))
                        .ifPresent(campo -> {
                            porIndice.put(entrada.getKey(), campo);
                            columnasPorIa.add(entrada.getValue());
                        });
            }
        }

        var plan = new AnalisisDeLibro.Hoja(nombre, destino, null,
                cabecera.get().fila(),
                new LinkedHashMap<>(cabecera.get().titulos()),
                new LinkedHashMap<>(porIndice),
                List.copyOf(columnasPorIa),
                destinoPorIa);
        return new HojaClasificada(plan, leerConEsePlan(hoja, plan));
    }

    /**
     * Vuelve a leer el libro aplicando un análisis ya tomado.
     *
     * <p>No se consulta el diccionario ni la IA: cada hoja recibe el destino y
     * el mapa de columnas que se decidieron al previsualizar. Es lo que hace
     * que lo aprobado y lo escrito sean lo mismo.
     *
     * <p>Quien llame tiene que haber comprobado antes que el archivo es el
     * mismo que se analizó. Sin esa comprobación esto aplicaría el plan de un
     * archivo a las celdas de otro, que es peor que volver a analizarlo.
     */
    public static List<HojaClasificada> releer(MultipartFile archivo, AnalisisDeLibro analisis) {
        validarArchivo(archivo);
        try (var entrada = archivo.getInputStream();
             Workbook libro = WorkbookFactory.create(entrada)) {

            var resultado = new ArrayList<HojaClasificada>();
            for (var plan : analisis.hojas()) {
                Sheet hoja = plan.destino() == null ? null : libro.getSheet(plan.nombre());
                if (hoja == null) {
                    // Las omitidas se repiten omitidas y con su mismo motivo: si
                    // la previsualización dijo que una pestaña no se reconocía,
                    // el informe final tiene que seguir diciéndolo.
                    resultado.add(HojaClasificada.omitida(plan.nombre(), plan.motivo()));
                    continue;
                }
                resultado.add(new HojaClasificada(plan, leerConEsePlan(hoja, plan)));
            }
            return resultado;

        } catch (BusinessException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new BusinessException("No se pudo leer el archivo: " + e.getMessage());
        }
    }

    private static HojaLeida leerConEsePlan(Sheet hoja, AnalisisDeLibro.Hoja plan) {
        var filas = HojaLeida.filasDebajoDe(hoja, plan.filaCabecera(), plan.campos(), MAX_FILAS_POR_HOJA);
        return new HojaLeida(plan.nombre(), plan.filaCabecera() + 1, plan.columnas(), filas);
    }

    /** Cabecera sin exigir titulos reconocidos: rescate para hojas renombradas. */
    private static Optional<DeteccionDeCabecera.Cabecera> cabeceraLaxa(Sheet hoja) {
        return DeteccionDeCabecera.buscar(hoja, titulo -> true);
    }

    private static boolean loConoceAlguien(String titulo) {
        for (DestinoDeHoja destino : DestinoDeHoja.values()) {
            if (destino.reconoce(titulo)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Destino que mejor explica la cabecera, si le saca ventaja suficiente al
     * siguiente.
     */
    static Optional<DestinoDeHoja> mejorDestino(DeteccionDeCabecera.Cabecera cabecera) {
        DestinoDeHoja ganador = null;
        int mejorPuntaje = 0;
        int segundoPuntaje = 0;

        for (DestinoDeHoja destino : DestinoDeHoja.values()) {
            int puntaje = (int) cabecera.titulos().values().stream()
                    .filter(destino::reconoce)
                    .count();
            if (puntaje > mejorPuntaje) {
                segundoPuntaje = mejorPuntaje;
                mejorPuntaje = puntaje;
                ganador = destino;
            } else if (puntaje > segundoPuntaje) {
                segundoPuntaje = puntaje;
            }
        }

        if (ganador == null || mejorPuntaje - segundoPuntaje < VENTAJA_MINIMA) {
            return Optional.empty();
        }
        return Optional.of(ganador);
    }

    private static String describir(List<String> campos) {
        return campos.stream()
                .map(campo -> switch (campo) {
                    case "nombreCompleto" -> "la columna que identifica al participante";
                    case "empresaNombre", "nombre" -> "la columna «Empresa»";
                    default -> "la columna «" + campo + "»";
                })
                .distinct()
                .reduce((a, b) -> a + " y " + b)
                .orElse("columnas obligatorias");
    }
}
