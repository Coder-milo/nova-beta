package com.novacrm.empresa.portal;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.config.EmailService;
import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Invitar a una empresa al portal.
 *
 * <p>Esta prueba nace de un fallo que estuvo desde el primer día: la invitación
 * decidía si la cuenta era nueva preguntando {@code usuario.getId() == null},
 * pero {@code BaseEntity} pone el identificador al declarar el campo, así que
 * un {@code new Usuario()} ya trae uno. La respuesta era siempre «no es nueva»,
 * no se llegaba a poner el correo, y la petición moría contra el NOT NULL de la
 * columna. Invitar a una empresa <strong>nunca funcionó</strong>, y nadie lo
 * notó porque no había pantalla que lo llamara.
 */
class CuentasEmpresaServiceTest {

    private EmpresaRepository empresas;
    private UsuarioRepository usuarios;
    private EmailService correo;
    private CuentasEmpresaService servicio;
    private Empresa empresa;

    @BeforeEach
    void preparar() {
        empresas = mock(EmpresaRepository.class);
        usuarios = mock(UsuarioRepository.class);
        correo = mock(EmailService.class);
        PasswordEncoder cifrador = mock(PasswordEncoder.class);
        when(cifrador.encode(anyString())).thenReturn("cifrada");
        servicio = new CuentasEmpresaService(empresas, usuarios, cifrador, correo);

        empresa = new Empresa();
        empresa.setNombre("Concentrix");
        empresa.setActivo(true);
        when(empresas.findById(any())).thenReturn(Optional.of(empresa));
        when(usuarios.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(usuarios.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));
        when(correo.enviar(anyString(), anyString(), anyString()))
                .thenReturn(new EmailService.Resultado(true, null));
    }

    private Usuario loGuardado() {
        var captor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarios).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("una cuenta nueva se guarda con su correo")
    void laCuentaNuevaLlevaCorreo() {
        servicio.invitar(empresa.getId(), "rrhh@concentrix.test", "Recursos Humanos");

        var u = loGuardado();
        // Lo que fallaba: el correo llegaba nulo a la base.
        assertThat(u.getEmail()).isEqualTo("rrhh@concentrix.test");
        assertThat(u.getNombre()).isEqualTo("Recursos Humanos");
        assertThat(u.getPassword()).isNotBlank();
        assertThat(u.isActivo()).isTrue();
    }

    @Test
    @DisplayName("queda atada a la empresa y solo con el rol del portal")
    void quedaAtadaALaEmpresa() {
        servicio.invitar(empresa.getId(), "rrhh@concentrix.test", null);

        var u = loGuardado();
        assertThat(u.getEmpresa()).isSameAs(empresa);
        // Solo EMPRESA: una cuenta que además fuera del programa vería el censo
        // completo desde el portal externo.
        assertThat(u.getRoles()).containsExactly(Rol.EMPRESA);
    }

    @Test
    @DisplayName("sin nombre, el saludo usa el correo")
    void sinNombreSeUsaElCorreo() {
        servicio.invitar(empresa.getId(), "rrhh@concentrix.test", "   ");

        assertThat(loGuardado().getNombre()).isEqualTo("rrhh@concentrix.test");
    }

    @Test
    @DisplayName("sale con enlace de un solo uso y con fecha de caducidad")
    void llevaEnlaceConCaducidad() {
        servicio.invitar(empresa.getId(), "rrhh@concentrix.test", null);

        var u = loGuardado();
        // Aquí no se teclea ninguna contraseña: la persona define la suya con
        // este enlace. Una clave que conocen dos personas no identifica a nadie.
        assertThat(u.getResetToken()).isNotBlank();
        assertThat(u.getResetTokenExpira()).isNotNull();
    }

    @Test
    @DisplayName("reinvitar al mismo correo reutiliza la cuenta, no crea otra")
    void reinvitarNoDuplica() {
        var yaEsta = new Usuario();
        yaEsta.setEmail("rrhh@concentrix.test");
        yaEsta.setNombre("Recursos Humanos");
        yaEsta.setEmpresa(empresa);
        yaEsta.setRoles(new java.util.HashSet<>(java.util.Set.of(Rol.EMPRESA)));
        when(usuarios.findByEmailIgnoreCase("rrhh@concentrix.test")).thenReturn(Optional.of(yaEsta));

        var r = servicio.invitar(empresa.getId(), "rrhh@concentrix.test", "Otro nombre");

        assertThat(loGuardado()).isSameAs(yaEsta);
        assertThat(r.detalle()).contains("reenviada");
        // El nombre no se pisa: quien ya entró pudo cambiarlo, y el de la ficha
        // de la empresa no manda sobre el de la cuenta.
        assertThat(yaEsta.getNombre()).isEqualTo("Recursos Humanos");
    }

    @Test
    @DisplayName("un correo del programa no se convierte en cuenta de empresa")
    void noSeMezclanLosMundos() {
        var delEquipo = new Usuario();
        delEquipo.setEmail("coordinador@cac.test");
        delEquipo.setRoles(new java.util.HashSet<>(java.util.Set.of(Rol.COORDINADOR)));
        when(usuarios.findByEmailIgnoreCase("coordinador@cac.test")).thenReturn(Optional.of(delEquipo));

        assertThatThrownBy(() -> servicio.invitar(empresa.getId(), "coordinador@cac.test", null))
                .isInstanceOf(BusinessException.class);
        verify(usuarios, never()).save(any());
    }

    @Test
    @DisplayName("si el correo no sale, la cuenta queda hecha y se dice")
    void elFalloDelCorreoNoDeshaceElAlta() {
        when(correo.enviar(anyString(), anyString(), anyString()))
                .thenReturn(new EmailService.Resultado(false, "SMTP caido"));

        var r = servicio.invitar(empresa.getId(), "rrhh@concentrix.test", null);

        // Deshacerla obligaría a repetir un trabajo que ya está hecho; lo que
        // hay que poder hacer es reenviar.
        assertThat(r.correoEnviado()).isFalse();
        assertThat(r.detalle()).contains("SMTP caido");
        verify(usuarios).save(any(Usuario.class));
    }

    @Test
    @DisplayName("no se invita a una empresa inactiva")
    void laEmpresaTieneQueEstarViva() {
        empresa.setActivo(false);

        assertThatThrownBy(() -> servicio.invitar(empresa.getId(), "rrhh@concentrix.test", null))
                .isInstanceOf(BusinessException.class);
        verify(usuarios, never()).save(any());
    }
}
