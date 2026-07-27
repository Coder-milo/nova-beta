package com.novacrm.excel;

import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.excel.dto.ImportPreviewResponse;
import com.novacrm.excel.dto.ImportacionHistorialResponse;
import com.novacrm.exception.BusinessException;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ExcelService {

    private final EstudianteRepository estudianteRepository;
    private final ProgramaRepository programaRepository;
    private final NivelInglesRepository nivelInglesRepository;
    private final ColumnMapper columnMapper;
    private final ImportacionHistorialRepository importacionHistorialRepository;

    static final Map<String, String> BBDD_COLUMNS = buildBBDDMap();
    static final Map<String, String> MAESTRA_COLUMNS = buildMaestraMap();

    static final Set<String> SKIP = Set.of(
        "3.11 Si marco Otro, indique el Municipio...",
        "4.5 Si tu respuesta fue Otro, especifica:",
        "7.2 Disponibilidad de tiempo...",
        "7.5 Acceso a equipo prestado...",
        "9.2 Disposicion a asumir gastos migratorios",
        "10.1 Autorizas uso de datos (Prototipo NOVA)",
        "ID_Participante",
        "HV_Revisada",
        "LinkedIn_Optimizado",
        "Simulacro_Entrevista"
    );

    private static final int MAX_FILAS = 5000;

    public ExcelService(EstudianteRepository estudianteRepository,
                        ProgramaRepository programaRepository,
                        NivelInglesRepository nivelInglesRepository,
                        ColumnMapper columnMapper,
                        ImportacionHistorialRepository importacionHistorialRepository) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.nivelInglesRepository = nivelInglesRepository;
        this.columnMapper = columnMapper;
        this.importacionHistorialRepository = importacionHistorialRepository;
    }

    static {
        org.apache.poi.openxml4j.util.ZipSecureFile.setMinInflateRatio(0.01);
    }

    private void validarArchivo(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new BusinessException("Debes adjuntar un archivo Excel (.xlsx)");
        }
        String nombre = archivo.getOriginalFilename();
        if (nombre == null || !nombre.toLowerCase().endsWith(".xlsx")) {
            throw new BusinessException("Solo se admiten archivos .xlsx");
        }
        String tipo = archivo.getContentType();
        if (tipo != null && !tipo.isBlank()
                && !tipo.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                && !tipo.equals("application/octet-stream")) {
            throw new BusinessException("El tipo de archivo no es un Excel .xlsx valido");
        }
    }

    private static Map<String, String> buildBBDDMap() {
        var m = new LinkedHashMap<String, String>();
        m.put("3.9 Correo electronico", "email");
        m.put("3.1 Nombre (s)", "nombre");
        m.put("3.2 Apellido (s)", "apellido");
        m.put("3.3 Tipo de documento", "tipoDocumento");
        m.put("3.4 Numero de documento", "numeroDocumento");
        m.put("3.6 Fecha de nacimiento", "fechaNacimiento");
        m.put("3.7 Genero", "genero");
        m.put("3.8 Celular (WhatsApp activo)", "celular");
        m.put("3.10 Ciudad de residencia", "ciudad");
        m.put("3.12 Barrio", "barrio");
        m.put("4.1 Cual es tu clasificacion en SISBEN IV?", "clasificacionSisben");
        m.put("4.2 Actualmente, Cual es tu situacion laboral?", "situacionLaboral");
        m.put("4.3 Cuanto tiempo de experiencia laboral tienes en total?", "aniosExperiencia");
        m.put("4.4 En cual de los siguientes sectores tienes mayor experiencia laboral o formacion principal?", "sectorExperiencia");
        m.put("4.6 Si trabajas actualmente, cual es tu ingreso?", "ingresoMensual");
        m.put("4.7 Eres responsable economicamente de otros?", "responsableEconomico");
        m.put("5.1 Nivel educativo alcanzado", "nivelEducativo");
        m.put("5.2 Mencione el titulo obtenido...", "titulo");
        m.put("5.3 Has trabajado antes?", "haTrabajado");
        m.put("5.4 Describe brevemente tu experiencia laboral", "perfilProfesional");
        m.put("6.1 Cual consideras que es tu nivel actual de ingles?", "nivelIngles");
        m.put("7.1 Cual es tu principal motivacion...", "motivacion");
        m.put("7.3 Tienes computador funcional?", "tieneComputador");
        m.put("7.4 Cuentas con conexion a internet estable?", "tieneInternet");
        m.put("8.1 En que tipo de oportunidades laborales...", "tipoOportunidad");
        m.put("9.1 Te interesaria migrar a otro pais?", "interesMigratorio");
        m.put("3.5 Nacionalidad", "nacionalidad");
        m.put("Resultado Prueba Escrita", "resultadoPruebaEscrita");
        m.put("Resultado Prueba oral", "resultadoPruebaOral");
        return m;
    }

    private static Map<String, String> buildMaestraMap() {
        var m = new LinkedHashMap<String, String>();
        m.put("Nombre_Completo", "nombreCompleto");
        m.put("Documento", "numeroDocumento");
        m.put("Ciudad", "ciudad");
        m.put("Celular", "celular");
        m.put("Correo", "email");
        m.put("Nivel_Ingles", "nivelIngles");
        m.put("Estado_Programa", "estadoPrograma");
        m.put("Nivel_Educativo", "nivelEducativo");
        m.put("Programa_Academico", "programaAcademico");
        m.put("Institucion_Educativa", "institucionEducativa");
        m.put("Area_Formacion", "areaFormacion");
        m.put("Estado_Formacion", "estadoFormacion");
        m.put("Tiene_Experiencia", "haTrabajado");
        m.put("Anos_Experiencia", "aniosExperiencia");
        m.put("Ultimo_Cargo", "ultimoCargo");
        m.put("Sector_Experiencia", "sectorExperiencia");
        m.put("Perfil_Profesional_Sintesis", "perfilProfesional");
        m.put("Sector_Objetivo", "sectorObjetivo");
        m.put("Cargo_Objetivo", "cargoObjetivo");
        m.put("Disponibilidad_Laboral", "disponibilidadLaboral");
        m.put("Postulaciones_Enviadas", "postulacionesEnviadas");
        m.put("Empresas_Contactadas", "empresasContactadas");
        m.put("Estado_Busqueda", "estadoBusqueda");
        return m;
    }

    public record ResultadoImportacion(
        int importados,
        int errores,
        int totalFilas,
        List<String> columnasDetectadas,
        List<String> erroresDetalle
    ) {}

    @Transactional
    public Map<String, Object> importar(MultipartFile archivo, UUID programaId) {
        validarArchivo(archivo);

        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new BusinessException("Programa no encontrado: " + programaId));

        DatosArchivo datos = parsearArchivo(archivo);
        List<String> columnasDetectadas = datos.columnasDetectadas();
        List<Map<String, String>> filas = datos.filas();

        boolean esFormatoMaestra = columnasDetectadas.contains("Nombre_Completo");

        Map<String, String> columnMap = construirColumnMap(columnasDetectadas);

        List<String> columnasSinMapeo = columnMap.entrySet().stream()
                .filter(e -> e.getValue() == null)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        int importados = 0;
        int creados = 0;
        int actualizados = 0;
        int errores = 0;
        List<String> erroresDetalle = new ArrayList<>();

        for (Map<String, String> fila : filas) {
            try {
                var estudiante = construirEstudiante(fila, columnMap, esFormatoMaestra);
                estudiante.setPrograma(programa);
                estudiante.setActivo(true);

                if (estudiante.getEmail() != null && !estudiante.getEmail().isBlank()) {
                    var existente = estudianteRepository.findByEmail(estudiante.getEmail());
                    if (existente.isPresent()) {
                        aplicarActualizacion(existente.get(), estudiante);
                        estudianteRepository.save(existente.get());
                        actualizados++;
                    } else {
                        if (upsertPorDocumentoOInsertar(estudiante)) {
                            actualizados++;
                        } else {
                            creados++;
                        }
                    }
                } else if (estudiante.getNumeroDocumento() != null
                        && !estudiante.getNumeroDocumento().isBlank()) {
                    var existenteDoc = estudianteRepository.findByNumeroDocumento(estudiante.getNumeroDocumento());
                    if (existenteDoc.isPresent()) {
                        aplicarActualizacion(existenteDoc.get(), estudiante);
                        estudianteRepository.save(existenteDoc.get());
                        actualizados++;
                    } else {
                        throw new BusinessException("Email vacío o no encontrado en la fila");
                    }
                } else {
                    throw new BusinessException("Email vacío o no encontrado en la fila");
                }
                importados++;
            } catch (Exception e) {
                errores++;
                erroresDetalle.add("Fila " + (importados + errores) + ": " + e.getMessage());
            }
        }

        Map<String, Object> resultado = new HashMap<>();
        resultado.put("importados", importados);
        resultado.put("errores", errores);
        resultado.put("totalFilas", filas.size());
        resultado.put("columnasDetectadas", columnasDetectadas);
        resultado.put("columnasMapeadas", columnMap);
        resultado.put("columnasSinMapeo", columnasSinMapeo);
        resultado.put("erroresDetalle", erroresDetalle);

        registrarHistorial(archivo, programaId, creados, actualizados, errores, erroresDetalle);

        return resultado;
    }

    public ImportPreviewResponse previewImport(MultipartFile archivo, UUID programaId) {
        validarArchivo(archivo);

        if (programaId != null && programaRepository.findById(programaId).isEmpty()) {
            throw new BusinessException("Programa no encontrado: " + programaId);
        }

        DatosArchivo datos = parsearArchivo(archivo);
        List<String> columnasDetectadas = datos.columnasDetectadas();
        List<Map<String, String>> filas = datos.filas();

        boolean esFormatoMaestra = columnasDetectadas.contains("Nombre_Completo");

        Map<String, String> columnMap = construirColumnMap(columnasDetectadas);

        List<String> advertencias = columnMap.entrySet().stream()
                .filter(e -> e.getValue() == null)
                .map(e -> "Columna sin mapeo: " + e.getKey())
                .collect(Collectors.toList());

        int nuevos = 0;
        int actualizados = 0;
        int conErrores = 0;
        List<String> errores = new ArrayList<>();

        int numFila = 0;
        for (Map<String, String> fila : filas) {
            numFila++;
            try {
                var estudiante = construirEstudiante(fila, columnMap, esFormatoMaestra);
                if (estudianteRepository.findByEmail(estudiante.getEmail()).isPresent()) {
                    actualizados++;
                } else {
                    nuevos++;
                }
            } catch (Exception e) {
                conErrores++;
                errores.add("Fila " + numFila + ": " + e.getMessage());
            }
        }

        return new ImportPreviewResponse(
                filas.size(),
                nuevos + actualizados,
                nuevos,
                actualizados,
                conErrores,
                errores,
                advertencias);
    }

    public List<ImportacionHistorialResponse> obtenerHistorial() {
        return importacionHistorialRepository.findTop20ByOrderByCreatedAtDesc().stream()
                .map(h -> new ImportacionHistorialResponse(
                        h.getId(),
                        h.getArchivo(),
                        h.getUsuario(),
                        h.getCreados(),
                        h.getActualizados(),
                        h.getErrores(),
                        h.getCreatedAt()))
                .collect(Collectors.toList());
    }

    private DatosArchivo parsearArchivo(MultipartFile archivo) {
        List<String> columnasDetectadas = new ArrayList<>();
        List<Map<String, String>> filas = new ArrayList<>();

        try (var workbook = new XSSFWorkbook(archivo.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row header = sheet.getRow(0);
            if (header == null) throw new BusinessException("El archivo no tiene encabezados");
            if (sheet.getLastRowNum() > MAX_FILAS) {
                throw new BusinessException("El archivo supera el maximo de " + MAX_FILAS + " filas permitidas");
            }

            for (Cell cell : header) {
                columnasDetectadas.add(getCellValueAsString(cell).trim());
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                boolean allEmpty = true;
                Map<String, String> fila = new LinkedHashMap<>();
                for (int j = 0; j < columnasDetectadas.size(); j++) {
                    Cell cell = row.getCell(j);
                    String val = cell != null ? getCellValueAsString(cell) : "";
                    fila.put(columnasDetectadas.get(j), val);
                    if (!val.isBlank()) allEmpty = false;
                }
                if (!allEmpty) filas.add(fila);
            }
        } catch (IOException e) {
            throw new BusinessException("Error al leer el archivo Excel: " + e.getMessage());
        }

        return new DatosArchivo(columnasDetectadas, filas);
    }

    private Map<String, String> construirColumnMap(List<String> columnasDetectadas) {
        boolean esFormatoBBDD = columnasDetectadas.stream().anyMatch(c -> c.startsWith("3."));
        boolean esFormatoMaestra = columnasDetectadas.contains("Nombre_Completo");

        Map<String, String> exactOverrides;
        if (esFormatoBBDD) {
            exactOverrides = BBDD_COLUMNS;
        } else if (esFormatoMaestra) {
            exactOverrides = MAESTRA_COLUMNS;
        } else {
            exactOverrides = Collections.emptyMap();
        }

        return columnMapper.buildColumnMap(columnasDetectadas, exactOverrides);
    }

    private Estudiante construirEstudiante(Map<String, String> fila,
                                           Map<String, String> columnMap,
                                           boolean esFormatoMaestra) {
        var estudiante = new Estudiante();

        for (var entry : columnMap.entrySet()) {
            String col = entry.getKey();
            String field = entry.getValue();
            if (field == null || SKIP.contains(col)) continue;

            String val = fila.get(col);
            if (val == null || val.isBlank()) continue;

            if (esFormatoMaestra && "Nombre_Completo".equals(col)) {
                splitAndSetNombreCompleto(estudiante, val);
                continue;
            }

            asignar(estudiante, field, val, col);
        }

        // VALIDACIÓN DE CAMPOS OBLIGATORIOS
        if (estudiante.getNombre() == null || estudiante.getNombre().trim().isEmpty()) {
            throw new BusinessException("El nombre es requerido y no puede estar vacío");
        }
        if (estudiante.getApellido() == null) {
            throw new BusinessException("El apellido es requerido");
        }
        if (estudiante.getEmail() == null || estudiante.getEmail().trim().isEmpty()) {
            throw new BusinessException("El email es requerido y no puede estar vacío");
        }

        return estudiante;
    }

    private void registrarHistorial(MultipartFile archivo, UUID programaId,
                                    int creados, int actualizados, int errores,
                                    List<String> erroresDetalle) {
        var historial = new ImportacionHistorial();
        historial.setArchivo(archivo.getOriginalFilename());
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        historial.setUsuario(auth != null && auth.getName() != null ? auth.getName() : "sistema");
        historial.setProgramaId(programaId);
        historial.setCreados(creados);
        historial.setActualizados(actualizados);
        historial.setOmitidos(0);
        historial.setErrores(errores);
        String detalle = String.join("\n", erroresDetalle);
        historial.setDetalle(detalle.length() > 2000 ? detalle.substring(0, 2000) : detalle);
        importacionHistorialRepository.save(historial);
    }

    private boolean upsertPorDocumentoOInsertar(Estudiante estudiante) {
        if (estudiante.getNumeroDocumento() != null
                && !estudiante.getNumeroDocumento().isBlank()) {
            var existenteDoc = estudianteRepository
                    .findByNumeroDocumento(estudiante.getNumeroDocumento());
            if (existenteDoc.isPresent()) {
                aplicarActualizacion(existenteDoc.get(), estudiante);
                estudianteRepository.save(existenteDoc.get());
                return true;
            }
        }
        estudianteRepository.save(estudiante);
        return false;
    }

    private record DatosArchivo(List<String> columnasDetectadas, List<Map<String, String>> filas) {}

    private void splitAndSetNombreCompleto(Estudiante e, String nombreCompleto) {
        if (nombreCompleto == null || nombreCompleto.isBlank()) return;
        nombreCompleto = nombreCompleto.trim();
        int idx = nombreCompleto.indexOf(' ');
        if (idx > 0) {
            e.setNombre(truncate(nombreCompleto.substring(0, idx).trim()));
            e.setApellido(truncate(nombreCompleto.substring(idx).trim()));
        } else {
            e.setNombre(truncate(nombreCompleto));
            e.setApellido("");
        }
    }

    private void asignar(Estudiante e, String campo, String val, String columna) {
        try {
            switch (campo) {
                case "email" -> e.setEmail(truncate(val));
                case "nombre" -> e.setNombre(truncate(val));
                case "apellido" -> e.setApellido(truncate(val));
                case "tipoDocumento" -> e.setTipoDocumento(truncate(val));
                case "numeroDocumento" -> e.setNumeroDocumento(truncate(val));
                case "genero" -> e.setGenero(truncate(val));
                case "celular" -> e.setCelular(truncate(val));
                case "ciudad" -> e.setCiudad(truncate(val));
                case "barrio" -> e.setBarrio(truncate(val));
                case "nacionalidad" -> e.setNacionalidad(truncate(val));
                case "clasificacionSisben" -> e.setClasificacionSisben(truncate(val));
                case "situacionLaboral" -> e.setSituacionLaboral(truncate(val));
                case "sectorExperiencia" -> e.setSectorExperiencia(truncate(val));
                case "ingresoMensual" -> e.setIngresoMensual(truncate(val));
                case "nivelEducativo" -> e.setNivelEducativo(truncate(val));
                case "titulo" -> e.setTitulo(truncate(val));
                case "perfilProfesional" -> e.setPerfilProfesional(val);
                case "motivacion" -> e.setMotivacion(val);
                case "ultimoCargo" -> e.setUltimoCargo(truncate(val));
                case "sectorObjetivo" -> e.setSectorObjetivo(truncate(val));
                case "cargoObjetivo" -> e.setCargoObjetivo(truncate(val));
                case "resultadoPruebaEscrita" -> e.setResultadoPruebaEscrita(truncate(val));
                case "resultadoPruebaOral" -> e.setResultadoPruebaOral(truncate(val));
                case "institucionEducativa" -> e.setInstitucionEducativa(truncate(val));
                case "programaAcademico" -> e.setProgramaAcademico(truncate(val));
                case "areaFormacion" -> e.setAreaFormacion(truncate(val));
                case "estadoFormacion" -> e.setEstadoFormacion(truncate(val));
                case "disponibilidadLaboral" -> e.setDisponibilidadLaboral(truncate(val));
                case "estadoBusqueda" -> e.setEstadoBusqueda(truncate(val));
                case "aniosExperiencia" -> e.setAniosExperiencia(parseExperiencia(val, columna));
                case "postulacionesEnviadas" -> e.setPostulacionesEnviadas(parseInt(val, columna));
                case "empresasContactadas" -> e.setEmpresasContactadas(parseInt(val, columna));
                case "responsableEconomico" -> e.setResponsableEconomico(parseBoolean(val));
                case "haTrabajado" -> e.setHaTrabajado(parseBoolean(val));
                case "tieneComputador" -> e.setTieneComputador(parseBoolean(val));
                case "tieneInternet" -> e.setTieneInternet(parseBoolean(val));
                case "interesMigratorio" -> e.setInteresMigratorio(parseBoolean(val));
                case "fechaNacimiento" -> {
                    for (var fmt : List.of(
                            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
                            DateTimeFormatter.ofPattern("dd-MM-yyyy"))) {
                        try {
                            e.setFechaNacimiento(LocalDate.parse(val, fmt));
                            break;
                        } catch (DateTimeParseException ignored) {}
                    }
                }
                case "nivelIngles" -> {
                    var codigo = val.toUpperCase().replaceAll("[^A-Z0-9]", "");
                    if (!codigo.isBlank()) {
                        var nivel = nivelInglesRepository.findByCodigo(codigo);
                        nivel.ifPresent(e::setNivelIngles);
                    }
                }
                case "nombreCompleto", "tipoOportunidad", "estadoPrograma" -> {}
                default -> {}
            }
        } catch (Exception ex) {
            throw new BusinessException("Error mapeando columna '" + columna + "': " + ex.getMessage());
        }
    }

    private String truncate(String val) {
        if (val == null) return null;
        val = val.trim();
        return val.length() > 255 ? val.substring(0, 255) : val;
    }

    private void aplicarActualizacion(Estudiante existente, Estudiante nuevo) {
        if (nuevo.getNombre() != null && !nuevo.getNombre().isBlank()) existente.setNombre(nuevo.getNombre());
        if (nuevo.getApellido() != null && !nuevo.getApellido().isBlank()) existente.setApellido(nuevo.getApellido());
        if (nuevo.getTelefono() != null) existente.setTelefono(nuevo.getTelefono());
        if (nuevo.getCelular() != null) existente.setCelular(nuevo.getCelular());
        if (nuevo.getCiudad() != null) existente.setCiudad(nuevo.getCiudad());
        if (nuevo.getBarrio() != null) existente.setBarrio(nuevo.getBarrio());
        if (nuevo.getTipoDocumento() != null) existente.setTipoDocumento(nuevo.getTipoDocumento());
        if (nuevo.getNumeroDocumento() != null) existente.setNumeroDocumento(nuevo.getNumeroDocumento());
        if (nuevo.getFechaNacimiento() != null) existente.setFechaNacimiento(nuevo.getFechaNacimiento());
        if (nuevo.getGenero() != null) existente.setGenero(nuevo.getGenero());
        if (nuevo.getNacionalidad() != null) existente.setNacionalidad(nuevo.getNacionalidad());
        if (nuevo.getNivelEducativo() != null) existente.setNivelEducativo(nuevo.getNivelEducativo());
        if (nuevo.getTitulo() != null) existente.setTitulo(nuevo.getTitulo());
        if (nuevo.getAniosExperiencia() != null) existente.setAniosExperiencia(nuevo.getAniosExperiencia());
        if (nuevo.getSectorExperiencia() != null) existente.setSectorExperiencia(nuevo.getSectorExperiencia());
        if (nuevo.getUltimoCargo() != null) existente.setUltimoCargo(nuevo.getUltimoCargo());
        if (nuevo.getPerfilProfesional() != null) existente.setPerfilProfesional(nuevo.getPerfilProfesional());
        if (nuevo.getSectorObjetivo() != null) existente.setSectorObjetivo(nuevo.getSectorObjetivo());
        if (nuevo.getCargoObjetivo() != null) existente.setCargoObjetivo(nuevo.getCargoObjetivo());
        if (nuevo.getNivelIngles() != null) existente.setNivelIngles(nuevo.getNivelIngles());
        if (nuevo.getClasificacionSisben() != null) existente.setClasificacionSisben(nuevo.getClasificacionSisben());
        if (nuevo.getSituacionLaboral() != null) existente.setSituacionLaboral(nuevo.getSituacionLaboral());
        if (nuevo.getIngresoMensual() != null) existente.setIngresoMensual(nuevo.getIngresoMensual());
        if (nuevo.getResponsableEconomico() != null) existente.setResponsableEconomico(nuevo.getResponsableEconomico());
        if (nuevo.getHaTrabajado() != null) existente.setHaTrabajado(nuevo.getHaTrabajado());
        if (nuevo.getTieneComputador() != null) existente.setTieneComputador(nuevo.getTieneComputador());
        if (nuevo.getTieneInternet() != null) existente.setTieneInternet(nuevo.getTieneInternet());
        if (nuevo.getMotivacion() != null) existente.setMotivacion(nuevo.getMotivacion());
        if (nuevo.getInteresMigratorio() != null) existente.setInteresMigratorio(nuevo.getInteresMigratorio());
        if (nuevo.getResultadoPruebaEscrita() != null) existente.setResultadoPruebaEscrita(nuevo.getResultadoPruebaEscrita());
        if (nuevo.getResultadoPruebaOral() != null) existente.setResultadoPruebaOral(nuevo.getResultadoPruebaOral());
        if (nuevo.getInstitucionEducativa() != null) existente.setInstitucionEducativa(nuevo.getInstitucionEducativa());
        if (nuevo.getProgramaAcademico() != null) existente.setProgramaAcademico(nuevo.getProgramaAcademico());
        if (nuevo.getAreaFormacion() != null) existente.setAreaFormacion(nuevo.getAreaFormacion());
        if (nuevo.getEstadoFormacion() != null) existente.setEstadoFormacion(nuevo.getEstadoFormacion());
        if (nuevo.getDisponibilidadLaboral() != null) existente.setDisponibilidadLaboral(nuevo.getDisponibilidadLaboral());
        if (nuevo.getEstadoBusqueda() != null) existente.setEstadoBusqueda(nuevo.getEstadoBusqueda());
        if (nuevo.getPostulacionesEnviadas() != null) existente.setPostulacionesEnviadas(nuevo.getPostulacionesEnviadas());
        if (nuevo.getEmpresasContactadas() != null) existente.setEmpresasContactadas(nuevo.getEmpresasContactadas());
        if (nuevo.getDisponibilidadMovilidad() != null) existente.setDisponibilidadMovilidad(nuevo.getDisponibilidadMovilidad());
    }

    private Integer parseExperiencia(String val, String columna) {
        if (val == null || val.isBlank()) return null;
        var v = val.toLowerCase().trim()
                .replace("á", "a").replace("é", "e")
                .replace("í", "i").replace("ó", "o").replace("ú", "u");
        if (v.contains("no tengo") || v.contains("ninguna")) return 0;
        if (v.contains("menos")) return 0;
        if (v.contains("entre 6") || v.contains("entre seis")) return 1;
        if (v.contains("entre 1") || v.contains("entre uno")) return 1;
        if (v.contains("mas de 2") || v.contains("mas de dos")) return 3;
        return parseInt(val, columna);
    }

    private Integer parseInt(String val, String columna) {
        if (val == null || val.isBlank()) return null;
        try {
            return (int) Math.round(Double.parseDouble(val.replace(",", ".")));
        } catch (NumberFormatException e) {
            throw new BusinessException("Valor numérico inválido en columna '" + columna + "': " + val);
        }
    }

    // Solo palabras completas e inequivocas. Las iniciales sueltas ("s", "n")
    // quedan fuera a proposito: "N/A" empieza por "n" y significa "sin dato",
    // no "no".
    private static final Set<String> RESPUESTAS_SI = Set.of("si", "true", "yes", "1");
    private static final Set<String> RESPUESTAS_NO = Set.of("no", "false", "0");

    /**
     * Interpreta la respuesta a una pregunta de si/no.
     *
     * <p>El formulario de admision no responde con "Si" a secas: las opciones
     * reales son del estilo "Si, propio", "Si, tengo acceso a un computador" o
     * "No tengo la posibilidad...". Por eso se decide con la primera palabra y
     * no con la cadena completa; comparar la cadena entera descartaba en
     * silencio la respuesta de todos los participantes.
     *
     * @return {@code true}/{@code false}, o {@code null} si la respuesta no
     *         empieza por una afirmacion ni una negacion reconocible.
     */
    static Boolean parseBoolean(String val) {
        if (val == null || val.isBlank()) return null;

        String v = java.text.Normalizer.normalize(val.trim().toLowerCase(Locale.ROOT),
                        java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "");

        String primeraPalabra = Arrays.stream(v.split("[^a-z0-9]+"))
                .filter(p -> !p.isBlank())
                .findFirst()
                .orElse("");

        if (RESPUESTAS_SI.contains(primeraPalabra)) return true;
        if (RESPUESTAS_NO.contains(primeraPalabra)) return false;
        return null;
    }

    private String getCellValueAsString(Cell cell) {
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> {
                double val = cell.getNumericCellValue();
                yield val == Math.floor(val) ? String.valueOf((long) val) : String.valueOf(val);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield String.valueOf(cell.getNumericCellValue());
                } catch (Exception e) {
                    yield cell.getStringCellValue();
                }
            }
            default -> "";
        };
    }
}
