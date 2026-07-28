# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

CRM de empleabilidad del programa "Cuando sabes inglés se nota" (CAC Eurocentres, Fundación Santo
Domingo, GitLab Foundation, Compartamos con Colombia). Gestiona estudiantes, sus hojas de vida,
vacantes y el emparejamiento entre ambos.

El README describe el frontend como Angular 17 en el puerto 4200: **está desactualizado**. El
frontend real es Astro 7 + React 19 en el 3000.

## Estructura del repositorio

**El repositorio git está en el directorio padre**, no en `NOVA-CRM/`:

```
PROYECTOS CON OPENCODE/     <- raíz de git (contiene otros proyectos del usuario)
└── NOVA-CRM/               <- este proyecto
    ├── back-end/           Spring Boot 3.3 / Java 17
    └── front-end/          Astro 7 (SSR, adaptador node) + React 19
```

Los comandos `git` desde `NOVA-CRM/` operan sobre el repo padre. Al usar rutas con `git`, hay que
darlas relativas al cwd o prefijarlas con `NOVA-CRM/`.

## Regla crítica: el backend corre desde una imagen Docker

Cada vez que cambies de rama o hagas pull con cambios en `back-end/`, **hay que reconstruir
el contenedor**. El backend no lee del disco: arranca desde una imagen empaquetada. Sin
`--build` los cambios nuevos no existen dentro del contenedor.

```bash
docker compose up -d --build app
```

El frontend sí tiene recarga en caliente; por eso sin esta regla parece que falla "solo lo del
front" — el front refleja cambios al guardar, el back se queda en la versión empaquetada.

## Comandos

Todo desde `NOVA-CRM/`.

```bash
# Infraestructura (Postgres 5433, MinIO 9000/9001)
docker compose up -d postgres minio

# Backend completo en contenedor (única forma verificada de arrancarlo aquí)
docker compose up -d --build app

# Tests del backend, excluyendo el que necesita Docker
mvn -f back-end/pom.xml -B test -Dtest='!PapeleraIntegrationTest'

# Un solo test / un solo método
mvn -f back-end/pom.xml -B test -Dtest='PuntajeInglesTest'
mvn -f back-end/pom.xml -B test -Dtest='PuntajeInglesTest#unA1OralNoPuntuaAltoEnUnaVacanteDeVozQueExigeB1'

# Frontend
pnpm --dir front-end dev        # http://localhost:3000
pnpm --dir front-end build
pnpm --dir front-end exec tsc --noEmit

# Frontend simulando ir detrás de un balanceador (ver "Rate limiting" más abajo).
# Sin esto no se puede reproducir en local el comportamiento de producción.
TRUST_PROXY_HEADERS=true pnpm --dir front-end dev
```

`pnpm check` (astro check) falla: falta la dependencia `@astrojs/check`. CI usa `tsc --noEmit`.

**El frontend no tiene runner de tests.** CI se apoya en `tsc --noEmit` y `pnpm build`. La lógica
frontend que merece prueba (`src/lib/paleta.ts`) está escrita como funciones puras para que añadir
un runner no obligue a reescribirla.

Un buzón SMTP local para probar envíos sin proveedor (los captura y los muestra en
`http://localhost:8025`):

```bash
docker run -d --name nova-mailpit --network nova-crm_default -p 8025:8025 \
  -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 axllent/mailpit
```

El contenedor de la app espera el host `mailpit`; si se le pone otro nombre hay que darle ese alias
de red (`docker network connect --alias mailpit nova-crm_default <nombre>`).

`PapeleraIntegrationTest` usa Testcontainers y falla sin Docker con
`Could not find a valid Docker environment`. Es ambiental, no un defecto.

## Variables de entorno

`application.yml` lee **nombres canónicos** (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`,
`MINIO_ENDPOINT`, `AWS_REGION`), que son los que inyectan `docker-compose.yml` y `render.yaml`. Los
antiguos `NOVA_*` siguen funcionando como alias mediante defaults anidados:
`${DB_USER:${NOVA_DB_USER:novacrm}}`.

Consecuencia a tener presente: si la máquina de desarrollo tiene definidas `DB_USER`, `DB_NAME`,
`DB_PASSWORD` o `JWT_SECRET` a nivel global (para otro proyecto), la aplicación las tomará. Docker
Compose además resuelve `${JWT_SECRET}` desde el entorno del shell **antes** que desde `.env`. Al
arrancar hay que pasar los valores explícitamente:

```bash
JWT_SECRET="<el del .env>" docker compose up -d app
```

`SecurityConfig` rechaza al arrancar un `JWT_SECRET` ausente, de menos de 32 bytes, o igual a
alguno de los dos secretos que estuvieron versionados en el repositorio.

Compose solo pasa al contenedor lo que esté declarado en su bloque `environment:`. Una variable
nueva en `application.yml` no llega sola: hay que añadirla también a `docker-compose.yml`.

`TRUST_PROXY_HEADERS` es del **servidor de Astro**, no del backend, y está documentada en
`.env.example`. Viene desactivada por defecto y en producción tiene que estar en `true`.

## Arquitectura: el frontend hace de proxy

Esto es lo menos evidente del sistema y condiciona autenticación, rate limiting y despliegue.

El navegador **nunca habla con el backend directamente**. Todas las llamadas van a rutas relativas
`/api/*` del servidor Astro, y `front-end/src/middleware.ts` las reenvía a Spring. Ese middleware:

1. **Traduce la cookie a cabecera.** El token vive en una cookie `HttpOnly` que el JavaScript de la
   página no puede leer; el proxy la convierte en `Authorization: Bearer`. **No hay tokens en
   `localStorage`**; ahí solo van datos de presentación (nombre, iniciales, roles), que el backend
   revalida en cada petición.
2. **Renueva la sesión del lado servidor** y traduce el resultado a un código que el navegador pueda
   interpretar (ver la sección siguiente).
3. **Reenvía la IP real**, resuelta con `resolverIpCliente`.

**Dos rutas se saltan el proxy genérico y hay que tenerlo presente al tocarlas:** el login
(`src/pages/auth/session.ts`) y la renovación (`renovarSesion` en `src/lib/server/session.ts`).
Llaman al backend directamente para que los tokens nunca lleguen al navegador. Como no pasan por
`middleware.ts`, **tienen que reenviar la IP del cliente ellas mismas** (`cabecerasHaciaBackend`).
Olvidarlo hizo que el backend viera la misma IP para los 108 estudiantes y que cinco logins por
minuto —válidos— dejaran fuera al sexto.

## Autenticación: 401 y 403 no significan lo mismo

Confundirlos produjo dos veces el mismo síntoma —usuarios expulsados con "tu sesión expiró" cuando
no había expirado nada—, así que la regla es explícita:

- **401 = ya no estás autenticado.** Solo lo emite `middleware.ts`, y solo cuando el refresh token
  tampoco vale. Es lo único que hace a `api.ts` cerrar la sesión y mandar a `/login`.
- **403 = estás autenticado pero esto no es para ti.** Es una respuesta normal: un estudiante
  pidiendo el panel de administración recibe 403 y **debe seguir dentro**.
- **503** cuando el refresh falla por algo pasajero (rate limit, backend ocupado). La sesión sigue
  siendo buena; borrarla ahí era el núcleo del bucle.

El caso ambiguo —Spring devuelve 403 cuando un JWT vencido deja la petición como anónima— lo
resuelve el middleware antes de que llegue al navegador: intenta renovar y, si el refresh tampoco
vale, responde 401.

`GlobalExceptionHandler` mapea también los fallos que Spring dejaba caer en el manejador genérico
(ruta inexistente → 404, JSON ilegible / parámetro que falta / id con formato inválido → 400, método
no permitido → 405). Salían como 500, lo que impedía al cliente saber si reintentar y llenaba el log
de `Unhandled exception` enterrando los errores de verdad.

## Rate limiting

`RateLimitFilter` mantiene **dos cupos distintos**:

- El estricto (5/min) es solo para las rutas que aceptan una credencial: `login`, `forgot-password`
  y `reset-password` (`RUTAS_DE_CREDENCIAL`).
- **`/api/v1/auth/refresh` va al cupo general de la API**, y es deliberado. Renovar una sesión ya
  autenticada no es adivinar una contraseña; con el límite estricto, una pantalla que dispara varias
  llamadas con el token recién vencido lo agotaba sola.

Solo cree la cabecera `X-Forwarded-For` si el par inmediato está en `app.rate-limit.trusted-proxies`
(por defecto loopback y rangos privados). Si la API queda expuesta directamente a internet, esa
lista debe vaciarse o el límite es falseable.

**En producción hace falta `TRUST_PROXY_HEADERS=true` en el servicio de Astro.** El
`clientAddress` del adaptador node es la dirección del socket e ignora el `X-Forwarded-For`
entrante, que es lo correcto cuando el navegador habla directo con Astro. Detrás del balanceador de
Render esa dirección es la del balanceador, la misma para todos, y el bug del contador compartido
vuelve tal cual. `resolverIpCliente` toma la entrada **de más a la derecha** del encabezado: cada
proxy añade la dirección desde la que le llegó la petición, así que con un único proxy de confianza
las anteriores pudo escribirlas el cliente.

## Arquitectura: rutas del frontend

`src/pages/` solo contiene el puente Astro; las páginas reales son componentes React en `src/app/`
(estructura heredada del App Router de Next.js). El enrutado lo hace `src/CrmApp.tsx` con un mapa
`exactRoutes`. **Añadir una página requiere tres cambios**: el componente en `src/app/<ruta>/page.tsx`,
la entrada en `exactRoutes` de `CrmApp.tsx`, y el ítem en `src/lib/navigation.ts`.

Un archivo bajo `src/pages/` que empiece por `_` **no es una ruta**: Astro los excluye del enrutado.

Quedan referencias a Next.js en comentarios y en el fallback `NEXT_PUBLIC_API_URL`.

**Un estudiante solo puede abrir sus propias pantallas.** `CurrentRoute` en `CrmApp.tsx` comprueba
`soloEsEstudiante` + `estudiantePuedeVer` y, si la ruta no le corresponde, pinta el portal y corrige
la URL con `replaceState` —no navegando, para no dejar la pantalla prohibida en el historial donde
el botón Atrás la reabriría—. Añadir una pantalla visible para estudiantes exige meterla en
`RUTAS_DE_ESTUDIANTE` de `navigation.ts`.

Esto no es solo cosmético: sin ello el estudiante aterrizaba en `/`, que es el dashboard de
administración, y las llamadas que dispara esa pantalla devolvían 403.

## Dominio: qué es derivado y qué es capturado

**El pipeline de empleabilidad no se captura a mano.** `com.novacrm.pipeline` calcula la etapa del
embudo (`SIN_PERFIL → PERFIL_LISTO → PREPARADO → POSTULANDO → COLOCADO`) a partir de hechos que ya
registran otros módulos: HV vigente (`HvService.tieneHvVigente`), un `Seguimiento` de tipo
`SIMULACRO*` completado, las filas de `postulacion` y las de `colocacion`. La deducción vive en un
método estático puro (`PipelineEmpleabilidadService.construir`) para poder probarla sin base de datos.

**Pero no todo se puede deducir, y eso era el agujero.** Salario, canal de consecución, estado de una
postulación concreta y respuesta de una empresa son hechos que ningún módulo genera solo. Mientras no
tuvieron sitio, el equipo siguió llevándolos en `seguimiento_Nova.xlsx` y el CRM no podía sustituirlo.
Viven en `com.novacrm.postulacion`, `com.novacrm.colocacion` y en los campos de CRM de `Empresa`.

**Los cinco hitos de preparación se capturan y tienen tres estados.**
`PreparacionEmpleabilidad` (embebido en `Estudiante`) guarda `cvListo`, `cvEnIngles`,
`linkedinCreado`, `linkedinOptimizado` y `perfilOcupacional` como `EstadoHito`
(`NO | EN_PROCESO | SI`). Dos motivos, los dos medidos sobre datos reales:

- **`linkedinOptimizado` se deducía de `linkedinUserId` y era falso.** Eso es tener el perfil creado,
  no trabajado. En el seguimiento hay 74 creados y 9 optimizados: el CRM reportaba ocho veces más de
  lo que el programa había hecho.
- **"En proceso" no cabe en un booleano.** Hay 14 perfiles ocupacionales y 10 HV en inglés a medias;
  colapsarlos falsea el indicador en las dos direcciones.

**`PuntajeEmpleabilidad` replica la fórmula de la hoja, rarezas incluidas.** Pesos 0,15 / 0,15 / 0,10
/ 0,15 / 0,15 y 0,30 por estar colocado; un hito a medias aporta **0,07 fijo** —no la mitad de su
peso, es un único `IF` copiado a las cinco columnas— y el total se **trunca**, no se redondea.
Verificado contra las 107 filas: coincide en las 107, y el promedio da el 31,5 % publicado. Si se
"mejora" la fórmula, el indicador cambia de valor sin que nadie haya cambiado de situación y no habrá
forma de explicarle al financiador si la diferencia es el programa o el cambio de sistema.

## Postulaciones: lo que el estudiante actualiza llega al tablero

`Match.postulado` era un booleano y no daba para más: ni a qué, ni cuándo, ni en qué quedó. Una
persona puede tener cinco procesos vivos en estados distintos y las cinco cosas son ciertas a la vez.
`Postulacion` es una fila por proceso, con `EstadoPostulacion` (los siete estados de la hoja).

**`vacante_id` es opcional a propósito.** Muchas postulaciones salen de una feria o de un contacto
directo, y exigir una vacante registrada obligaría a inventarla. Por eso empresa y cargo van también
como texto: la postulación sobrevive a que la vacante se cierre.

**Cada cambio de estado escribe en `seguimiento`**, y ahí está el valor del módulo: el estudiante
actualiza desde su cuenta y el equipo lo ve sin transcribir nada. Se escriben hasta dos apuntes:

- Siempre uno de tipo `POSTULACION` — el rastro de lo que pasó.
- Uno de tipo `CONTACTO` **solo si la tarjeta debe moverse**, que lo decide `AvanceDelTablero`
  (clase pura). Tres reglas, todas para que el tablero no se vuelva inservible: solo hacia adelante
  (anotar una postulación nueva no devuelve a "en proceso" a quien ya tiene entrevista); un rechazo
  no mueve nada (es información del proceso, no de la persona); y de `CERRADO` no se sale solo.

**Que un estudiante marque `CONTRATADO` es una noticia, no un dato verificado.** No cuenta como
colocación: aparece en `GET /api/v1/postulaciones/pendientes-de-confirmar` para que el equipo la
registre con contrato y salario.

`MatchController.marcarPostulado` crea la `Postulacion` correspondiente, para que postularse desde
las vacantes recomendadas y anotarla a mano acaben en la misma tabla.

## Colocaciones: la cifra que se reporta

Antes solo existía `EstadoEmpleabilidad.EMPLEADO`, un valor de enum sin nada detrás. `Colocacion`
guarda empresa, cargo, fecha, salario, modalidad, contrato y `ChecklistIngreso`.

**`CanalConsecucion` es lo que distingue el impacto del programa.** `AUTOGESTIONADO` se registra
igual pero no se le atribuye: mezclarlo con `OPEN_HOUSE` o `VISITA_CAC` infla la cifra reportada con
gente que encontró trabajo por su cuenta. Va enumerado —al revés que `Postulacion.canal`, que es
texto libre— porque es categoría de reporte y tiene que ser comparable entre cohortes.

**La diferencia contra la meta no se guarda: se calcula.** La meta es
`app.colocacion.meta-salarial` (`META_SALARIAL`, por defecto 2.276.176) y sube con el mínimo cada
año; guardar la resta dejaría histórico que miente.

**Las casillas del checklist son `Boolean`, no `boolean`.** `null` es "sin revisar" y `false` es
"revisado y no cumple". Solo la segunda hay que perseguirla, y con un booleano se ven igual.

**`TipoVinculacion.FORMACION` no cuenta como empleo** y no mueve la tarjeta a `COLOCADO`.

## CRM de empresas

`Empresa` era un catálogo colgado de `Vacante`. Ahora lleva contacto, `EstadoRelacion`, próximo paso
y cargos típicos —estos permiten sugerir una empresa aunque hoy no tenga vacante publicada, que es
como trabaja el equipo—.

**Los contadores no son columnas.** Participantes, respuestas y contratados se cuentan desde
`postulacion` y `colocacion`. En la hoja eran columnas y decían "104" en todas las filas.

**Se cuentan por ficha _o_ por nombre**, y al crear una empresa se enganchan las filas huérfanas
(`vincularPorNombre`). Lo habitual es dar de alta la empresa cuando la relación ya lleva meses, así
que sus postulaciones anteriores tienen `empresa_id` nulo; contar solo por ficha dejaba en cero
justo a las empresas con las que más se ha trabajado. El enganche usa `saveAndFlush`: el `UPDATE`
masivo se salta el contexto de persistencia y sin volcar antes la fila nueva revienta la FK.

## Ofertas registradas a mano

`VacanteRequest` ya no exige enlace: pide **enlace o título** (`@AssertTrue isIdentificable`). Una
oferta de feria no tiene URL y exigirla dejaba fuera justo las que no están en ningún portal.
`jornada` (tiempo completo / medio tiempo) es distinto de `tipoContrato` (figura jurídica), y
`ciudad` es aparte de `ubicacion`, que es el texto libre del anuncio.

**`revisada` es la puerta que separa lo que entra al matching.** Un estudiante puede registrar una
oferta (`POST /api/v1/vacantes/sugeridas`): se guarda y él puede postularse, pero entra con
`revisada = false` y `MatchingService` la ignora hasta que alguien la valide. Recomendarle a los 107
participantes una oferta sin verificar es el camino por el que una estafa de empleo llega a toda una
cohorte.

**La edad se guarda como fecha de nacimiento.** `EdadParticipante.resolver` acepta además el par
(edad, fecha de captura) porque de la hoja solo se puede importar el número, y un número suelto deja
de ser cierto al año siguiente.

**El matching puntúa el inglés medido, no el declarado.** `MatchingService.puntajeIngles` usa
`PerfilIngles`, que lee `resultadoPruebaEscrita` y `resultadoPruebaOral`, no el nivel que el
estudiante declaró en el formulario. En la primera cohorte 89 de 102 participantes declararon más
nivel del que midieron sus pruebas. Para vacantes de voz (`VacanteDeVoz.esDeVoz`, heurística sobre el
texto del anuncio) se compara contra el nivel **oral**, que es donde está la brecha.

**Las vacantes se filtran por vigencia, no por `activo`.** Usar
`VacanteRepository.findVigentes(ahora, pageable)`, que además comprueba `fechaExpiracion`. Cerrar una
vacante se hace con `Vacante.cerrar(MotivoCierre, cuando)` para que quede el motivo: `EXPIRADA`,
`CUBIERTA` o `RETIRADA`.

## Identidad visual por proyecto

La plataforma aloja **varios clientes a la vez**, y cada programa puede tener su color, su
encabezado y las imágenes de sus correos (`com.novacrm.branding`, tabla `programa_branding`).

**Que no exista fila significa "usa la gama global del panel".** Es un estado válido y por eso no se
crean filas vacías al dar de alta un programa; volver a la gama global es borrar la fila, no
rellenarla con valores por defecto. `BrandingResponse.personalizado` lo dice explícito para que el
frontend no tenga que deducirlo de un color a null.

**Se pide un solo color y de él sale toda la gama.** `src/lib/paleta.ts` deriva nueve variables CSS
trabajando en HSL —las variaciones que hacen falta son movimientos de una coordenada; en RGB el tono
se desvía—. El color de texto sobre el primario se decide por luminancia WCAG, no a ojo. La paleta
se aplica escribiendo variables CSS en `<html>` desde `src/lib/branding.tsx`, así que personalizar
un proyecto no obliga a tocar ni un componente.

**Las medidas de las imágenes las manda el servidor** (`MedidasExigidas`), no están escritas en el
frontend: tenerlas en dos sitios es tenerlas distintas. Se exigen exactas y al doble del tamaño de
visualización, y el HTML del correo lleva `width` y `height` escritos —Outlook no calcula el tamaño
desde el CSS y dibujaría la imagen al tamaño del archivo, es decir al doble—. `panel-branding.tsx`
recorta y escala el archivo con un `<canvas>` a esas medidas exactas antes de enviarlo, y el
servidor lo revalida devolviendo **todos** los motivos de rechazo de una vez, no el primero.

Cuidado con dos cosas al tocar la paleta y las imágenes:

- **Las variables se escriben en línea sobre `<html>`, y eso gana a la regla `.dark`.** Un valor
  sólido pensado para fondo claro se queda puesto también de noche. Por eso `--sidebar-accent` sale
  con alfa (`hslACssAlfa`): con un sólido al 95 % de luminosidad, la fila activa del menú quedaba
  casi blanca con texto `#F8FAFC` encima. Cualquier variable nueva que sea un **fondo** debe ir
  translúcida; las de trazo o relleno con texto propio calculado pueden ser sólidas.
- **El recorte en navegador produce una `data:` URL.** Para el banner del panel es correcto, pero
  como cabecera o pie de un **correo** no sirve: Gmail descarta las `data:` URI en `<img src>` y
  Outlook de escritorio no las dibuja. Además la plantilla solo cae al texto de respaldo cuando la
  URL está **vacía**, no cuando es irrenderizable, así que el correo saldría con el hueco. Las
  imágenes de correo tienen que acabar siendo URLs públicas.

`OwnershipService.verificarAccesoPrograma` impide que un estudiante consulte el branding de otro
proyecto: saber que existe otro cliente y con qué marca opera ya es información que no le
corresponde. `GET /api/v1/branding/mio` existe para que no tenga que manejar —ni poder cambiar— el
id de un programa.

## Importación de Excel

`ExcelService` está construido alrededor de dos archivos concretos: la BBDD cruda del formulario de
admisión (columnas numeradas: `"3.9 Correo electrónico"`) y la Base Maestra de empleabilidad
(`Nombre_Completo`, `Documento`...). `ColumnMapper` normaliza los encabezados (quita tildes, la
numeración inicial y los paréntesis) y resuelve por sinónimos desde `column-synonyms.yml`.

Los mapas `BBDD_COLUMNS` y `MAESTRA_COLUMNS` de `ExcelService` están escritos sin tildes y se
consultan con el encabezado crudo, así que en la práctica **no coinciden nunca** para las columnas
acentuadas: quien resuelve es el matcher difuso. Funciona (lo cubre
`MapeoColumnasRealesTest` con los 48 encabezados reales), pero conviene saberlo antes de tocarlos.

`parseBoolean` decide por la primera palabra, no por la cadena completa: las respuestas del
formulario son frases (`"Sí, propio"`, `"No tengo la posibilidad..."`).

## Correo

Dos canales tras la interfaz `CorreoSender`, elegidos por configuración: SMTP
(`spring.mail.host` + `app.correo.remitente`) tiene prioridad; Amazon SES es el respaldo.
`EmailService.enviar` **devuelve un `Resultado`**: no se traga los fallos, porque en un envío masivo
de credenciales un error silencioso hace creer que los estudiantes recibieron su acceso.

`app.correo.destinatarios-permitidos` es una salvaguarda: mientras tenga direcciones, solo se escribe
a esas, aunque se dispare el alta de los 108 estudiantes. Vaciarla habilita el envío real.

El health check de correo está desactivado (`management.health.mail.enabled: false`): con
`spring.mail.*` declarado y sin credenciales, dejaba toda la aplicación como `DOWN`.

Las cuentas de estudiante se crean con una contraseña aleatoria que nadie conoce y se envía un enlace
de activación; no se mandan contraseñas por correo. La plantilla (`PlantillaCorreo`) usa tablas y
estilos en línea porque Outlook ignora CSS moderno, y el lema y los aliados van también como texto
porque los clientes bloquean las imágenes.

**Todo correo sale como `multipart/alternative`.** `TextoPlano.deHtml` deriva la versión de texto del
propio HTML —dos textos en paralelo se desincronizan, y el que nadie mira es el de texto plano—
conservando la URL de los enlaces, que es lo único imprescindible. Mandar solo HTML penaliza en los
filtros antispam, y en un envío de 108 enlaces de activación caer en spam es no haber enviado nada.

`MarcaCorreo` resuelve qué imágenes, medidas y color lleva cada mensaje; lo que el programa no haya
configurado cae al valor institucional. **El botón recibe el color aparte** (`boton(texto, url,
color)`): lo arma quien redacta el mensaje, antes de envolverlo, así que si no se le pasa sale azul
dentro de un correo personalizado. Su texto se decide por contraste, igual que en `paleta.ts`.

## Scraping de portales

`app.scraping.elempleo.enabled` está en **`false` por defecto y a propósito**: extraer contenido de
un portal suele estar restringido por sus condiciones de uso. Activarlo debe ser una decisión
consciente, respaldada por un acuerdo con el portal.

`RemotiveConnector` usa la API pública documentada de Remotive. Sus condiciones piden enlazar de
vuelta (de ahí que siempre se guarde `urlOrigen`) y no consultarla más de unas pocas veces al día:
por eso solo se invoca desde la tarea diaria. Filtra por región para descartar ofertas que un
candidato en Colombia no puede tomar.

Los términos de búsqueda salen del `cargoObjetivo` y `sectorObjetivo` de los propios estudiantes
(`TerminosDeBusqueda`), no de una lista fija.

## Convenciones

- Comentarios, nombres de test y mensajes de dominio **en español**. El código de producción evita
  tildes en identificadores y comentarios Javadoc; el frontend sí las usa en texto de interfaz.
- Los tests nombran el comportamiento, no el método (`unA1OralNoPuntuaAltoEnUnaVacanteDeVozQueExigeB1`).
- La lógica que merece prueba se extrae a funciones puras o clases sin dependencias
  (`PipelineEmpleabilidadService.construir`, `ClientIpResolver`, `TerminosDeBusqueda`,
  `AlertasEmpleabilidad`) para poder ejercitarla sin Spring ni base de datos.
- Autorización en dos capas: reglas por URL en `SecurityConfig` **y** `@PreAuthorize` en el
  controlador. `OwnershipService.verificarAccesoEstudiante` impide que un estudiante lea la ficha de
  otro y `verificarAccesoPrograma` que se asome a otro proyecto; las dos comprueban el rol antes de
  buscar la ficha, para que un admin sin ficha propia no reciba un 404.
- La misma decisión no se toma en dos sitios. Las medidas de imagen las manda el servidor, el umbral
  de contraste vive en `paleta.ts` y en `PlantillaCorreo.textoSobre` con el mismo valor documentado,
  y `RUTAS_DE_ESTUDIANTE` es la única lista de lo que un estudiante puede abrir.
- `OwnershipService.obtenerEstudianteAutenticado` **no crea registros**. Lo hacía, y una simple
  consulta de perfil insertaba estudiantes ficticios en un programa arbitrario.

## Datos personales

La base de desarrollo contiene datos reales de 108 participantes (nombre, documento, celular,
correo). Los archivos Excel de origen **no deben versionarse**; los tests que dependen de su
estructura usan solo los encabezados, que no son datos personales.
