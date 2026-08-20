# Copiloto de empleabilidad y seguimiento — diseño del MVP

## Decisión de producto

La propuesta aporta valor, pero parte de ella ya existe distribuida entre el Perfil 360, `AlertasEmpleabilidad`, el pipeline, matching, `MiRuta`, próximas entrevistas y el tablero de seguimiento. El MVP no crea otro chatbot ni otro sistema de alertas: convierte esas señales en una decisión compartida y explicable.

La primera pieza recomendada es **Next Best Action por estudiante**. Es la dependencia del Centro de Acción, el ranking y la experiencia «Mi siguiente paso»; empezar por cualquier tarjeta del dashboard volvería a duplicar reglas.

## Datos disponibles

- Ficha, estado académico y de empleabilidad, responsable y cinco hitos de preparación.
- Hoja de vida vigente y versiones.
- Seguimientos, próxima acción y fecha próxima.
- Postulaciones, estados, fechas, entrevistas y resultado.
- Matching vigente con puntaje y desglose explicable.
- Colocación vigente y fecha de inicio.
- Timeline, documentos, plataformas, notificaciones y comunicaciones.

## Datos que faltan o no son suficientemente estructurados

- Tareas unificadas enlazadas a estudiante/vacante/empresa.
- Preparación asociada a una entrevista concreta; hoy solo puede probarse el simulacro general.
- Estado de «oferta» separado dentro de una postulación.
- Seguimientos post-colocación 30/60/90 identificables como hitos.
- Resultado, prioridad, responsable FK y adjuntos estructurados en seguimiento.
- Eventos normalizados de actividad para calcular Momentum sin aproximaciones.

Por esas ausencias, el MVP no afirma causas, no calcula probabilidad de contratación y no implementa todavía el radar Entrevista → Oferta ni el seguimiento 30/60/90.

## Reglas iniciales

| Regla | Condición | Evidencia | Prioridad | Acción recomendada |
| --- | --- | --- | --- | --- |
| Entrevista sin cierre | Fecha pasada y estado `ENTREVISTA_AGENDADA` | fecha, cargo, número de procesos | Alta | Registrar resultado |
| Seguimiento vencido | `fechaProxima < hoy` y estado no completado | fecha límite y días de retraso | Alta | Registrar seguimiento |
| Entrevista sin preparación | Entrevista en ≤48 h y ningún simulacro completado | horas restantes, cargo y simulacro | Alta | Preparar entrevista |
| CV como bloqueo | Busca empleo y no tiene CV vigente ni hito validado | estado de empleabilidad y CV | Media | Completar/revisar CV |
| Preparado sin postular | CV + LinkedIn listos, ≥15 días sin postular y matches vigentes | última postulación, cantidad de matches y mejor compatibilidad | Media/Alta | Revisar oportunidades |

El radar básico añade una sexta señal: cinco o más postulaciones y ninguna entrevista registrada. Se presenta como **posible área de revisión**, nunca como diagnóstico.

## Arquitectura

- `MotorSiguienteAccion`: función determinista sin Spring, base de datos ni LLM.
- `CopilotoService`: reúne los hechos y ejecuta el motor.
- `CopilotoController`: tres superficies con RBAC:
  - administración por estudiante;
  - estudiante autenticado;
  - Centro de Acción agregado.
- El Centro de Acción trae los datos en lote. No llama el motor mediante un endpoint por estudiante y evita N+1.
- No hay migración de base de datos en el MVP.
- La respuesta incluye textos ES/EN, evidencia y ruta; las notas administrativas nunca llegan al estudiante.

## Diseño funcional

### Perfil 360

«Siguiente mejor acción» muestra máximo tres recomendaciones, empezando por la más urgente. Cada una contiene qué se detectó, por qué importa, evidencia y acción directa. El resumen operativo existente permanece como contexto, no como un segundo motor.

### Dashboard administrador

«Centro de Acción» agrupa señales por tipo y permite desplegar las personas afectadas. A su lado, el ranking ordena por prioridad y cantidad de señales, no por nombre.

### Estudiante

«Mi siguiente paso» muestra la recomendación principal con lenguaje positivo. No enseña notas, responsables internos ni instrucciones reservadas. Las alertas complementarias del portal siguen disponibles debajo.

### Listado de estudiantes

La prioridad podrá incorporarse después como orden/filtro de servidor. No se filtra una página ya cargada en el navegador porque produciría resultados incompletos.

## LLM y privacidad

El MVP no envía datos a Groq. Un LLM solo aportaría valor posteriormente para redactar resúmenes de historial o preparación de entrevista, después de definir minimización, consentimiento, retención y auditoría. Las preguntas estructuradas («quién lleva 15 días sin postular») deben resolverse con reglas/SQL.

## Riesgos y mitigaciones

- Reglas contradictorias: un motor y constantes compartidas.
- Datos ausentes: no se convierten en una causa inventada.
- Fuga de notas: DTO específico por audiencia y pruebas de contenido.
- Presión sobre Render: consultas agrupadas y proyecciones, sin N+1.
- Automatización sensible: el motor solo sugiere; cada acción requiere confirmación en su módulo.
