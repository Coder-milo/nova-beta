package com.novacrm.excel.libro;

import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.excel.dto.ResultadoImportacionCrm;
import com.novacrm.excel.dto.ResultadoImportacionCrm.ColumnaReconocida;
import com.novacrm.excel.dto.ResultadoImportacionCrm.FilaConError;
import com.novacrm.postulacion.EstadoPostulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.postulacion.PostulacionService;
import com.novacrm.postulacion.dto.PostulacionDtos.CrearPostulacion;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;

/**
 * Carga la hoja de seguimiento de postulaciones.
 *
 * <p>Es la hoja donde el equipo anota, una fila por acercamiento, a que empresa
 * y a que cargo se presento cada participante. No tenia importador: se llevaba
 * entera en Excel mientras el CRM tenia el modulo de postulaciones vacio, asi
 * que el tablero de empleabilidad no veia ninguna.
 *
 * <p>Como las otras hojas del libro, identifica a la persona por su nombre
 * completo. Ver {@link ResolutorDeParticipante} para por que eso obliga a no
 * adivinar cuando hay dos participantes con el mismo nombre.
 */
@Service
@Transactional(readOnly = true)
public class ImportacionDePostulaciones {

    private final EstudianteRepository estudianteRepository;
    private final PostulacionRepository postulacionRepository;
    private final PostulacionService postulacionService;

    public ImportacionDePostulaciones(EstudianteRepository estudianteRepository,
                                      PostulacionRepository postulacionRepository,
                                      PostulacionService postulacionService) {
        this.estudianteRepository = estudianteRepository;
        this.postulacionRepository = postulacionRepository;
        this.postulacionService = postulacionService;
    }

@Transactional
    public ResultadoImportacionCrm importar(HojaLeida hoja, boolean simular, String autor) {
        var resolutor = new ResolutorDeParticipante(estudianteRepository);
        var errores = new ArrayList<FilaConError>();
        // Dentro del propio archivo se repite el par (participante, empresa,
        // cargo) cuando alguien anota dos veces el mismo acercamiento. Se
        // recuerdan los ya vistos para no duplicar la postulacion.
        var vistas = new HashSet<String>();
        int creados = 0;
        int omitidos = 0;

        for (var fila : hoja.filas()) {
            String nombre = fila.texto("nombreCompleto");
            String empresa = cortar(fila.texto("empresaNombre"), 255);
            if (empresa == null) {
                errores.add(new FilaConError(fila.numeroFila(), "Sin empresa"));
                continue;
            }
            var hallado = resolutor.buscar(nombre);
            if (!(hallado instanceof ResolutorDeParticipante.Resultado.Encontrado encontrado)) {
                errores.add(new FilaConError(fila.numeroFila(),
                        ResolutorDeParticipante.explicar(hallado, nombre)));
                continue;
            }
            var estudiante = encontrado.estudiante();

            // El cargo es obligatorio en el modelo. La hoja a veces lo deja en
            // blanco cuando el acercamiento fue "envio de perfil" sin vacante
            // concreta; se anota asi en vez de perder la fila.
            String cargo = fila.texto("cargo");
            if (cargo == null) {
                cargo = "Sin cargo especificado";
            }
            // Columnas con tope en la base: una celda larga revienta la
            // postulacion con un 22001. Se recorta como en participante.
            cargo = cortar(cargo, 255);

            String clave = estudiante.getId() + "|"
                    + empresa.trim().toLowerCase(Locale.ROOT) + "|"
                    + cargo.trim().toLowerCase(Locale.ROOT);
            if (!vistas.add(clave)) {
                omitidos++;
                continue;
            }
            if (yaRegistrada(estudiante.getId(), empresa, cargo)) {
                omitidos++;
                continue;
            }

            try {
                var datos = new CrearPostulacion(
                        estudiante.getId(),
                        null,
                        empresa.trim(),
                        cargo.trim(),
                        cortar(fila.texto("canal"), 60),
                        fecha(fila.texto("fechaPostulacion")),
                        estado(fila),
                        cortar(fila.texto("urlOferta"), 1000),
                        observaciones(fila));

                if (!simular) {
                    postulacionService.crear(estudiante.getId(), datos,
                            gestor(fila, autor), false);
                }
                creados++;
            } catch (RuntimeException e) {
                errores.add(new FilaConError(fila.numeroFila(),
                        e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }

        var columnas = hoja.columnas().entrySet().stream()
                .map(e -> new ColumnaReconocida(e.getKey(), e.getValue()))
                .toList();
        // Nada se actualiza: una postulacion ya anotada se deja como esta y se
        // cuenta como omitida, para que reimportar el libro no duplique el
        // historial de acercamientos.
        return new ResultadoImportacionCrm(simular, hoja.filas().size(), creados, 0,
                omitidos, errores, columnas);
    }

    /**
     * Ya anotada en una carga anterior.
     *
     * <p>Reimportar el mismo libro es lo normal —se actualiza y se vuelve a
     * subir—, asi que sin esto cada carga duplicaria todas las postulaciones y
     * el indicador de acercamientos crecerian solo.
     */
    private boolean yaRegistrada(java.util.UUID estudianteId, String empresa, String cargo) {
        return postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(estudianteId).stream()
                .anyMatch(p -> igual(p.getEmpresaNombre(), empresa) && igual(p.getCargo(), cargo));
    }

    private static boolean igual(String uno, String otro) {
        return uno != null && otro != null
                && ResolutorDeParticipante.normalizar(uno).equals(ResolutorDeParticipante.normalizar(otro));
    }

    /**
     * Estado del proceso.
     *
     * <p>La hoja lo escribe en masculino ("Enviado") y a veces solo anota el
     * resultado ("Rechazado") dejando el estado en blanco. Se mira primero el
     * estado y, si no dice nada, el resultado.
     */
    private static EstadoPostulacion estado(HojaLeida.Fila fila) {
        var deEstado = EstadoPostulacion.desde(fila.texto("estado"));
        if (deEstado.isPresent()) {
            return deEstado.get();
        }
        return EstadoPostulacion.desde(fila.texto("resultado")).orElse(EstadoPostulacion.ENVIADA);
    }

    /**
     * La respuesta de la empresa y quien la anoto no tienen campo propio en el
     * alta, asi que se conservan en las observaciones en vez de tirarse: son la
     * unica traza de que hubo contestacion y de que dia.
     */
    private static String observaciones(HojaLeida.Fila fila) {
        var partes = new ArrayList<String>();
        if (fila.texto("observaciones") != null) {
            partes.add(fila.texto("observaciones"));
        }
        if (fila.texto("resultado") != null) {
            partes.add("Resultado: " + fila.texto("resultado"));
        }
        if (fila.texto("fechaRespuesta") != null) {
            partes.add("Respuesta el " + fila.texto("fechaRespuesta"));
        }
        return partes.isEmpty() ? null : String.join(". ", partes);
    }

    private static String gestor(HojaLeida.Fila fila, String autor) {
        String enLaHoja = fila.texto("gestionadoPor");
        return cortar(enLaHoja == null ? autor : enLaHoja, 255);
    }

    private static String cortar(String valor, int largoMaximo) {
        if (valor == null || valor.length() <= largoMaximo) {
            return valor;
        }
        return valor.substring(0, largoMaximo).trim();
    }

    /** Las fechas llegan ya normalizadas a ISO por el lector de celdas. */
    private static LocalDate fecha(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String limpio = valor.trim();
        for (var formato : java.util.List.of(
                java.time.format.DateTimeFormatter.ISO_LOCAL_DATE,
                java.time.format.DateTimeFormatter.ofPattern("d/M/yyyy"),
                java.time.format.DateTimeFormatter.ofPattern("d-M-yyyy"),
                java.time.format.DateTimeFormatter.ofPattern("yyyy/M/d"))) {
            try {
                return LocalDate.parse(limpio, formato);
            } catch (Exception ignorado) {
                // Se prueba el siguiente formato.
            }
        }
        return null;
    }
}
