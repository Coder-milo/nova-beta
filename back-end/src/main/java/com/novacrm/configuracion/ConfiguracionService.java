package com.novacrm.configuracion;

import com.novacrm.config.MatchingConfig;
import com.novacrm.exception.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Lee y guarda la configuracion de la instalacion.
 *
 * <p>Los dos parametros de operacion los consulta quien los aplica —el motor de
 * matching y la purga de la papelera— a traves de {@link #umbralDeMatch()} y
 * {@link #diasRetencionPapelera()}, y no como un valor que este servicio
 * empuje al arrancar. Empujarlo cachearia la decision en cada instancia: con
 * dos procesos en marcha, cambiar el umbral en uno dejaria al otro cortando por
 * el numero viejo hasta el siguiente despliegue.
 */
@Service
public class ConfiguracionService {

    /** Dias en la papelera antes de la purga cuando nadie lo ha configurado. */
    public static final int DIAS_RETENCION_POR_DEFECTO = 30;

    /**
     * Tope de un campo de texto. Las columnas son TEXT y no lo necesitan, pero
     * sin limite un pegado accidental de media hoja de calculo entra entero y
     * despues sale impreso en donde se use el nombre de la institucion.
     */
    private static final int MAX_TEXTO = 500;

    private final ConfiguracionRepository configuracionRepository;
    private final MatchingConfig matchingConfig;

    public ConfiguracionService(ConfiguracionRepository configuracionRepository,
                                MatchingConfig matchingConfig) {
        this.configuracionRepository = configuracionRepository;
        this.matchingConfig = matchingConfig;
    }

    /**
     * La configuracion vigente. Si nadie ha guardado nada devuelve los valores
     * por defecto sin crear la fila: crearla al primer GET haria que la
     * pantalla dijera "guardado" sin que nadie hubiera guardado.
     */
    @Transactional(readOnly = true)
    public ConfiguracionResponse obtener() {
        return configuracionRepository.findById(ConfiguracionGlobal.FILA_UNICA)
                .map(c -> ConfiguracionResponse.de(
                        c, matchingConfig.getUmbralMinimo(), DIAS_RETENCION_POR_DEFECTO))
                .orElseGet(() -> ConfiguracionResponse.porDefecto(
                        matchingConfig.getUmbralMinimo(), DIAS_RETENCION_POR_DEFECTO));
    }

    /**
     * Guarda. La primera vez inserta la fila; a partir de ahi la actualiza
     * —{@code save} sobre una entidad con id ya asignado y version es un
     * UPDATE—, que es lo que hace que la fila siga siendo unica.
     */
    @Transactional
    public ConfiguracionResponse guardar(ConfiguracionRequest request) {
        validar(request);

        var config = configuracionRepository.findById(ConfiguracionGlobal.FILA_UNICA)
                .orElseGet(ConfiguracionGlobal::new);

        config.setNombreOficial(vacioComoNulo(request.nombreOficial()));
        config.setNit(vacioComoNulo(request.nit()));
        config.setRegistroEducativo(vacioComoNulo(request.registroEducativo()));
        config.setSedePrincipal(vacioComoNulo(request.sedePrincipal()));
        config.setTelefonoContacto(vacioComoNulo(request.telefonoContacto()));
        config.setWhatsappSoporte(vacioComoNulo(request.whatsappSoporte()));
        config.setEmailContacto(vacioComoNulo(request.emailContacto()));
        config.setEmailSoporte(vacioComoNulo(request.emailSoporte()));
        config.setSitioWeb(vacioComoNulo(request.sitioWeb()));
        config.setLinkedinUrl(vacioComoNulo(request.linkedinUrl()));
        config.setInstagramUrl(vacioComoNulo(request.instagramUrl()));

        config.setCohorteActiva(vacioComoNulo(request.cohorteActiva()));
        config.setUmbralMatchMinimo(request.umbralMatchMinimo());
        // Un valor desconocido se guarda como apagado: repartir participantes
        // segun una regla que nadie escribio es peor que no repartir.
        String regla = request.reglaAsignacion();
        config.setReglaAsignacion("ROTATIVO".equalsIgnoreCase(regla == null ? "" : regla.trim())
                ? "ROTATIVO" : "NINGUNA");
        config.setDiasRetencionPapelera(request.diasRetencionPapelera());

        config.tocar();
        configuracionRepository.save(config);

        return ConfiguracionResponse.de(
                config, matchingConfig.getUmbralMinimo(), DIAS_RETENCION_POR_DEFECTO);
    }

    /**
     * Puntaje minimo para que un par llegue a ser match.
     *
     * <p>Lo pregunta {@code MatchingService} en cada corrida. Antes el motor
     * leia siempre {@code matching-config.yml} mientras la pantalla ofrecia
     * editar el numero y arrancaba en 70: quien lo subia a 80 seguia recibiendo
     * los matches del 55, sin nada que le indicara que su cambio no habia
     * llegado a ninguna parte.
     */
    @Transactional(readOnly = true)
    public int umbralDeMatch() {
        // `map` sobre un getter que devuelve null da un Optional vacio, asi que
        // esto cubre igual los dos casos: no hay fila, o hay fila y la columna
        // esta a null porque nadie fijo el umbral.
        return configuracionRepository.findById(ConfiguracionGlobal.FILA_UNICA)
                .map(ConfiguracionGlobal::getUmbralMatchMinimo)
                .orElseGet(matchingConfig::getUmbralMinimo);
    }

    /** Dias que una ficha aguanta en la papelera antes de que la purga la borre. */
    @Transactional(readOnly = true)
    public int diasRetencionPapelera() {
        return configuracionRepository.findById(ConfiguracionGlobal.FILA_UNICA)
                .map(ConfiguracionGlobal::getDiasRetencionPapelera)
                .orElse(DIAS_RETENCION_POR_DEFECTO);
    }

    /**
     * Todos los motivos de rechazo de una vez: devolver el primero y callar el
     * resto obliga a guardar, corregir y volver a guardar tantas veces como
     * errores haya.
     */
    private void validar(ConfiguracionRequest request) {
        var motivos = new ArrayList<String>();

        Integer umbral = request.umbralMatchMinimo();
        if (umbral != null && (umbral < 0 || umbral > 100)) {
            motivos.add("El umbral de match debe estar entre 0 y 100; llego: " + umbral + ".");
        }

        Integer dias = request.diasRetencionPapelera();
        if (dias != null && (dias < 1 || dias > 365)) {
            motivos.add("Los dias de retencion deben estar entre 1 y 365; llego: " + dias + ".");
        }

        agregarSiEsLargo(motivos, "nombre oficial", request.nombreOficial());
        agregarSiEsLargo(motivos, "NIT", request.nit());
        agregarSiEsLargo(motivos, "registro educativo", request.registroEducativo());
        agregarSiEsLargo(motivos, "sede principal", request.sedePrincipal());
        agregarSiEsLargo(motivos, "telefono de contacto", request.telefonoContacto());
        agregarSiEsLargo(motivos, "WhatsApp de soporte", request.whatsappSoporte());
        agregarSiEsLargo(motivos, "correo institucional", request.emailContacto());
        agregarSiEsLargo(motivos, "correo de empleabilidad", request.emailSoporte());
        agregarSiEsLargo(motivos, "sitio web", request.sitioWeb());
        agregarSiEsLargo(motivos, "LinkedIn", request.linkedinUrl());
        agregarSiEsLargo(motivos, "Instagram", request.instagramUrl());
        agregarSiEsLargo(motivos, "cohorte activa", request.cohorteActiva());

        if (!motivos.isEmpty()) {
            throw new BusinessException(String.join(" ", motivos));
        }
    }

    private static void agregarSiEsLargo(List<String> motivos, String campo, String valor) {
        if (valor != null && valor.trim().length() > MAX_TEXTO) {
            motivos.add("El campo '" + campo + "' no puede pasar de " + MAX_TEXTO + " caracteres.");
        }
    }

    /**
     * Una cadena vacia y un null significan lo mismo —"no hay valor"— y guardar
     * las dos formas obliga a comprobarlas por separado en todas partes.
     */
    private static String vacioComoNulo(String valor) {
        if (valor == null) return null;
        String limpio = valor.trim();
        return limpio.isEmpty() ? null : limpio;
    }
}
