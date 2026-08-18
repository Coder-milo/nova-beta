package com.novacrm.vista;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Las dos reglas que sostienen las vistas compartidas.
 *
 * <p>Compartir da lectura y no escritura, y volver a guardar con el mismo
 * nombre corrige la propia en vez de crear una segunda. Si cualquiera de las
 * dos falla, la vista que el equipo usa a diario deja de ser un acuerdo: o se
 * la cambia alguien sin avisar, o hay tres con el mismo nombre.
 */
class VistaGuardadaServiceTest {

    private VistaGuardadaRepository repo;
    private VistaGuardadaService servicio;

    private static final String YO = "coordinador@local.test";
    private static final String OTRA = "otra.persona@local.test";

    @BeforeEach
    void preparar() {
        repo = mock(VistaGuardadaRepository.class);
        servicio = new VistaGuardadaService(repo, new ObjectMapper());
        when(repo.save(any(VistaGuardada.class))).thenAnswer(i -> i.getArgument(0));
    }

    private static void ponerId(Object e, UUID id) {
        try {
            Class<?> c = e.getClass();
            Field f = null;
            while (c != null && f == null) {
                try { f = c.getDeclaredField("id"); }
                catch (NoSuchFieldException ex) { c = c.getSuperclass(); }
            }
            f.setAccessible(true);
            f.set(e, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static VistaGuardada vistaDe(String duenio, boolean compartida) {
        var v = new VistaGuardada();
        v.setNombre("Sin colocar");
        v.setModulo(ModuloDeVista.ESTUDIANTES);
        v.setPropietario(duenio);
        v.setCompartida(compartida);
        ponerId(v, UUID.randomUUID());
        return v;
    }

    // ── Permisos ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("compartir da lectura, no escritura: otra persona no la borra")
    void compartirNoDaBorrado() {
        var ajena = vistaDe(OTRA, true);
        when(repo.findById(ajena.getId())).thenReturn(Optional.of(ajena));

        assertThatThrownBy(() -> servicio.eliminar(ajena.getId(), YO))
                .isInstanceOf(AccessDeniedException.class);
        verify(repo, never()).delete(any());
    }

    @Test
    @DisplayName("la propia si se borra")
    void laPropiaSeBorra() {
        var mia = vistaDe(YO, true);
        when(repo.findById(mia.getId())).thenReturn(Optional.of(mia));

        servicio.eliminar(mia.getId(), YO);
        verify(repo).delete(mia);
    }

    @Test
    @DisplayName("el dueño se reconoce sin importar mayusculas del correo")
    void elCorreoNoDistingueMayusculas() {
        var mia = vistaDe("Coordinador@Local.Test", false);
        assertThat(mia.laPuedeEditar(YO)).isTrue();
    }

    // ── Sobrescribir ────────────────────────────────────────────────────────

    @Test
    @DisplayName("guardar con un nombre que ya tengo corrige la mia, no crea otra")
    void repetirNombreSobrescribe() {
        var existente = vistaDe(YO, false);
        when(repo.findByPropietarioIgnoreCaseAndModuloAndNombreIgnoreCase(
                YO, ModuloDeVista.ESTUDIANTES, "Sin colocar")).thenReturn(Optional.of(existente));

        var guardada = servicio.guardar(ModuloDeVista.ESTUDIANTES, "Sin colocar",
                "{\"estadoEmpleabilidad\":\"SIN_COLOCAR\"}", true, YO);

        // Es la misma fila, con los filtros nuevos.
        assertThat(guardada.id()).isEqualTo(existente.getId());
        assertThat(guardada.compartida()).isTrue();
        assertThat(existente.getFiltros()).contains("SIN_COLOCAR");
    }

    // ── Validacion de los filtros ───────────────────────────────────────────

    @Test
    @DisplayName("un JSON roto se rechaza al guardar, no al abrirlo semanas despues")
    void elJsonRotoSeRechazaAlGuardar() {
        assertThatThrownBy(() -> servicio.guardar(
                ModuloDeVista.ESTUDIANTES, "Rota", "{esto no es json", false, YO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("JSON");
    }

    @Test
    @DisplayName("los filtros tienen que ser un objeto, no una lista ni un numero")
    void losFiltrosSonUnObjeto() {
        assertThatThrownBy(() -> servicio.guardar(
                ModuloDeVista.ESTUDIANTES, "Lista", "[1,2,3]", false, YO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("objeto");
    }

    @Test
    @DisplayName("sin nombre no se guarda")
    void elNombreEsObligatorio() {
        assertThatThrownBy(() -> servicio.guardar(
                ModuloDeVista.ESTUDIANTES, "   ", "{}", false, YO))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("sin filtros se guarda un objeto vacio, no null")
    void sinFiltrosQuedaObjetoVacio() {
        when(repo.findByPropietarioIgnoreCaseAndModuloAndNombreIgnoreCase(any(), any(), any()))
                .thenReturn(Optional.empty());

        var guardada = servicio.guardar(ModuloDeVista.VACANTES, "Todas", null, false, YO);
        assertThat(guardada.filtros()).isEqualTo("{}");
    }
}
