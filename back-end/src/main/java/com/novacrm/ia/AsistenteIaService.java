package com.novacrm.ia;

import com.fasterxml.jackson.databind.JsonNode;
import com.novacrm.ia.dto.ConsultaAsistenteDto;
import com.novacrm.ia.dto.RespuestaAsistenteDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class AsistenteIaService {

    private static final Logger log = LoggerFactory.getLogger(AsistenteIaService.class);

    private final ProveedorIa proveedorIa;

    private static final String INSTRUCCIONES_SISTEMA = """
            Eres Nova AI, el asistente virtual inteligente de administración para el sistema NOVA-CRM (Programa de Empleabilidad CAC Eurocentres).
            Tu función es responder preguntas sobre el funcionamiento de la plataforma, ayudar a los administradores a realizar tareas y guiarlos en la navegación del sitio.
            
            Mapa de navegación y funciones principales de la plataforma:
            - / o /dashboard: Tablero Principal / métricas globales de empleabilidad, gráficos de estado, colocaciones y resumen de vacantes.
            - /estudiantes: Gestión de estudiantes, filtrado por programa/nivel de inglés, expedientes y descarga de hojas de vida.
            - /vacantes: Gestión de vacantes laborales, scraping automático de empleos, coincidencia inteligente (matching) con estudiantes.
            - /colocaciones: Registro y seguimiento de inserción laboral / colocaciones dignas (meta salarial) de los egresados.
            - /importar: Importador dinámico de Excel para cargar estudiantes, programas o vacantes masivamente.
            - /whatsapp: Centro de mensajería y configuración del canal de WhatsApp.
            - /configuracion: Ajustes generales del sistema, marca/branding, credenciales de IA, correo SMTP/SES e integraciones.
            - /certificaciones: Emisión y gestión de certificados digitales verificables.
            
            REGLA FUNDAMENTAL: Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la siguiente estructura exacta:
            {
              "respuesta": "Texto explicativo amigable y conciso en español.",
              "accionNavegacion": {
                "etiqueta": "Texto del botón (ej. 'Ir a Estudiantes' o null si no aplica)",
                "url": "Ruta relativa del mapa (ej. '/estudiantes' o null)"
              },
              "sugerencias": [
                "Pregunta sugerida 1",
                "Pregunta sugerida 2"
              ]
            }
            """;

    @Autowired
    public AsistenteIaService(ProveedorIa proveedorIa) {
        this.proveedorIa = proveedorIa;
    }

    public RespuestaAsistenteDto procesarConsulta(ConsultaAsistenteDto consulta) {
        String pregunta = consulta.pregunta() != null ? consulta.pregunta().trim() : "";
        String rutaActual = consulta.rutaActual() != null ? consulta.rutaActual() : "/";

        if (pregunta.isBlank()) {
            return fallbackRespuestaGeneral();
        }

        if (proveedorIa.disponible()) {
            try {
                String promptUsuario = String.format(
                        "El administrador se encuentra actualmente en la ruta '%s' y pregunta: '%s'",
                        rutaActual, pregunta
                );
                Optional<JsonNode> resultado = proveedorIa.completarJson(INSTRUCCIONES_SISTEMA, promptUsuario);
                if (resultado.isPresent()) {
                    JsonNode root = resultado.get();
                    String respuestaText = root.path("respuesta").asText("");
                    
                    RespuestaAsistenteDto.AccionNavegacion accion = null;
                    if (root.hasNonNull("accionNavegacion") && !root.path("accionNavegacion").isNull()) {
                        JsonNode navNode = root.path("accionNavegacion");
                        String etiqueta = navNode.path("etiqueta").asText(null);
                        String url = navNode.path("url").asText(null);
                        if (url != null && !url.isBlank()) {
                            accion = new RespuestaAsistenteDto.AccionNavegacion(
                                    etiqueta != null ? etiqueta : "Ir a la sección",
                                    url
                            );
                        }
                    }

                    List<String> sugerencias = new ArrayList<>();
                    if (root.has("sugerencias") && root.path("sugerencias").isArray()) {
                        for (JsonNode s : root.path("sugerencias")) {
                            if (s.isTextual() && !s.asText().isBlank()) {
                                sugerencias.add(s.asText());
                            }
                        }
                    }

                    if (!respuestaText.isBlank()) {
                        return new RespuestaAsistenteDto(respuestaText, accion, sugerencias);
                    }
                }
            } catch (Exception e) {
                log.warn("Fallo al consultar IA para el asistente de navegación, usando respuesta local: {}", e.getMessage());
            }
        }

        // Fallback local determinista cuando la IA no está disponible o falla
        return resolverLocalmente(pregunta);
    }

    private RespuestaAsistenteDto resolverLocalmente(String pregunta) {
        String text = pregunta.toLowerCase();

        if (text.contains("estudiante") || text.contains("alumno") || text.contains("expediente")) {
            return new RespuestaAsistenteDto(
                    "En el módulo de Estudiantes puedes gestionar a todos los participantes del programa, filtrar por estado de empleabilidad, nivel de inglés y descargar sus HVs.",
                    new RespuestaAsistenteDto.AccionNavegacion("Ir a Estudiantes", "/estudiantes"),
                    List.of("¿Cómo importar estudiantes desde Excel?", "¿Dónde ver las colocaciones?")
            );
        }

        if (text.contains("vacante") || text.contains("empleo") || text.contains("oferta") || text.contains("match")) {
            return new RespuestaAsistenteDto(
                    "En la sección de Vacantes puedes publicar nuevas ofertas de trabajo, ver los resultados del motor de matching inteligente y revisar las ofertas capturadas por el scraper.",
                    new RespuestaAsistenteDto.AccionNavegacion("Ver Vacantes", "/vacantes"),
                    List.of("¿Cómo funciona el matching inteligente?", "¿Cómo crear una vacante?")
            );
        }

        if (text.contains("excel") || text.contains("import") || text.contains("carga") || text.contains("masiva")) {
            return new RespuestaAsistenteDto(
                    "El Importador Excel te permite cargar archivos masivos de estudiantes y vacantes. Mapea automáticamente las columnas sin importar variaciones de formato.",
                    new RespuestaAsistenteDto.AccionNavegacion("Abrir Importador", "/importar"),
                    List.of("¿Qué formato requiere el archivo Excel?", "Ir a Estudiantes")
            );
        }

        if (text.contains("colocaci") || text.contains("salario") || text.contains("empleado") || text.contains("contratado")) {
            return new RespuestaAsistenteDto(
                    "En el módulo de Colocaciones realizas el seguimiento a los egresados contratados, evaluando el cumplimiento de la meta salarial digna.",
                    new RespuestaAsistenteDto.AccionNavegacion("Ir a Colocaciones", "/colocaciones"),
                    List.of("¿Dónde ver el tablero principal?", "Ir a Estudiantes")
            );
        }

        if (text.contains("whatsapp") || text.contains("mensaje") || text.contains("notificac")) {
            return new RespuestaAsistenteDto(
                    "Puedes gestionar el envío de notificaciones y la integración del canal de WhatsApp en la sección de mensajería.",
                    new RespuestaAsistenteDto.AccionNavegacion("Configurar WhatsApp", "/whatsapp"),
                    List.of("Ir a Configuración", "¿Cómo enviar correos?")
            );
        }

        if (text.contains("configura") || text.contains("correo") || text.contains("ia") || text.contains("brand")) {
            return new RespuestaAsistenteDto(
                    "En Configuración puedes personalizar la marca, ajustar las credenciales de correo (SMTP/SES), integrar la API de IA (Groq/OpenAI) y configurar el sistema.",
                    new RespuestaAsistenteDto.AccionNavegacion("Ir a Configuración", "/configuracion"),
                    List.of("¿Cómo activar la IA?", "Ir al Tablero Principal")
            );
        }

        if (text.contains("certific") || text.contains("diploma") || text.contains("credencial")) {
            return new RespuestaAsistenteDto(
                    "El módulo de Certificaciones permite emitir credenciales digitales con código QR y verificación pública mediante UUID único.",
                    new RespuestaAsistenteDto.AccionNavegacion("Ver Certificaciones", "/certificaciones"),
                    List.of("Ir a Configuración", "Ir a Estudiantes")
            );
        }

        if (text.contains("dashboard") || text.contains("inicio") || text.contains("panel") || text.contains("metrica")) {
            return new RespuestaAsistenteDto(
                    "El Tablero Principal muestra el resumen de empleabilidad, gráficos de impacto, tasa de colocación y métricas en tiempo real.",
                    new RespuestaAsistenteDto.AccionNavegacion("Ir al Tablero Principal", "/dashboard"),
                    List.of("Ver Vacantes", "Ir a Estudiantes")
            );
        }

        return fallbackRespuestaGeneral();
    }

    private RespuestaAsistenteDto fallbackRespuestaGeneral() {
        return new RespuestaAsistenteDto(
                "¡Hola! Soy Nova AI, tu asistente virtual de administración. Puedo guiarte a cualquier módulo (Estudiantes, Vacantes, Importador Excel, WhatsApp, Configuración o Certificados) y responder preguntas sobre la plataforma. ¿En qué te ayudo hoy?",
                new RespuestaAsistenteDto.AccionNavegacion("Ir al Tablero Principal", "/dashboard"),
                List.of("¿Dónde importo estudiantes desde Excel?", "¿Cómo ver las vacantes activas?", "¿Dónde configuro el correo?")
        );
    }
}
