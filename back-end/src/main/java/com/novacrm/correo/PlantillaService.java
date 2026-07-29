package com.novacrm.correo;

import com.novacrm.branding.BrandingService;
import com.novacrm.config.DestinatariosPermitidos;
import com.novacrm.config.EmailService;
import com.novacrm.config.MarcaCorreo;
import com.novacrm.config.PlantillaCorreo;
import com.novacrm.config.TextoPlano;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.UUID;

/**
 * Plantillas de correo: guardar, previsualizar y enviar.
 *
 * <p>Se apoya en lo que ya existe y no lo reemplaza: {@code PlantillaCorreo}
 * pone el armazon que entiende Outlook, {@code MarcaCorreo} resuelve la
 * identidad del programa, {@code TextoPlano} deriva la version sin HTML y
 * {@code DestinatariosPermitidos} es la salvaguarda del envio.
 */
@Service
public class PlantillaService {

    private static final Logger log = LoggerFactory.getLogger(PlantillaService.class);

    private static final List<String> ROLES = List.of("COORDINADOR", "ADMIN");

    private final PlantillaRepository plantillaRepository;
    private final EstudianteRepository estudianteRepository;
    private final BrandingService brandingService;
    private final EmailService emailService;
    private final DestinatariosPermitidos destinatarios;

    @Value("${app.correo.logo-url:}")
    private String logoUrl;

    @Value("${app.correo.banner-pie-url:}")
    private String bannerPieUrl;

    public PlantillaService(PlantillaRepository plantillaRepository,
                            EstudianteRepository estudianteRepository,
                            BrandingService brandingService,
                            EmailService emailService,
                            DestinatariosPermitidos destinatarios) {
        this.plantillaRepository = plantillaRepository;
        this.estudianteRepository = estudianteRepository;
        this.brandingService = brandingService;
        this.emailService = emailService;
        this.destinatarios = destinatarios;
    }

    @Transactional(readOnly = true)
    public List<PlantillaDtos.Respuesta> listar() {
        return plantillaRepository.findAllByOrderByNombreAsc().stream()
                .map(PlantillaDtos.Respuesta::de).toList();
    }

    @Transactional(readOnly = true)
    public PlantillaDtos.Respuesta obtener(UUID id) {
        return PlantillaDtos.Respuesta.de(buscar(id));
    }

    /**
     * Guarda una plantilla, rechazando de una vez todo lo que este mal.
     *
     * <p>Devolver el primer motivo y callar el resto obliga a guardar, corregir
     * y volver a guardar tantas veces como errores haya.
     */
    @Transactional
    public PlantillaDtos.Respuesta guardar(UUID id, PlantillaDtos.Guardar peticion) {
        var motivos = new ArrayList<String>();

        if (vacio(peticion.nombre())) motivos.add("La plantilla necesita un nombre.");
        if (vacio(peticion.asunto())) motivos.add("El asunto no puede estar vacio.");
        if (vacio(peticion.cuerpo())) motivos.add("El cuerpo no puede estar vacio.");

        String rol = peticion.rolMinimo() == null ? "COORDINADOR" : peticion.rolMinimo().toUpperCase();
        if (!ROLES.contains(rol)) {
            motivos.add("El rol debe ser COORDINADOR o ADMIN; llego: " + peticion.rolMinimo());
        }

        // Una marca mal escrita se rechaza aqui, que es cuando hay alguien
        // mirando la pantalla; si se dejara pasar, el destinatario recibiria el
        // texto literal en medio de la frase.
        var malas = Variables.desconocidasEn(peticion.asunto() + " " + peticion.cuerpo());
        if (!malas.isEmpty()) {
            motivos.add("Estas variables no existen: " + String.join(", ", malas)
                    + ". Las disponibles son: " + Variables.todas().stream()
                    .map(Variables::marca).reduce((a, b) -> a + " " + b).orElse(""));
        }

        boolean textoSinUrl = !vacio(peticion.botonTexto()) && vacio(peticion.botonUrl());
        boolean urlSinTexto = vacio(peticion.botonTexto()) && !vacio(peticion.botonUrl());
        if (textoSinUrl || urlSinTexto) {
            motivos.add("El boton necesita texto y destino, o ninguno de los dos.");
        }

        if (!motivos.isEmpty()) {
            throw new BusinessException(String.join(" ", motivos));
        }

        var plantilla = id == null ? new PlantillaGuardada() : buscar(id);
        plantilla.setProgramaId(peticion.programaId());
        plantilla.setNombre(peticion.nombre().trim());
        plantilla.setDescripcion(limpio(peticion.descripcion()));
        plantilla.setAsunto(peticion.asunto().trim());
        plantilla.setCuerpo(peticion.cuerpo());
        plantilla.setBotonTexto(limpio(peticion.botonTexto()));
        plantilla.setBotonUrl(limpio(peticion.botonUrl()));
        plantilla.setRolMinimo(rol);
        plantilla.setActiva(peticion.activa() == null || peticion.activa());

        return PlantillaDtos.Respuesta.de(plantillaRepository.save(plantilla));
    }

    @Transactional
    public void eliminar(UUID id) {
        plantillaRepository.delete(buscar(id));
    }

    /**
     * El correo montado con valores de ejemplo, tal y como saldria.
     *
     * <p>Se arma con el mismo camino que el envio real —misma plantilla, misma
     * marca, mismo texto plano—: una previsualizacion que no use el codigo de
     * produccion acaba ensenando algo que no es lo que llega.
     */
    @Transactional(readOnly = true)
    public PlantillaDtos.Previsualizacion previsualizar(PlantillaDtos.Guardar peticion) {
        var marca = marcaDe(peticion.programaId());
        var valores = Variables.ejemplos();

        String asunto = Variables.aplicar(peticion.asunto(), valores);
        String cuerpo = Variables.aplicar(peticion.cuerpo(), valores);

        String html = montar(asunto, "Hola " + valores.get(Variables.NOMBRE) + ",",
                cuerpo, peticion.botonTexto(), peticion.botonUrl(), valores, marca);

        return new PlantillaDtos.Previsualizacion(
                asunto, html, TextoPlano.deHtml(html), avisos(peticion));
    }

    /**
     * Lo que conviene saber antes de mandar esto a 108 personas.
     *
     * <p>No son errores: son cosas que solo la persona que escribe la plantilla
     * puede decidir si estan bien.
     */
    private List<String> avisos(PlantillaDtos.Guardar peticion) {
        var avisos = new ArrayList<String>();
        String todo = peticion.asunto() + " " + peticion.cuerpo();

        if (Variables.usadasEn(todo).contains(Variables.EMPRESA)) {
            avisos.add("Usa {{empresa}}, que sale de una vacante. En un envio masivo a "
                    + "estudiantes no hay ninguna detras y esa frase quedara con un hueco.");
        }
        if (Variables.usadasEn(todo).contains(Variables.LINK) && vacio(peticion.botonUrl())) {
            avisos.add("Usa {{link}}, que es el enlace personal de activacion. Solo lo rellena "
                    + "el alta de cuentas; en un envio normal quedara vacio.");
        }
        if (destinatarios.hayRestriccion()) {
            avisos.add("Hay lista de direcciones de prueba: solo se escribira a "
                    + String.join(", ", destinatarios.lista()) + ".");
        }
        if (!emailService.canalActivo().equalsIgnoreCase("SMTP")
                && !emailService.canalActivo().equalsIgnoreCase("SES")) {
            avisos.add("No hay canal de correo configurado; el envio fallara.");
        }
        return avisos;
    }

    /**
     * Envia una plantilla a un conjunto de estudiantes.
     *
     * <p>Simula por defecto: mandar un correo a 108 personas no debe ser el
     * efecto de una llamada hecha por descuido.
     */
    @Transactional(readOnly = true)
    public PlantillaDtos.ResumenEnvio enviar(UUID plantillaId, PlantillaDtos.EnviarRequest peticion) {
        var plantilla = buscar(plantillaId);
        boolean simulacion = peticion.simulacion() == null || peticion.simulacion();

        List<Estudiante> estudiantes =
                (peticion.estudianteIds() == null || peticion.estudianteIds().isEmpty())
                        ? estudianteRepository.findAllByActivoTrue()
                        : estudianteRepository.findAllById(peticion.estudianteIds());

        if (estudiantes.isEmpty()) {
            throw new BusinessException("No hay estudiantes a los que enviar");
        }

        var resultados = new ArrayList<PlantillaDtos.ResultadoEnvio>();
        int enviados = 0, bloqueados = 0, fallidos = 0, sinCorreo = 0;

        for (Estudiante estudiante : estudiantes) {
            String nombre = nombreCompleto(estudiante);
            String email = estudiante.getEmail() == null ? null : estudiante.getEmail().trim();

            if (email == null || email.isBlank()) {
                sinCorreo++;
                resultados.add(new PlantillaDtos.ResultadoEnvio(estudiante.getId(), nombre, null,
                        false, "La ficha no tiene correo registrado"));
                continue;
            }

            if (!destinatarios.permite(email)) {
                bloqueados++;
                resultados.add(new PlantillaDtos.ResultadoEnvio(estudiante.getId(), nombre, email,
                        false, "No enviado: la direccion no esta en la lista de pruebas"));
                continue;
            }

            if (simulacion) {
                resultados.add(new PlantillaDtos.ResultadoEnvio(estudiante.getId(), nombre, email,
                        false, "Simulacion: no se envio nada"));
                continue;
            }

            var valores = new EnumMap<Variables, String>(Variables.class);
            valores.put(Variables.NOMBRE, nombre);
            valores.put(Variables.EMAIL, email);
            // EMPRESA y LINK se quedan vacias a proposito: la primera necesita
            // una vacante y la segunda un token de activacion, y ninguna de las
            // dos existe en un envio de comunicacion general.

            var marca = marcaDe(programaDe(estudiante, plantilla));
            String asunto = Variables.aplicar(plantilla.getAsunto(), valores);
            String html = montar(asunto, "Hola " + nombre + ",",
                    Variables.aplicar(plantilla.getCuerpo(), valores),
                    plantilla.getBotonTexto(), plantilla.getBotonUrl(), valores, marca);

            var envio = emailService.enviar(email, asunto, html);
            if (envio.enviado()) {
                enviados++;
                resultados.add(new PlantillaDtos.ResultadoEnvio(estudiante.getId(), nombre, email,
                        true, "Enviado"));
            } else {
                fallidos++;
                log.warn("Fallo el envio de '{}' a {}: {}",
                        plantilla.getNombre(), email, envio.motivoFallo());
                resultados.add(new PlantillaDtos.ResultadoEnvio(estudiante.getId(), nombre, email,
                        false, "Fallo: " + envio.motivoFallo()));
            }
        }

        return new PlantillaDtos.ResumenEnvio(
                estudiantes.size(), enviados, bloqueados, fallidos, sinCorreo,
                simulacion, emailService.canalActivo(), destinatarios.lista(), resultados);
    }

    /** Las variables disponibles, para que el editor no lleve la lista escrita. */
    public List<PlantillaDtos.VariableDisponible> variables() {
        return Variables.todas().stream().map(PlantillaDtos.VariableDisponible::de).toList();
    }

    // ── Interno ─────────────────────────────────────────────────────────────

    private String montar(String titulo, String saludo, String cuerpo,
                          String botonTexto, String botonUrl,
                          java.util.Map<Variables, String> valores, MarcaCorreo marca) {
        var contenido = new StringBuilder(cuerpo);
        if (botonTexto != null && !botonTexto.isBlank()
                && botonUrl != null && !botonUrl.isBlank()) {
            // El destino tambien admite variables: es como se manda un enlace
            // personal a cada quien.
            contenido.append(PlantillaCorreo.boton(
                    botonTexto, Variables.aplicar(botonUrl, valores), marca.colorPrimario()));
        }
        return PlantillaCorreo.construir(titulo, saludo, contenido.toString(), marca);
    }

    /** La plantilla puede fijar el programa; si no, manda el del estudiante. */
    private UUID programaDe(Estudiante estudiante, PlantillaGuardada plantilla) {
        if (plantilla.getProgramaId() != null) {
            return plantilla.getProgramaId();
        }
        return estudiante.getPrograma() == null ? null : estudiante.getPrograma().getId();
    }

    private MarcaCorreo marcaDe(UUID programaId) {
        return brandingService.paraCorreo(programaId)
                .map(b -> new MarcaCorreo(
                        primeroNoVacio(b.getCorreoHeaderUrl(), logoUrl),
                        b.getCorreoHeaderAncho(), b.getCorreoHeaderAlto(),
                        primeroNoVacio(b.getCorreoPieUrl(), bannerPieUrl),
                        b.getCorreoPieAncho(), b.getCorreoPieAlto(),
                        b.getCorreoTextoPie(), b.getColorPrimario()))
                .orElseGet(() -> MarcaCorreo.global(logoUrl, bannerPieUrl));
    }

    private PlantillaGuardada buscar(UUID id) {
        return plantillaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Plantilla no encontrada"));
    }

    private static String primeroNoVacio(String preferido, String respaldo) {
        return preferido == null || preferido.isBlank() ? respaldo : preferido;
    }

    private static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }

    private static String limpio(String valor) {
        if (valor == null) return null;
        String s = valor.trim();
        return s.isEmpty() ? null : s;
    }

    private static String nombreCompleto(Estudiante estudiante) {
        String nombre = estudiante.getNombre() == null ? "" : estudiante.getNombre();
        String apellido = estudiante.getApellido() == null ? "" : estudiante.getApellido();
        String completo = (nombre + " " + apellido).trim();
        return completo.isEmpty() ? "Estudiante" : completo;
    }
}
