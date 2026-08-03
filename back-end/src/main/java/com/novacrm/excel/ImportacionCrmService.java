package com.novacrm.excel;

import com.novacrm.colocacion.CanalConsecucion;
import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.colocacion.ColocacionService;
import com.novacrm.colocacion.TipoVinculacion;
import com.novacrm.colocacion.dto.ColocacionDtos.GuardarColocacion;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.empresa.EmpresaService;
import com.novacrm.empresa.EstadoRelacion;
import com.novacrm.empresa.dto.EmpresaDtos.GuardarEmpresa;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.excel.dto.ResultadoImportacionCrm;
import com.novacrm.excel.dto.ResultadoImportacionCrm.ColumnaReconocida;
import com.novacrm.excel.dto.ResultadoImportacionCrm.FilaConError;
import com.novacrm.excel.libro.DestinoDeHoja;
import com.novacrm.excel.libro.HojaLeida;
import com.novacrm.excel.libro.LectorDeLibro;
import com.novacrm.excel.libro.ResolutorDeParticipante;
import com.novacrm.ia.ReconocimientoConIa;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

/**
 * Carga masiva de empresas y colocaciones desde una hoja de cálculo.
 *
 * <p>Las dos se llevaban en Excel antes de existir el CRM y se siguen
 * recibiendo así de los aliados: pasar 300 empresas a mano por el formulario no
 * es una tarea, es una semana. Este servicio reconoce la cabecera con el
 * diccionario de sinónimos que ya usa la importación de estudiantes, más los
 * títulos propios de estos dos formatos.
 *
 * <p>Toda importación puede ejecutarse en seco ({@code simular = true}). Es la
 * misma pasada, con las mismas validaciones, sin escribir: quien carga ve
 * cuántas filas entran, cuántas se actualizan y qué falla, y decide después.
 */
@Service
@Transactional(readOnly = true)
public class ImportacionCrmService {

    private final ColumnMapper columnMapper;
    private final EmpresaRepository empresaRepository;
    private final EmpresaService empresaService;
    private final EstudianteRepository estudianteRepository;
    private final ColocacionRepository colocacionRepository;
    private final ColocacionService colocacionService;
    private final ReconocimientoConIa reconocimientoConIa;

    public ImportacionCrmService(ColumnMapper columnMapper,
                                 EmpresaRepository empresaRepository,
                                 EmpresaService empresaService,
                                 EstudianteRepository estudianteRepository,
                                 ColocacionRepository colocacionRepository,
                                 ColocacionService colocacionService,
                                 ReconocimientoConIa reconocimientoConIa) {
        this.columnMapper = columnMapper;
        this.empresaRepository = empresaRepository;
        this.empresaService = empresaService;
        this.estudianteRepository = estudianteRepository;
        this.colocacionRepository = colocacionRepository;
        this.colocacionService = colocacionService;
        this.reconocimientoConIa = reconocimientoConIa;
    }

    // ── Empresas ────────────────────────────────────────────────────────────

    @Transactional
    public ResultadoImportacionCrm importarEmpresas(MultipartFile archivo, boolean simular) {
        return importarEmpresas(hojaUnica(archivo, DestinoDeHoja.EMPRESAS,
                "Falta la columna con el nombre de la empresa. Titúlala «Empresa» o «Razón social»."),
                simular);
    }

    /** Misma pasada sobre una hoja ya leída, para la importación de libro completo. */
    @Transactional
    public ResultadoImportacionCrm importarEmpresas(HojaLeida hoja, boolean simular) {

        var errores = new ArrayList<FilaConError>();
        // Dentro del propio archivo se repiten empresas: la hoja suele ser un
        // registro de contactos, con una fila por acercamiento. Se recuerdan
        // los nombres ya vistos para que la segunda aparición cuente como
        // actualización y no intente crear un duplicado.
        var vistas = new HashSet<String>();
        int creados = 0;
        int actualizados = 0;

        for (var fila : hoja.filas()) {
            String nombre = fila.texto("nombre");
            if (nombre == null) {
                errores.add(new FilaConError(fila.numeroFila(), "Sin nombre de empresa"));
                continue;
            }
String clave = nombre.trim().toLowerCase(Locale.ROOT);
            // `nombre` recortado para que tope con la columna de la base; el
            // resto de campos con tope se recortan en la construccion de abajo.
            nombre = cortar(nombre, 255);
            var existente = empresaRepository.findByNombreIgnoreCaseActiva(nombre.trim());
            boolean yaExiste = existente.isPresent() || vistas.contains(clave);

            try {
                var datos = new GuardarEmpresa(
                        nombre.trim(),
                        cortar(fila.texto("sector"), 255),
                        cortar(fila.texto("ciudad"), 255),
                        cortar(fila.texto("sitioWeb"), 500),
                        cortar(fila.texto("telefono"), 50),
                        correo(fila.texto("email")),
                        fila.texto("direccion"),
                        cortar(fila.texto("contactoNombre"), 255),
                        correo(fila.texto("contactoEmail")),
                        cortar(fila.texto("contactoCanal"), 255),
                        LectorHoja.fecha(fila.texto("fechaPrimerContacto")),
                        LectorHoja.enumDe(EstadoRelacion.class, fila.texto("estadoRelacion"), EstadoRelacion::getEtiqueta),
                        fila.texto("proximoPaso"),
                        fila.texto("notas"),
                        fila.texto("cargosTipicos"),
                        cortar(fila.texto("canalPostulacion"), 255));

                if (!simular) {
                    if (existente.isPresent()) empresaService.actualizar(existente.get().getId(), datos);
                    else empresaService.crear(datos);
                }
                vistas.add(clave);
                if (yaExiste) actualizados++;
                else creados++;
            } catch (RuntimeException e) {
                errores.add(new FilaConError(fila.numeroFila(), motivo(e)));
            }
        }

        return resultado(simular, hoja, creados, actualizados, errores);
    }

    // ── Colocaciones ────────────────────────────────────────────────────────

    @Transactional
    public ResultadoImportacionCrm importarColocaciones(MultipartFile archivo, boolean simular, String autor) {
        return importarColocaciones(hojaUnica(archivo, DestinoDeHoja.COLOCACIONES,
                "Falta la columna «Empresa»."), simular, autor);
    }

    /** Misma pasada sobre una hoja ya leída, para la importación de libro completo. */
    @Transactional
    public ResultadoImportacionCrm importarColocaciones(HojaLeida hoja, boolean simular, String autor) {
        if (!hoja.tiene("documento") && !hoja.tiene("email") && !hoja.tiene("nombreCompleto")) {
            throw new com.novacrm.exception.BusinessException(
                    "Falta la columna que identifica al participante. Añade «Número de documento», "
                    + "«Correo» o «Nombre completo».");
        }
        // Solo se construye el índice por nombre si de verdad hace falta: es una
        // consulta a toda la cohorte activa.
        var porNombre = hoja.tiene("nombreCompleto")
                ? new ResolutorDeParticipante(estudianteRepository) : null;

        var errores = new ArrayList<FilaConError>();
        int creados = 0;
        int actualizados = 0;

        for (var fila : hoja.filas()) {
            String empresa = fila.texto("empresaNombre");
            if (empresa == null) {
                errores.add(new FilaConError(fila.numeroFila(), "Sin empresa"));
                continue;
            }
            var estudiante = buscarEstudiante(fila.texto("documento"), fila.texto("email"));
            if (estudiante.isEmpty() && porNombre != null) {
                // El libro de seguimiento identifica al participante por su
                // nombre y un número de orden: no trae ni documento ni correo.
                String nombre = fila.texto("nombreCompleto");
                var hallado = porNombre.buscar(nombre);
                if (hallado instanceof ResolutorDeParticipante.Resultado.Encontrado encontrado) {
                    estudiante = Optional.of(encontrado.estudiante());
                } else {
                    errores.add(new FilaConError(fila.numeroFila(),
                            ResolutorDeParticipante.explicar(hallado, nombre)));
                    continue;
                }
            }
            if (estudiante.isEmpty()) {
                errores.add(new FilaConError(fila.numeroFila(),
                        "No hay ningún estudiante con ese documento o correo"));
                continue;
            }

            try {
                // Una colocación vigente por estudiante: si ya está colocado,
                // la fila corrige lo registrado en vez de abrir un segundo
                // empleo simultáneo, que es lo que descuadraba los informes de
                // cierre de cohorte.
                var vigente = colocacionRepository
                        .findFirstByEstudianteIdAndActivaTrueOrderByFechaInicioDesc(estudiante.get().getId());

                var datos = new GuardarColocacion(
                        estudiante.get().getId(),
                        null,
                        cortar(empresa.trim(), 255),
                        cortar(fila.texto("cargo"), 255),
                        LectorHoja.enumDe(TipoVinculacion.class, fila.texto("tipoVinculacion"), TipoVinculacion::getEtiqueta),
                        LectorHoja.fecha(fila.texto("fechaInicio")),
                        LectorHoja.enumDe(CanalConsecucion.class, fila.texto("canalConsecucion"), CanalConsecucion::getEtiqueta),
                        LectorHoja.dinero(fila.texto("salario")),
                        cortar(fila.texto("bonificaciones"), 255),
                        cortar(fila.texto("modalidad"), 40),
                        cortar(fila.texto("tipoContrato"), 60),
                        // El checklist de ingreso venia descartandose aunque la
                        // hoja lo trae: son las cinco casillas que dicen si la
                        // vinculacion esta verificada, y sin ellas toda
                        // colocacion importada aparecia como sin revisar.
                        casilla(fila.texto("checklistContrato")),
                        casilla(fila.texto("checklistVerificacionVacante")),
                        casilla(fila.texto("checklistBenchmark")),
                        casilla(fila.texto("checklistReglamento")),
                        casilla(fila.texto("checklistColilla")),
                        fila.texto("observaciones"));

                if (!simular) {
                    if (vigente.isPresent()) colocacionService.actualizar(vigente.get().getId(), datos, autor);
                    else colocacionService.registrar(datos, autor);
                }
                if (vigente.isPresent()) actualizados++;
                else creados++;
            } catch (RuntimeException e) {
                errores.add(new FilaConError(fila.numeroFila(), motivo(e)));
            }
        }

        return resultado(simular, hoja, creados, actualizados, errores);
    }

    // ── Auxiliares ──────────────────────────────────────────────────────────

    private Optional<Estudiante> buscarEstudiante(String documento, String email) {
        if (documento != null && !documento.isBlank()) {
            // Los documentos vienen de Excel con puntos de miles y, si la celda
            // era numérica, a veces con ",0" al final.
            String limpio = documento.replaceAll("[^0-9A-Za-z]", "");
            var porDocumento = estudianteRepository.findByNumeroDocumento(limpio);
            if (porDocumento.isPresent()) return porDocumento;
            var original = estudianteRepository.findByNumeroDocumento(documento.trim());
            if (original.isPresent()) return original;
        }
        if (email != null && !email.isBlank()) {
            return estudianteRepository.findByEmail(email.trim().toLowerCase(Locale.ROOT));
        }
        return Optional.empty();
    }

    /**
     * Casilla del checklist de ingreso.
     *
     * <p>La hoja las escribe con simbolos: "✅ Sí" cumplida, "⏳ Pendiente" no.
     * Un valor que no diga ni una cosa ni la otra se deja sin responder en vez
     * de darlo por incumplido: "no anotado" y "verificado que no" no son lo
     * mismo cuando lo que se audita es si la vinculacion se reviso.
     */
    private static Boolean casilla(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        // Palabra por palabra y no con `contains`: "Sin verificar" contiene
        // "si" y significa justo lo contrario de "Sí".
        var palabras = Set.of(LectorHoja.normalizar(valor).split(" "));
        if (palabras.contains("si") || palabras.contains("ok") || palabras.contains("cumplido")) {
            return true;
        }
        if (palabras.contains("pendiente") || palabras.contains("no")) {
            return false;
        }
        return null;
    }

    /**
     * Un correo mal escrito no debe tumbar la fila entera.
     *
     * <p>El DTO valida el formato, y muchas hojas traen "N/A" o "pendiente" en
     * esa columna. Perder el alta de la empresa por eso sería absurdo: se
     * descarta el valor y se importa el resto.
     */
    private static String correo(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String limpio = valor.trim();
        return limpio.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+") ? limpio : null;
    }

    private static String motivo(RuntimeException e) {
        String mensaje = e.getMessage();
        return mensaje == null || mensaje.isBlank() ? e.getClass().getSimpleName() : mensaje;
    }

    /** Recorta un texto al tope de su columna en la base para que el 22001 no tuele toda la hoja. */
    private static String cortar(String valor, int largoMaximo) {
        if (valor == null || valor.length() <= largoMaximo) {
            return valor;
        }
        return valor.substring(0, largoMaximo).trim();
    }

    private static ResultadoImportacionCrm resultado(boolean simular,
                                                     HojaLeida hoja,
                                                     int creados,
                                                     int actualizados,
                                                     List<FilaConError> errores) {
        var columnas = hoja.columnas().entrySet().stream()
                .map(e -> new ColumnaReconocida(e.getKey(), e.getValue()))
                .toList();
        // `omitidos` en cero: estas dos hojas no descartan filas por duplicado,
        // las actualizan. El numero de errores ya viaja en la lista `errores`,
        // y duplicarlo aqui hacia que el panel mostrara como "omitidas" filas
        // que en realidad habian fallado.
        return new ResultadoImportacionCrm(simular, hoja.filas().size(), creados, actualizados,
                0, errores, columnas);
    }

    /**
     * Busca en el libro la única hoja que corresponde a un destino.
     *
     * <p>Estos endpoints reciben un archivo pensando en una sola tabla, pero el
     * archivo que manda el equipo trae siete hojas. Se busca la que encaja en
     * vez de asumir que es la primera, que era leer el tablero de indicadores.
     */
    private HojaLeida hojaUnica(MultipartFile archivo, DestinoDeHoja destino, String siNoHay) {
        var clasificadas = LectorDeLibro.leer(archivo, reconocimientoConIa);
        var candidatas = clasificadas.stream()
                .filter(LectorDeLibro.HojaClasificada::importable)
                .filter(c -> c.destino() == destino)
                .toList();
        if (candidatas.isEmpty()) {
            String detalle = clasificadas.stream()
                    .filter(c -> !c.importable())
                    .map(c -> "«" + c.nombre() + "»: " + c.motivo())
                    .reduce((a, b) -> a + "; " + b)
                    .map(m -> " Se revisaron estas hojas — " + m)
                    .orElse("");
            throw new com.novacrm.exception.BusinessException(siNoHay + detalle);
        }
        // Con varias hojas del mismo tipo —el libro trae dos de empresas— se usa
        // la que más columnas reconocidas aporta.
        return candidatas.stream()
                .max(Comparator.comparingInt(c -> c.hoja().columnas().size()))
                .orElseThrow()
                .hoja();
    }
}
