package com.novacrm.vista;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Alta, listado y borrado de vistas guardadas. */
@Service
public class VistaGuardadaService {

    /** Tope del JSON de filtros. Una vista razonable no llega a 4 KB. */
    private static final int TOPE_FILTROS = 4_000;

    private final VistaGuardadaRepository repositorio;
    private final ObjectMapper json;

    public VistaGuardadaService(VistaGuardadaRepository repositorio, ObjectMapper json) {
        this.repositorio = repositorio;
        this.json = json;
    }

    public record VistaResponse(
            UUID id,
            String nombre,
            String modulo,
            String filtros,
            String propietario,
            boolean compartida,
            /** Si quien pregunta puede editarla o borrarla. */
            boolean mia) {}

    @Transactional(readOnly = true)
    public List<VistaResponse> listar(ModuloDeVista modulo, String correo) {
        return repositorio.visiblesPara(modulo, correo).stream()
                .map(v -> aRespuesta(v, correo))
                .toList();
    }

    @Transactional
    public VistaResponse guardar(ModuloDeVista modulo, String nombre, String filtros,
                                 boolean compartida, String correo) {
        String limpio = nombre == null ? "" : nombre.trim();
        if (limpio.isEmpty()) {
            throw new BusinessException("La vista necesita un nombre");
        }
        validarFiltros(filtros);

        // Guardar con un nombre que ya existe la sobrescribe en vez de fallar.
        // Es lo que se espera: quien vuelve a guardar «Sin colocar» esta
        // corrigiendo la suya, no intentando crear una segunda con el mismo
        // nombre que despues no sabria distinguir.
        var existente = repositorio
                .findByPropietarioIgnoreCaseAndModuloAndNombreIgnoreCase(correo, modulo, limpio)
                .orElseGet(VistaGuardada::new);

        existente.setNombre(limpio);
        existente.setModulo(modulo);
        existente.setFiltros(filtros == null || filtros.isBlank() ? "{}" : filtros);
        existente.setPropietario(correo);
        existente.setCompartida(compartida);

        try {
            return aRespuesta(repositorio.save(existente), correo);
        } catch (DataIntegrityViolationException e) {
            // Dos guardados a la vez con el mismo nombre: el segundo choca con
            // el indice unico. Se traduce al mismo mensaje que el caso normal.
            throw new BusinessException("Ya tienes una vista con ese nombre");
        }
    }

    @Transactional
    public void eliminar(UUID id, String correo) {
        var vista = repositorio.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vista no encontrada"));
        if (!vista.laPuedeEditar(correo)) {
            // Compartir da lectura, no escritura. Quien no la creo no la borra
            // ni aunque la use a diario.
            throw new AccessDeniedException("Esa vista es de otra persona");
        }
        repositorio.delete(vista);
    }

    /**
     * Comprueba que los filtros son JSON y que no son enormes.
     *
     * <p>El contenido no se valida —cada modulo tiene el suyo y el servidor no
     * lo entiende—, pero que sea JSON bien formado si: guardar una cadena rota
     * dejaria una vista que revienta al abrirla, y el error apareceria semanas
     * despues en la pantalla de otra persona.
     */
    private void validarFiltros(String filtros) {
        if (filtros == null || filtros.isBlank()) {
            return;
        }
        if (filtros.length() > TOPE_FILTROS) {
            throw new BusinessException("Los filtros de esa vista son demasiado grandes");
        }
        try {
            var nodo = json.readTree(filtros);
            if (!nodo.isObject()) {
                throw new BusinessException("Los filtros tienen que ser un objeto JSON");
            }
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new BusinessException("Los filtros no son JSON valido");
        }
    }

    private static VistaResponse aRespuesta(VistaGuardada v, String correo) {
        return new VistaResponse(
                v.getId(), v.getNombre(), v.getModulo().name(), v.getFiltros(),
                v.getPropietario(), v.isCompartida(), v.laPuedeEditar(correo));
    }
}
