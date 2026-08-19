package com.novacrm.vacante;

import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Punto unico por el que entra una vacante venida de una fuente automatica.
 *
 * <p>Antes cada conector deduplicaba y guardaba por su cuenta, y cada uno
 * resolvia la empresa a su manera —Remotive directamente tiraba el
 * {@code company_name} que le llegaba, y Elempleo solo enlazaba empresas que ya
 * existieran—. El resultado era que practicamente ninguna vacante automatica
 * tenia empresa, y sin empresa no hay sector, asi que el matching perdia ese
 * criterio y las postulaciones quedaban registradas como "Sin registrar".
 *
 * <p>Centralizarlo aqui deja un solo sitio donde se decide que es una vacante
 * nueva, de donde sale su empresa y que campos se completan por lectura del
 * anuncio.
 */
@Component
public class RegistroDeVacante {

    private final VacanteRepository vacanteRepository;
    private final EmpresaRepository empresaRepository;
    private final EnriquecedorDeVacante enriquecedor;

    public RegistroDeVacante(VacanteRepository vacanteRepository,
                             EmpresaRepository empresaRepository,
                             EnriquecedorDeVacante enriquecedor) {
        this.vacanteRepository = vacanteRepository;
        this.empresaRepository = empresaRepository;
        this.enriquecedor = enriquecedor;
    }

    /**
     * Guarda la vacante si no estaba ya, completando empresa y campos deducibles.
     *
     * @param nombreEmpresa nombre tal como lo publica el portal; puede ser nulo
     * @return la vacante guardada, o vacio si ya existia o le falta el hash
     */
    public Optional<Vacante> registrarSiEsNueva(Vacante vacante, String nombreEmpresa) {
        if (vacante == null || vacante.getHashDedup() == null) {
            return Optional.empty();
        }
        if (vacanteRepository.findByHashDedup(vacante.getHashDedup()).isPresent()) {
            return Optional.empty();
        }
        // Dedup cruzado: la misma plaza en dos portales no entra dos veces. El
        // par (titulo, empresa) normalizado es la identidad mas alla de la fuente.
        String empresaNom = nombreEmpresa;
        if ((empresaNom == null || empresaNom.isBlank()) && vacante.getEmpresa() != null) {
            empresaNom = vacante.getEmpresa().getNombre();
        }
        if (vacante.getHashContenido() == null) {
            vacante.setHashContenido(hashContenido(vacante.getTitulo(), empresaNom));
        }
        if (vacante.getHashContenido() != null && vacanteRepository.findByHashContenido(vacante.getHashContenido()).isPresent()) {
            return Optional.empty();
        }
        if (vacante.getEmpresa() == null && nombreEmpresa != null && !nombreEmpresa.isBlank()) {
            vacante.setEmpresa(empresaOCrear(nombreEmpresa.trim()));
        }
        enriquecedor.enriquecer(vacante);
        return Optional.of(vacanteRepository.save(vacante));
    }

    /** Titulo + empresa, sin tildes ni mayusculas ni puntuacion; el indice V52 es la ultima palabra. */
    static String hashContenido(String titulo, String nombreEmpresa) {
        return sha256(normalizar(titulo) + "|" + normalizar(nombreEmpresa));
    }

    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return java.text.Normalizer.normalize(texto.toLowerCase(java.util.Locale.ROOT),
                        java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    private static String sha256(String input) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(
                    digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Igual que {@link VacanteService} en el alta manual: solo empresas activas,
     * para que una empresa borrada no resucite por el nombre de un anuncio.
     */
    private Empresa empresaOCrear(String nombre) {
        return empresaRepository.findByNombreIgnoreCaseActiva(nombre).orElseGet(() -> {
            var empresa = new Empresa();
            empresa.setNombre(nombre);
            return empresaRepository.save(empresa);
        });
    }
}
