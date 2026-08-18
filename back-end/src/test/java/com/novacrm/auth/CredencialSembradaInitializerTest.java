package com.novacrm.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Que la contrasena de ejemplo del repositorio no valga en ningun entorno.
 *
 * <p>Las dos garantias que hay que sostener a la vez: cerrar la cuenta que
 * sigue con la contrasena sembrada y <em>no tocar</em> la de quien ya la
 * cambio. Fallar en la segunda deja fuera al administrador real, que es
 * exactamente el motivo por el que esto llevaba tanto tiempo sin arreglarse.
 */
class CredencialSembradaInitializerTest {

    private static final String HASH_SEMBRADO =
            "$2a$10$.XT99VGrzqD16sUXmhyJ0OAmD3MxkJV7E77eiPoz31KY8AFUGjNTe";

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    private Usuario usuario(String email, String hash) {
        var u = new Usuario();
        u.setEmail(email);
        u.setPassword(hash);
        return u;
    }

    @Test
    @DisplayName("el hash sembrado en V1 es efectivamente el de admin123")
    void elHashSembradoEsAdmin123() {
        // Si esto falla, la marca que usa el inicializador dejo de valer y el
        // guardia no reconoceria la cuenta que debe cerrar.
        assertThat(encoder.matches("admin123", HASH_SEMBRADO)).isTrue();
    }

    @Test
    @DisplayName("la cuenta que sigue con la contraseña de ejemplo deja de aceptarla")
    void cierraLaCuentaConLaContrasenaDeEjemplo() {
        var repo = mock(UsuarioRepository.class);
        var admin = usuario("admin@novacrm.com", HASH_SEMBRADO);
        when(repo.findAll()).thenReturn(new ArrayList<>(List.of(admin)));

        new CredencialSembradaInitializer(repo, encoder, "").run();

        assertThat(admin.getPassword()).isNotEqualTo(HASH_SEMBRADO);
        assertThat(encoder.matches("admin123", admin.getPassword()))
                .as("admin123 ya no puede abrir la cuenta")
                .isFalse();
        verify(repo).save(admin);
    }

    @Test
    @DisplayName("no toca a quien ya cambió su contraseña")
    void noTocaAQuienYaLaCambio() {
        var repo = mock(UsuarioRepository.class);
        String suyo = encoder.encode("la-que-el-admin-real-puso");
        var admin = usuario("admin@novacrm.com", suyo);
        when(repo.findAll()).thenReturn(new ArrayList<>(List.of(admin)));

        new CredencialSembradaInitializer(repo, encoder, "").run();

        assertThat(admin.getPassword()).isEqualTo(suyo);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("usa ADMIN_INITIAL_PASSWORD cuando el entorno la define")
    void usaLaContrasenaDelEntornoSiExiste() {
        var repo = mock(UsuarioRepository.class);
        var admin = usuario("admin@novacrm.com", HASH_SEMBRADO);
        when(repo.findAll()).thenReturn(new ArrayList<>(List.of(admin)));

        new CredencialSembradaInitializer(repo, encoder, "la-del-despliegue").run();

        assertThat(encoder.matches("la-del-despliegue", admin.getPassword())).isTrue();
    }

    @Test
    @DisplayName("con la base ya limpia no escribe nada")
    void conLaBaseLimpiaNoHaceNada() {
        var repo = mock(UsuarioRepository.class);
        when(repo.findAll()).thenReturn(new ArrayList<>(List.of(
                usuario("ana@novacrm.com", encoder.encode("suya")),
                usuario("luis@novacrm.com", encoder.encode("suya-tambien")))));

        new CredencialSembradaInitializer(repo, encoder, "").run();

        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("dos entornos nuevos no reciben la misma contraseña")
    void laAleatoriaNoSeRepite() {
        var capturadas = new ArrayList<String>();
        for (int i = 0; i < 2; i++) {
            var repo = mock(UsuarioRepository.class);
            var admin = usuario("admin@novacrm.com", HASH_SEMBRADO);
            when(repo.findAll()).thenReturn(new ArrayList<>(List.of(admin)));
            new CredencialSembradaInitializer(repo, encoder, "").run();
            capturadas.add(admin.getPassword());
        }
        assertThat(capturadas.get(0)).isNotEqualTo(capturadas.get(1));
    }
}
