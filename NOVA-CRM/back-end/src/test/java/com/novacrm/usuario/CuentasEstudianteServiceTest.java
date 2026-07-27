package com.novacrm.usuario;

import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.config.EmailService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Alta de cuentas de estudiante.
 *
 * <p>Lo que mas importa aqui es que el recuento diga la verdad: quien lanza
 * esto para 107 personas decide por lo que ve en pantalla si tiene que volver
 * a lanzarlo.
 */
class CuentasEstudianteServiceTest {

    private static final UUID ID = UUID.fromString("3726e888-36d3-4697-9394-5748feec7000");

    private EstudianteRepository estudianteRepository;
    private UsuarioRepository usuarioRepository;
    private EmailService emailService;
    private com.novacrm.branding.BrandingService brandingService;
    private CuentasEstudianteService servicio;

    @BeforeEach
    void configurar() {
        estudianteRepository = mock(EstudianteRepository.class);
        usuarioRepository = mock(UsuarioRepository.class);
        emailService = mock(EmailService.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);

        when(encoder.encode(anyString())).thenReturn("$2a$10$hash");
        when(emailService.canalActivo()).thenReturn("SMTP");
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        brandingService = mock(com.novacrm.branding.BrandingService.class);
        when(brandingService.paraCorreo(any())).thenReturn(Optional.empty());

        servicio = new CuentasEstudianteService(
                estudianteRepository, usuarioRepository, encoder, emailService, brandingService);

        ReflectionTestUtils.setField(servicio, "frontendUrl", "http://localhost:3000");
        ReflectionTestUtils.setField(servicio, "logoUrl", "");
        ReflectionTestUtils.setField(servicio, "bannerPieUrl", "");
        ReflectionTestUtils.setField(servicio, "destinatariosPermitidos", "");
    }

    private Estudiante estudiante(String email) {
        var e = new Estudiante();
        e.setId(ID);
        e.setNombre("Hector");
        e.setApellido("Suarez");
        e.setEmail(email);
        when(estudianteRepository.findAllById(List.of(ID))).thenReturn(List.of(e));
        return e;
    }

    /** Tres estudiantes: uno con cuenta, uno sin cuenta y uno sin correo. */
    private void tresEstudiantes() {
        var conCuenta = new Estudiante();
        conCuenta.setId(UUID.randomUUID());
        conCuenta.setNombre("Ana");
        conCuenta.setApellido("Perez");
        conCuenta.setEmail("ana@ejemplo.com");

        var sinCuenta = new Estudiante();
        sinCuenta.setId(UUID.randomUUID());
        sinCuenta.setNombre("Luis");
        sinCuenta.setApellido("Gomez");
        sinCuenta.setEmail("luis@ejemplo.com");

        var sinCorreo = new Estudiante();
        sinCorreo.setId(UUID.randomUUID());
        sinCorreo.setNombre("Marta");
        sinCorreo.setApellido("Diaz");
        sinCorreo.setEmail("  ");

        when(estudianteRepository.findAllByActivoTrue())
                .thenReturn(List.of(conCuenta, sinCuenta, sinCorreo));
        when(usuarioRepository.findByEmail("ana@ejemplo.com"))
                .thenReturn(Optional.of(new Usuario()));
        when(usuarioRepository.findByEmail("luis@ejemplo.com")).thenReturn(Optional.empty());
    }

    @Test
    void elPadronDistingueQuienYaTieneCuentaYQuienNoTieneCorreo() {
        tresEstudiantes();

        var padron = servicio.padron();

        assertEquals(3, padron.total());
        assertEquals(1, padron.conCuenta());
        assertEquals(1, padron.sinCuenta());
        assertEquals(1, padron.sinCorreo());

        var marta = padron.estudiantes().stream()
                .filter(f -> f.nombre().startsWith("Marta")).findFirst().orElseThrow();
        assertNull(marta.email(), "un correo en blanco no es un correo");
        assertFalse(marta.sePuedeEscribir());
    }

    @Test
    void elPadronNoEscribeNada() {
        tresEstudiantes();

        servicio.padron();

        // Es una consulta: si esto cambia, abrir la pantalla daria de alta gente.
        verify(usuarioRepository, never()).save(any(Usuario.class));
        verify(emailService, never()).enviar(anyString(), anyString(), anyString());
    }

    @Test
    void elPadronMarcaAQuienBloquearaLaListaDePruebas() {
        ReflectionTestUtils.setField(servicio, "destinatariosPermitidos", "luis@ejemplo.com");
        tresEstudiantes();

        var padron = servicio.padron();

        assertEquals(List.of("luis@ejemplo.com"), padron.destinatariosPermitidos(),
                "la pantalla tiene que poder avisar de que hay lista de pruebas");
        var porNombre = padron.estudiantes().stream()
                .collect(java.util.stream.Collectors.toMap(
                        f -> f.nombre().split(" ")[0],
                        CuentasEstudianteService.FilaPadron::sePuedeEscribir));
        assertTrue(porNombre.get("Luis"));
        assertFalse(porNombre.get("Ana"), "esta fuera de la lista, no recibiria nada");
    }

    @Test
    void laCuentaSigueContandoComoCreadaAunqueElCorreoFalle() {
        estudiante("hector@ejemplo.com");
        when(usuarioRepository.findByEmail("hector@ejemplo.com")).thenReturn(Optional.empty());
        when(emailService.enviar(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.fallo("Authentication failed"));

        var resumen = servicio.crearCuentas(List.of(ID), true, false);

        // Lo que se rompia: el estado pasaba a CORREO_FALLIDO, el recuento de
        // creadas caia a cero y la pantalla negaba un alta que si habia ocurrido.
        assertEquals(1, resumen.creadas(), "la cuenta se guardo, tiene que contarse");
        assertEquals(1, resumen.correosFallidos());
        assertEquals(0, resumen.correosEnviados());

        var fila = resumen.detalle().get(0);
        assertEquals(CuentasEstudianteService.Estado.CREADA, fila.estado());
        assertEquals(CuentasEstudianteService.EnvioCorreo.FALLIDO, fila.envio());
        assertTrue(fila.detalle().contains("Authentication failed"),
                "el motivo del proveedor es lo unico que explica el fallo");

        verify(usuarioRepository).save(any(Usuario.class));
    }

    @Test
    void unEnvioCorrectoCuentaComoCreadaYComoEnviado() {
        estudiante("hector@ejemplo.com");
        when(usuarioRepository.findByEmail("hector@ejemplo.com")).thenReturn(Optional.empty());
        when(emailService.enviar(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.ok());

        var resumen = servicio.crearCuentas(List.of(ID), true, false);

        assertEquals(1, resumen.creadas());
        assertEquals(1, resumen.correosEnviados());
        assertEquals(0, resumen.correosFallidos());
        assertTrue(resumen.detalle().get(0).correoEnviado());
    }

    @Test
    void unaDireccionFueraDeLaListaDePruebasNoRecibeCorreoPeroSiCuenta() {
        ReflectionTestUtils.setField(servicio, "destinatariosPermitidos",
                "hectorluissuarezarroyo@gmail.com");
        estudiante("otra.persona@ejemplo.com");
        when(usuarioRepository.findByEmail("otra.persona@ejemplo.com")).thenReturn(Optional.empty());

        var resumen = servicio.crearCuentas(List.of(ID), true, false);

        assertEquals(1, resumen.creadas());
        assertEquals(0, resumen.correosEnviados());
        assertEquals(0, resumen.correosFallidos(), "bloquear no es fallar");
        assertEquals(CuentasEstudianteService.EnvioCorreo.BLOQUEADO_POR_LISTA,
                resumen.detalle().get(0).envio());

        // Lo importante: no se llego a llamar al proveedor.
        verify(emailService, never()).enviar(anyString(), anyString(), anyString());
    }

    @Test
    void laSimulacionNoGuardaNiEscribe() {
        estudiante("hector@ejemplo.com");
        when(usuarioRepository.findByEmail("hector@ejemplo.com")).thenReturn(Optional.empty());

        var resumen = servicio.crearCuentas(List.of(ID), true, true);

        assertTrue(resumen.simulacion());
        assertEquals(1, resumen.creadas(), "informa lo que haria");
        verify(usuarioRepository, never()).save(any(Usuario.class));
        verify(emailService, never()).enviar(anyString(), anyString(), anyString());
    }

    @Test
    void unaFichaSinCorreoNoBloqueaAlResto() {
        estudiante(null);

        var resumen = servicio.crearCuentas(List.of(ID), true, false);

        assertEquals(1, resumen.sinCorreo());
        assertEquals(0, resumen.creadas());
        assertEquals(CuentasEstudianteService.EnvioCorreo.SIN_DIRECCION,
                resumen.detalle().get(0).envio());
        verify(usuarioRepository, never()).save(any(Usuario.class));
    }

    @Test
    void elTokenDeActivacionSoloSeEmiteSiDeVerdadSeVaAEnviar() {
        ReflectionTestUtils.setField(servicio, "destinatariosPermitidos",
                "hectorluissuarezarroyo@gmail.com");
        estudiante("otra.persona@ejemplo.com");
        when(usuarioRepository.findByEmail("otra.persona@ejemplo.com")).thenReturn(Optional.empty());

        servicio.crearCuentas(List.of(ID), true, false);

        // Un token emitido y no comunicado es una credencial viva que nadie usa.
        var guardado = org.mockito.ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(guardado.capture());
        assertNull(guardado.getValue().getResetToken());
    }
}
