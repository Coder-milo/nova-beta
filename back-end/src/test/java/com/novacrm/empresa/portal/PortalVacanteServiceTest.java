package com.novacrm.empresa.portal;

import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.vacante.MotivoCierre;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Que una empresa no pueda saltarse la moderacion.
 *
 * <p>El caso que da sentido a esta clase es el ultimo: publicar un texto
 * limpio, esperar la aprobacion y cambiarlo despues. Si esa edicion no
 * devolviera la vacante a la cola, toda la moderacion seria decorativa.
 */
class PortalVacanteServiceTest {

    private VacanteRepository vacantes;
    private EmpresaRepository empresas;
    private AccesoDelPortal acceso;
    private PortalVacanteService servicio;

    private final UUID idEmpresa = UUID.randomUUID();

    @BeforeEach
    void preparar() {
        vacantes = mock(VacanteRepository.class);
        empresas = mock(EmpresaRepository.class);
        acceso = mock(AccesoDelPortal.class);
        servicio = new PortalVacanteService(vacantes, empresas, acceso);

        var empresa = new Empresa();
        empresa.setNombre("Solvo");
        ponerId(empresa, idEmpresa);
        when(empresas.findById(idEmpresa)).thenReturn(Optional.of(empresa));
        // `save` devuelve lo que recibe, como hace JPA con una entidad ya nueva.
        when(vacantes.save(any(Vacante.class))).thenAnswer(i -> i.getArgument(0));
        when(vacantes.contarPostulacionesDe(any())).thenReturn(0L);
    }

    private static void ponerId(Object entidad, UUID id) {
        try {
            Class<?> c = entidad.getClass();
            Field campo = null;
            while (c != null && campo == null) {
                try { campo = c.getDeclaredField("id"); }
                catch (NoSuchFieldException e) { c = c.getSuperclass(); }
            }
            campo.setAccessible(true);
            campo.set(entidad, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static PortalVacanteService.DatosDeVacante completa(String titulo) {
        return new PortalVacanteService.DatosDeVacante(
                titulo, "Atencion al cliente bilingue.", "Ingles B2",
                "Barranquilla", "Presencial", "Termino fijo", "Completa",
                "2.000.000", "B2", 1, null);
    }

    private static PortalVacanteService.DatosDeVacante soloTitulo() {
        return new PortalVacanteService.DatosDeVacante(
                "Sin terminar", null, null, null, null, null, null, null, null, null, null);
    }

    // ── Alta ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("lo que publica una empresa nace sin revisar")
    void naceSinRevisar() {
        var creada = servicio.crear(idEmpresa, completa("Asesor bilingue"), false, "rrhh@solvo.test");
        assertThat(creada.estado()).isEqualTo("EN_REVISION");
    }

    @Test
    @DisplayName("un borrador puede estar a medias; enviarlo, no")
    void elBorradorAdmiteHuecos() {
        var borrador = servicio.crear(idEmpresa, soloTitulo(), true, "rrhh@solvo.test");
        assertThat(borrador.estado()).isEqualTo("BORRADOR");

        assertThatThrownBy(() -> servicio.crear(idEmpresa, soloTitulo(), false, "rrhh@solvo.test"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("descripcion");
    }

    @Test
    @DisplayName("sin titulo no se guarda ni como borrador")
    void elTituloEsImprescindible() {
        var sinTitulo = new PortalVacanteService.DatosDeVacante(
                "  ", null, null, null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> servicio.crear(idEmpresa, sinTitulo, true, "rrhh@solvo.test"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("una fecha de cierre ya pasada se rechaza")
    void laFechaPasadaSeRechaza() {
        var d = new PortalVacanteService.DatosDeVacante(
                "Asesor", "Descripcion", null, "Barranquilla", null, null, null, null, null, null,
                LocalDateTime.now().minusDays(1));
        assertThatThrownBy(() -> servicio.crear(idEmpresa, d, false, "rrhh@solvo.test"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("ya paso");
    }

    // ── El caso que importa ─────────────────────────────────────────────────

    @Test
    @DisplayName("editar una vacante ya publicada la devuelve a revision")
    void editarLoPublicadoVuelveARevision() {
        var publicada = new Vacante();
        publicada.setEmpresa(empresas.findById(idEmpresa).orElseThrow());
        publicada.setActivo(true);
        publicada.setRevisada(true);
        publicada.setBorrador(false);
        publicada.setFechaPublicacion(LocalDateTime.now().minusDays(2));
        UUID id = UUID.randomUUID();
        ponerId(publicada, id);
        when(acceso.exigirVacantePropia(id, idEmpresa)).thenReturn(publicada);

        var tras = servicio.editar(id, idEmpresa, completa("Asesor bilingue (editado)"), true);

        // Sin esto, la moderacion no serviria: se aprueba un texto y se publica
        // otro.
        assertThat(tras.estado()).isEqualTo("EN_REVISION");
        assertThat(publicada.getFechaPublicacion()).isNull();
    }

    @Test
    @DisplayName("editar un borrador lo deja en borrador si no se envia")
    void elBorradorSigueSiendoBorrador() {
        var borrador = new Vacante();
        borrador.setEmpresa(empresas.findById(idEmpresa).orElseThrow());
        borrador.setActivo(true);
        borrador.setBorrador(true);
        borrador.setRevisada(false);
        UUID id = UUID.randomUUID();
        ponerId(borrador, id);
        when(acceso.exigirVacantePropia(id, idEmpresa)).thenReturn(borrador);

        var tras = servicio.editar(id, idEmpresa, soloTitulo(), false);
        assertThat(tras.estado()).isEqualTo("BORRADOR");
    }

    @Test
    @DisplayName("una vacante cerrada ya no se edita")
    void loCerradoNoSeEdita() {
        var cerrada = new Vacante();
        cerrada.setEmpresa(empresas.findById(idEmpresa).orElseThrow());
        cerrada.setActivo(false);
        UUID id = UUID.randomUUID();
        ponerId(cerrada, id);
        when(acceso.exigirVacantePropia(id, idEmpresa)).thenReturn(cerrada);

        assertThatThrownBy(() -> servicio.editar(id, idEmpresa, completa("X"), true))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("cerrada");
    }

    // ── Cierre ──────────────────────────────────────────────────────────────

    // ── Rechazo y corrección ────────────────────────────────────────────────

    @Test
    @DisplayName("corregir una vacante rechazada borra el motivo del rechazo")
    void corregirBorraElReproche() {
        var rechazada = new Vacante();
        rechazada.setEmpresa(empresas.findById(idEmpresa).orElseThrow());
        rechazada.setActivo(true);
        rechazada.setBorrador(false);
        rechazada.rechazar("Falta el salario y la descripcion es de otra empresa.",
                "coordinador@local.test", LocalDateTime.now());
        UUID id = UUID.randomUUID();
        ponerId(rechazada, id);
        when(acceso.exigirVacantePropia(id, idEmpresa)).thenReturn(rechazada);

        assertThat(rechazada.estadoDePublicacion()).isEqualTo("RECHAZADA");

        var tras = servicio.editar(id, idEmpresa, completa("Asesor bilingue"), true);

        // Sin esto la empresa reenvía la corrección y sigue viendo el reproche
        // anterior encima de un texto que ya no dice eso.
        assertThat(tras.motivoRechazo()).isNull();
        assertThat(tras.estado()).isEqualTo("EN_REVISION");
    }

    @Test
    @DisplayName("una rechazada no se confunde con una cerrada")
    void rechazadaNoEsCerrada() {
        var v = new Vacante();
        v.setActivo(true);
        v.setBorrador(false);
        v.rechazar("No cumple.", "coordinador@local.test", LocalDateTime.now());

        // Cerrarla obligaría a la empresa a escribirla otra vez desde cero, que
        // es la forma segura de que no la corrija nadie.
        assertThat(v.estadoDePublicacion()).isEqualTo("RECHAZADA");
        assertThat(v.isActivo()).isTrue();
    }

    @Test
    @DisplayName("cerrar sin motivo cuenta como RETIRADA, no como cubierta")
    void cerrarSinMotivoNoInflaLasColocaciones() {
        var vacante = new Vacante();
        vacante.setEmpresa(empresas.findById(idEmpresa).orElseThrow());
        vacante.setActivo(true);
        vacante.setRevisada(true);
        UUID id = UUID.randomUUID();
        ponerId(vacante, id);
        when(acceso.exigirVacantePropia(id, idEmpresa)).thenReturn(vacante);

        var tras = servicio.cerrar(id, idEmpresa, null);

        assertThat(tras.estado()).isEqualTo("CERRADA");
        assertThat(vacante.getMotivoCierre()).isEqualTo(MotivoCierre.RETIRADA);
    }
}
