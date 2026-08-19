package com.novacrm.correo;

import com.novacrm.branding.BrandingService;
import com.novacrm.config.DestinatariosPermitidos;
import com.novacrm.config.EmailService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.Programa;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlantillaServiceTest {

    @Mock
    private PlantillaRepository plantillaRepository;

    @Mock
    private EstudianteRepository estudianteRepository;

    @Mock
    private BrandingService brandingService;

    @Mock
    private EmailService emailService;

    @Mock
    private DestinatariosPermitidos destinatarios;

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

    // ── CRUD y Listado ───────────────────────────────────────────────────────

    @Test
    @DisplayName("listar retorna todas las plantillas mapeadas a Respuesta DTO")
    void listarRetornaPlantillasMapeadas() {
        var p1 = new PlantillaGuardada();
        p1.setId(UUID.randomUUID());
        p1.setNombre("Bienvenida");
        p1.setAsunto("Bienvenido {{nombre}}");
        p1.setCuerpo("<p>Hola {{nombre}} {{apellido}}</p>");
        p1.setRolMinimo("COORDINADOR");
        p1.setActiva(true);

        when(plantillaRepository.findAllByOrderByNombreAsc()).thenReturn(List.of(p1));

        List<PlantillaDtos.Respuesta> resultado = plantillaService.listar();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).nombre()).isEqualTo("Bienvenida");
        assertThat(resultado.get(0).variablesUsadas()).containsExactlyInAnyOrder("nombre", "apellido");
    }

    @Test
    @DisplayName("obtener retorna la plantilla por ID si existe")
    void obtenerRetornaPlantillaPorId() {
        UUID id = UUID.randomUUID();
        var p = new PlantillaGuardada();
        p.setId(id);
        p.setNombre("Aviso");
        p.setAsunto("Asunto");
        p.setCuerpo("Cuerpo");
        p.setRolMinimo("ADMIN");
        p.setActiva(true);

        when(plantillaRepository.findById(id)).thenReturn(Optional.of(p));

        PlantillaDtos.Respuesta res = plantillaService.obtener(id);

        assertThat(res.id()).isEqualTo(id);
        assertThat(res.nombre()).isEqualTo("Aviso");
    }

    @Test
    @DisplayName("obtener lanza ResourceNotFoundException si no existe")
    void obtenerLanzaExcepcionSiNoExiste() {
        UUID id = UUID.randomUUID();
        when(plantillaRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> plantillaService.obtener(id))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Plantilla no encontrada");
    }

    // ── Guardar y Validaciones ───────────────────────────────────────────────

    @Test
    @DisplayName("guardar nueva plantilla con datos válidos")
    void guardarNuevaPlantillaValida() {
        var peticion = new PlantillaDtos.Guardar(
                null,
                "Invitación Entrevista",
                "Plantilla para coordinar citas",
                "Entrevista para {{cargo}} en {{empresa}}",
                "<p>Estimado {{nombre}} {{apellido}}, tu cita es el {{fecha_entrevista}}.</p>",
                "Ver cita",
                "https://panel.ejemplo.com/citas",
                "COORDINADOR",
                true
        );

        when(plantillaRepository.save(any(PlantillaGuardada.class))).thenAnswer(inv -> {
            PlantillaGuardada p = inv.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        PlantillaDtos.Respuesta res = plantillaService.guardar(null, peticion);

        assertThat(res).isNotNull();
        assertThat(res.nombre()).isEqualTo("Invitación Entrevista");
        assertThat(res.variablesUsadas()).contains("cargo", "empresa", "nombre", "apellido", "fecha_entrevista");

        ArgumentCaptor<PlantillaGuardada> captor = ArgumentCaptor.forClass(PlantillaGuardada.class);
        verify(plantillaRepository).save(captor.capture());
        assertThat(captor.getValue().getNombre()).isEqualTo("Invitación Entrevista");
    }

    @Test
    @DisplayName("guardar actualiza una plantilla existente")
    void guardarActualizaExistente() {
        UUID id = UUID.randomUUID();
        var existente = new PlantillaGuardada();
        existente.setId(id);
        existente.setNombre("Original");
        existente.setAsunto("Asunto original");
        existente.setCuerpo("Cuerpo original");
        existente.setRolMinimo("COORDINADOR");

        when(plantillaRepository.findById(id)).thenReturn(Optional.of(existente));
        when(plantillaRepository.save(any(PlantillaGuardada.class))).thenAnswer(inv -> inv.getArgument(0));

        var peticion = new PlantillaDtos.Guardar(
                null,
                "Modificado",
                "Desc",
                "Nuevo asunto {{nombre}}",
                "Nuevo cuerpo {{programa}}",
                null,
                null,
                "ADMIN",
                true
        );

        PlantillaDtos.Respuesta res = plantillaService.guardar(id, peticion);

        assertThat(res.nombre()).isEqualTo("Modificado");
        assertThat(res.rolMinimo()).isEqualTo("ADMIN");
        assertThat(existente.getAsunto()).isEqualTo("Nuevo asunto {{nombre}}");
    }

    @Test
    @DisplayName("guardar rechaza plantilla con campos vacíos o nulos")
    void guardarRechazaCamposVacios() {
        var peticion = new PlantillaDtos.Guardar(null, " ", "Desc", "", null, null, null, "COORDINADOR", true);

        assertThatThrownBy(() -> plantillaService.guardar(null, peticion))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("La plantilla necesita un nombre")
                .hasMessageContaining("El asunto no puede estar vacio")
                .hasMessageContaining("El cuerpo no puede estar vacio");
    }

    @Test
    @DisplayName("guardar rechaza rol inválido")
    void guardarRechazaRolInvalido() {
        var peticion = new PlantillaDtos.Guardar(null, "Nombre", "Desc", "Asunto", "Cuerpo", null, null, "SUPERUSER", true);

        assertThatThrownBy(() -> plantillaService.guardar(null, peticion))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("El rol debe ser COORDINADOR o ADMIN");
    }

    @Test
    @DisplayName("guardar rechaza variables desconocidas o mal escritas")
    void guardarRechazaVariablesDesconocidas() {
        var peticion = new PlantillaDtos.Guardar(
                null, "Nombre", "Desc", "Hola {{nombrre}}", "Tu empresa es {{empressa_ficticia}}", null, null, "COORDINADOR", true);

        assertThatThrownBy(() -> plantillaService.guardar(null, peticion))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Estas variables no existen: nombrre, empressa_ficticia");
    }

    @Test
    @DisplayName("guardar rechaza botón incompleto (texto sin url o url sin texto)")
    void guardarRechazaBotonIncompleto() {
        var p1 = new PlantillaDtos.Guardar(null, "Nombre", "Desc", "Asunto", "Cuerpo", "Texto Botón", null, "COORDINADOR", true);
        assertThatThrownBy(() -> plantillaService.guardar(null, p1))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("El boton necesita texto y destino");

        var p2 = new PlantillaDtos.Guardar(null, "Nombre", "Desc", "Asunto", "Cuerpo", null, "https://link.com", "COORDINADOR", true);
        assertThatThrownBy(() -> plantillaService.guardar(null, p2))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("El boton necesita texto y destino");
    }

    @Test
    @DisplayName("eliminar borra la plantilla existente")
    void eliminarBorraPlantilla() {
        UUID id = UUID.randomUUID();
        var p = new PlantillaGuardada();
        p.setId(id);

        when(plantillaRepository.findById(id)).thenReturn(Optional.of(p));

        plantillaService.eliminar(id);

        verify(plantillaRepository).delete(p);
    }

    // ── Previsualización ─────────────────────────────────────────────────────

    @Test
    @DisplayName("previsualizar monta el HTML con variables de ejemplo y genera avisos")
    void previsualizarMontaHtmlYAvisos() {
        when(brandingService.paraCorreo(any())).thenReturn(Optional.empty());
        when(destinatarios.hayRestriccion()).thenReturn(true);
        when(destinatarios.lista()).thenReturn(List.of("test@ejemplo.com"));
        when(emailService.canalActivo()).thenReturn("SMTP");

        var peticion = new PlantillaDtos.Guardar(
                null,
                "Previa",
                "Desc",
                "Oportunidad en {{empresa}} para {{nombre}}",
                "<p>Hola {{nombre}}, revisa el {{link}}</p>",
                "Ir",
                "https://link.com",
                "COORDINADOR",
                true
        );

        PlantillaDtos.Previsualizacion previa = plantillaService.previsualizar(peticion);

        assertThat(previa.asunto()).contains("Konecta", "Héctor Luis");
        assertThat(previa.html()).contains("<!DOCTYPE html>", "Konecta", "Héctor Luis");
        assertThat(previa.textoPlano()).isNotBlank();
        assertThat(previa.avisos()).isNotEmpty();
        assertThat(previa.avisos().stream().anyMatch(a -> a.contains("{{empresa}}"))).isTrue();
    }

    // ── Envíos Masivos y Simulación ──────────────────────────────────────────

    @Test
    @DisplayName("enviar lanza BusinessException si no hay estudiantes")
    void enviarLanzaExcepcionSiNoHayEstudiantes() {
        UUID id = UUID.randomUUID();
        var p = new PlantillaGuardada();
        p.setId(id);
        when(plantillaRepository.findById(id)).thenReturn(Optional.of(p));
        when(estudianteRepository.findAllByActivoTrue()).thenReturn(List.of());

        assertThatThrownBy(() -> plantillaService.enviar(id, new PlantillaDtos.EnviarRequest(null, true)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("No hay estudiantes");
    }

    @Test
    @DisplayName("enviar en modo simulación no llama a EmailService")
    void enviarEnModoSimulacionNoLlamaEmailService() {
        UUID id = UUID.randomUUID();
        var p = new PlantillaGuardada();
        p.setId(id);
        p.setNombre("Aviso Masivo");
        p.setAsunto("Aviso {{nombre}}");
        p.setCuerpo("Mensaje");

        var e1 = new Estudiante();
        e1.setId(UUID.randomUUID());
        e1.setNombre("Carlos");
        e1.setApellido("Pérez");
        e1.setEmail("carlos@ejemplo.com");

        when(plantillaRepository.findById(id)).thenReturn(Optional.of(p));
        when(estudianteRepository.findAllByActivoTrue()).thenReturn(List.of(e1));
        when(destinatarios.permite(anyString())).thenReturn(true);
        when(emailService.canalActivo()).thenReturn("SMTP");

        PlantillaDtos.ResumenEnvio resumen = plantillaService.enviar(id, new PlantillaDtos.EnviarRequest(null, true));

        assertThat(resumen.destinatarios()).isEqualTo(1);
        assertThat(resumen.enviados()).isEqualTo(0);
        assertThat(resumen.simulacion()).isTrue();
        verify(emailService, never()).enviar(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("enviar real procesa entregados, bloqueados y fallidos")
    void enviarRealProcesaEstadosCorrectamente() {
        UUID id = UUID.randomUUID();
        var p = new PlantillaGuardada();
        p.setId(id);
        p.setNombre("Aviso Masivo");
        p.setAsunto("Aviso {{nombre}}");
        p.setCuerpo("Hola {{nombre}} {{apellido}} de {{programa}}");

        var prog = new Programa();
        prog.setNombre("Ruta BPO");

        var e1 = new Estudiante();
        e1.setId(UUID.randomUUID());
        e1.setNombre("Carlos");
        e1.setApellido("Pérez");
        e1.setEmail("carlos@ejemplo.com");
        e1.setPrograma(prog);

        var e2 = new Estudiante();
        e2.setId(UUID.randomUUID());
        e2.setNombre("Ana");
        e2.setEmail("ana@externo.com");

        var e3 = new Estudiante();
        e3.setId(UUID.randomUUID());
        e3.setNombre("Sin Correo");
        e3.setEmail(null);

        var e4 = new Estudiante();
        e4.setId(UUID.randomUUID());
        e4.setNombre("Falla");
        e4.setEmail("falla@ejemplo.com");

        when(plantillaRepository.findById(id)).thenReturn(Optional.of(p));
        when(estudianteRepository.findAllByActivoTrue()).thenReturn(List.of(e1, e2, e3, e4));
        when(brandingService.paraCorreo(any())).thenReturn(Optional.empty());

        when(destinatarios.permite("carlos@ejemplo.com")).thenReturn(true);
        when(destinatarios.permite("ana@externo.com")).thenReturn(false);
        when(destinatarios.permite("falla@ejemplo.com")).thenReturn(true);

        when(emailService.enviar(eq("carlos@ejemplo.com"), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.ok());
        when(emailService.enviar(eq("falla@ejemplo.com"), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.fallo("SMTP timeout"));
        when(emailService.canalActivo()).thenReturn("SMTP");

        PlantillaDtos.ResumenEnvio resumen = plantillaService.enviar(id, new PlantillaDtos.EnviarRequest(null, false));

        assertThat(resumen.destinatarios()).isEqualTo(4);
        assertThat(resumen.enviados()).isEqualTo(1);
        assertThat(resumen.bloqueadosPorLista()).isEqualTo(1);
        assertThat(resumen.sinCorreo()).isEqualTo(1);
        assertThat(resumen.fallidos()).isEqualTo(1);
        assertThat(resumen.simulacion()).isFalse();
    }

    // ── Enviar Prueba Directo ────────────────────────────────────────────────

    @Test
    @DisplayName("enviarPrueba despacha correo con variables simuladas")
    void enviarPruebaDespachaCorreoConVariables() {
        when(destinatarios.permite("admin@novacrm.com")).thenReturn(true);
        when(brandingService.paraCorreo(any())).thenReturn(Optional.empty());
        when(emailService.canalActivo()).thenReturn("SMTP");
        when(emailService.enviar(eq("admin@novacrm.com"), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.ok());

        var peticion = new PlantillaDtos.EnviarPruebaRequest(
                "admin@novacrm.com",
                "Prueba entrevista {{cargo}}",
                "<p>Hola {{nombre}} {{apellido}}, cita: {{fecha_entrevista}} en {{lugar_entrevista}}.</p>",
                "Ver cita",
                "{{enlace_boton}}",
                null,
                Map.of(
                        "nombre", "Pedro",
                        "apellido", "Infante",
                        "cargo", "Tech Lead",
                        "fecha_entrevista", "Mañana a las 8am",
                        "lugar_entrevista", "Sala Virtual 1",
                        "enlace_boton", "https://panel.com/test"
                )
        );

        PlantillaDtos.ResumenEnvio res = plantillaService.enviarPrueba(peticion);

        assertThat(res.destinatarios()).isEqualTo(1);
        assertThat(res.enviados()).isEqualTo(1);
        assertThat(res.fallidos()).isEqualTo(0);
        assertThat(res.bloqueadosPorLista()).isEqualTo(0);

        ArgumentCaptor<String> htmlCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).enviar(eq("admin@novacrm.com"), eq("Prueba entrevista Tech Lead"), htmlCaptor.capture());
        assertThat(htmlCaptor.getValue())
                .contains("Pedro Infante")
                .contains("Tech Lead")
                .contains("Mañana a las 8am")
                .contains("Sala Virtual 1")
                .contains("https://panel.com/test");
    }

    @Test
    @DisplayName("enviarPrueba respeta bloqueo por lista de destinatarios permitidos")
    void enviarPruebaBloqueadoPorLista() {
        when(destinatarios.permite("noautorizado@externo.com")).thenReturn(false);
        when(emailService.canalActivo()).thenReturn("SMTP");

        var peticion = new PlantillaDtos.EnviarPruebaRequest(
                "noautorizado@externo.com",
                "Asunto",
                "Cuerpo",
                null,
                null,
                null,
                null
        );

        PlantillaDtos.ResumenEnvio res = plantillaService.enviarPrueba(peticion);

        assertThat(res.destinatarios()).isEqualTo(1);
        assertThat(res.enviados()).isEqualTo(0);
        assertThat(res.bloqueadosPorLista()).isEqualTo(1);
        verify(emailService, never()).enviar(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("enviarPrueba valida email y campos obligatorios")
    void enviarPruebaValidaCamposObligatorios() {
        assertThatThrownBy(() -> plantillaService.enviarPrueba(null))
                .isInstanceOf(BusinessException.class);

        var p1 = new PlantillaDtos.EnviarPruebaRequest("", "Asunto", "Cuerpo", null, null, null, null);
        assertThatThrownBy(() -> plantillaService.enviarPrueba(p1))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Debe especificar una dirección de correo");

        var p2 = new PlantillaDtos.EnviarPruebaRequest("invalido-email", "Asunto", "Cuerpo", null, null, null, null);
        assertThatThrownBy(() -> plantillaService.enviarPrueba(p2))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("formato válido");

        var p3 = new PlantillaDtos.EnviarPruebaRequest("test@ejemplo.com", " ", "Cuerpo", null, null, null, null);
        assertThatThrownBy(() -> plantillaService.enviarPrueba(p3))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("El asunto no puede estar vacio");

        var p4 = new PlantillaDtos.EnviarPruebaRequest("test@ejemplo.com", "Asunto", "", null, null, null, null);
        assertThatThrownBy(() -> plantillaService.enviarPrueba(p4))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("El cuerpo no puede estar vacio");
    }

    // ── Restaurar Valores de Fábrica ─────────────────────────────────────────

    @Test
    @DisplayName("restaurarDefecto resetea la plantilla existente a valores del sistema")
    void restaurarDefectoPorId() {
        UUID id = UUID.randomUUID();
        var existente = new PlantillaGuardada();
        existente.setId(id);
        existente.setNombre("Cita de entrevista agendada");
        existente.setAsunto("Asunto modificado");
        existente.setCuerpo("Cuerpo modificado");

        when(plantillaRepository.findById(id)).thenReturn(Optional.of(existente));
        when(plantillaRepository.save(any(PlantillaGuardada.class))).thenAnswer(inv -> inv.getArgument(0));

        PlantillaDtos.Respuesta res = plantillaService.restaurarDefecto(id, "CITA_ENTREVISTA");

        assertThat(res.asunto()).contains("{{cargo}}", "{{empresa}}");
        assertThat(res.cuerpo()).contains("{{fecha_entrevista}}", "{{modalidad_entrevista}}");
        assertThat(res.botonTexto()).isEqualTo("Ver detalles de la entrevista");
    }

    @Test
    @DisplayName("restaurarDefectoPorTipo retorna plantilla de fábrica correcta")
    void restaurarDefectoPorTipo() {
        PlantillaDtos.PlantillaDefecto def = plantillaService.restaurarDefectoPorTipo("ASIGNACION_VACANTE");

        assertThat(def.tipo()).isEqualTo("ASIGNACION_VACANTE");
        assertThat(def.asunto()).contains("{{cargo}}", "{{empresa}}");
        assertThat(def.botonTexto()).isEqualTo("Consultar vacante");
    }

    @Test
    @DisplayName("restaurarDefectoPorTipo lanza BusinessException si tipo no existe")
    void restaurarDefectoPorTipoInvalido() {
        assertThatThrownBy(() -> plantillaService.restaurarDefectoPorTipo("TIPO_INVENTADO"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("desconocido");
    }

    @Test
    @DisplayName("obtenerDefectos retorna todas las plantillas del sistema")
    void obtenerDefectosRetornaListaCompleta() {
        List<PlantillaDtos.PlantillaDefecto> defaults = plantillaService.obtenerDefectos();

        assertThat(defaults).isNotEmpty();
        assertThat(defaults.stream().map(PlantillaDtos.PlantillaDefecto::tipo))
                .contains("ACTIVACION", "RECUPERACION", "CITA_ENTREVISTA", "ASIGNACION_VACANTE", "ANUNCIO", "RECORDATORIO_HV");
    }

    // ── Variables Disponibles ────────────────────────────────────────────────

    @Test
    @DisplayName("variables lista todas las variables con su categoría")
    void variablesRetornaListaConCategorias() {
        List<PlantillaDtos.VariableDisponible> vars = plantillaService.variables();

        assertThat(vars).hasSize(Variables.values().length);
        assertThat(vars.stream().map(PlantillaDtos.VariableDisponible::categoria).distinct())
                .containsExactlyInAnyOrder("Estudiante", "Empleo", "Entrevista", "Coordinador", "Proyecto", "Sistema");
    }
}
