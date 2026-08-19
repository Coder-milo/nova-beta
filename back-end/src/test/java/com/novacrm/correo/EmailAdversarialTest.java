package com.novacrm.correo;

import com.novacrm.branding.BrandingService;
import com.novacrm.config.DestinatariosPermitidos;
import com.novacrm.config.EmailService;
import com.novacrm.config.MarcaCorreo;
import com.novacrm.config.correo.ProveedorCorreo;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Suite de Pruebas Adversarias y Empíricas para el Sistema de Correo de NOVA-CRM.
 *
 * <p>Diseñada con perspectiva hostil: evalúa resiliencia ante inyección de caracteres especiales,
 * secuencias de escape regex, valores nulos, variaciones de mayúsculas/minúsculas,
 * ataques XSS simulados en variables, bypass de listas blancas y condiciones de carrera/borde.
 */
@ExtendWith(MockitoExtension.class)
class EmailAdversarialTest {

    private static final MarcaCorreo MARCA_TEST = new MarcaCorreo(
            "https://cdn.novacrm.com/logo.png", 400, 100,
            "https://cdn.novacrm.com/pie.png", 1200, 150,
            "NOVA-CRM · Sistema de Pruebas",
            "#0284C7");

    // ═════════════════════════════════════════════════════════════════════════
    // 1. INTERPOLACIÓN ADVERSARIA DE VARIABLES (Variables.java)
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("1. Interpolación de Variables — Casos Adversarios y Límites")
    class VariablesAdversarialTests {

        @Test
        @DisplayName("Maneja caracteres especiales de regex ($ y \\) en valores sin lanzar excepción")
        void testValoresConCaracteresRegexEspeciales() {
            // $1 y \ son caracteres de captura y escape en Matcher.appendReplacement.
            // Si no se usa Matcher.quoteReplacement, lanzan IndexOutOfBoundsException o IllegalArgumentException.
            Map<Variables, String> valores = new HashMap<>();
            valores.put(Variables.NOMBRE, "Precio: $100 y $20 y $0");
            valores.put(Variables.EMPRESA, "Path\\To\\File\\Subfolder");
            valores.put(Variables.CARGO, "Pattern \\1 \\2 \\g<0>");
            valores.put(Variables.PROGRAMA, "${var_test} and $` and $'");

            String plantilla = "Estimado {{nombre}}, en {{empresa}} para el cargo de {{cargo}} en {{programa}}.";
            String resultado = Variables.aplicar(plantilla, valores);

            assertThat(resultado)
                    .contains("Precio: $100 y $20 y $0")
                    .contains("Path\\To\\File\\Subfolder")
                    .contains("Pattern \\1 \\2 \\g&lt;0&gt;")
                    .contains("${var_test} and $` and $'");
        }

        @Test
        @DisplayName("Escapa adecuadamente contenido malicioso HTML / XSS en los valores")
        void testEscapadoHtmlYProteccionXSS() {
            Map<Variables, String> valores = Map.of(
                    Variables.NOMBRE, "<script>alert('XSS')</script>",
                    Variables.APELLIDO, "O'Connor & \"Sons\" <test>",
                    Variables.EMPRESA, "<img src=x onerror=alert(1)>",
                    Variables.CARGO, "<b>Director</b> & CEO"
            );

            String plantilla = "Candidato: {{nombre}} {{apellido}}, Empresa: {{empresa}}, Cargo: {{cargo}}";
            String resultado = Variables.aplicar(plantilla, valores);

            assertThat(resultado)
                    .doesNotContain("<script>")
                    .doesNotContain("<img src=x onerror=alert(1)>")
                    .doesNotContain("<b>Director</b>")
                    .contains("&lt;script&gt;alert('XSS')&lt;/script&gt;")
                    .contains("O'Connor &amp; &quot;Sons&quot; &lt;test&gt;")
                    .contains("&lt;img src=x onerror=alert(1)&gt;")
                    .contains("&lt;b&gt;Director&lt;/b&gt; &amp; CEO");
        }

        @Test
        @DisplayName("Manejo de nulos, mapas vacíos y claves mapeadas a valor nulo")
        void testManejoDeNulosYValoresVacios() {
            // Plantilla nula
            assertThat(Variables.aplicar(null, Map.of())).isEqualTo("");
            assertThat(Variables.usadasEn(null)).isEmpty();
            assertThat(Variables.desconocidasEn(null)).isEmpty();

            // Mapa nulo
            String plantilla = "Hola {{nombre}}, empresa {{empresa}}.";
            assertThat(Variables.aplicar(plantilla, null)).isEqualTo("Hola , empresa .");

            // Mapa con valor explícitamente nulo para una variable existente
            Map<Variables, String> mapaConNull = new HashMap<>();
            mapaConNull.put(Variables.NOMBRE, null);
            mapaConNull.put(Variables.EMPRESA, "");
            mapaConNull.put(Variables.CARGO, "Analista");

            String res = Variables.aplicar("Hola {{nombre}}, {{empresa}} - {{cargo}}", mapaConNull);
            assertThat(res).isEqualTo("Hola ,  - Analista");
        }

        @Test
        @DisplayName("Variables repetidas múltiples veces y variables adyacentes sin separador")
        void testVariablesRepetidasYAdyacentes() {
            Map<Variables, String> valores = Map.of(
                    Variables.NOMBRE, "Ana",
                    Variables.APELLIDO, "Gómez",
                    Variables.PROGRAMA, "Java"
            );

            // Repetidas
            String plantillaRepetida = "{{nombre}} - {{nombre}} - {{nombre}}";
            assertThat(Variables.aplicar(plantillaRepetida, valores)).isEqualTo("Ana - Ana - Ana");

            // Adyacentes sin espacios
            String plantillaAdyacente = "{{nombre}}{{apellido}}[{{programa}}]";
            assertThat(Variables.aplicar(plantillaAdyacente, valores)).isEqualTo("AnaGómez[Java]");

            // usadasEn no debe duplicar variables
            assertThat(Variables.usadasEn(plantillaRepetida)).containsExactly(Variables.NOMBRE);
            assertThat(Variables.usadasEn(plantillaAdyacente))
                    .containsExactly(Variables.NOMBRE, Variables.APELLIDO, Variables.PROGRAMA);
        }

        @Test
        @DisplayName("Resistencia a mayúsculas, minúsculas y espacios arbitrarios dentro de {{ ... }}")
        void testVariacionesMayusculasYEspacios() {
            Map<Variables, String> valores = Map.of(
                    Variables.NOMBRE, "Héctor",
                    Variables.FECHA_ENTREVISTA, "10:00 AM",
                    Variables.ENLACE_BOTON, "https://link.test"
            );

            String plantilla = "1: {{NOMBRE}} 2: {{  nombre  }} 3: {{  Nombre  }} "
                    + "4: {{FECHA_ENTREVISTA}} 5: {{  fecha_entrevista   }} 6: {{  EnLaCe_BoToN  }}";

            String res = Variables.aplicar(plantilla, valores);
            assertThat(res).isEqualTo("1: Héctor 2: Héctor 3: Héctor 4: 10:00 AM 5: 10:00 AM 6: https://link.test");
        }

        @Test
        @DisplayName("Detección estricta de variables desconocidas y marcas mal formadas")
        void testVariablesDesconocidasYMarcasMalFormadas() {
            String texto = "Hola {{usuario}}, tu {{saldo}} en {{empresa}} y {{123}} con {{   }} y {solitario} {{no_cerrado";

            List<String> desconocidas = Variables.desconocidasEn(texto);
            assertThat(desconocidas).contains("usuario", "saldo", "123");
            assertThat(desconocidas).doesNotContain("empresa");

            // Al aplicar, las desconocidas se sustituyen por vacío para no ensuciar el email
            Map<Variables, String> valores = Map.of(Variables.EMPRESA, "NovaCorp");
            String aplicado = Variables.aplicar(texto, valores);
            assertThat(aplicado).contains("NovaCorp");
            assertThat(aplicado).doesNotContain("{{usuario}}");
            assertThat(aplicado).doesNotContain("{{saldo}}");
            assertThat(aplicado).doesNotContain("{{123}}");
            // {solitario} y {{no_cerrado se conservan como texto literal
            assertThat(aplicado).contains("{solitario}");
            assertThat(aplicado).contains("{{no_cerrado");
        }

        @Test
        @DisplayName("Estrés de rendimiento con plantilla grande (10,000 etiquetas de variables)")
        void testEstresDeRendimientoGranEscala() {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 2500; i++) {
                sb.append("ID ").append(i).append(": {{nombre}} aplica a {{cargo}} en {{empresa}} el {{fecha_entrevista}}. ");
            }
            String granPlantilla = sb.toString();

            Map<Variables, String> valores = Map.of(
                    Variables.NOMBRE, "Estudiante Test",
                    Variables.CARGO, "Desarrollador",
                    Variables.EMPRESA, "Empresa Aliada",
                    Variables.FECHA_ENTREVISTA, "2026-08-20"
            );

            long inicio = System.currentTimeMillis();
            String resultado = Variables.aplicar(granPlantilla, valores);
            long duracion = System.currentTimeMillis() - inicio;

            assertThat(resultado).isNotBlank();
            assertThat(resultado).doesNotContain("{{");
            // Debe procesar 10,000 variables en menos de 1000ms
            assertThat(duracion).isLessThan(1000);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 2. PLANTILLAS DEL SISTEMA Y RESTAURACIÓN (CorreosDelSistema.java)
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("2. Plantillas del Sistema — Generación, Borde y Restauración")
    class CorreosDelSistemaAdversarialTests {

        @Test
        @DisplayName("Generación de todos los tipos con valores nulos y cadenas vacías sin lanzar NPE")
        void testGeneracionConNulosSinExcepcion() {
            for (var tipo : CorreosDelSistema.Tipo.values()) {
                String html = CorreosDelSistema.ejemplo(tipo, MARCA_TEST, null);
                assertThat(html)
                        .as("El HTML para %s debe ser válido y completo", tipo)
                        .isNotBlank()
                        .startsWith("<!DOCTYPE html>")
                        .doesNotContain("%s", "%d", "%f");
            }

            // Métodos individuales con parámetros nulos
            assertThatCode(() -> CorreosDelSistema.activacion(null, null, null, 0, MARCA_TEST))
                    .doesNotThrowAnyException();
            assertThatCode(() -> CorreosDelSistema.recuperacion(null, null, 0, MARCA_TEST))
                    .doesNotThrowAnyException();
            assertThatCode(() -> CorreosDelSistema.citaEntrevista(null, null, null, null, null, null, null, MARCA_TEST))
                    .doesNotThrowAnyException();
            assertThatCode(() -> CorreosDelSistema.asignacionVacante(null, null, null, null, null, MARCA_TEST))
                    .doesNotThrowAnyException();
            assertThatCode(() -> CorreosDelSistema.anuncio(null, null, null, null, MARCA_TEST))
                    .doesNotThrowAnyException();
            assertThatCode(() -> CorreosDelSistema.recordatorioHv(null, null, null, MARCA_TEST))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Verificación de que ninguna plantilla de fábrica contenga variables desconocidas")
        void testPlantillasPorDefectoIntegridadDeVariables() {
            List<PlantillaDtos.PlantillaDefecto> defaults = CorreosDelSistema.plantillasPorDefecto();
            assertThat(defaults).hasSize(6);

            for (var def : defaults) {
                String todo = (def.asunto() != null ? def.asunto() : "") + " "
                        + (def.cuerpo() != null ? def.cuerpo() : "") + " "
                        + (def.botonUrl() != null ? def.botonUrl() : "");

                List<String> desconocidas = Variables.desconocidasEn(todo);
                assertThat(desconocidas)
                        .as("Plantilla de fábrica %s contiene variables no registradas: %s", def.tipo(), desconocidas)
                        .isEmpty();
            }
        }

        @Test
        @DisplayName("Soporte de sinónimos / aliases en los tipos de correo (ENTREVISTA -> CITA_ENTREVISTA, POSTULACION -> ASIGNACION_VACANTE)")
        void testAliasesDeTiposDeCorreo() {
            var p1 = CorreosDelSistema.plantillaPorDefecto(CorreosDelSistema.Tipo.ENTREVISTA);
            var p2 = CorreosDelSistema.plantillaPorDefecto(CorreosDelSistema.Tipo.CITA_ENTREVISTA);
            assertThat(p1.tipo()).isEqualTo(p2.tipo());
            assertThat(p1.asunto()).isEqualTo(p2.asunto());

            var q1 = CorreosDelSistema.plantillaPorDefecto(CorreosDelSistema.Tipo.POSTULACION);
            var q2 = CorreosDelSistema.plantillaPorDefecto(CorreosDelSistema.Tipo.ASIGNACION_VACANTE);
            assertThat(q1.tipo()).isEqualTo(q2.tipo());
            assertThat(q1.asunto()).isEqualTo(q2.asunto());
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3. ENVÍO DE PRUEBA Y VALIDACIÓN (PlantillaService.enviarPrueba)
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("3. Endpoint enviarPrueba — Validación de Emails y Reglas de Negocio")
    class EnviarPruebaAdversarialTests {

        @Mock private PlantillaRepository plantillaRepository;
        @Mock private EstudianteRepository estudianteRepository;
        @Mock private BrandingService brandingService;
        @Mock private EmailService emailService;
        @Mock private DestinatariosPermitidos destinatarios;

        private PlantillaService plantillaService;

        @BeforeEach
        void setUp() {
            plantillaService = new PlantillaService(
                    plantillaRepository,
                    estudianteRepository,
                    brandingService,
                    emailService,
                    destinatarios
            );
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"   ", "notanemail", "user@", "@domain.com", "user@domain", "user @domain.com", "user@.com"})
        @DisplayName("enviarPrueba rechaza formatos de email inválidos con BusinessException")
        void testRechazoEmailsInvalidos(String emailInvalido) {
            var req = new PlantillaDtos.EnviarPruebaRequest(
                    emailInvalido,
                    "Asunto de prueba",
                    "Cuerpo de prueba",
                    null,
                    null,
                    null,
                    null
            );

            assertThatThrownBy(() -> plantillaService.enviarPrueba(req))
                    .isInstanceOf(BusinessException.class);
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "admin@novacrm.com",
                "test.user+tag@domain.co",
                "user_name.123@sub.dominio.edu.co",
                "UPPERCASE@DOMAIN.ORG"
        })
        @DisplayName("enviarPrueba acepta formatos de email válidos y complejos")
        void testAceptaEmailsValidos(String emailValido) {
            when(destinatarios.permite(anyString())).thenReturn(true);
            when(brandingService.paraCorreo(any())).thenReturn(Optional.empty());
            when(emailService.canalActivo()).thenReturn("SMTP");
            when(emailService.enviar(anyString(), anyString(), anyString())).thenReturn(EmailService.Resultado.ok());

            var req = new PlantillaDtos.EnviarPruebaRequest(
                    emailValido,
                    "Asunto {{nombre}}",
                    "<p>Cuerpo {{empresa}}</p>",
                    "Boton",
                    "https://test.com",
                    null,
                    Map.of("nombre", "Carlos", "empresa", "Nova")
            );

            PlantillaDtos.ResumenEnvio resumen = plantillaService.enviarPrueba(req);

            assertThat(resumen.destinatarios()).isEqualTo(1);
            assertThat(resumen.enviados()).isEqualTo(1);
            assertThat(resumen.fallidos()).isEqualTo(0);
            assertThat(resumen.bloqueadosPorLista()).isEqualTo(0);
        }

        @Test
        @DisplayName("enviarPrueba con variables simuladas desconocidas o nulas se procesa de forma segura")
        void testVariablesSimuladasAdversarias() {
            when(destinatarios.permite(anyString())).thenReturn(true);
            when(brandingService.paraCorreo(any())).thenReturn(Optional.empty());
            when(emailService.canalActivo()).thenReturn("SES");
            when(emailService.enviar(anyString(), anyString(), anyString())).thenReturn(EmailService.Resultado.ok());

            Map<String, String> vars = new HashMap<>();
            vars.put("variable_fantasma", "no existe");
            vars.put(null, "valor sin clave");
            vars.put("nombre", "María José");
            vars.put("cargo", null); // valor nulo para clave válida

            var req = new PlantillaDtos.EnviarPruebaRequest(
                    "tester@novacrm.com",
                    "Hola {{nombre}}",
                    "<p>Cargo: {{cargo}} en {{empresa}}</p>",
                    null,
                    null,
                    null,
                    vars
            );

            PlantillaDtos.ResumenEnvio resumen = plantillaService.enviarPrueba(req);

            assertThat(resumen.enviados()).isEqualTo(1);
            // La variable empresa no fue pasada en simuladas, por lo que toma el ejemplo por defecto ("Konecta")
            verify(emailService).enviar(eq("tester@novacrm.com"), eq("Hola María José"), argThat(html ->
                    html.contains("María José") && html.contains("Konecta")));
        }

        @Test
        @DisplayName("enviarPrueba reporta fallo limpio cuando el proveedor de correo falla (ej: timeout SMTP)")
        void testManejoFalloProveedorCorreo() {
            when(destinatarios.permite(anyString())).thenReturn(true);
            when(brandingService.paraCorreo(any())).thenReturn(Optional.empty());
            when(emailService.canalActivo()).thenReturn("SMTP");
            when(emailService.enviar(anyString(), anyString(), anyString()))
                    .thenReturn(EmailService.Resultado.fallo("Connection timed out: smtp.office365.com:587"));

            var req = new PlantillaDtos.EnviarPruebaRequest(
                    "tester@novacrm.com",
                    "Asunto",
                    "Cuerpo",
                    null,
                    null,
                    null,
                    null
            );

            PlantillaDtos.ResumenEnvio resumen = plantillaService.enviarPrueba(req);

            assertThat(resumen.enviados()).isEqualTo(0);
            assertThat(resumen.fallidos()).isEqualTo(1);
            assertThat(resumen.detalle()).hasSize(1);
            assertThat(resumen.detalle().get(0).detalle()).contains("Connection timed out");
        }

        @Test
        @DisplayName("restaurarDefectoPorTipo valida entradas nulas o inválidas")
        void testRestaurarDefectoPorTipoValidaciones() {
            assertThatThrownBy(() -> plantillaService.restaurarDefectoPorTipo(null))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Debe especificar un tipo");

            assertThatThrownBy(() -> plantillaService.restaurarDefectoPorTipo("   "))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Debe especificar un tipo");

            assertThatThrownBy(() -> plantillaService.restaurarDefectoPorTipo("TIPO_NO_EXISTE"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("desconocido");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4. SEGURIDAD Y FILTRADO (DestinatariosPermitidos y EmailService)
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("4. Seguridad de Entrega — DestinatariosPermitidos y Filtrado")
    class DestinatariosPermitidosAdversarialTests {

        @Test
        @DisplayName("Parsea correctamente listas con espacios, comas múltiples y valores vacíos")
        void testParseoRobustoDeConfiguracion() {
            String configCaotica = "  dev1@novacrm.com  , ,   dev2@novacrm.com,  ,, DEV3@novacrm.com , ";
            var filtro = new DestinatariosPermitidos(configCaotica);

            assertThat(filtro.hayRestriccion()).isTrue();
            assertThat(filtro.lista()).containsExactly("dev1@novacrm.com", "dev2@novacrm.com", "DEV3@novacrm.com");

            // Insensible a mayúsculas y espacios al consultar
            assertThat(filtro.permite("dev1@novacrm.com")).isTrue();
            assertThat(filtro.permite("DEV1@novacrm.com")).isTrue();
            assertThat(filtro.permite("  dev2@novacrm.com  ")).isTrue();
            assertThat(filtro.permite("dev3@novacrm.com")).isTrue();

            // Bloquea no permitidos
            assertThat(filtro.permite("hacker@externo.com")).isFalse();
            assertThat(filtro.permite("dev1@novacrm.com.attacker.com")).isFalse();
        }

        @Test
        @DisplayName("Configuración vacía o nula no impone restricciones")
        void testConfiguracionVaciaSinRestriccion() {
            var filtroVacio = new DestinatariosPermitidos("");
            assertThat(filtroVacio.hayRestriccion()).isFalse();
            assertThat(filtroVacio.lista()).isEmpty();
            assertThat(filtroVacio.permite("cualquier.correo@dominio.com")).isTrue();

            var filtroNull = new DestinatariosPermitidos(null);
            assertThat(filtroNull.hayRestriccion()).isFalse();
            assertThat(filtroNull.permite("estudiante@universidad.edu.co")).isTrue();
        }

        @Test
        @DisplayName("EmailService nunca invoca al proveedor cuando la dirección está bloqueada")
        void testEmailServiceBloqueoInfalible() {
            var proveedor = mock(ProveedorCorreo.class);
            var filtro = new DestinatariosPermitidos("admin@novacrm.com");
            var emailService = new EmailService(proveedor, filtro);

            var resBloqueado = emailService.enviar("alumno.real@gmail.com", "Asunto", "<p>HTML</p>");
            assertThat(resBloqueado.enviado()).isFalse();
            assertThat(resBloqueado.motivoFallo()).contains("fuera de la lista de pruebas");

            // Verifica que el proveedor NUNCA fue llamado
            verify(proveedor, never()).enviar(anyString(), anyString(), anyString());

            // Si es la dirección permitida, sí delega al proveedor
            when(proveedor.enviar(anyString(), anyString(), anyString())).thenReturn(EmailService.Resultado.ok());
            var resPermitido = emailService.enviar("admin@novacrm.com", "Asunto", "<p>HTML</p>");
            assertThat(resPermitido.enviado()).isTrue();
            verify(proveedor, times(1)).enviar(eq("admin@novacrm.com"), anyString(), anyString());
        }
    }
}
