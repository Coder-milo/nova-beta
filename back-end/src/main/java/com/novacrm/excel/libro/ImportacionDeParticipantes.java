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
 * por su nombre completo, documento o correo. Lo que aporta son los hitos de
 * preparacion, el nivel de ingles, experiencia y los objetivos laborales.
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
        // El libro real trae más de cien participantes. Consultar el catálogo
        // de inglés dentro de cada fila convertía una vista previa en más de
        // cien viajes a PostgreSQL y hacía que el proxy de Vercel venciera
        // antes de recibir la respuesta. El catálogo es pequeño y estable: se
        // carga una sola vez y se resuelve en memoria.
        var nivelesPorCodigo = nivelInglesRepository.findAll().stream()
                .filter(nivel -> nivel.getCodigo() != null)
                .collect(java.util.stream.Collectors.toMap(
                        nivel -> nivel.getCodigo().toUpperCase(java.util.Locale.ROOT),
                        java.util.function.Function.identity(),
                        (primero, ignorado) -> primero));
        var errores = new ArrayList<FilaConError>();
        int actualizados = 0;

        for (var fila : hoja.filas()) {
            String nombre = fila.texto("nombreCompleto");
            if (nombre == null || nombre.isBlank()) {
                String n = fila.texto("nombre");
                String a = fila.texto("apellido");
                if (n != null || a != null) {
                    nombre = ((n != null ? n : "") + " " + (a != null ? a : "")).trim();
                }
            }
            if (nombre == null || nombre.isBlank()) {
                errores.add(new FilaConError(fila.numeroFila(), "Sin nombre del participante"));
                continue;
            }
            String email = fila.texto("email");
            String documento = fila.texto("numeroDocumento");

            var hallado = resolutor.buscar(nombre, email, documento);
            if (!(hallado instanceof ResolutorDeParticipante.Resultado.Encontrado encontrado)) {
                errores.add(new FilaConError(fila.numeroFila(),
                        ResolutorDeParticipante.explicar(hallado, nombre)));
                continue;
            }
            try {
                var estudiante = encontrado.estudiante();
                aplicar(fila, estudiante, nivelesPorCodigo);
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
        return new ResultadoImportacionCrm(simular, hoja.filas().size(), 0, actualizados,
                0, errores, columnas);
    }

    /**
     * Vuelca la fila sobre el participante.
     */
    private void aplicar(HojaLeida.Fila fila, Estudiante e,
                         java.util.Map<String, com.novacrm.catalogo.nivel_ingles.NivelIngles> nivelesPorCodigo) {
        texto(fila, "nacionalidad", e::setNacionalidad, 100);
        texto(fila, "genero", e::setGenero, 50);
        texto(fila, "tipoDocumento", e::setTipoDocumento, 50);
        texto(fila, "numeroDocumento", e::setNumeroDocumento, 50);
        texto(fila, "nivelEducativo", e::setNivelEducativo);
        texto(fila, "programaAcademico", e::setProgramaAcademico);
        texto(fila, "institucionEducativa", e::setInstitucionEducativa);
        texto(fila, "estadoFormacion", e::setEstadoFormacion, 100);
        texto(fila, "sectorExperiencia", e::setSectorExperiencia);
        texto(fila, "ultimoCargo", e::setUltimoCargo);
        texto(fila, "perfilProfesional", e::setPerfilProfesional, 0);
        texto(fila, "sectorObjetivo", e::setSectorObjetivo);
        texto(fila, "disponibilidadLaboral", e::setDisponibilidadLaboral);
        texto(fila, "estadoBusqueda", e::setEstadoBusqueda, 100);
        texto(fila, "areaFormacion", e::setAreaFormacion, 0);
        texto(fila, "cargoObjetivo", e::setCargoObjetivo, 0);
        texto(fila, "competencias", e::setCompetencias, 0);
        texto(fila, "carpetaUrl", e::setCarpetaUrl, 1000);
        texto(fila, "linkedinUrl", e::setLinkedinUrl, 1000);
        texto(fila, "clasificacionSisben", e::setClasificacionSisben, 100);
        texto(fila, "situacionLaboral", e::setSituacionLaboral, 100);
        texto(fila, "ingresoMensual", e::setIngresoMensual, 100);
        texto(fila, "resultadoPruebaEscrita", e::setResultadoPruebaEscrita, 255);
        texto(fila, "resultadoPruebaOral", e::setResultadoPruebaOral, 255);
        texto(fila, "motivacion", e::setMotivacion, 0);
        texto(fila, "ciudad", v -> {
            if (v != null && !v.contains("\n") && !v.toLowerCase().contains("solvo") && !v.toLowerCase().contains("bpo")) {
                e.setCiudad(v);
            }
        });
        texto(fila, "celular", e::setCelular, 50);
        texto(fila, "telefono", e::setTelefono, 50);

        booleano(fila.texto("haTrabajado"), e::setHaTrabajado);
        booleano(fila.texto("responsableEconomico"), e::setResponsableEconomico);
        booleano(fila.texto("tieneComputador"), e::setTieneComputador);
        booleano(fila.texto("tieneInternet"), e::setTieneInternet);
        booleano(fila.texto("interesMigratorio"), e::setInteresMigratorio);
        booleano(fila.texto("disponibilidadMovilidad"), e::setDisponibilidadMovilidad);

        enteroConTope(fila.texto("postulacionesEnviadas"), e::setPostulacionesEnviadas);
        enteroConTope(fila.texto("empresasContactadas"), e::setEmpresasContactadas);

        edad(fila.texto("edad"), e);
        aniosExperiencia(fila.texto("tiempoExperiencia"), e);
        nivelIngles(fila.texto("nivelIngles"), e, nivelesPorCodigo);
        estadoEmpleabilidad(fila.texto("estadoEmpleabilidad"), e);

        var preparacion = e.getPreparacion();
        hito(fila, "cvListo", preparacion::setCvListo);
        hito(fila, "cvEnIngles", preparacion::setCvEnIngles);
        hito(fila, "linkedinCreado", preparacion::setLinkedinCreado);
        hito(fila, "linkedinOptimizado", preparacion::setLinkedinOptimizado);
        hito(fila, "perfilOcupacional", preparacion::setPerfilOcupacional);
        e.setPreparacion(preparacion);
    }

    private static final int LARGO_MAXIMO = 255;

    private static void texto(HojaLeida.Fila fila, String campo, java.util.function.Consumer<String> destino) {
        texto(fila, campo, destino, LARGO_MAXIMO);
    }

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

    private static void edad(String valor, Estudiante e) {
        Integer anios = entero(valor);
        if (anios != null && anios > 0 && anios < 120) {
            e.setEdadAlRegistrar(anios);
            e.setFechaCapturaEdad(LocalDate.now());
        }
    }

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

    private static void nivelIngles(
            String valor,
            Estudiante e,
            java.util.Map<String, com.novacrm.catalogo.nivel_ingles.NivelIngles> nivelesPorCodigo) {
        if (valor == null || valor.isBlank()) {
            return;
        }
        NivelMcer.desdeTexto(valor)
                .map(nivel -> nivelesPorCodigo.get(nivel.name()))
                .filter(java.util.Objects::nonNull)
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
    }

    private static void hito(HojaLeida.Fila fila, String campo, java.util.function.Consumer<EstadoHito> destino) {
        String valor = fila.texto(campo);
        if (valor == null) {
            return;
        }
        String v = ResolutorDeParticipante.normalizar(valor);
        if (v.equals("si") || v.equals("x") || v.equals("true") || v.equals("1")) {
            destino.accept(EstadoHito.SI);
        } else if (v.contains("proceso") || v.contains("parcial")) {
            destino.accept(EstadoHito.EN_PROCESO);
        } else if (v.equals("no") || v.equals("false") || v.equals("0")) {
            destino.accept(EstadoHito.NO);
        }
    }

    private static void booleano(String valor, java.util.function.Consumer<Boolean> destino) {
        if (valor == null || valor.isBlank()) {
            return;
        }
        String v = ResolutorDeParticipante.normalizar(valor);
        if (v.equals("si") || v.equals("true") || v.equals("1") || v.equals("s")) {
            destino.accept(true);
        } else if (v.equals("no") || v.equals("false") || v.equals("0") || v.equals("n")) {
            destino.accept(false);
        }
    }

    private static void enteroConTope(String valor, java.util.function.Consumer<Integer> destino) {
        Integer n = entero(valor);
        if (n != null && n >= 0) {
            destino.accept(n);
        }
    }

    static Integer entero(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        // Soporta formatos como "2.3", "4.0", "15"
        var dec = DECIMAL.matcher(valor.trim().replace(',', '.'));
        if (dec.find()) {
            try {
                return (int) Math.round(Double.parseDouble(dec.group(1)));
            } catch (NumberFormatException ignored) {}
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
    private static final java.util.regex.Pattern DECIMAL =
            java.util.regex.Pattern.compile("(\\d+(?:\\.\\d+)?)");
}
