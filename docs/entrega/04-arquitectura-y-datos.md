# Arquitectura técnica y datos

## Stack actual

| Capa | Tecnología usada |
|---|---|
| Frontend | Astro 7, React 19, TypeScript, Tailwind y componentes reutilizables. |
| BFF / sesión | Middleware Astro con cookies `HttpOnly`; reenvía `/api/**` al backend. |
| Backend | Java 17, Spring Boot 3.3.13, Spring Security, Spring Data JPA y Bean Validation. |
| Datos | PostgreSQL con Flyway y Hibernate en modo `validate`. |
| Archivos | Servicio compatible con S3/MinIO; el disco local no debe usarse para producción. |
| APIs | REST, OpenAPI/Swagger, Actuator (`/actuator/health`). |
| Despliegue | Vercel para frontend SSR; Render Docker para API; PostgreSQL administrado externo. |
| Integraciones | Groq opcional, SMTP/SES, WhatsApp, MinIO/S3 y fuentes de vacantes. |

## Diagrama

```text
Usuario (Admin / Coordinador / Estudiante / Empresa)
                    │ HTTPS
                    ▼
        Vercel: Astro + React + middleware de sesión
                    │ /api, JWT en cabecera interna
                    ▼
          Render: Spring Boot REST API + RBAC
           │                │                 │
           ▼                ▼                 ▼
 PostgreSQL + Flyway   S3/MinIO         Correo, WhatsApp,
                                      IA opcional y vacantes externas
```

La sesión se guarda en cookies `HttpOnly` del frontend. El navegador no recibe
el token JWT directamente; el middleware lo transforma en la cabecera que
espera el backend. Todas las decisiones de autorización relevantes ocurren en
el backend mediante Spring Security y `@PreAuthorize`.

## Estructura principal del repositorio

```text
front-end/
  src/app/             pantallas por ruta y rol
  src/components/      componentes de administración, estudiante, dashboard y UI
  src/lib/             API, preferencias, autenticación y utilidades
  src/middleware.ts    BFF, sesión, proxy y cabeceras de seguridad
back-end/
  src/main/java/com/novacrm/
    auth/ estudiante/ empresa/ vacante/ postulacion/ colocacion/
    seguimiento/ agenda/ actividad/ mensaje/ notificacion/ excel/
    matching/ pipeline/ copiloto/ configuracion/ auditoria/
  src/main/resources/db/migration/  migraciones Flyway V1 a V65
docs/
  entrega/             paquete de documentación de entrega
render.yaml            servicio API en Render
```

## Modelo lógico de datos

```text
Usuario ── roles ───────────────────────────────┐
                                                │
Programa ──< Estudiante ──< Documento / HojaVida│
                  │  │  └──< Seguimiento / Actividad / Notificación
                  │  ├────< Postulación >──── Vacante >──── Empresa
                  │  ├────< Colocación >───── Empresa
                  │  └────< Match >────────── Vacante
                  │
Empresa ──< ContactoEmpresa / Vacante / CuentaEmpresa
Postulación ── entrevista, estado, historial y posible colocación
```

## Diccionario resumido

| Entidad / tabla | Campos importantes | Relaciones y sensibilidad |
|---|---|---|
| `usuario`, `usuario_rol` | correo, hash de contraseña, activo, roles | Credenciales y roles: acceso restringido. |
| `estudiante` | nombre, documento, correo, teléfono, programa, nivel inglés, perfil y estado | Datos personales; pertenece a un programa. |
| `empresa` | nombre, sector, contacto, estado de relación, próximo paso | Relación CRM; tiene vacantes y contactos. |
| `vacante` | cargo, requisitos, ubicación, modalidad, salario, estado, empresa | Alimenta matching y postulaciones. |
| `postulacion` | estudiante, empresa/vacante, cargo, fecha, estado, entrevista | Traza del pipeline de empleo. |
| `colocacion` | estudiante, empresa, cargo, salario, fecha, contrato, checklist, activa | Historial laboral; una activa por estudiante. |
| `seguimiento`, `actividad`, `agenda` | responsable, tipo, fecha, resultado, próximo paso | Evidencia de acompañamiento. |
| `hoja_vida`, `documento` | estudiante, archivo, tipo, vigente, fecha | Archivos y datos personales; almacenamiento protegido. |
| `match_resultado` | estudiante, vacante, puntaje, explicación, estado | Resultado del motor de compatibilidad. |
| `notificacion`, `mensaje_*`, `chat_*` | destinatario, leído, conversación, adjuntos | Comunicación privada por usuario/rol. |
| `auditoria` | actor, acción, entidad, fecha y detalle | Trazabilidad de cambios relevantes. |
| `plan_importacion`, `historial_importacion` | huella de archivo, plan, origen, resultado | Permite confirmar lo previsualizado y conservar evidencia. |

## Enums relevantes

- Roles: `ADMIN`, `COORDINADOR`, `ESTUDIANTE`, `EMPRESA`.
- Empleabilidad: disponible, en proceso, postulado, entrevista, oferta,
  empleado/colocado y estados de excepción según el flujo.
- Postulación: enviada, en revisión, preselección, entrevista, prueba, oferta,
  contratado, rechazado, retirado o cerrada.
- Colocación: tipo de vinculación, canal de consecución y checklist de ingreso.

Los valores exactos se encuentran en los enums de `back-end/src/main/java` y
son la referencia para integraciones; no se deben inventar valores desde el
frontend.

## Rendimiento aplicado en esta entrega

Las pruebas de producción mostraron que cargar 250 empresas podía tardar cerca
de 16 segundos, 250 estudiantes cerca de 9 segundos y el tablero de
seguimiento cerca de 38 segundos. Se redujeron consultas N+1 en el pipeline,
tableros e importación. La pantalla de colocaciones carga primero la información
crítica y deja catálogos pesados en segundo plano.

El importador ahora carga catálogos, empresas existentes, postulaciones y
colocaciones en bloque. También evita consultar IA para hojas estándar que ya
cumplen el mapeo determinista. No requiere cambiar el esquema de base de datos.
