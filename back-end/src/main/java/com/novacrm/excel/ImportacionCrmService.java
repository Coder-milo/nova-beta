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

    // ── Empresas ────────────────────────────────────────────────────────────

    private static final Set<String> CAMPOS_EMPRESA = Set.of(
            "nombre", "sector", "ciudad", "sitioWeb", "telefono", "email", "direccion",
            "contactoNombre", "contactoEmail", "contactoCanal", "fechaPrimerContacto",
            "estadoRelacion", "proximoPaso", "notas", "cargosTipicos", "canalPostulacion");

    private static final Map<String, String> ALIAS_EMPRESA = alias(Map.ofEntries(
            Map.entry("empresa", "nombre"),
            Map.entry("nombre de la empresa", "nombre"),
            Map.entry("razon social", "nombre"),
            Map.entry("compania", "nombre"),
            Map.entry("sector", "sector"),
            Map.entry("industria", "sector"),
            Map.entry("ciudad", "ciudad"),
            Map.entry("sitio web", "sitioWeb"),
            Map.entry("pagina web", "sitioWeb"),
            Map.entry("web", "sitioWeb"),
            Map.entry("telefono", "telefono"),
            Map.entry("telefono empresa", "telefono"),
            Map.entry("correo", "email"),
            Map.entry("correo empresa", "email"),
            Map.entry("email", "email"),
            Map.entry("direccion", "direccion"),
            Map.entry("contacto", "contactoNombre"),
            Map.entry("nombre del contacto", "contactoNombre"),
            Map.entry("persona de contacto", "contactoNombre"),
            Map.entry("correo del contacto", "contactoEmail"),
            Map.entry("email contacto", "contactoEmail"),
            Map.entry("canal de contacto", "contactoCanal"),
            Map.entry("fecha primer contacto", "fechaPrimerContacto"),
            Map.entry("fecha de contacto", "fechaPrimerContacto"),
            Map.entry("estado", "estadoRelacion"),
            Map.entry("estado relacion", "estadoRelacion"),
            Map.entry("estado de la relacion", "estadoRelacion"),
            Map.entry("proximo paso", "proximoPaso"),
            Map.entry("siguiente paso", "proximoPaso"),
            Map.entry("notas", "notas"),
            Map.entry("observaciones", "notas"),
            Map.entry("cargos", "cargosTipicos"),
            Map.entry("cargos tipicos", "cargosTipicos"),
            Map.entry("perfiles que contrata", "cargosTipicos"),
            Map.entry("canal de postulacion", "canalPostulacion")));

    // ── Colocaciones ────────────────────────────────────────────────────────

    private static final Set<String> CAMPOS_COLOCACION = Set.of(
            "documento", "email", "empresaNombre", "cargo", "tipoVinculacion", "fechaInicio",
            "canalConsecucion", "salario", "bonificaciones", "modalidad", "tipoContrato", "observaciones");

    private static final Map<String, String> ALIAS_COLOCACION = alias(Map.ofEntries(
            Map.entry("documento", "documento"),
            Map.entry("numero de documento", "documento"),
            Map.entry("cedula", "documento"),
            Map.entry("identificacion", "documento"),
            Map.entry("correo", "email"),
            Map.entry("correo del estudiante", "email"),
            Map.entry("email", "email"),
            Map.entry("empresa", "empresaNombre"),
            Map.entry("nombre de la empresa", "empresaNombre"),
            Map.entry("cargo", "cargo"),
            Map.entry("puesto", "cargo"),
            Map.entry("tipo de vinculacion", "tipoVinculacion"),
            Map.entry("vinculacion", "tipoVinculacion"),
            Map.entry("fecha de inicio", "fechaInicio"),
            Map.entry("fecha inicio", "fechaInicio"),
            Map.entry("fecha de ingreso", "fechaInicio"),
            Map.entry("canal", "canalConsecucion"),
            Map.entry("canal de consecucion", "canalConsecucion"),
            Map.entry("como se consiguio", "canalConsecucion"),
            Map.entry("salario", "salario"),
            Map.entry("sueldo", "salario"),
            Map.entry("remuneracion", "salario"),
            Map.entry("bonificaciones", "bonificaciones"),
            Map.entry("modalidad", "modalidad"),
            Map.entry("tipo de contrato", "tipoContrato"),
            Map.entry("observaciones", "observaciones"),
            Map.entry("notas", "observaciones")));

    private final ColumnMapper columnMapper;
    private final EmpresaRepository empresaRepository;
    private final EmpresaService empresaService;
    private final EstudianteRepository estudianteRepository;
    private final ColocacionRepository colocacionRepository;
    private final ColocacionService colocacionService;

    public ImportacionCrmService(ColumnMapper columnMapper,
                                 EmpresaRepository empresaRepository,
                                 EmpresaService empresaService,
                                 EstudianteRepository estudianteRepository,
                                 ColocacionRepository colocacionRepository,
                                 ColocacionService colocacionService) {
        this.columnMapper = columnMapper;
        this.empresaRepository = empresaRepository;
        this.empresaService = empresaService;
        this.estudianteRepository = estudianteRepository;
        this.colocacionRepository = colocacionRepository;
        this.colocacionService = colocacionService;
    }

    // ── Empresas ────────────────────────────────────────────────────────────

    @Transactional
    public ResultadoImportacionCrm importarEmpresas(MultipartFile archivo, boolean simular) {
        var hoja = LectorHoja.leer(archivo, ALIAS_EMPRESA, columnMapper, CAMPOS_EMPRESA);
        if (!hoja.columnas().containsValue("nombre")) {
            throw new com.novacrm.exception.BusinessException(
                    "Falta la columna con el nombre de la empresa. Titúlala «Empresa» o «Razón social».");
        }

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
            var existente = empresaRepository.findByNombreIgnoreCaseActiva(nombre.trim());
            boolean yaExiste = existente.isPresent() || vistas.contains(clave);

            try {
                var datos = new GuardarEmpresa(
                        nombre.trim(),
                        fila.texto("sector"),
                        fila.texto("ciudad"),
                        fila.texto("sitioWeb"),
                        fila.texto("telefono"),
                        correo(fila.texto("email")),
                        fila.texto("direccion"),
                        fila.texto("contactoNombre"),
                        correo(fila.texto("contactoEmail")),
                        fila.texto("contactoCanal"),
                        LectorHoja.fecha(fila.texto("fechaPrimerContacto")),
                        LectorHoja.enumDe(EstadoRelacion.class, fila.texto("estadoRelacion"), EstadoRelacion::getEtiqueta),
                        fila.texto("proximoPaso"),
                        fila.texto("notas"),
                        fila.texto("cargosTipicos"),
                        fila.texto("canalPostulacion"));

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
        var hoja = LectorHoja.leer(archivo, ALIAS_COLOCACION, columnMapper, CAMPOS_COLOCACION);
        if (!hoja.columnas().containsValue("documento") && !hoja.columnas().containsValue("email")) {
            throw new com.novacrm.exception.BusinessException(
                    "Falta la columna que identifica al estudiante. Añade «Número de documento» o «Correo».");
        }
        if (!hoja.columnas().containsValue("empresaNombre")) {
            throw new com.novacrm.exception.BusinessException("Falta la columna «Empresa».");
        }

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
                        empresa.trim(),
                        fila.texto("cargo"),
                        LectorHoja.enumDe(TipoVinculacion.class, fila.texto("tipoVinculacion"), TipoVinculacion::getEtiqueta),
                        LectorHoja.fecha(fila.texto("fechaInicio")),
                        LectorHoja.enumDe(CanalConsecucion.class, fila.texto("canalConsecucion"), CanalConsecucion::getEtiqueta),
                        LectorHoja.dinero(fila.texto("salario")),
                        fila.texto("bonificaciones"),
                        fila.texto("modalidad"),
                        fila.texto("tipoContrato"),
                        null, null, null, null, null,
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

    private static ResultadoImportacionCrm resultado(boolean simular,
                                                     LectorHoja.Hoja hoja,
                                                     int creados,
                                                     int actualizados,
                                                     List<FilaConError> errores) {
        var columnas = hoja.columnas().entrySet().stream()
                .map(e -> new ColumnaReconocida(e.getKey(), e.getValue()))
                .toList();
        return new ResultadoImportacionCrm(simular, hoja.filas().size(), creados, actualizados,
                errores.size(), errores, columnas);
    }

    /** Normaliza las claves del mapa de alias una sola vez, al cargar la clase. */
    private static Map<String, String> alias(Map<String, String> crudo) {
        var salida = new HashMap<String, String>();
        crudo.forEach((cabecera, campo) -> salida.put(LectorHoja.normalizar(cabecera), campo));
        return Map.copyOf(salida);
    }
}
