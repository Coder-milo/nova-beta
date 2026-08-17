package com.novacrm.estudiante;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.configuracion.ConfiguracionResponse;
import com.novacrm.configuracion.ConfiguracionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * El reparto automático de participantes.
 *
 * <p>Lo que fija esta prueba no es que funcione, es que **no se dispare sola**.
 * Una regla de reparto que no coincide con cómo trabaja el equipo se desactiva
 * la primera semana, y hasta entonces asigna mal; por eso viene apagada y por
 * eso nunca pisa una asignación hecha a mano.
 */
class AsignacionAutomaticaTest {

    private UsuarioRepository usuarios;
    private EstudianteRepository estudiantes;
    private ConfiguracionService configuracion;
    private AsignacionAutomatica asignacion;

    private Usuario ana;
    private Usuario beto;

    @BeforeEach
    void preparar() {
        usuarios = mock(UsuarioRepository.class);
        estudiantes = mock(EstudianteRepository.class);
        configuracion = mock(ConfiguracionService.class);
        asignacion = new AsignacionAutomatica(usuarios, estudiantes, configuracion);

        ana = cuenta("ana@cac.test", Rol.COORDINADOR, true);
        beto = cuenta("beto@cac.test", Rol.COORDINADOR, true);
        when(usuarios.findAll()).thenReturn(List.of(ana, beto));
        conRegla("ROTATIVO");
    }

    private static Usuario cuenta(String email, Rol rol, boolean activo) {
        var u = new Usuario();
        ponerId(u, UUID.randomUUID());
        u.setEmail(email);
        u.setNombre(email);
        u.setActivo(activo);
        u.setRoles(new java.util.HashSet<>(java.util.Set.of(rol)));
        return u;
    }

    private static void ponerId(Object o, UUID id) {
        try {
            Class<?> c = o.getClass();
            Field f = null;
            while (c != null && f == null) {
                try { f = c.getDeclaredField("id"); }
                catch (NoSuchFieldException ex) { c = c.getSuperclass(); }
            }
            f.setAccessible(true);
            f.set(o, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private void conRegla(String regla) {
        var resp = mock(ConfiguracionResponse.class);
        when(resp.reglaAsignacion()).thenReturn(regla);
        when(configuracion.obtener()).thenReturn(resp);
    }

    private void carga(Usuario u, long cuantos) {
        when(estudiantes.countByResponsableIdAndActivoTrue(u.getId())).thenReturn(cuantos);
    }

    @Test
    @DisplayName("apagada no asigna nada")
    void apagadaNoHaceNada() {
        conRegla("NINGUNA");
        var e = new Estudiante();

        asignacion.asignarSiCorresponde(e);

        assertThat(e.getResponsable())
                .as("viene apagada a propósito: encenderla obliga a que alguien lo decida")
                .isNull();
    }

    @Test
    @DisplayName("una regla que no reconocemos se trata como apagada, no como «elige una»")
    void loDesconocidoNoReparte() {
        conRegla("POR_SIGNO_ZODIACAL");
        var e = new Estudiante();

        asignacion.asignarSiCorresponde(e);

        assertThat(e.getResponsable()).isNull();
    }

    @Test
    @DisplayName("asigna a quien menos casos lleva")
    void alDeMenosCarga() {
        carga(ana, 12);
        carga(beto, 3);
        var e = new Estudiante();

        asignacion.asignarSiCorresponde(e);

        assertThat(e.getResponsable()).isEqualTo(beto);
    }

    @Test
    @DisplayName("no pisa a un responsable puesto a mano")
    void loManualGana() {
        carga(ana, 0);
        carga(beto, 99);
        var e = new Estudiante();
        e.setResponsable(beto);

        asignacion.asignarSiCorresponde(e);

        assertThat(e.getResponsable())
                .as("si alguien lo asignó a mano, sabía algo que la regla no sabe")
                .isEqualTo(beto);
    }

    @Test
    @DisplayName("solo reparte entre el equipo: ni estudiantes ni empresas")
    void soloElEquipoLlevaCasos() {
        var alumno = cuenta("alumno@cac.test", Rol.ESTUDIANTE, true);
        var empresa = cuenta("empresa@cac.test", Rol.EMPRESA, true);
        when(usuarios.findAll()).thenReturn(List.of(alumno, empresa));
        var e = new Estudiante();

        asignacion.asignarSiCorresponde(e);

        assertThat(e.getResponsable())
                .as("sin nadie del equipo se queda sin asignar, que es un estado normal")
                .isNull();
    }

    @Test
    @DisplayName("una cuenta desactivada no recibe casos nuevos")
    void laCuentaApagadaNoRecibe() {
        var deBaja = cuenta("sebaja@cac.test", Rol.COORDINADOR, false);
        when(usuarios.findAll()).thenReturn(List.of(deBaja, ana));
        carga(ana, 40);
        carga(deBaja, 0);
        var e = new Estudiante();

        asignacion.asignarSiCorresponde(e);

        assertThat(e.getResponsable())
                .as("la de menos carga es la de baja, y precisamente por eso")
                .isEqualTo(ana);
    }

    @Test
    @DisplayName("a igualdad de carga el desempate es estable")
    void elEmpateNoEsAlAzar() {
        carga(ana, 5);
        carga(beto, 5);

        var primera = new Estudiante();
        var segunda = new Estudiante();
        asignacion.asignarSiCorresponde(primera);
        asignacion.asignarSiCorresponde(segunda);

        // Con desempate al azar, dos altas seguidas irían a personas distintas
        // y el reparto dejaría de poder explicarse.
        assertThat(primera.getResponsable()).isEqualTo(segunda.getResponsable());
        assertThat(primera.getResponsable()).isEqualTo(ana);
    }

    @Test
    @DisplayName("si algo revienta, el alta sigue adelante sin responsable")
    void nuncaTumbaUnAlta() {
        when(configuracion.obtener()).thenThrow(new IllegalStateException("base caída"));
        var e = new Estudiante();

        asignacion.asignarSiCorresponde(e);

        // Que falle el reparto no puede tirar un alta ni una importación de
        // trescientas filas. Sin responsable es un estado normal.
        assertThat(e.getResponsable()).isNull();
    }
}
