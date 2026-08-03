package com.novacrm.excel.libro;

import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.catalogo.nivel_ingles.NivelMcer;
import com.novacrm.estudiante.EstadoHito;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.excel.dto.ResultadoImportacionCrm;
import com.novacrm.excel.dto.ResultadoImportacionCrm.ColumnaReconocida;
import com.novacrm.excel.dto.ResultadoImportacionCrm.FilaConError;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;

/**
 * Actualiza los participantes con lo que trae la hoja de seguimiento.
 *
 * <p><strong>Actualiza; no da de alta.</strong> La hoja identifica a la persona
 * por su nombre completo y un numero de orden: no trae correo ni documento. Y
 * {@code Estudiante.email} es obligatorio y unico, asi que crear desde aqui
 * obligaria a inventarse un correo, lo que romperia el acceso del estudiante y
 * sus avisos. Los nombres que no esten en el sistema se informan fila por fila
 * para que alguien los registre con sus datos de contacto reales.
 *
 * <p>Es lo que corresponde a lo que esta hoja es: el seguimiento de una cohorte
 * ya inscrita. Lo que aporta son los hitos de preparacion, el nivel de ingles y
 * los objetivos laborales —justo lo que el CRM no puede deducir solo—.
 */
@Service
@Transactional(readOnly = true)
public class ImportacionDeParticipantes {

    private final EstudianteRepository estudianteRepository;
    private final NivelInglesRepository nivelInglesRepository;

    public ImportacionDeParticipantes(EstudianteRepository estudianteRepository,
                                      NivelInglesRepository nivelInglesRepository) {
        this.estudianteRepository = estudianteRepository;
        this.nivelInglesRepository = nivelInglesRepository;
    }

    @Transactional
    public ResultadoImportacionCrm importar(HojaLeida hoja, boolean simular) {
        var resolutor = new ResolutorDeParticipante(estudianteRepository);
        var errores = new ArrayList<FilaConError>();
        int actualizados = 0;

        for (var fila : hoja.filas()) {
            String nombre = fila.texto("nombreCompleto");
            if (nombre == null) {
                errores.add(new FilaConError(fila.numeroFila(), "Sin nombre del participante"));
                continue;
            }
            var hallado = resolutor.buscar(nombre);
            if (!(hallado instanceof ResolutorDeParticipante.Resultado.Encontrado encontrado)) {
                errores.add(new FilaConError(fila.numeroFila(),
                        ResolutorDeParticipante.explicar(hallado, nombre)));
                continue;
            }
            try {
                var estudiante = encontrado.estudiante();
                aplicar(fila, estudiante);
                if (!simular) {
                    estudianteRepository.save(estudiante);
                }
                actualizados++;
            } catch (RuntimeException e) {
                errores.add(new FilaConError(fila.numeroFila(),
                        e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }

        var columnas = hoja.columnas().entrySet().stream()
                .map(e -> new ColumnaReconocida(e.getKey(), e.getValue()))
                .toList();
        // Ninguno creado: esta hoja no da de alta a nadie.
        return new ResultadoImportacionCrm(simular, hoja.filas().size(), 0, actualizados,
                0, errores, columnas);
    }

    /**
     * Vuelca la fila sobre el participante.
     *
     * <p>Una celda vacia no borra lo que ya hay. La hoja se llena a mano y a
     * ritmos distintos: que alguien no haya anotado todavia el sector objetivo
     * no significa que el participante no tenga uno registrado en el CRM.
     */
    private void aplicar(HojaLeida.Fila fila, Estudiante e) {
        // Columnas con tope menor a 255 en la base (varchar(50)/(100)): la
        // guarda generica recorta a 255 y una celda larga todavia revienta el
        // UPDATE con un 22001 propio.
        texto(fila, "nacionalidad", e::setNacionalidad, 100);
        texto(fila, "genero", e::setGenero, 50);
        texto(fila, "nivelEducativo", e::setNivelEducativo);
        texto(fila, "sectorExperiencia", e::setSectorExperiencia);
        texto(fila, "sectorObjetivo", e::setSectorObjetivo);
        // Columnas que la hoja usa como texto libre y que la V31 amplio a TEXT:
        // recortarlas a 255 perdia parrafos enteros escritos por el equipo.
        texto(fila, "areaFormacion", e::setAreaFormacion, 0);
        texto(fila, "cargoObjetivo", e::setCargoObjetivo, 0);
        texto(fila, "competencias", e::setCompetencias, 0);
        texto(fila, "carpetaUrl", e::setCarpetaUrl, 1000);
        texto(fila, "linkedinUrl", e::setLinkedinUrl, 1000);
        texto(fila, "ciudad", v -> {
            if (v != null && !v.contains("\n") && !v.toLowerCase().contains("solvo") && !v.toLowerCase().contains("bpo")) {
                e.setCiudad(v);
            }
        });
        texto(fila, "celular", e::setCelular, 50);
        texto(fila, "telefono", e::setTelefono, 50);

        edad(fila.texto("edad"), e);
        aniosExperiencia(fila.texto("tiempoExperiencia"), e);
        nivelIngles(fila.texto("nivelIngles"), e);
        estadoEmpleabilidad(fila.texto("estadoEmpleabilidad"), e);

        var preparacion = e.getPreparacion();
        hito(fila, "cvListo", preparacion::setCvListo);
        hito(fila, "cvEnIngles", preparacion::setCvEnIngles);
        hito(fila, "linkedinCreado", preparacion::setLinkedinCreado);
        hito(fila, "linkedinOptimizado", preparacion::setLinkedinOptimizado);
        hito(fila, "perfilOcupacional", preparacion::setPerfilOcupacional);
        e.setPreparacion(preparacion);
    }

    /**
     * Largo maximo de una columna de texto corto en la base.
     *
     * <p>La mayoria de los campos de la ficha son {@code varchar(255)}. La hoja
     * de seguimiento tiene celdas mucho mas largas —en el libro real, "Carrera /
     * Titulo" llega a 1115 caracteres y "Cargos que puede aplicar" a 307, porque
     * la gente las usa como texto libre—, y sin recorte el UPDATE de Hibernate
     * revienta con un error de longitud que no dice ni que fila ni que columna
     * lo causo.
     */
    private static final int LARGO_MAXIMO = 255;

    private static void texto(HojaLeida.Fila fila, String campo, java.util.function.Consumer<String> destino) {
        texto(fila, campo, destino, LARGO_MAXIMO);
    }

    /**
     * Vuelca un campo de texto, recortando lo que no cabe.
     *
     * <p>El importador de estudiantes ya recortaba a 255 desde siempre
     * ({@code ExcelService.truncate}); este no heredo esa guarda al escribirse,
     * y bastaba una celda larga para tumbar la importacion entera. Se recorta y
     * se sigue: perder la cola de un texto libre es mejor que perder las 107
     * filas.
     *
     * @param largoMaximo tope de la columna destino; {@code 0} para no recortar
     */
    private static void texto(HojaLeida.Fila fila, String campo,
                              java.util.function.Consumer<String> destino, int largoMaximo) {
        String valor = fila.texto(campo);
        if (valor == null) {
            return;
        }
        if (largoMaximo > 0 && valor.length() > largoMaximo) {
            valor = valor.substring(0, largoMaximo).trim();
        }
        destino.accept(valor);
    }

    /**
     * La hoja anota la edad, no la fecha de nacimiento. Se guarda junto a la
     * fecha de captura: una edad suelta caduca, y reimportar el archivo el año
     * que viene dejaria a los 107 participantes con la edad del año pasado.
     */
    private static void edad(String valor, Estudiante e) {
        Integer anios = entero(valor);
        if (anios != null && anios > 0 && anios < 120) {
            e.setEdadAlRegistrar(anios);
            e.setFechaCapturaEdad(LocalDate.now());
        }
    }

    /**
     * La hoja no da un numero sino un rango ("Entre 1 y 2 años", "No tengo
     * experiencia laboral"). Se toma el extremo inferior: contar de mas la
     * experiencia infla el ajuste con las vacantes que la exigen.
     */
    static void aniosExperiencia(String valor, Estudiante e) {
        if (valor == null || valor.isBlank()) {
            return;
        }
        String v = ResolutorDeParticipante.normalizar(valor);
        Integer anios;
        if (v.contains("no tengo") || v.contains("ninguna") || v.contains("sin experiencia")) {
            anios = 0;
        } else if (v.contains("menos")) {
            anios = 0;
        } else if (v.contains("entre 6") || v.contains("entre seis") || v.contains("entre 1") || v.contains("entre uno")) {
            anios = 1;
        } else if (v.contains("mas de 2") || v.contains("mas de dos")) {
            anios = 3;
        } else {
            anios = entero(valor);
        }
        if (anios != null && anios >= 0) {
            e.setAniosExperiencia(anios);
        }
    }

    /**
     * El nivel llega como "B1 (Puedo comunicarme en situaciones sencillas)" o
     * como "No estoy seguro/a". Lo segundo no es un nivel y no debe pisar el
     * que ya estuviera registrado.
     */
    private void nivelIngles(String valor, Estudiante e) {
        NivelMcer.desdeTexto(valor)
                .flatMap(nivel -> nivelInglesRepository.findByCodigo(nivel.name()))
                .ifPresent(e::setNivelIngles);
    }

    private static void estadoEmpleabilidad(String valor, Estudiante e) {
        if (valor == null) {
            return;
        }
        String v = ResolutorDeParticipante.normalizar(valor);
        if (v.contains("empleado") || v.contains("colocado") || v.contains("contratado")) {
            e.setEstadoEmpleabilidad(EstadoEmpleabilidad.EMPLEADO);
        } else if (v.contains("buscando") || v.contains("postulando") || v.contains("en proceso")) {
            e.setEstadoEmpleabilidad(EstadoEmpleabilidad.BUSCANDO);
        }
        // "Sin iniciar" y cualquier otra cosa no mueven el estado: no dicen que
        // la persona haya dejado de buscar, dicen que nadie ha anotado nada.
    }

    /**
     * Los hitos tienen tres estados, no dos.
     *
     * <p>En el seguimiento hay hojas de vida en ingles "en proceso" y perfiles
     * ocupacionales a medias. Colapsar eso a {@code No} borra trabajo hecho y a
     * {@code Sí} inventa trabajo sin terminar.
     */
    private static void hito(HojaLeida.Fila fila, String campo, java.util.function.Consumer<EstadoHito> destino) {
        String valor = fila.texto(campo);
        if (valor == null) {
            return;
        }
        String v = ResolutorDeParticipante.normalizar(valor);
        // Comparacion exacta y no por prefijo: "Sin iniciar" empieza por "si" y
        // significa justo lo contrario de "Si".
        if (v.equals("si") || v.equals("x") || v.equals("true") || v.equals("1")) {
            destino.accept(EstadoHito.SI);
        } else if (v.contains("proceso") || v.contains("parcial")) {
            destino.accept(EstadoHito.EN_PROCESO);
        } else if (v.equals("no") || v.equals("false") || v.equals("0")) {
            destino.accept(EstadoHito.NO);
        }
        // Cualquier otra cosa —"N/A", "pendiente", "Sin iniciar"— deja el hito
        // como estaba: no dice que no se haya hecho, dice que nadie lo anoto.
    }

    /**
     * Primer numero entero del texto.
     *
     * <p>Se toma la parte entera y se descarta el resto en vez de parsear el
     * texto completo: una celda numerica de Excel llega como "24.0" y una edad
     * puede venir escrita como "24 años". Tratar ese punto como separador de
     * miles convertiria un 24 en un 240.
     */
    static Integer entero(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        var encontrado = ENTERO.matcher(valor);
        if (!encontrado.find()) {
            return null;
        }
        try {
            return Integer.valueOf(encontrado.group(1));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static final java.util.regex.Pattern ENTERO =
            java.util.regex.Pattern.compile("(\\d{1,3})");
}
