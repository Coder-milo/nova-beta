# Pruebas, UAT y changelog

## Estrategia de calidad

Se combinaron pruebas unitarias, compilación/typecheck, revisión de build, pruebas de API de solo lectura y recorridos manuales de los roles disponibles. Las acciones que crean, eliminan o envían comunicaciones reales se validaron mediante controles, formularios y simulaciones; no se ejecutaron de forma destructiva sobre producción.

## Evidencia de esta entrega

| Área | Evidencia | Resultado |
|---|---|---|
| Backend | `mvn -Dtest=!PapeleraIntegrationTest test`: 1.033 pruebas en reportes actuales. | Aprobado: 0 fallos. La exclusión requiere Docker/Testcontainers, no disponible en este equipo. |
| Frontend | `pnpm test` (93/93), `tsc --noEmit`, `astro check` y build de Astro. | Aprobado localmente: sin errores ni advertencias. |
| Estudiante | Inicio, proceso, postulaciones, HV, documentos, calendario, ajustes, notificaciones, mensajes, actividades y ayuda. | Navegación y carga verificadas. |
| Administrador | Dashboard, reportes, auditoría, estudiantes, empresas, vacantes, colocaciones, seguimiento, agenda, proyectos, HV, documentos, importaciones, comunicaciones y configuración. | Rutas y estados principales revisados. |
| Permisos | Estudiante limitado a su información; endpoints administrativos protegidos. | Verificado por backend y recorrido de rol. |
| Importaciones | Libro de seguimiento inspeccionado; se detectó dashboard no importable y código pegado en una columna. | Corregido: omisión explícita, filtrado y carga en bloque. |

## Casos UAT

| ID | Caso de aceptación | Resultado de esta entrega | Responsable de aprobación |
|---|---|---|---|
| UAT-01 | Login y persistencia de sesión de administración | Aprobado en recorrido manual. | Cliente |
| UAT-02 | Login y navegación del estudiante | Aprobado en recorrido manual. | Cliente |
| UAT-03 | Perfil 360 y acciones de estudiante | Aprobado para lectura/navegación. | Cliente |
| UAT-04 | Notificación lleva al módulo relacionado y el contador coincide | Corregido en código; requiere confirmar después de desplegar. | Cliente |
| UAT-05 | Vacantes, filtros y postulación con confirmación | Aprobado sin generar una postulación de prueba. | Cliente |
| UAT-06 | Registro/edición de empresa, vacante y colocación | Formularios y controles verificados; UAT de escritura requiere caso de negocio. | Cliente |
| UAT-07 | Importar libro completo | Simulación protegida y optimizada; confirmar con archivo real tras despliegue. | Cliente |
| UAT-08 | Seguimiento y pipeline con carga ágil | Optimizado en backend; verificar tiempo posterior al deploy. | Cliente |
| UAT-09 | Correos y WhatsApp reales | Pendiente: requiere autorización y credenciales institucionales. | Cliente |
| UAT-10 | Portal de empresa | Pendiente: requiere cuenta empresarial autorizada. | Cliente |

## Changelog — versión 2026.08.20

### Mejoras funcionales

- Perfil 360 con resumen accionable y centro de prioridades.
- Siguiente paso explicable para estudiante y administración.
- Navegación de notificaciones hacia postulaciones o mensajes.
- Contador de notificaciones sin truncar a `9+`.
- Idioma inicial inglés para cuentas exclusivamente de estudiante, sin alterar la preferencia guardada de usuarios existentes.
- Listado progresivo de postulaciones de estudiante para evitar pantallas muy largas.
- Carga inicial de colocaciones separada de catálogos secundarios.
- Corrección de carga superpuesta de tablero de personas en vista de postulaciones.
- Edición de colocaciones para cargo, empresa, salario, modalidad, contrato y otros datos.

### Rendimiento y mapeo

- Pipeline de empleabilidad calculado en bloque para evitar consultas por estudiante.
- Importación de participantes, empresas, postulaciones y colocaciones optimizada para evitar consultas N+1 en la vista previa.
- Las hojas estándar NOVA se mapean con reglas deterministas antes de IA.
- `Dashboard` se omite explícitamente y el código accidental dentro de una celda/columna se ignora de forma segura.

### Seguridad y experiencia

- Sesión en cookies `HttpOnly`, renovación controlada y errores recuperables.
- Respuestas de IA con restricciones de rol y de acceso a datos.
- Títulos de navegador adecuados para panel administrativo y portal estudiantil.

## Criterio de salida

La versión queda lista para despliegue cuando el commit final pase validación backend/frontend y los proveedores indiquen despliegue saludable. Después se debe repetir UAT-04, UAT-07 y UAT-08 directamente en la URL de producción.
