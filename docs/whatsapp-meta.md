# WhatsApp Cloud API — configuración para despliegue

Documento de operación: cómo dejar el canal de WhatsApp de Nova CRM
funcionando en producción. El administrador hace la parte técnica dentro del
panel (pestaña *Apariencia & mantenimiento* → *Canal de WhatsApp*); este
documento cubre lo que ocurre fuera del panel.

## 1. Requisitos en Meta Business Manager

1. Crear la app en <https://developers.facebook.com> (tipo *Business*) y
   vincularla a la cuenta de negocio.
2. Agregar el número de WhatsApp del negocio en *WhatsApp → WhatsApp Manager*.
   Debe ser un número real, con un celular disponible para la verificación
   por SMS.
3. Obtener de la app:
   - **Token de acceso permanente**: *WhatsApp → Configuración → API* (o desde
     una llamada de prueba, intercambiando el token temporal). Este token es el
     que se pega en el panel; el servidor lo cifra y nunca lo vuelve a mostrar.
   - **Phone ID** y **ID de la cuenta de WhatsApp** (empresa), visibles en la
     misma pantalla.
4. En el panel de Nova CRM: guardar número (con código de país, sin
   separadores: `573001234567`), Phone ID, token y marcar *Canal activo*.
   Usar el botón **Enviar mensaje de prueba**: llega al WhatsApp del número
   del negocio y confirma token, phone ID y alcance sin necesidad de
   plantillas.

## 2. Variables de entorno del servidor

| Variable | Para qué |
|---|---|
| `WHATSAPP_TOKEN_KEY` | Clave (≥ 32 caracteres) que cifra los tokens en la base. Fijarla antes del primer guardado; si cambia, los tokens guardados quedan ilegibles. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Secreto de suscripción del webhook; el mismo valor se pega en Meta. |
| `WHATSAPP_APP_SECRET` | Secreto de la app de Meta; valida la firma `X-Hub-Signature-256` de cada evento. |

Sin `WHATSAPP_TOKEN_KEY` el servidor rechaza guardar el token del canal.

## 3. Webhook

Dirección (debe ser una URL pública con HTTPS):

```
https://tu-dominio/api/v1/whatsapp/webhook
```

En *WhatsApp → Configuración → Webhook*:
- **Callback URL**: la dirección anterior.
- **Verify token**: el valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- Suscribir el campo **messages**.

Los botones de las plantillas llegan por aquí y el sistema los entiende sin
configuración adicional (responde *Sí me interesa* → se marca el match como
postulado; *No, gracias* → se descarta).

## 4. Plantillas (las aprueba Meta, tardan horas o días)

Crear en *WhatsApp Manager → Plantillas de mensajes*, **idioma Español
(Colombia)**, categoría *Utilidades* o *Marketing* según la plantilla. Los
nombres son fijos; los `{{1}}`, `{{2}}`… son los valores que envía el sistema
en ese orden. Si una plantilla no existe o está rechazada, los avisos se
omiten silenciosamente (el correo y la bandeja interna siguen funcionando).

### nova_match — aviso de vacante recomendada

Categoría: **Marketing**. Botones: **quick reply**.

```
Hola, {{1}}: encontramos una nueva vacante que puede interesarte: {{2}}
en {{3}}. Responde para que el equipo te contacte. 😃
```

- `{{1}}` nombre del estudiante
- `{{2}}` título de la vacante
- `{{3}}` empresa
- Botón **Sí me interesa** (respuesta rápida)
- Botón **No, gracias** (respuesta rápida)

### nova_cuenta — activación de cuenta del estudiante

Categoría: **Utilidades**.

```
Hola {{1}}: tu cuenta en Nova CRM quedó activa. Ingresa con este enlace
para completar tu perfil: {{2}}
```

- `{{1}}` nombre del estudiante
- `{{2}}` enlace de activación

### nova_anuncio — anuncio del coordinador

Categoría: **Marketing**. Solo se envía si el coordinador marca *enviar por
WhatsApp* al publicar el anuncio.

```
{{1}}

{{2}}
```

- `{{1}}` título del anuncio
- `{{2}}` cuerpo del anuncio

## 5. Costos

Meta cobra por **conversación** iniciada por el negocio (aprox. USD 0.03 en
Colombia, sujeto a cambios). Una conversación de 24 horas agrupa todos los
mensajes al mismo estudiante. Las respuestas del estudiante (botones) inician
la ventana de 24 horas a su favor, que es gratis. Sin plantilla aprobada, el
negocio solo puede iniciar conversación con su propio número (de ahí el
botón de prueba).

## 6. Puesta en marcha

1. Desplegar con las tres variables de entorno definidas.
2. Configurar el canal en el panel y enviar mensaje de prueba.
3. Crear las tres plantillas y esperar aprobación.
4. Conectar el webhook (Meta llama a `/api/v1/whatsapp/webhook`).
5. Publicar un anuncio de prueba con *enviar por WhatsApp* marcado.
