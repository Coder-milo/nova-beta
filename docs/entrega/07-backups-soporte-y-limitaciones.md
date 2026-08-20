# Backups, recuperación, mantenimiento y limitaciones

## Política mínima de respaldo

La configuración exacta del proveedor de PostgreSQL y S3 debe confirmarse en el momento de transferencia. Hasta que exista esa evidencia, no se debe asumir que hay copias automáticas suficientes.

| Activo | Frecuencia mínima | Retención sugerida | Responsable |
|---|---|---|---|
| PostgreSQL | Diario + antes de cambios masivos | 30 días; mensual 12 meses | Administración de datos |
| Archivos S3/MinIO | Versionado o copia diaria | 30-90 días | Infraestructura |
| Configuración de proveedores | Tras cada cambio | Versiones controladas sin secretos | DevOps / administrador |
| Repositorio Git | Cada push protegido | Histórico institucional | Dueño del repositorio |
| Evidencia UAT y actas | Por entrega | Según política documental | Líder funcional |

## Recuperación

### Restaurar base de datos

1. Declara incidente y bloquea escrituras si hay riesgo de sobrescritura.
2. Identifica la última copia válida y confirma fecha, tamaño y entorno.
3. Restaura primero en una base aislada de verificación.
4. Ejecuta comprobaciones de migración, conteos y datos críticos.
5. Obtén aprobación antes de reemplazar producción.
6. Apunta temporalmente el backend a la base restaurada o realiza el cambio controlado según el proveedor.
7. Verifica salud, login, estudiantes, documentos y una postulación de referencia.
8. Documenta incidente, RPO, RTO y causa raíz.

### Restaurar archivos

1. Verifica bucket, versión del objeto y permisos de lectura.
2. Recupera en una ruta o bucket de cuarentena cuando sea posible.
3. Valida tipo MIME, tamaño y enlace desde una ficha de prueba.
4. Solo después repón el objeto en la ubicación productiva.

## Mantenimiento

| Frecuencia | Actividad |
|---|---|
| Diario hábil | Revisar dashboard, seguimientos vencidos, entrevistas y alertas. |
| Semanal | Revisar errores de importación, auditoría, conectores y comunicación pendiente. |
| Mensual | Revisar usuarios/roles, consumo de APIs, dependencias y restaurabilidad de un backup. |
| Trimestral | Rotar credenciales sensibles, probar recuperación y revisar permisos de proveedores. |
| Antes de cada release | Ejecutar pruebas, revisar migraciones y tomar respaldo. |

## Definición de soporte

- **Bug:** una capacidad documentada falla, da un resultado incorrecto o viola permisos/seguridad.
- **Cambio menor:** ajuste de textos, configuración, catálogo o presentación sin alterar flujo de negocio.
- **Nueva funcionalidad:** flujo, integración, reporte, permiso o modelo de datos no contemplado; requiere estimación y aprobación.
- **Incidente crítico:** caída, pérdida de datos, exposición de datos o bloqueo general de acceso. Debe atenderse mediante el canal institucional acordado.

Los horarios, SLA, período de garantía y responsable final deben rellenarse en el acta contractual; no se infieren del código.

## Limitaciones conocidas y mitigación

| Situación | Efecto | Mitigación |
|---|---|---|
| Render en plan gratuito entra en reposo | Primer acceso lento, especialmente importaciones. | Mantener servicio activo mediante plan adecuado o estrategia institucional de monitoreo. |
| Archivos grandes a través de Vercel | El proxy puede rechazar cuerpos grandes. | Carga directa a S3/MinIO o límites claros de archivo. |
| Datos heredados con perfiles extensos o nombres ambiguos | Algunas filas no se actualizan automáticamente. | Usar vista previa; completar correo/documento y corregir archivo fuente. |
| Power BI sin reporte institucional conectado | La vista no puede mostrar analítica real. | Configurar URL, workspace y permisos de informe. |
| APIs externas | Pueden responder 429, cambiar contrato o quedarse sin cuota. | Timeouts, indicadores de estado, claves institucionales y monitoreo. |
| IA opcional | No debe decidir datos por sí sola ni bloquear el flujo. | Mapeo determinista primero; IA solo como rescate validado. |

## Gestión de incidentes

Para reportar un incidente, registra fecha/hora, usuario afectado, URL/módulo, pasos, captura sin datos sensibles, mensaje/código y si es reproducible. Nunca adjuntes token, contraseña, cookie ni cadena de base de datos.
