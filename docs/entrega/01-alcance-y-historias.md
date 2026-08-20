# Alcance funcional e historias de usuario

## Propósito

NOVA CRM centraliza el seguimiento académico y de empleabilidad. La prioridad
del producto es que el equipo pueda entender el estado de una persona y actuar
sin reconstruir su historia en varias hojas de cálculo; el estudiante, por su
parte, ve un portal limitado a su propio proceso.

## Roles existentes

| Rol | Propósito |
|---|---|
| `ADMIN` | Administra la institución, datos, configuraciones y operaciones sensibles. |
| `COORDINADOR` | Gestiona estudiantes, empleabilidad, programas y comunicaciones. |
| `ESTUDIANTE` | Consulta y actualiza exclusivamente su propio proceso. |
| `EMPRESA` | Gestiona la cuenta empresarial, vacantes y postulantes vinculados a su empresa. |

## Módulos incluidos

| Área | Capacidades entregadas |
|---|---|
| Dashboard y reportes | Indicadores, alertas, actividad, mapa, exportaciones y accesos de trabajo. |
| Estudiantes | Listado, filtros, creación, edición, perfil 360, documentos, formación, experiencia, plataformas, historial y seguimientos. |
| Empleabilidad | Vacantes, matching, postulaciones, entrevistas, pipeline y recomendaciones accionables. |
| Empresas | Directorio CRM, contactos, historial de relación, vacantes, candidatos y colocaciones. |
| Colocaciones | Registro, edición, cierre, checklist de ingreso y métricas de vinculación. |
| Seguimiento y agenda | Tablero de personas y postulaciones, actividades, citas y próximos compromisos. |
| Hojas de vida y documentos | Plantillas, generación, edición, conversión, documentos y descarga. |
| Comunicaciones | Anuncios, eventos, correos/plantillas y mensajería directa. |
| Importaciones | Participantes, empresas, colocaciones y libro completo con simulación antes de escribir. |
| Configuración y auditoría | Institución, marca, parámetros, cuentas, integraciones, preferencias y trazabilidad. |
| Portales | Portal de estudiante, captación pública de vacantes y portal de empresa. |
| Asistencia | Chat contextual y recomendaciones de siguiente acción sin exponer datos ajenos. |

## Historias principales y estado

| ID | Historia | Criterios de aceptación | Estado |
|---|---|---|---|
| HU-01 | Como administrador quiero ver y buscar estudiantes para acompañar su proceso. | Lista paginada, filtros, perfil y acciones rápidas. | Completada |
| HU-02 | Como administrador quiero consultar un Perfil 360. | Datos personales, académicos, empleo, CV, documentos, historial y seguimientos en una ficha. | Completada |
| HU-03 | Como administrador quiero registrar seguimientos. | Tipo, responsable, fecha, resultado, próxima acción y trazabilidad. | Completada |
| HU-04 | Como administrador quiero gestionar vacantes y compatibilidad. | Crear/editar/revisar oportunidades, candidatos y matching. | Completada |
| HU-05 | Como estudiante quiero ver mi proceso sin acceso a otros estudiantes. | Portal propio, postulaciones, documentos, calendario, notificaciones y chat. | Completada |
| HU-06 | Como equipo quiero registrar postulaciones e hitos de entrevista. | Pipeline, estado, cita y enlaces de navegación. | Completada |
| HU-07 | Como equipo quiero registrar y corregir colocaciones. | Persona, empresa, cargo, salario, condiciones, checklist y edición. | Completada |
| HU-08 | Como administrador quiero importar un libro de seguimiento. | Vista previa sin escritura, mapeo por hoja, errores por fila y confirmación posterior. | Completada; optimizada en esta entrega |
| HU-09 | Como estudiante quiero saber mi siguiente paso. | Recomendación explicable y acción enlazada, en español o inglés. | Completada |
| HU-10 | Como empresa quiero publicar y gestionar vacantes. | Captación pública y portal empresarial con permisos propios. | Completada; UAT con cuenta empresarial pendiente |
| HU-11 | Como administrador quiero auditar cambios importantes. | Bitácora consultable para operaciones relevantes. | Completada |

## Fuera del alcance o pendiente institucional

| Tema | Estado y motivo |
|---|---|
| Power BI con datos reales | La pantalla existe, pero requiere URL, workspace y permisos institucionales del informe real. No se debe simular una conexión. |
| LinkedIn OAuth | Hay configuración de datos, no una conexión OAuth productiva completa. |
| UAT de empresa con datos reales | Requiere una cuenta empresarial autorizada y un caso de negocio para no crear vacantes de prueba en producción. |
| Envío masivo real de correo/WhatsApp | Depende de proveedor, remitentes/plantillas verificados y autorización institucional. Las salvaguardas evitan envíos accidentales. |
| Integración directa de archivos grandes | Las cargas que pasan por Vercel tienen límite de plataforma. Para archivos grandes se recomienda carga directa a almacenamiento S3 compatible. |

## Restricciones conocidas

- El servicio gratuito de Render puede detenerse por inactividad; el primer uso
  puede tardar aproximadamente un minuto mientras inicia.
- La calidad de perfiles importados depende del archivo origen. La plataforma
  conserva filas con error en la vista previa en vez de inventar o sobrescribir
  datos.
- Las acciones destructivas no se ejecutan durante pruebas de aceptación sin
  aprobación específica y respaldo verificado.
