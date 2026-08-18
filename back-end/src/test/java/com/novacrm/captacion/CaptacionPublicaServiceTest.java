package com.novacrm.captacion;

import com.novacrm.auditoria.AuditoriaService;
import com.novacrm.exception.BusinessException;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * El formulario público de captación.
 *
 * <p>Es la única escritura que puede hacer cualquiera sin identificarse, así que
 * lo que fijan estas pruebas es sobre todo lo que <strong>no</strong> pasa: que
 * no se enlaza con ninguna empresa del CRM, que no nace publicada y que no se
 * puede llenar la cola a base de reenviar.
 */
class CaptacionPublicaServiceTest {

    private VacanteRepository vacantes;
    private AuditoriaService auditoria;
    private CaptacionPublicaService servicio;

    @BeforeEach
    void preparar() {
        vacantes = mock(VacanteRepository.class);
        auditoria = mock(AuditoriaService.class);
        servicio = new CaptacionPublicaService(vacantes, auditoria);
        when(vacantes.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacantes.save(any(Vacante.class))).thenAnswer(inv -> {
            Vacante v = inv.getArgument(0);
            ponerId(v, UUID.randomUUID());
            return v;
        });
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

    private static SolicitudPublicaDeVacante solicitud() {
        return new SolicitudPublicaDeVacante(
                "Tecnoglass", "Ana Perez", "ana@tecnoglass.test", "3001234567",
                "Auxiliar de produccion", "Turnos rotativos en planta.",
                "Bachiller", "Barranquilla", "Presencial", "Termino fijo",
                "$1.800.000", null);
    }

    private Vacante loGuardado() {
        var captor = ArgumentCaptor.forClass(Vacante.class);
        verify(vacantes).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("entra sin revisar y sin fecha de publicacion")
    void naceEnRevision() {
        servicio.recibir(solicitud());

        var v = loGuardado();
        assertThat(v.isRevisada())
                .as("lo escribe un desconocido: no se ve hasta que una persona lo lee")
                .isFalse();
        assertThat(v.getFechaPublicacion())
                .as("no esta publicada, asi que no tiene fecha de publicacion")
                .isNull();
        assertThat(v.isBorrador())
                .as("un borrador no lo ve ni la cola de revision, y esto si tiene que verse")
                .isFalse();
        assertThat(v.estadoDePublicacion()).isEqualTo("EN_REVISION");
    }

    @Test
    @DisplayName("nunca enlaza con una empresa del CRM")
    void noSeEnlazaConNingunaEmpresa() {
        servicio.recibir(solicitud());

        var v = loGuardado();
        // Buscar la empresa por nombre —que es lo que hace el alta interna—
        // dejaria que un desconocido publique como una empresa real y que esa
        // empresa lo viera entre sus vacantes del portal.
        assertThat(v.getEmpresa()).isNull();
        assertThat(v.getEmpresaDeclarada()).isEqualTo("Tecnoglass");
    }

    @Test
    @DisplayName("no lee ninguna URL: no hay campo de enlace")
    void nadaDeUrls() {
        servicio.recibir(solicitud());

        var v = loGuardado();
        // El alta interna completa datos leyendo el enlace. Sin autenticar eso
        // convierte al servidor en un cliente HTTP a las ordenes de cualquiera.
        assertThat(v.getUrlOrigen()).isNull();
        assertThat(v.getUrlAplicar()).isNull();
    }

    @Test
    @DisplayName("la trampa para robots corta el envio")
    void elCampoTrampaRechaza() {
        var conTrampa = new SolicitudPublicaDeVacante(
                "Spam SA", "Bot", "bot@spam.test", null, "Gane dinero", "Desde casa",
                null, null, null, null, null, "me lo llene solo");

        assertThatThrownBy(() -> servicio.recibir(conTrampa))
                .isInstanceOf(BusinessException.class);
        verify(vacantes, never()).save(any());
    }

    @Test
    @DisplayName("el mismo cargo y la misma empresa no entran dos veces")
    void elReenvioNoDuplica() {
        when(vacantes.findByHashDedup(anyString())).thenReturn(Optional.of(new Vacante()));

        assertThatThrownBy(() -> servicio.recibir(solicitud()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Ya recibimos");
        verify(vacantes, never()).save(any());
    }

    @Test
    @DisplayName("el mismo texto con otra caja da la misma huella")
    void laHuellaIgnoraLaCaja() {
        servicio.recibir(solicitud());
        String primera = loGuardado().getHashDedup();

        reset(vacantes);
        when(vacantes.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacantes.save(any(Vacante.class))).thenAnswer(inv -> {
            Vacante v = inv.getArgument(0);
            ponerId(v, UUID.randomUUID());
            return v;
        });
        var enMayusculas = new SolicitudPublicaDeVacante(
                "  TECNOGLASS  ", "Ana Perez", "ana@tecnoglass.test", null,
                "AUXILIAR DE PRODUCCION", "Otro texto distinto.",
                null, null, null, null, null, null);
        servicio.recibir(enMayusculas);

        assertThat(loGuardado().getHashDedup())
                .as("reenviar lo mismo escrito distinto sigue siendo reenviar lo mismo")
                .isEqualTo(primera);
    }

    @Test
    @DisplayName("los datos de contacto se guardan aparte del anuncio")
    void elContactoNoSeMezclaConElAnuncio() {
        servicio.recibir(solicitud());

        var v = loGuardado();
        assertThat(v.getContactoDeclarado()).isEqualTo("Ana Perez");
        assertThat(v.getEmailDeclarado()).isEqualTo("ana@tecnoglass.test");
        assertThat(v.getTelefonoDeclarado()).isEqualTo("3001234567");
        // Si el correo acabara dentro de la descripcion, viajaria al estudiante
        // con el anuncio. Separado, `toResponse` puede dejarlo solo en gestion.
        assertThat(v.getDescripcion()).doesNotContain("ana@tecnoglass.test");
    }

    @Test
    @DisplayName("lo opcional que llega vacio se guarda nulo, no en blanco")
    void loVacioEsNulo() {
        var minima = new SolicitudPublicaDeVacante(
                "Empresa", "Contacto", "c@empresa.test", "   ",
                "Cargo", "Descripcion", "  ", "", null, null, null, null);

        servicio.recibir(minima);

        var v = loGuardado();
        // Una cadena en blanco se pinta como un dato que esta y no esta: la
        // pantalla no la marca como ausente y la persona que revisa cree leerla.
        assertThat(v.getTelefonoDeclarado()).isNull();
        assertThat(v.getRequisitos()).isNull();
        assertThat(v.getCiudad()).isNull();
    }

    @Test
    @DisplayName("queda en auditoria")
    void dejaRastro() {
        servicio.recibir(solicitud());

        // Sin esto, una tanda de basura no deja de donde vino: la auditoria
        // guarda la IP aunque no haya usuario.
        verify(auditoria).registrar(eq("Vacantes"), eq("Captacion publica"), eq("Vacante"),
                anyString(), contains("Tecnoglass"), isNull(), isNull());
    }
}
