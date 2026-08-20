# Auditoría de producto, UX y arquitectura — seguimiento y empleabilidad

Fecha: 20 de agosto de 2026
Base revisada: `b8ecb0e`
Alcance: frontend, backend, migraciones, autenticación, permisos, pruebas y módulos de estudiante/empleabilidad.

## Resumen ejecutivo

NOVA ya tiene una base funcional considerable. No conviene crear otro Perfil 360, otro pipeline ni otro sistema de matching: esas piezas existen y deben consolidarse. La oportunidad principal es transformar los datos dispersos en decisiones y acciones concretas para el equipo.

Los hallazgos más importantes son:

1. El Perfil 360 actual reúne mucha información, pero su resumen no responde con rapidez «quién lleva el caso, qué está vencido y qué debo hacer ahora».
2. El dashboard administrativo puede sustituir datos reales por datos de ejemplo cuando falla el backend. Aunque muestra un aviso, esa mezcla no es aceptable para decisiones operativas.
3. Varias pantallas convierten silenciosamente una respuesta fallida en una lista vacía. Esto confunde «no existen registros» con «no fue posible consultarlos».
4. Seguimientos, entrevistas y actividades existen, pero Agenda no es aún una vista unificada de compromisos. No hay una entidad de tareas relacionable con estudiante, vacante o empresa.
5. El responsable actual del estudiante está bien modelado como FK, pero los seguimientos históricos conservan el responsable como texto y carecen de prioridad, resultado, adjuntos y responsable estructurado.
6. Hay buena defensa en profundidad para los roles y pruebas específicas de propiedad de datos, pero todavía faltan MFA para administración y roles/permisos configurables.
7. El frontend contiene varias páginas y componentes de más de 1.000 líneas. Eso aumenta el riesgo de regresiones y dificulta reutilizar patrones.
8. La suite detectó que el fallback textual del pie de correo había dejado de nombrar a los aliados cuando el cliente bloqueaba la imagen. Se corrigió durante esta primera iteración.

## A. Estado actual

### Stack y despliegue

| Capa | Implementación actual |
| --- | --- |
| Frontend | Astro 7 SSR, adaptador Node/Vercel, React 19, TypeScript 5.7, Tailwind 4, Base UI y componentes propios |
| Backend | Spring Boot 3.3.13, Java 17, Spring Web/Security/JPA/Validation |
| Base de datos | PostgreSQL y 65 migraciones Flyway |
| Autenticación | JWT de acceso/renovación; cookies HttpOnly gestionadas por el servidor Astro; BCrypt |
| Autorización | Roles `ADMIN`, `COORDINADOR`, `ESTUDIANTE` y `EMPRESA`; reglas HTTP, `@PreAuthorize` y comprobación de propiedad/alcance |
| Archivos | MinIO/almacenamiento configurable |
| Integraciones | Correo SMTP/SES, WhatsApp, Groq, scraping de vacantes, generación/lectura de PDF y Excel |
| Despliegue actual | Frontend en Vercel y API en Render |

La documentación principal está parcialmente desactualizada: el README menciona Java 21/Spring Boot 3.3.0, mientras el `pom.xml` usa Java 17/Spring Boot 3.3.13.

### Arquitectura y módulos reales

El backend está organizado por dominio. Existen módulos para estudiantes, perfil, seguimiento, pipeline, postulaciones, matching, vacantes, empresas, colocaciones, documentos, hojas de vida, agenda/actividades, comunicación, notificaciones, auditoría, reportes, importación, branding, chat e IA.

El frontend mantiene shells y navegación distintos para gestión, estudiante y empresa. La lista blanca de rutas del estudiante evita que navegue a pantallas administrativas; el backend vuelve a validar el rol y, cuando corresponde, la propiedad del estudiante.

### Funcionalidades ya existentes que deben reutilizarse

- Ficha de estudiante con diez pestañas: resumen, información personal y académica, formación, experiencia, HV, documentos, plataformas, seguimientos e historial.
- Timeline unificado del estudiante.
- Responsable actual del caso con FK a usuario y asignación individual/masiva.
- Tablero por persona y pipeline Kanban por postulación.
- Pipeline de empleabilidad derivado de hechos registrados, no de una etapa arbitraria editable.
- Índice de preparación/empleabilidad basado en hitos reales: CV, LinkedIn, perfil ocupacional y otros hitos configurados en el modelo actual.
- Matching por reglas con desglose de afinidad, habilidades, inglés, ubicación y experiencia.
- Vacantes propias, importadas y detectadas por scraping; flujo de validación.
- Portal de empresas con vacantes y candidatos limitados a la empresa autenticada.
- CRM de empresas con contactos e historial.
- Colocaciones con cargo, salario, modalidad, contrato, origen y checklist; edición disponible.
- Entrevistas en postulaciones y agenda de entrevistas.
- Búsqueda global de estudiantes, empresas, vacantes, programas, documentos y colocaciones.
- Filtros avanzados, vistas guardadas y acciones masivas en estudiantes.
- Portal del estudiante con progreso, hitos, seguimientos, documentos, postulaciones, calendario y notificaciones.
- Auditoría de cambios en estudiantes, empresas, vacantes, programas, colocaciones y operaciones administrativas relevantes.
- Paginación en listados principales e índices de BD para varias consultas operativas.
- Manejo global de errores del backend y pruebas de autorización/propiedad.

## B. Problemas encontrados

### UX

- El resumen del Perfil 360 muestra indicadores descriptivos, pero no prioriza acciones vencidas o próximas.
- El responsable del caso llega en la respuesta, pero no se muestra en la ficha individual.
- Fecha de nacimiento y género se editan y llegan desde la API, pero la vista personal los muestra siempre vacíos.
- El administrador todavía debe recorrer varias pestañas para reunir CV, seguimiento, entrevista y postulación.
- Agenda representa entrevistas; las actividades del programa y los próximos seguimientos no forman una agenda operativa única.
- La acción rápida desde la tabla/perfil no cubre todavía todo el flujo propuesto: tarea vinculada y comunicación contextual siguen fragmentadas.
- El dashboard tiene alertas clicables útiles, pero carece de una sección completa «qué necesita mi atención hoy» con todos los criterios de empleabilidad solicitados.

### Frontend

- El dashboard usa `mock-data` como respaldo productivo cuando la API falla. Es un riesgo de confianza y de toma de decisiones.
- En la ficha individual, al menos ocho fuentes se consultan al montar la pantalla, aunque el usuario no visite las pestañas correspondientes.
- Las cargas secundarias de la ficha capturan errores y asignan `[]`/`null`; no existe estado de error por sección.
- Se encontraron 57 bloques `catch` vacíos o equivalentes en componentes/páginas. No todos son defectos, pero requieren clasificación.
- Hay componentes excesivamente grandes: estudiantes (lista y ficha), hojas de vida, cabecera y mensajería superan o se acercan a 1.500 líneas.
- Solo hay 10 archivos de prueba frontend frente a una superficie de interfaz grande.
- La internacionalización está incompleta: hay traducciones, pero también numerosos textos administrativos incrustados en español.

### Backend

- `Seguimiento` usa cadenas libres para tipo, estado y responsable; no tiene prioridad, resultado, archivos ni FK del responsable histórico.
- No existe entidad de tareas. El «próximo paso» del seguimiento cubre un caso sencillo, pero no permite asignación, relación polimórfica, prioridades o tablero de trabajo.
- El modelo `Actividad` está vinculado al programa, no a estudiante/empresa/vacante. Por eso no puede representar por sí solo los compromisos de seguimiento.
- El dashboard calcula alertas importantes (seguimientos vencidos, entrevistas, mensajes, datos faltantes), pero aún no cubre inactividad completa, CV desactualizado configurable, falta de postulaciones, múltiples rechazos o post-colocación.
- No existe seguimiento post-colocación estructurado a 30/60/90 días.
- Los estados/tipos son mayoritariamente cadenas o enums fijos; modificar el flujo exige código/migración.
- El comentario del DTO de dashboard todavía llama «placeholders» a documentos/HV aunque ya se consultan tablas reales.

### Base de datos

- La base actual permite construir buena parte de los KPIs, pero faltan fechas/relaciones estructuradas para tareas y seguimiento post-colocación.
- No hay moneda explícita en colocaciones; el salario no debe agregarse entre monedas sin ese dato.
- No hay una política configurable persistida para «CV desactualizado» o «sin actividad X días».
- `responsable_id` existe en estudiante, pero el histórico de seguimiento no referencia al usuario responsable.
- Deben revisarse índices nuevos al introducir tareas, consultas por vencimiento y timeline consolidado. Los listados actuales ya tienen varias optimizaciones y el tablero agrupa consultas para evitar el N+1 anterior.

### Arquitectura

- Existe solapamiento conceptual entre `Actividad`, `Seguimiento.proximaAccion`, entrevista y una futura tarea. Crear un cuarto registro independiente sin una regla de origen duplicaría datos.
- La ficha individual concentra demasiadas responsabilidades de carga, formularios, acciones y presentación.
- La documentación de mejoras contiene afirmaciones antiguas junto a implementaciones nuevas; el código y las migraciones son la fuente de verdad.
- Un endpoint agregado de resumen 360 podría reducir viajes, pero debe construirse como proyección de dominios existentes, no como nueva fuente de datos.

### Seguridad

- La base de RBAC es buena: JWT, cookies HttpOnly, HSTS, lista blanca del rol empresa, `@PreAuthorize`, ownership y pruebas específicas.
- Los campos administrativos no se confían al frontend: la autoedición del estudiante tiene topes en backend.
- Falta MFA para roles administrativos.
- Los roles son fijos y no existen permisos por campo/acción.
- Los adjuntos públicos de anuncios son una decisión de producto documentada; las claves son validadas. Si en el futuro contienen información privada, deberán pasar a URL firmada/caducable.

### Rendimiento y operación

- La carga inicial del Perfil 360 hace un abanico de llamadas y puede amplificar el arranque en frío de Render.
- Render puede añadir latencia de cold start, pero no explica por sí solo los errores: la interfaz debe diferenciar 429, 502/503 y vacío real.
- El tablero de seguimiento ya trae historiales y conteos agrupados; un comentario afirma aún que existe un N+1 y debe corregirse.
- La búsqueda global usa `LIKE` y limita a cinco resultados por entidad. Es adecuada para el volumen actual; si crece, convendrá búsqueda normalizada/trigramas y límites por alcance.
- El backend tiene 153 clases de prueba, una cobertura cualitativa claramente mejor que la del frontend.

## C. Funcionalidades incompletas

1. Perfil 360 accionable: existe la ficha, falta el centro de atención y próximos pasos.
2. Seguimiento estructurado: faltan resultado, prioridad, responsable FK, adjuntos y categorías completas.
3. Agenda unificada: próximos seguimientos, entrevistas y actividades no comparten una proyección común.
4. Tareas internas: no existe el dominio ni relaciones con estudiante/vacante/empresa.
5. Alertas configurables: las reglas actuales están codificadas en Java.
6. Post-colocación 30/60/90: no existe como flujo verificable.
7. Dashboard sin datos ficticios y con métricas accionables completas.
8. KPIs de conversión/tiempo: parte de los datos existe, pero falta exponerlos de forma consistente y validar denominadores.
9. CV desactualizado: se conoce la fecha de versión, pero no hay umbral de negocio configurable.
10. Comunicaciones 360: hay chat, correo, WhatsApp y seguimientos, pero el historial no representa de forma homogénea todos los canales.
11. Campos/etapas/roles configurables y MFA.
12. Power BI figura como módulo futuro; no debe presentarse como analítica operativa terminada.

## D. Roadmap priorizado

| Prioridad | Mejora | Beneficio | Complejidad | Módulos afectados |
| --- | --- | --- | --- | --- |
| P0 | Eliminar datos de ejemplo del dashboard productivo y mostrar error/último dato válido | Evita decisiones con cifras ficticias | Baja | Dashboard, gráficos |
| P0 | Distinguir error, vacío y carga parcial en Perfil 360 | Evita concluir que no hay CV/seguimientos cuando falló la API | Media | Estudiantes, API frontend |
| P0 | Mantener pruebas de ownership para todas las rutas compartidas con estudiante | Previene acceso horizontal a datos | Media | Seguridad, HV, documentos, postulaciones, notificaciones |
| P1 | Centro de atención y acciones rápidas en Perfil 360 | Reduce clics y centra el acompañamiento | Media | Estudiantes, seguimiento, HV, postulaciones |
| P1 | Modelo unificado de tareas/compromisos enlazado a entidades | Evita duplicar agenda y próximos pasos | Alta | Seguimiento, agenda, estudiantes, empresas, vacantes |
| P1 | Seguimiento estructurado con prioridad, resultado, responsable FK y adjuntos | Mejora trazabilidad y reparto de trabajo | Alta | Seguimiento, auditoría, documentos |
| P1 | Agenda unificada como proyección de tareas, entrevistas y próximos seguimientos | Una sola fuente de trabajo diario | Media/Alta | Agenda, seguimiento, postulaciones |
| P1 | Alertas de inactividad, CV, postulaciones, rechazos y documentos con enlaces filtrados | Detecta casos que requieren intervención | Media | Dashboard, estudiantes, HV, postulaciones |
| P1 | Seguimiento post-colocación 30/60/90 generado al registrar contratación | Mide permanencia y calidad del resultado | Media | Colocaciones, tareas, agenda, reportes |
| P1 | Funnel y conversiones basados en postulaciones/colocaciones reales | Permite gestionar cuellos de botella | Media | Dashboard, reportes, postulaciones |
| P1 | Carga diferida o endpoint de proyección para Perfil 360 | Reduce latencia y presión sobre Render | Media | Estudiantes frontend/backend |
| P2 | Umbrales configurables por programa para alertas | Adapta el seguimiento sin desplegar código | Media | Configuración, dashboard |
| P2 | Ampliar matching con disponibilidad/preferencias cuando los datos sean confiables | Mejora recomendaciones explicables | Media | Matching, vacantes, estudiante |
| P2 | Acciones rápidas desde lista de estudiantes | Reduce navegación operativa | Media | Estudiantes, modales reutilizables |
| P2 | Moneda en colocaciones y validación de agregados salariales | Hace válidos los KPIs de salario | Baja/Media | Colocaciones, reportes, importación |
| P2 | Historial de comunicaciones normalizado en timeline | Da contexto completo del caso | Alta | Timeline, chat, correo, WhatsApp |
| P2 | Descomponer páginas grandes por dominio y aumentar pruebas frontend | Reduce regresiones y duplicación | Media/Alta | Frontend transversal |
| P3 | Etapas y campos configurables | Flexibilidad entre programas | Alta | Configuración, DB, múltiples módulos |
| P3 | MFA administrativo y permisos granulares | Eleva seguridad empresarial | Alta | Auth, usuarios, auditoría |
| P3 | Webhooks/API de terceros | Facilita integraciones futuras | Alta | Integraciones, seguridad |

## Primeras tres mejoras recomendadas

1. **Perfil 360 accionable y confiable.** Reutilizar la ficha existente, añadir responsable, alertas y próximos pasos; corregir campos omitidos y estados parciales.
2. **Tareas/compromisos como pieza central de Seguimiento + Agenda.** Diseñar una fuente de verdad que se cree desde un seguimiento o entrevista sin registrar lo mismo dos veces.
3. **Dashboard accionable y sin datos ficticios.** Sustituir el fallback de muestra, completar reglas de atención y enlazar cada indicador a su filtro real.

## Diseño funcional de la primera mejora

### Problema actual

La ficha contiene la información, pero el administrador debe interpretar manualmente varias pestañas. Responsable, ausencia de contacto, compromisos vencidos, CV, preparación, entrevistas y postulaciones no están reunidos en una lectura operativa.

### Solución

Añadir al resumen actual un bloque «Atención y próximos pasos» calculado exclusivamente con datos reales ya cargados. Mostrará:

- responsable actual del caso;
- última fecha de seguimiento y días transcurridos;
- siguiente compromiso o compromiso vencido;
- entrevista próxima o entrevista pasada sin cerrar;
- CV vigente y fecha de actualización;
- postulaciones activas;
- porcentaje de empleabilidad y pendientes de preparación;
- acciones rápidas hacia seguimiento, HV, preparación y postulación.

El cálculo no emitirá alertas negativas mientras la fuente correspondiente siga cargando.

### Flujo ADMIN/COORDINADOR

1. Abre la ficha desde estudiantes, una alerta o la búsqueda global.
2. Lee el responsable y los riesgos sin cambiar de pestaña.
3. Ejecuta la acción sugerida en un clic.
4. El formulario existente registra el seguimiento/postulación/HV; no se crea una segunda implementación.

### Flujo ESTUDIANTE

No cambia en esta iteración. El estudiante conserva su dashboard y sus endpoints propios. El bloque administrativo no se expone en su lista blanca de rutas.

### Datos, BD y endpoints

- Datos: `EstudianteResponse`, seguimientos, versiones de HV, pipeline, postulaciones y colocaciones ya existentes.
- Base de datos: sin cambios.
- Endpoints: sin cambios.
- Regla de contacto: reutiliza el umbral actual del tablero (`14` días), no introduce otro número contradictorio.

### Componentes

- Una función pura y probada para construir el resumen accionable.
- Un componente visual integrado con `Card`, `Badge`, `Button` y tokens semánticos existentes.
- La página actual conecta los callbacks a sus pestañas y modales existentes.

### Permisos

No se amplía ningún endpoint ni rol. La ficha continúa restringida a gestión y el backend conserva sus controles actuales.

### Riesgos y mitigaciones

- **Alerta falsa por API pendiente:** cada dominio tiene bandera de carga.
- **Fechas con cambio de zona:** las fechas de solo día se comparan como calendario, no como timestamp UTC implícito.
- **Duplicación visual:** se reutilizan componentes y acciones existentes.
- **Regla arbitraria:** se usa el mismo umbral de 14 días del tablero actual.

## Criterios de aceptación de la primera mejora

- No se crea un segundo Perfil 360.
- La ficha muestra el responsable actual.
- Un seguimiento vencido y una entrevista sin cerrar aparecen con prioridad alta.
- «Sin CV» y «sin postulaciones activas» solo aparecen después de terminar su carga.
- Las acciones rápidas abren la sección o modal existente.
- Fecha de nacimiento y género muestran el valor real.
- El cálculo tiene pruebas de vacío, carga, caso sano y vencimientos.
- `test`, `check` y `build` del frontend terminan sin errores.
