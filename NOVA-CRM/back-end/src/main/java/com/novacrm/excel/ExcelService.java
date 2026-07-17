package com.novacrm.excel;

import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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

    private static final Map<String, String> BBDD_COLUMNS = buildBBDDMap();
    private static final Map<String, String> MAESTRA_COLUMNS = buildMaestraMap();

    private static final Set<String> SKIP_BBDD = buildSkipBBDD();
    private static final Set<String> SKIP_MAESTRA = buildSkipMaestra();

    public ExcelService(EstudianteRepository estudianteRepository,
                        ProgramaRepository programaRepository,
                        NivelInglesRepository nivelInglesRepository) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.nivelInglesRepository = nivelInglesRepository;
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
        m.put("4.3 Cuanto tiempo de experiencia laboral tienes?", "aniosExperiencia");
        m.put("4.4 En cual de los siguientes sectores...", "sectorExperiencia");
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

    private static Set<String> buildSkipBBDD() {
        return Set.of(
            "3.11 Si marco Otro, indique el Municipio...",
            "4.5 Si tu respuesta fue Otro, especifica:",
            "7.2 Disponibilidad de tiempo...",
            "7.5 Acceso a equipo prestado...",
            "9.2 Disposicion a asumir gastos migratorios",
            "10.1 Autorizas uso de datos (Prototipo NOVA)"
        );
    }

    private static Set<String> buildSkipMaestra() {
        return Set.of(
            "ID_Participante",
            "HV_Revisada",
            "LinkedIn_Optimizado",
            "Simulacro_Entrevista"
        );
    }

    public record ResultadoImportacion(
        int importados,
        int errores,
        int totalFilas,
        List<String> columnasDetectadas,
        List<String> erroresDetalle
    ) {}

    // Limite defensivo de filas para evitar cargas masivas / abuso.
    private static final int MAX_FILAS = 5000;

    static {
        // Proteccion frente a "zip bombs" en archivos OOXML: descomprimir mas de 100x
        // el tamano del zip aborta el parseo.
        org.apache.poi.openxml4j.util.ZipSecureFile.setMinInflateRatio(0.01);
    }

    @Transactional
    public Map<String, Object> importar(MultipartFile archivo, UUID programaId) {
        validarArchivo(archivo);

        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new BusinessException("Programa no encontrado: " + programaId));

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

        boolean esFormatoBBDD = columnasDetectadas.stream().anyMatch(c -> c.startsWith("3."));
        boolean esFormatoMaestra = columnasDetectadas.contains("Nombre_Completo");

        int importados = 0;
        int errores = 0;
        List<String> erroresDetalle = new ArrayList<>();

        for (Map<String, String> fila : filas) {
            try {
                var estudiante = new Estudiante();
                estudiante.setPrograma(programa);
                estudiante.setActivo(true);

                if (esFormatoBBDD) {
                    mapearBBDD(fila, estudiante);
                } else if (esFormatoMaestra) {
                    mapearMaestra(fila, estudiante);
                } else {
                    mapearGenerico(fila, estudiante);
                }

                if (estudiante.getEmail() == null || estudiante.getEmail().isBlank()) {
                    throw new BusinessException("Email vacío o no encontrado en la fila");
                }

                var existente = estudianteRepository.findByEmail(estudiante.getEmail());
                if (existente.isPresent()) {
                    var est = existente.get();
                    aplicarActualizacion(est, estudiante);
                    estudianteRepository.save(est);
                } else {
                    estudianteRepository.save(estudiante);
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
        resultado.put("erroresDetalle", erroresDetalle);
        return resultado;
    }

    private void mapearBBDD(Map<String, String> fila, Estudiante e) {
        for (var entry : BBDD_COLUMNS.entrySet()) {
            String col = entry.getKey();
            String campo = entry.getValue();
            String val = fila.getOrDefault(col, "").trim();
            if (val.isBlank() || SKIP_BBDD.contains(col)) continue;
            asignar(e, campo, val, col);
        }
        if (fila.containsKey("3.5 Nacionalidad")) {
            String nac = fila.get("3.5 Nacionalidad");
            if (nac != null && !nac.isBlank()) e.setNacionalidad(nac.trim());
        }
    }

    private void mapearMaestra(Map<String, String> fila, Estudiante e) {
        String nombreCompleto = fila.getOrDefault("Nombre_Completo", "").trim();
        if (!nombreCompleto.isBlank()) {
            int idx = nombreCompleto.indexOf(' ');
            if (idx > 0) {
                e.setNombre(nombreCompleto.substring(0, idx).trim());
                e.setApellido(nombreCompleto.substring(idx).trim());
            } else {
                e.setNombre(nombreCompleto);
                e.setApellido("");
            }
        }
        for (var entry : MAESTRA_COLUMNS.entrySet()) {
            String col = entry.getKey();
            if ("Nombre_Completo".equals(col)) continue;
            String campo = entry.getValue();
            String val = fila.getOrDefault(col, "").trim();
            if (val.isBlank() || SKIP_MAESTRA.contains(col)) continue;
            asignar(e, campo, val, col);
        }
    }

    private void mapearGenerico(Map<String, String> fila, Estudiante e) {
        e.setNombre(fila.getOrDefault("nombre", fila.getOrDefault("Nombre", "")));
        e.setApellido(fila.getOrDefault("apellido", fila.getOrDefault("Apellido", "")));
        e.setEmail(fila.getOrDefault("email", fila.getOrDefault("Email", "")));
        e.setTelefono(fila.getOrDefault("telefono", fila.getOrDefault("Teléfono", "")));
        e.setCiudad(fila.getOrDefault("ciudad", fila.getOrDefault("Ciudad", "")));
        e.setNumeroDocumento(fila.getOrDefault("numero_documento", fila.getOrDefault("Número Documento", "")));
    }

    private void asignar(Estudiante e, String campo, String val, String columna) {
        try {
            switch (campo) {
                case "email" -> e.setEmail(val);
                case "nombre" -> e.setNombre(val);
                case "apellido" -> e.setApellido(val);
                case "tipoDocumento" -> e.setTipoDocumento(val);
                case "numeroDocumento" -> e.setNumeroDocumento(val);
                case "genero" -> e.setGenero(val);
                case "celular" -> e.setCelular(val);
                case "ciudad" -> e.setCiudad(val);
                case "barrio" -> e.setBarrio(val);
                case "nacionalidad" -> e.setNacionalidad(val);
                case "clasificacionSisben" -> e.setClasificacionSisben(val);
                case "situacionLaboral" -> e.setSituacionLaboral(val);
                case "sectorExperiencia" -> e.setSectorExperiencia(val);
                case "ingresoMensual" -> e.setIngresoMensual(val);
                case "nivelEducativo" -> e.setNivelEducativo(val);
                case "titulo" -> e.setTitulo(val);
                case "perfilProfesional" -> e.setPerfilProfesional(val);
                case "motivacion" -> e.setMotivacion(val);
                case "ultimoCargo" -> e.setUltimoCargo(val);
                case "sectorObjetivo" -> e.setSectorObjetivo(val);
                case "cargoObjetivo" -> e.setCargoObjetivo(val);
                case "resultadoPruebaEscrita" -> e.setResultadoPruebaEscrita(val);
                case "resultadoPruebaOral" -> e.setResultadoPruebaOral(val);
                case "institucionEducativa" -> e.setInstitucionEducativa(val);
                case "programaAcademico" -> e.setProgramaAcademico(val);
                case "areaFormacion" -> e.setAreaFormacion(val);
                case "estadoFormacion" -> e.setEstadoFormacion(val);
                case "disponibilidadLaboral" -> e.setDisponibilidadLaboral(val);
                case "estadoBusqueda" -> e.setEstadoBusqueda(val);
                case "aniosExperiencia" -> e.setAniosExperiencia(parseInt(val, columna));
                case "postulacionesEnviadas" -> e.setPostulacionesEnviadas(parseInt(val, columna));
                case "empresasContactadas" -> e.setEmpresasContactadas(parseInt(val, columna));
                case "responsableEconomico" -> e.setResponsableEconomico(parseBoolean(val));
                case "haTrabajado" -> e.setHaTrabajado(parseBoolean(val));
                case "tieneComputador" -> e.setTieneComputador(parseBoolean(val));
                case "tieneInternet" -> e.setTieneInternet(parseBoolean(val));
                case "interesMigratorio" -> e.setInteresMigratorio(parseBoolean(val));
                case "fechaNacimiento" -> {
                    try {
                        for (var fmt : List.of(
                                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                                DateTimeFormatter.ofPattern("yyyy-MM-dd"),
                                DateTimeFormatter.ofPattern("dd-MM-yyyy"))) {
                            try {
                                e.setFechaNacimiento(LocalDate.parse(val, fmt));
                                break;
                            } catch (DateTimeParseException ignored) {}
                        }
                    } catch (Exception ignored) {}
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

    private Integer parseInt(String val, String columna) {
        if (val == null || val.isBlank()) return null;
        try {
            return (int) Math.round(Double.parseDouble(val.replace(",", ".")));
        } catch (NumberFormatException e) {
            throw new BusinessException("Valor numérico inválido en columna '" + columna + "': " + val);
        }
    }

    private Boolean parseBoolean(String val) {
        if (val == null || val.isBlank()) return null;
        var v = val.toLowerCase().trim();
        if (Set.of("si", "sí", "true", "yes", "1").contains(v)) return true;
        if (Set.of("no", "false", "not", "0").contains(v)) return false;
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
