package com.novacrm.empresa.portal;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.empresa.Empresa;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Lo que una empresa NO puede ver.
 *
 * <p>Es la clase de prueba que importa de este modulo. Comprobar que una
 * empresa ve su propia vacante es util pero no es donde esta el riesgo: el
 * riesgo es que vea la de otra, o que una cuenta mal dada de alta acabe viendo
 * el censo entero. Por eso casi todos los casos de aqui son negativos.
 */
class AccesoDelPortalTest {

    private UsuarioRepository usuarios;
    private VacanteRepository vacantes;
    private PostulacionRepository postulaciones;
    private AccesoDelPortal acceso;

    private final UUID idEmpresaA = UUID.randomUUID();
    private final UUID idEmpresaB = UUID.randomUUID();

    @BeforeEach
    void preparar() {
        usuarios = mock(UsuarioRepository.class);
        vacantes = mock(VacanteRepository.class);
        postulaciones = mock(PostulacionRepository.class);
        acceso = new AccesoDelPortal(usuarios, vacantes, postulaciones);
    }

    /** `BaseEntity.id` lo asigna JPA; en una prueba unitaria hay que ponerlo. */
    private static void ponerId(Object entidad, UUID id) {
        try {
            Class<?> c = entidad.getClass();
            Field campo = null;
            while (c != null && campo == null) {
                try {
                    campo = c.getDeclaredField("id");
                } catch (NoSuchFieldException e) {
                    c = c.getSuperclass();
                }
            }
            if (campo == null) throw new IllegalStateException("sin campo id");
            campo.setAccessible(true);
            campo.set(entidad, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Empresa empresa(UUID id, String nombre) {
        var e = new Empresa();
        e.setNombre(nombre);
        ponerId(e, id);
        return e;
    }

    private Authentication comoUsuario(Usuario u) {
        when(usuarios.findByEmailIgnoreCase(any())).thenReturn(Optional.of(u));
        return new UsernamePasswordAuthenticationToken(u.getEmail(), "x");
    }

    private static Usuario cuenta(Set<Rol> roles, Empresa empresa) {
        var u = new Usuario();
        u.setEmail("contacto@empresa.test");
        u.setRoles(roles);
        u.setEmpresa(empresa);
        return u;
    }

    // ── Quien es quien ──────────────────────────────────────────────────────

    @Test
    @DisplayName("una cuenta de empresa con empresa asignada resuelve su empresa")
    void resuelveLaEmpresa() {
        var auth = comoUsuario(cuenta(Set.of(Rol.EMPRESA), empresa(idEmpresaA, "Solvo")));
        assertThat(acceso.empresaDe(auth)).isEqualTo(idEmpresaA);
    }

    @Test
    @DisplayName("una cuenta con rol EMPRESA pero sin empresa asignada no ve nada")
    void sinEmpresaAsignadaSeNiega() {
        var auth = comoUsuario(cuenta(Set.of(Rol.EMPRESA), null));
        assertThatThrownBy(() -> acceso.empresaDe(auth))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("no tiene empresa asignada");
    }

    @Test
    @DisplayName("un coordinador no entra por la puerta del portal")
    void elPersonalDelProgramaNoEsCuentaDePortal() {
        var auth = comoUsuario(cuenta(Set.of(Rol.COORDINADOR), null));
        assertThatThrownBy(() -> acceso.empresaDe(auth))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── Vacantes ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("la vacante de otra empresa responde 'no encontrada', no 'prohibida'")
    void laVacanteAjenaSeOcultaComoInexistente() {
        var vacante = new Vacante();
        vacante.setEmpresa(empresa(idEmpresaB, "Otra"));
        UUID idVacante = UUID.randomUUID();
        when(vacantes.findById(idVacante)).thenReturn(Optional.of(vacante));

        // 404 y no 403: un 403 confirmaria que la vacante existe, y con eso una
        // empresa puede sondear identificadores y deducir cuantas gestiona el
        // programa.
        assertThatThrownBy(() -> acceso.exigirVacantePropia(idVacante, idEmpresaA))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("una vacante sin empresa no pertenece a nadie")
    void laVacanteHuerfanaNoEsDeNadie() {
        var vacante = new Vacante();
        UUID idVacante = UUID.randomUUID();
        when(vacantes.findById(idVacante)).thenReturn(Optional.of(vacante));

        assertThatThrownBy(() -> acceso.exigirVacantePropia(idVacante, idEmpresaA))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("la vacante propia se devuelve")
    void laVacantePropiaPasa() {
        var vacante = new Vacante();
        vacante.setEmpresa(empresa(idEmpresaA, "Solvo"));
        UUID idVacante = UUID.randomUUID();
        when(vacantes.findById(idVacante)).thenReturn(Optional.of(vacante));

        assertThat(acceso.exigirVacantePropia(idVacante, idEmpresaA)).isSameAs(vacante);
    }

    // ── Postulaciones, que es por donde se llega a un estudiante ────────────

    @Test
    @DisplayName("no se alcanza la postulacion a la vacante de otra empresa")
    void laPostulacionAjenaSeOculta() {
        var vacante = new Vacante();
        vacante.setEmpresa(empresa(idEmpresaB, "Otra"));
        var postulacion = new Postulacion();
        postulacion.setVacante(vacante);
        UUID id = UUID.randomUUID();
        when(postulaciones.findById(id)).thenReturn(Optional.of(postulacion));

        assertThatThrownBy(() -> acceso.exigirPostulacionPropia(id, idEmpresaA))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("el nombre de empresa en texto libre no concede acceso")
    void elTextoLibreNoEsPermiso() {
        // Lo escribe cualquiera al registrar la postulacion a mano; si valiera
        // como permiso, bastaria teclear el nombre de otra empresa.
        var postulacion = new Postulacion();
        postulacion.setEmpresaNombre("Solvo S.A.S.");
        UUID id = UUID.randomUUID();
        when(postulaciones.findById(id)).thenReturn(Optional.of(postulacion));

        assertThatThrownBy(() -> acceso.exigirPostulacionPropia(id, idEmpresaA))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("la postulacion a una vacante propia pasa")
    void laPostulacionPropiaPasa() {
        var vacante = new Vacante();
        vacante.setEmpresa(empresa(idEmpresaA, "Solvo"));
        var postulacion = new Postulacion();
        postulacion.setVacante(vacante);
        UUID id = UUID.randomUUID();
        when(postulaciones.findById(id)).thenReturn(Optional.of(postulacion));

        assertThat(acceso.exigirPostulacionPropia(id, idEmpresaA)).isSameAs(postulacion);
    }

    @Test
    @DisplayName("la postulacion registrada a mano contra la ficha de la empresa propia pasa")
    void laPostulacionSinVacantePeroConEmpresaPropiaPasa() {
        var postulacion = new Postulacion();
        postulacion.setEmpresa(empresa(idEmpresaA, "Solvo"));
        UUID id = UUID.randomUUID();
        when(postulaciones.findById(id)).thenReturn(Optional.of(postulacion));

        assertThat(acceso.exigirPostulacionPropia(id, idEmpresaA)).isSameAs(postulacion);
    }
}
