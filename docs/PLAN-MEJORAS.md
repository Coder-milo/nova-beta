# Plan de mejoras — NOVA CRM

Backlog ordenado. **Cada iteración cierra un punto entero antes de empezar el
siguiente**, y lo marca aquí. Verificación obligatoria antes de dar algo por
hecho: `npx tsc --noEmit` en `front-end/` y `mvn -o compile` en `back-end/`.

Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecho

---

## Auditoría contra Zoho CRM y Salesforce

Medidos en vivo sobre cuentas reales (agosto 2026). Lo que **tienen los dos y
nosotros no**:

**Revisada en agosto de 2026, al cerrar los trece puntos.** La columna NOVA dice
el estado de hoy, no el del día que se escribió la tabla.

| Funcionalidad | Zoho | Salesforce | NOVA | Estado |
|---|---|---|---|---|
| Vistas de lista guardadas y compartidas | Sí | Sí | **Sí** | Punto 4 |
| Filtros combinables en la lista | Sí | Sí | **Sí** | Punto 4 |
| Línea de tiempo por registro | Sí | Sí | **Sí** | Punto 6 |
| Kanban arrastrable del pipeline | Sí | Sí | **Sí** | Punto 7 |
| Acciones en lote sobre selección | Sí | Sí | **Sí** | Puntos 5 y 13 |
| Detección de duplicados al importar | Sí | Sí (reglas) | **Sí** | Punto 8 |
| Asistente de mapeo de columnas | Sí | Sí | **Sí** | Punto 8, con plan repetible |
| Portal externo (clientes / socios) | Portals | Experience Cloud | **Sí** | Puntos 1-3 |
| Responsable de un registro | Sí | Sí | **Sí** | Punto 13 |
| Registro de correos en la ficha | Sí | Sí | Parcial | Se ve la plantilla, no el envío |
| **Tareas con responsable y vencimiento** | Sí | Sí | **No** | → punto 17 |
| **Notas sueltas en el registro** | Sí | Sí | **No** | → punto 17 |
| **Reglas de asignación automática** | Sí | Sí | **No** | → punto 18 |
| **Constructor de informes** | Sí | Sí | **No** (fijos + 2 bancos) | → punto 19 |
| **Formulario público de captación** | Web-to-Lead | Web-to-Lead | **No** | → punto 19 |

> Lo que **no** se copia de ellos, y por qué: reglas de flujo de trabajo con
> disparadores encadenados, objetos personalizados y permisos por campo. Los
> tres existen porque Zoho y Salesforce se venden a empresas que no se parecen
> entre sí. Aquí el dominio es uno —empleabilidad de una cohorte— y cada uno de
> esos tres añade una capa de configuración que alguien tiene que mantener a
> cambio de flexibilidad que este programa no necesita.

Lo que **sí tenemos y está bien**: búsqueda global, auditoría, branding por
proyecto, matching, scraping de portales, generación de HV en formato ATS,
WhatsApp y chat interno. Nada de esto necesita tocarse.

---

## Backlog

### 1. Portal de empresas — modelo y acceso · HECHO
- [x] Rol `EMPRESA` y vínculo usuario ↔ empresa (`Usuario.empresa`)
- [x] Invitación por correo desde el panel, sin auto-registro abierto
      (`CuentasEmpresaService`, enlace de 3 días); revocar corta las sesiones
      abiertas vía `credencialesDesde`
- [x] Reglas de visibilidad en `AccesoDelPortal`: el permiso se pregunta sobre
      la **postulación**, no sobre el estudiante — si retira su candidatura deja
      de ser visible sin revocar nada
- [x] `PerfilLaboralDto` como lista blanca: fuera documento, dirección,
      teléfono, correo personal y notas internas
- [x] Migración V54 con disparador que impide una cuenta EMPRESA sin empresa
- [x] `SecurityConfig`: `/api/v1/portal/**` solo rol EMPRESA, y una cuenta
      EMPRESA **no alcanza nada fuera de ahí**
- [x] `AccesoDelPortalTest` — 10 casos, casi todos negativos. Pasan 10/10

> **Lo que decide este punto**: qué ve una empresa de un estudiante. Solo lo
> laboral —HV, habilidades, proyecto formativo, disponibilidad—. Nunca documento
> de identidad, dirección, notas internas del equipo ni estado socioeconómico.

### 2. Portal de empresas — publicar vacante · HECHO (backend)
- [x] `PortalVacanteService` + `PortalVacanteController` en `/api/v1/portal/vacantes`
- [x] Todo lo que publica una empresa nace **sin revisar**, igual que lo que
      registra un estudiante y por el mismo motivo ya escrito en
      `Vacante.revisada`. Que quien publique sea una empresa registrada no
      cambia nada: registrarse es barato y el daño es el mismo
- [x] **Editar una vacante publicada la devuelve a la cola de revisión.** Sin
      esto la moderación sería decorativa — se aprueba un texto limpio y
      después se cambia por otro. Es el caso que da sentido a los tests
- [x] Estados sin enum nuevo: `borrador` (V55) + `revisada` + `activo` +
      `motivoCierre`. Un enum de cuatro valores habría obligado a migrar cada
      consulta que hoy pregunta por `revisada` o `activo`, a cambio de nada
- [x] Ningún endpoint recibe el id de empresa: sale de la sesión. Aceptarlo por
      parámetro dejaría publicar en nombre de otra con el rol correcto
- [x] Cerrar sin motivo cuenta como RETIRADA, nunca CUBIERTA: suponer que se
      cubrió inflaría las cifras de colocación del cierre de cohorte
- [x] `PortalVacanteServiceTest` — 8 casos. **18/18** con los del punto 1
- [x] Interfaz: `/portal/vacantes` con listado, formulario y borradores. El
      aviso de «esto vuelve a revisión» sale **antes** de escribir, no al
      guardar: enterarse después de reescribir el texto entero es la forma de
      que nadie corrija una errata
- [x] **Rechazo con motivo** (V56). Hasta ahora la moderación solo sabía decir
      que sí: lo único que se podía hacer con una oferta dudosa era cerrarla, y
      quien la publicó veía «Cerrada» sin saber qué corregir, así que volvía a
      mandar lo mismo. Una puerta que solo se abre no es una revisión
- [x] `RECHAZADA` es un estado distinto de `CERRADA`: la vacante sigue viva y
      editable. Cerrarla obligaría a escribirla otra vez desde cero, que es la
      forma segura de que no la corrija nadie
- [x] El motivo es **obligatorio** en el endpoint. Un rechazo sin explicación
      deja a quien publicó igual que antes de publicar
- [x] Corregir borra el reproche (`olvidarRechazo`), en editar, reenviar y
      aprobar. Si no, la empresa reenvía la corrección y sigue viendo el motivo
      anterior encima de un texto que ya no dice eso
- [x] `GET /vacantes/cola-revision`: excluye borradores —quien redacta no ha
      pedido nada— y ya rechazadas —la pelota está del otro lado—. Las del
      portal primero: hay alguien esperando
- [x] El motivo se muestra **dentro del formulario**, donde se corrige. Leerlo
      en el listado obliga a memorizarlo y volver
- [x] **Corregido un defecto propio**: el panel de revisión afirmaba «la
      registró un participante» también en las vacantes del portal. Ahora el
      origen sale de `fuente`
- [x] 2 tests nuevos del ciclo rechazo → corrección → reenvío. **23/23**

### 3. Portal de empresas — ver postulantes · HECHO (backend)
- [x] `PortalPostulanteService` + controlador en `/api/v1/portal/postulantes`
- [x] **No existe ningún endpoint que reciba un id de estudiante.** Se entra por
      la postulación o por la vacante, que es lo que la empresa posee. Un
      `GET /estudiantes/{id}`, aun con permisos, sería una puerta al censo:
      bastaría probar identificadores
- [x] `PerfilLaboralDto` ajustado a los campos reales. Fuera quedan documento,
      fecha de nacimiento, género, nacionalidad, dirección, barrio, teléfonos,
      correo, foto, tokens de LinkedIn y estado académico
- [x] **Tampoco salen las otras postulaciones** del candidato: saber que habla
      con otras tres empresas se usaría para negociar, y el estudiante no se lo
      ha dado a nadie
- [x] La empresa **no puede marcar CONTRATADO**. Es una noticia, no un hecho
      verificado: la colocación con contrato y salario la registra el equipo, y
      de ahí salen las cifras del cierre de cohorte
- [x] `PerfilLaboralNoFiltraDatosTest` — guardián por reflexión sobre el record.
      **Comprobado que falla en rojo** al meter un campo prohibido; el mensaje
      explica que es un cambio de qué sale de la institución, no de código
- [x] `JOIN FETCH` de programa y nivel de inglés, y las habilidades en una sola
      consulta: una vacante con 40 candidatos eran 80 viajes a la base
- [x] Interfaz: `/portal/postulantes`, en fichas y no en tabla — una empresa
      compara cuatro candidatos leyendo su perfil, no escanea doscientas filas
- [x] La pantalla **explica por qué no está el botón de contratar**. Un botón
      ausente sin explicación se lee como una carencia del sistema
- [x] Enrutado: `soloEsEmpresa` + `empresaPuedeVer` en `CrmApp`, con el mismo
      guardián que ya protegía al estudiante. Una cuenta de empresa fuera de
      `/portal` se corrige con `replaceState`, sin dejar la ruta en el historial
- [x] **Agendar desde el portal**, reutilizando `FormularioCita` de verdad.
      El componente tenía el endpoint del panel cableado dentro y una cuenta de
      empresa no lo alcanza —`SecurityConfig` la corta fuera de `/portal`—, así
      que ahora recibe la función que guarda. Es lo que evita duplicarlo y que
      las dos copias se separen con el tiempo
- [x] `POST /portal/postulantes/{id}/cita` **no recibe estado**: poner fecha ya
      significa citar, y el dominio lo deduce. Pedirle además elegir el estado
      en un desplegable es pedirle repetir lo que acaba de hacer
- [x] Tampoco recibe el correo del contacto: el sistema ya lo tiene por la
      cuenta con la que entró, y pedirlo otra vez acaba en dos direcciones para
      el mismo interlocutor
- [x] El botón «Citar» abre el formulario en vez de mover el estado a ciegas:
      agendar sin decir cuándo deja al candidato sabiendo que hay entrevista
      pero no cuándo, que es peor que no moverlo
- [x] Cancelar la cita **no revierte el estado**: que se caiga una cita no
      significa que el proceso muera, y decidirlo por la empresa borraría un
      rechazo o una entrevista ya realizada

### 4. Vistas guardadas y filtros en listas · HECHO (estudiantes)

> Lo que resuelve no es el ahorro de clics. Mientras cada coordinador
> reconstruye «los activos sin colocar» a mano, dos personas que dicen mirar lo
> mismo miran conjuntos distintos y las cifras de la reunión no cuadran sin que
> nadie sepa por qué. Una vista compartida es un acuerdo sobre qué significa
> esa frase.

- [x] Entidad `VistaGuardada` + `ModuloDeVista` (V57), servicio y controlador
- [x] **Compartir da lectura, nunca escritura.** Si cualquiera pudiera cambiar
      la vista que el equipo usa a diario, la cambiaría sin que el resto se
      entere y volveríamos al problema que esto viene a resolver
- [x] **Repetir el nombre sobrescribe la propia** en vez de fallar: quien vuelve
      a guardar «Sin colocar» está corrigiendo la suya, no creando una segunda
      que después no sabría distinguir. La carrera entre dos guardados a la vez
      cae en el índice único y se traduce al mismo mensaje
- [x] Filtros como JSON opaco: cada módulo filtra por cosas distintas y una
      tabla con la unión de todas las columnas sería mayormente nulos, más una
      migración por cada filtro nuevo. El precio —la base no valida el
      contenido— se asume porque el peor caso es filtrar de menos
- [x] Se valida que **sea JSON y un objeto** al guardar. Una cadena rota daría
      una vista que revienta al abrirla, semanas después y en la pantalla de
      otra persona
- [x] Al aplicar, **las claves desconocidas se ignoran**: una vista de hace
      meses puede traer un filtro que ya no existe
- [x] Que fallen las vistas no rompe la lista: son una comodidad encima de una
      pantalla que funciona sin ellas
- [x] `VistaGuardadaServiceTest` — 8 casos. **31/31** en total
- [x] Montado en Estudiantes, encima de los filtros: se elige antes de filtrar,
      porque abrir una vista *pone* los filtros
- [x] Montado también en **Vacantes** (fuente + búsqueda) y **Empresas**
      (búsqueda + sector + estado). En Empresas el estado se valida contra el
      catálogo al aplicar: una vista vieja con un valor retirado dejaría el
      filtro en un estado imposible y la lista saldría vacía sin explicación

### 5. Acciones en lote · PARCIAL

Auditado: **ya existía** más de lo que decía este punto. Estudiantes tiene
columna de selección, «todos los de esta página», y en lote: marcar hito,
restaurar de papelera y borrar (`bulk-delete`). No hacía falta tocarlo.

- [x] **Exportar la selección** a CSV. Usa `lib/csv.ts`, que ya resuelve lo de
      Excel —separador `;` y BOM, o las filas caen en la columna A y «Medellín»
      sale roto— y prefija las celdas que empiezan por `= + - @`, que Excel
      evaluaría como fórmula
- [x] Exporta **lo que hay en pantalla**, sin volver a pedirlo al servidor: la
      selección es sobre las filas que la persona ve, y recargarlas abriría la
      puerta a que el archivo no coincida con lo que acaba de marcar
- [x] **Sin datos de contacto ni documento en el CSV.** Un archivo así se
      reenvía por correo sin pensarlo, y ese es el camino por el que los datos
      de una cohorte acaban fuera. Para eso está el informe formal, que deja
      rastro
- [x] El botón va antes de los destructivos: separar lo reversible de lo que no
      lo es evita el clic equivocado con cuarenta filas marcadas

> **«Asignar responsable» no se puede hacer todavía.** `Estudiante` no tiene
> campo de responsable ni existe el concepto en el modelo. No lo invento aquí:
> decidir si el responsable es por estudiante, por proyecto o por etapa cambia
> el diseño entero y merece su propio punto. Añadido como punto 13.

### 6. Agenda de citas y línea de tiempo · HECHO
- [x] Página `/agenda` con vista semanal, registrada en rutas y en el menú
- [x] **La cola de vencidas va arriba, no al final.** Es lo único de la pantalla
      que exige una acción hoy: ya pasó la hora y siguen agendadas — o se hizo y
      nadie lo anotó, o la persona no se presentó. Sin sacarlas aparte quedan
      enterradas en el pasado del calendario, donde nadie vuelve a mirar
- [x] `FormularioCita` **por fin tiene botón que lo abre**, en la agenda y en el
      portal. Llevaba cuatro turnos construido sin punto de entrada
- [x] La semana empieza en lunes, que es como la cuenta el equipo
      (`getDay()` da 0 el domingo y hay que corregirlo)
- [x] Siete columnas solo en escritorio; apiladas por debajo. Un calendario de
      siete columnas en un móvil son celdas de 50 px donde no cabe un nombre
- [x] **Línea de tiempo por estudiante**, uniendo postulaciones, entrevistas,
      seguimiento, documentos y colocaciones
- [x] **Se compone en el servidor, no en el cliente.** En el navegador serían
      cuatro peticiones que hay que esperar todas antes de pintar, una mezcla y
      un orden repetidos en cada pantalla y —lo que lo decide— ningún modo de
      limitar: con cuatro listas sueltas no se puede pedir «los últimos treinta»
      sin traérselo todo primero. Tope de 60
- [x] **La entrevista es un hito aparte de la postulación**, en su propia fecha.
      Agruparlas bajo el día en que se postuló dejaría la cita fuera de sitio en
      la línea, que es justo donde se busca
- [x] Una fecha sin hora se ancla **al mediodía, no a medianoche**: a medianoche
      quedaría antes que cualquier cosa de la tarde anterior al invertir el
      orden. La pantalla detecta el mediodía exacto y oculta la hora, para no
      hacer creer que todo pasó a las 12:00
- [x] Lo que no tiene fecha va **al final, no al principio**: un registro sin
      fecha no es «lo más reciente», es un dato incompleto
- [x] Solo se hace pulsable lo que lleva a algún sitio. Una lista donde todo
      parece enlace y la mitad no lo es enseña a no pulsar nada
- [x] Documentos: solo la versión vigente. Un contrato resubido cuatro veces
      llenaría media historia con la misma entrega
- [x] Montada en la ficha del estudiante, **antes** de la ficha de empleabilidad:
      «qué ha pasado con esta persona» es la pregunta previa a cualquier otra

### 7. Kanban de postulaciones · HECHO

> **No duplica el tablero de seguimiento**, que ya existía. Aquel responde «cómo
> va esta persona» (`EstadoContacto`); este, «cómo va este proceso»
> (`EstadoPostulacion`). La misma persona puede tener una entrevista agendada en
> una empresa, un rechazo en otra y tres postulaciones calladas — con un solo
> estado por estudiante habría que elegir una y perder las demás. Es la razón
> que ya estaba escrita en el propio enum.

- [x] `GET /postulaciones/tablero` con filtro opcional por proyecto: el tablero
      de una cohorte es inservible si trae las cuatro a la vez
- [x] **Solo estados vivos.** Contratado, rechazado y sin respuesta son finales:
      una columna para ellos sería un cementerio que crece sin parar y empuja
      fuera de pantalla lo que sí hay que mover. La pantalla **dice** que no
      salen y dónde encontrarlos, en vez de dejar pensar que se perdieron
- [x] Devuelve lista plana, no un mapa por columna: agrupar en el backend
      pondría el orden de las columnas del lado del servidor, y eso lo decide
      la pantalla
- [x] **Aviso a los 14 días sin respuesta.** El silencio es el dato que se
      pierde: una postulación contestada se mueve sola, la que nadie contesta se
      queda en su columna sin que nada la señale
- [x] Mover a «entrevista agendada» sin fecha **avisa antes**, no después: si no,
      el estudiante sabe que hay cita pero no cuándo
- [x] El cambio se pinta antes de que responda el servidor y se revierte si
      falla. Arrastrar y ver la tarjeta volver a su sitio medio segundo se
      siente como un fallo aunque acabe funcionando
- [x] Reutiliza el patrón de arrastre del tablero de seguimiento
- [x] Proyectos pasa a `FolderKanban`: con dos tableros en el menú, el mismo
      icono para los dos no distingue nada

### 8. Mapeo de importaciones · HECHO

Auditado con OpenCode y **verificado a mano**. Lo que ya funciona bien y no hay
que tocar: `ColumnMapper` con sinónimos y solape de palabras, previsualización
obligatoria antes de escribir, y deduplicado de empresas por clave normalizada.

- [x] **Historial para los tres importadores.** La tabla existía pero solo la
      escribía el de participantes: las cargas de empresas, vinculaciones y
      libro no dejaban rastro, y una que metió cuarenta filas equivocadas no se
      podía ni datar
- [x] `RegistroDeImportaciones` compartido en vez de copiar el bloque tres
      veces: la primera vez que alguien añada un campo lo añadiría en uno solo
- [x] **Las simulaciones no se registran.** Una previsualización no cambia nada;
      anotarla llenaría el historial de líneas que no corresponden a ningún dato
- [x] **Nunca lanza.** Perder el apunte es malo; tirar por tierra una
      importación que ya escribió sus filas porque falló el apunte, peor
- [x] Columna `origen` (V58): con tres importadores en la misma tabla,
      «40 registros» no dice si eran participantes, empresas o vinculaciones —
      y son tres cosas que se corrigen distinto
- [x] El libro deja **una línea, no una por pestaña**: se sube de una vez y se
      deshace de una vez; seis pestañas parecerían seis importaciones
- [x] Visible en la pantalla de Importaciones, como etiqueta: en una tabla de
      veinte filas, tres valores repetidos se leen antes por forma que leyendo
- [x] **Colisión dentro del mismo archivo**, resuelta. Que una fila corrija una
      colocación *ya guardada* es deliberado —una vigente por estudiante— pero
      frente a otra fila del mismo archivo la segunda pisaba a la primera **en
      silencio**, y el resumen contaba las dos como importadas: la persona
      acababa con un solo empleo y nadie sabía cuál se perdió
- [x] Ahora se avisa y se salta, no se pisa: cuál de las dos filas vale lo sabe
      quien hizo el archivo, no nosotros
- [x] `ColisionEnElMismoArchivoTest` — 2 casos, incluida la simulación: si la
      previsualización dijera «2 creados» y la real hiciera 1, estaría mintiendo
      justo sobre el caso que viene a detectar
- [x] **La previsualización no garantiza lo que se graba**, resuelto. Simular y
      ejecutar eran dos llamadas que analizaban el archivo por separado. El
      motivo exacto, verificado en el código y no supuesto: `sugerirDestino`
      **no se memoriza nunca**, lo que sí se memoriza (`sugerirCampo`) vive en
      el proceso y tiene tope de 500, y el presupuesto de 25 consultas por libro
      más los 429 del tier gratuito de Groq hacen que la segunda pasada corte en
      otro punto. Cuando corta, las columnas sin resolver caen al diccionario y
      **desaparecen del mapeo sin error ninguno**: la importación sale verde y
      le falta una columna
- [x] La previsualización guarda su análisis (`PlanDeImportacion`, V60) y
      devuelve su `planId`; la importación real lo trae de vuelta y lo aplica
      tal cual, sin volver a consultar a la IA. Sale además más rápida y sin
      pagar el análisis dos veces
- [x] Se compara la **huella SHA-256 del contenido**, no el nombre: un archivo
      corregido entre las dos pantallas se sigue llamando igual, y aplicarle el
      plan de la versión anterior escribiría columnas cambiadas de sitio sin
      fallar nada —encajan los tipos, se leen las filas, el resumen sale verde—
- [x] En la base y no en memoria: entre revisar y confirmar cabe un
      redespliegue, y perder el plan obliga a repetir el análisis, que es justo
      lo que se quería evitar. Los caducados se borran solos a las 6 h
- [x] Plan ajeno, caducado o inexistente dan **el mismo mensaje**: distinguirlos
      no le sirve a quien carga y sí diría qué identificadores existen
- [x] `PlanQueSeRepiteTest` (5) y `PlanesDeImportacionTest` (6). El primero
      amaña la IA para que conteste una vez y calle después —que es literalmente
      el caso del 429— y comprueba las dos ramas: con plan la columna sobrevive,
      sin plan **desaparece en silencio**. La rama del defecto está aserida
      aparte para que se vea qué se está evitando
- [x] Verificado arrancando contra Postgres real, no solo con los tests. La
      primera versión de V60 puso `CHAR(64)` y Hibernate se negó a arrancar
      (`wrong column type [huella]: found bpchar, expecting varchar`) — el mismo
      fallo que V57, y otra vez invisible para los tests por el H2 con
      `create-drop`. Corregido **dentro de V60**, que no había salido de local:
      un V61 para una errata que no llegó a ningún sitio es cicatriz permanente
- [x] ~~Mostrar las columnas ignoradas~~ — **ya estaba hecho**. Se verificó:
      `importador-crm.tsx:250` las lista desde antes. La auditoría lo dio por
      pendiente y no lo era; queda anotado para no «arreglarlo» otra vez

### 9. Scraper · HECHO

Auditado con Antigravity y **verificado a mano**. Ya funciona: deduplicado en
dos niveles —`hashDedup` por portal y `hashContenido` entre portales— con las
carreras de inserción absorbidas.

- [x] **`activas.parallelStream()` con E/S bloqueante**, resuelto con pool
      propio. El `commonPool()` es de toda la aplicación y está dimensionado
      para CPU —núcleos menos uno—; en una máquina de dos núcleos tiene **un**
      hilo. Lo que se rompía no era el scraping, que acababa: era cualquier otra
      parte de la aplicación que usara un stream paralelo mientras tanto, y se
      quedaba en cola detrás de una petición a Computrabajo. Es la clase de
      fallo que no aparece en el módulo que lo causa
- [x] Cuatro hilos como mucho, con nombre (`scraping-N`) y demonios. Más hilos
      no aceleran espera de red y sí multiplican las peticiones simultáneas al
      mismo portal, que es como se provoca el 429 que luego hay que reintentar
- [x] **Tope de 8 min para la fase de red**, que no existía: una fuente que
      aceptaba la conexión y no respondía dejaba la corrida abierta y la diaria
      se solapaba con la siguiente. Lo cancelado consta como error, no como
      «sin novedades»
- [x] **Reintento con espera creciente ante 403/429** (`ReintentoConEspera`),
      compartido por Computrabajo y Elempleo. Se respeta `Retry-After` cuando el
      portal lo manda —es la única cifra fiable— con tope de 20 s, porque un
      `Retry-After: 3600` dejaría la corrida colgada. El desajuste aleatorio no
      es adorno: sin él, dos fuentes que reciben el mismo 429 vuelven a llamar a
      la vez y se lo ganan otra vez
- [x] El 403 se reintenta como el 429: el de estos portales es del cortafuegos
      por ritmo y se levanta solo. Uno permanente cuesta dos esperas y falla
      igual, que es lo correcto
- [x] **N+1 de `SmartRecruitersConnector` acotado** a 40 detalles por empresa.
      Eran hasta 200 llamadas en serie a 15 s de tope: la fuente sola podía
      comerse la corrida. Lo que pasa el tope **entra igual, sin descripción**;
      media vacante es mejor que ninguna
- [x] `MagnetoScraper`: el javadoc y `application.yml` decían «desactivado a
      propósito» y **el código tenía `:true` por defecto**. Bastaba desplegar sin
      esa clave para que se encendiera solo contra una SPA que no puede
      devolver nada. Los tres sitios dicen ya lo mismo
- [x] **Registro de ejecución consultable** (`/api/v1/vacantes/scraping/ejecuciones`
      + `RegistroDeScraping` en la pantalla de Vacantes), con estado
      CORRECTA / PARCIAL / FALLIDA. «Parcial» va aparte a propósito: entraron
      ofertas y además algo falló, y pintarla verde porque el total salió bien
      es como se dejan de ver las caídas parciales
- [x] **Desglose por portal** (V61). Se descubrió al mirar los datos reales: la
      tabla solo guardaba `vacantes_nuevas` —las que quedaron tras deduplicar—,
      así que «0 nuevas y sin errores» no distinguía entre traer 40 ofertas ya
      conocidas (sano) y no traer nada porque cambió el HTML (roto). Sin eso, el
      registro no respondía la pregunta para la que existe
- [x] Nulo = «no se registró», nunca cero: las corridas anteriores a la columna
      no se pueden juzgar, y un cero por defecto las marcaría como rotas
- [x] `ReintentoConEsperaTest` (11), `PoolPropioDelScrapingTest` (7) y
      `EjecucionDeScrapingTest` (7). El del pool asierta el **nombre del hilo**:
      es lo único que distingue de verdad un pool propio del común
- [x] Verificado con una corrida real: 121 vacantes nuevas en 63 s;
      `ELEMPLEO=320, COMPUTRABAJO=440, REMOTIVE=36, SMARTRECRUITERS=10,
      ARBEITNOW=0`, con ARBEITNOW marcado en la fila sin desplegarla

> **Para mirar**: ARBEITNOW devolvió 0 en esa corrida. Puede ser legítimo —solo
> conserva ofertas con patrocinio de visado— o puede ser el síntoma. Es
> exactamente la duda que el registro viene a resolver: si sigue en cero varios
> días seguidos, está roto.

> Corregido de paso: Elempleo y Computrabajo **no están muertos**, al contrario
> de lo que sugería la nota de BE-16. Traen 320 y 440 ofertas por corrida.

> No es defecto, aunque las dos auditorías lo señalaron: reservar el cupo de
> JSearch **antes** de llamar es correcto —el proveedor cobra la petición
> aunque falle— y está explicado en `JSearchConnector:124`.

### 10. Portal del estudiante · HECHO

- [x] **Ve sus citas.** El modelo guardaba la entrevista desde el punto 6, y la
      veían el equipo en la agenda y la empresa en su portal. **La única que no
      la veía era quien tiene que presentarse**: se enteraba por WhatsApp, si
      alguien se acordaba de escribirle
- [x] `ProximasCitas` en el inicio y en «Mi calendario», y la fecha en cada fila
      de «Mis postulaciones». Arriba de las alertas: una entrevista tiene hora
      de caducidad y «completa tu perfil de LinkedIn» no
- [x] Trae lo que hace falta para ir: cuándo, modalidad, dónde, con quién y a
      qué teléfono —pulsable, que es como se usa camino de la entrevista—. El
      «cuánto falta» se dice en días y solo pasa a horas el mismo día: «En 34 h»
      no le sirve a nadie para organizarse
- [x] Sin citas no pinta nada. Una tarjeta que dice «no tienes entrevistas»
      ocupa el mejor sitio de la pantalla para dar una no-noticia
- [x] **Fuga cerrada por tres puertas.** `/postulaciones/mias` devolvía el mismo
      `PostulacionResponse` que usa el panel: el estudiante recibía —en la
      respuesta, la pintara o no la pantalla— **quién de la institución lleva su
      caso**, la **fecha del próximo seguimiento interno** y el **correo del
      reclutador**. Y volvía por otras dos: `GET /postulaciones?estudianteId`
      admitía rol ESTUDIANTE, y la respuesta del `PATCH` de cambio de estado
      traía el registro entero
- [x] `MiPostulacion` como lista blanca, más `PATCH /mias/{id}`; las dos rutas de
      gestión pasan a COORDINADOR/ADMIN. Es el mismo corte que ya se hizo en
      `VacanteController` y en `PerfilLaboralDto`: cuando la regla es la misma
      tres veces, conviene que el tipo también lo diga
- [x] `contactoTelefono` **sí** viaja y `contactoEmail` no: el correo es el canal
      por el que el equipo negocia la cita, el teléfono es a quién llama el
      estudiante si se retrasa. Ocultarle el segundo sería proteger el dato
      equivocado
- [x] `MiPostulacionNoTraeGestionTest` — 3 casos, incluido uno que comprueba que
      el recorte **no se pasa de celoso** y la cita llega entera
- [x] Verificado contra el servidor con una sesión de estudiante real: sin
      fuga, `403` en las dos rutas de gestión, y la cita completa en pantalla
- [x] Geometría del inicio del estudiante alineada con el resto del portal:
      tenía cuatro radios distintos (`3xl`, `2xl`, `xl`, `lg`) en una sola
      pantalla mientras las demás usan dos. Ahora dos

> **Lo que NO se hizo, y por qué.** «Rediseño con el lenguaje del panel» choca
> con una decisión ya escrita en `globals.css`: el portal **conserva su cristal
> a propósito** porque son dos públicos distintos —el estudiante entra a leer un
> aviso y se va, y ahí la atmósfera aporta; el equipo pasa el día en tablas—.
> Aplicarle la densidad plana del panel sería deshacer eso. Se hizo la parte que
> sí era mejora objetiva —la geometría inconsistente— y se deja el resto: si se
> quiere el cambio de fondo, es una decisión de producto, no de refactor.

### 11. Barrido de iconografía · HECHO

- [x] **66 archivos migrados, 555 iconos, 141 nombres distintos.** Cero imports
      de Phosphor en el código y la dependencia **desinstalada**: quedaban dos
      juegos de iconos en el mismo bundle sirviendo para lo mismo
- [x] El mapeo se escribió a mano y después se **validó contra los 6.068 exports
      reales de `lucide-react`** antes de tocar un archivo. Importa porque un
      nombre parecido pero equivocado compila igual: `tsc` no distingue un icono
      correcto de uno que existe
- [x] Se conserva el alias local (`Search as MagnifyingGlass`) en vez de renombrar
      los usos. El diff queda en la línea del import y el JSX no se toca: un
      barrido de 66 archivos que además renombra variables es un diff que nadie
      revisa
- [x] **`weight` no existe en Lucide**, que es de trazo y solo tiene
      `strokeWidth`. Los 20 `duotone` eran iconos decorativos de cabecera en
      `text-primary`: quitar el peso los deja en trazo, que es el lenguaje del
      panel. Los 16 `fill` fueron uno a uno
- [x] Solo el **corazón** conserva el relleno (`fill="currentColor"`): un corazón
      lleno y uno vacío no dicen lo mismo. El `CheckCircle` relleno **no** se
      convirtió: en Lucide el círculo y el check son dos trazos, así que
      rellenarlo del mismo color **borra el check**
- [x] **Los tres logotipos —WhatsApp, LinkedIn, Instagram— salen a
      `iconos-de-marca.tsx`.** Lucide retiró las marcas del paquete a propósito:
      un logotipo no es un icono de interfaz, lo dibuja su dueño y no se
      reestiliza. Mantener Phosphor entera por tres marcas era cargar mil iconos
      por tres
- [x] Van rellenos y sin `strokeWidth`: así se dibujan las marcas y así se
      reconocen. Solo heredan el color, que es hasta donde llega lo razonable
      con la marca de otro
- [x] Corregido de paso: `quick-access` y `stat-card` importaban el tipo como
      `LucideIcon as PhosphorIcon`. El alias mentía sobre de dónde venía el tipo
- [x] Verificado con la dependencia **ya desinstalada** —así un import olvidado
      no puede compilar—: `tsc --noEmit` 0 errores. Y en el navegador, diez
      pantallas con **0 SVG vacíos**; los tres logotipos con sus trazados reales
      y su color de marca (LinkedIn en su `#0A66C2`). Consola sin errores

> Un icono equivocado compila y se pinta igual de bien que el correcto. Por eso
> la comprobación de esto no fue `tsc`, sino contar SVG vacíos pantalla por
> pantalla y mirar los tres logotipos, que son los únicos que no podían salir de
> un mapeo automático.

### 12. Gráficos del dashboard y los dos bancos de informes · HECHO

Lo que separa los dos bancos no es el contenido: es **a quién va dirigido el
archivo**, y eso no estaba en ninguna parte.

- [x] **Banco de perfiles laborales** (`perfiles-laborales`), el que se manda
      fuera. Existe porque cuando una empresa pedía candidatos, lo que había a
      mano era el reporte de estudiantes —y ese lleva **documento, correo y
      celular**—. Salía del CRM, se adjuntaba a un correo y ya estaba fuera de
      la institución. Nadie decidió ceder esos datos: era el botón que estaba ahí
- [x] Mismas columnas que ve una empresa en su portal (`PerfilLaboralDto`) y por
      el mismo motivo: para decidir a quién se entrevista hace falta el perfil,
      no la cédula. El nombre sí va —un perfil anónimo no sirve para convocar a
      nadie—, y si la empresa quiere contactar, pasa por el equipo
- [x] `vacanteId` acota a quienes se postularon a **esa** oferta, que es lo que
      una empresa puede preguntar: por lo suyo
- [x] «Sin preguntar» y «dijo que no» se distinguen en movilidad. En una hoja,
      una celda vacía y un «No» se leen igual y no significan lo mismo
- [x] **Banco panorama** (`panorama`), el interno. Junta lo que antes obligaba a
      exportar cuatro informes y armarlos a mano en el comité, y lo **dibuja**:
      «38 activos, 12 colocados» son dos números; la misma barra al lado de la
      otra es una proporción, que es lo que se mira en una reunión
- [x] Cuatro indicadores + seis gráficos: estado académico, programa, ciudades,
      nivel de inglés, estado de las postulaciones y colocaciones por mes
- [x] Barras en HTML/CSS, no SVG: openhtmltopdf no trae el módulo de SVG y meter
      Batik por seis gráficos de barras sería cargar un renderizador entero para
      dibujar rectángulos. Además imprimen bien en blanco y negro
- [x] La barra se mide **contra el mayor del gráfico**, no contra el total: con
      seis categorías repartidas, medir contra el total deja todas las barras
      cortas y el gráfico no dice nada
- [x] Los meses sin colocaciones se dejan **en cero y visibles**: un hueco en la
      serie se lee como «no hay dato», y aquí el dato es que ese mes no colocó a
      nadie. Un gráfico entero en cero, en cambio, se cae del informe
- [x] «Sin dato» es una categoría, no un hueco: veinte participantes sin ciudad
      registrada es justo lo que hay que ver
- [x] En xlsx y csv el panorama entrega las mismas cifras en tabla. Quien pide el
      csv de un gráfico quiere los números
- [x] `BancoDePerfilesNoLlevaDatosPersonalesTest` — **comprobado que falla en
      rojo**: se añadió una columna «Documento» y el test la cazó con el mensaje
      de por qué esa decisión no es de quien escribe el diff
- [x] Verificado contra la base real: banco de perfiles con **128 filas, 0
      correos y 0 rachas de 7-11 dígitos** en todo el archivo —no solo en las
      cabeceras—; panorama con **0 de los 108 nombres** de la cohorte
- [x] El PDF comprobado por dentro: 62 caminos rellenos, 27 en azul CAC, con 13
      anchos distintos proporcionales al dato. El texto extraído no prueba nada
      de las barras, porque las barras no son texto

> **Corregido de paso, en mi propia copia**: la tarjeta del panorama decía «este
> sí lleva datos personales». Era falso —son solo agregados, ni un nombre— y una
> etiqueta de seguridad equivocada es peor que ninguna.

---

### 13. Responsable de un estudiante · HECHO

Salió al hacer el punto 5: no se podía asignar responsable en lote porque el
concepto no existía en el modelo. **Decidido por quien lleva el programa
(agosto 2026): por estudiante.**

- [x] Se descartó **por proyecto** —los 108 participantes están en un solo
      programa, así que «mis estudiantes» le devolvería los 108 a una persona y
      no repartiría nada— y **por etapa**, que es más fiel a cómo trabaja un
      equipo de empleabilidad pero cuesta el doble. Por etapa **se puede añadir
      encima** más adelante sin deshacer esto: una segunda columna
- [x] **El hallazgo que enmarcó la decisión**: ya había cinco campos que suenan
      a responsable —`programa.responsable`, `seguimiento.responsable`,
      `postulacion.gestionadaPor`, `actividad.responsable`, `vacante.creadaPor`—
      y **los cinco son texto libre sin enlace a `usuario`**. En la base ese
      texto guardaba tres cosas a la vez: correos de personas reales, la
      etiqueta «Equipo NOVA» que no es nadie, y cadena vacía junto a NULL como
      dos formas de decir «nada»
- [x] Esos cinco **no se tocan**, y no es descuido: son la **traza** de quién
      hizo cada cosa aquel día y tienen que quedarse congelados aunque la
      persona se vaya. Reasignar un caso no puede reescribir el historial. Lo
      que se crea es lo otro: la **propiedad** del caso, que sí es enlace vivo
- [x] `estudiante.responsable_id` → FK a `usuario` (V62), con
      `ON DELETE SET NULL`: si se borra la cuenta de quien acompañaba a alguien,
      el participante queda **sin responsable** —hueco visible y reasignable—,
      no borrado con ella. Índice parcial: al principio casi todo estará sin
      asignar y no tiene sentido indexarlo
- [x] Asignación **en lote**, que es lo que faltaba: repartir ciento y pico de
      uno en uno es lo que hace que el equipo vuelva a la hoja de cálculo
- [x] `responsableId` nulo **quita** el responsable. No es un caso raro: es como
      se libera el trabajo de alguien que deja el programa, y por eso el
      desplegable lo dice —«Quitar responsable»— en vez de un «— elige —» mudo
- [x] Reasignar a quien ya lo tenía **no cuenta**: contarlo inflaría el «42
      actualizados» que se le enseña a quien pulsa
- [x] El desplegable lleva **cuántos lleva ya cada quien**, y se recarga tras
      asignar. Repartir a ciegas es como una persona acaba con ochenta y otra
      con seis
- [x] Solo COORDINADOR y ADMIN pueden ser responsables. Se comprueba **en el
      servicio**, no solo en el desplegable: el endpoint lo recibe por parámetro
- [x] `GET /por-responsable` sin id devuelve los **sin asignar**, no todos: es
      la lista que hay que mirar para repartir, y confundirla con «todos» dejaría
      el reparto sin pantalla
- [x] Verificado contra la base real: 3 asignados → repetir da **0** → el
      desplegable pasa a 3 → «mis estudiantes» 3 y sin asignar 105 (**3+105=108**)
      → asignar a una cuenta EMPRESA se **rechaza** → liberar deja 0. Y el ciclo
      completo por la interfaz, con el diálogo de confirmación y el aviso
- [x] La base queda como estaba: 0 con responsable, 108 activos

> **Corregido de paso**: `AltaDuplicadaTest` construía `EstudianteService` con la
> aridad vieja. `mvn compile` no lo vio porque no compila los tests; lo cazó el
> build de Docker. Desde ahora conviene `mvn -o test-compile`, no solo `compile`.

### 14. Configuración del admin, entendible · HECHO

- [x] **Siete secciones donde había seis, y cada una significa una sola cosa.**
      Tres de los seis nombres llevaban «&», que es la señal de que la sección
      era dos cosas. La peor: «Apariencia & Mantenimiento» juntaba la identidad
      que ve el cliente, el canal de WhatsApp, tu tema claro/oscuro y los
      botones de «Desactivar todo» y «Limpiar CRM transaccional»
- [x] **La zona de peligro es su propia sección y solo la ve un ADMIN.** Antes
      se llegaba a ella por el camino —abrías esa pestaña para poner el modo
      oscuro y pasabas por encima—; ahora hay que elegir entrar. Un coordinador
      ya ni ve la sección: un botón deshabilitado que no explica por qué es peor
      que no estar
- [x] **WhatsApp pasa a «Conexiones»**, con el correo, la IA y los portales. Es
      un canal de salida, no una preferencia de apariencia — y la placa de
      integraciones, que lista correo, IA, almacenamiento y scraping, **no lo
      incluye**, así que quien lo buscaba por ahí no lo encontraba
- [x] **La marca del proyecto tiene sección propia.** Es lo que el cliente ve en
      cada correo y cada informe; estaba junto al tema, que solo lo ve quien lo
      pulsa
- [x] **«Mis preferencias» separa lo que solo te afecta a ti.** Tema e idioma no
      son configuración del sistema
- [x] **Buscador de ajustes.** Con siete secciones y una treintena de ajustes,
      encontrar uno significaba abrirlas todas: la memoria de dónde está cada
      cosa la tiene quien lo configuró, no quien lo usa. Busca también por
      palabras que **no** están en el título —«logo», «Groq», «umbral»—, porque
      se busca por la palabra que uno tiene en la cabeza
- [x] Tarjetas en vez de pestañas: en una pestaña solo cabe un nombre corto, y
      por eso los nombres eran «Apariencia & Mantenimiento». En la tarjeta cabe
      la frase que dice qué hay dentro
- [x] **Cero cambios de funcionalidad**, que era la condición. Los diez paneles
      siguen siendo los mismos componentes con las mismas llamadas; lo único que
      cambia es en qué sección viven
- [x] Corregido de paso: el tablero de integraciones le decía a un COORDINADOR
      «Inicia sesión como ADMIN o COORDINADOR» —el mensaje compartido— cuando el
      endpoint es solo ADMIN. Le mandaba hacer lo que acababa de hacer
- [x] Verificado en el navegador recorriendo las siete secciones: los diez
      paneles aparecen, el buscador acierta con `logo`, `whatsapp`, `umbral`,
      `contrasena` y `oscuro`, y la zona de peligro conserva sus cinco botones

---

## Pendiente

### 15. Interfaz del estudiante · HECHO

- [x] **La hoja de vida no aparecía en «qué me toca».** La lista de pendientes
      cubría perfil, LinkedIn creado, LinkedIn optimizado y documentos, pero
      `hitoCvListo` y `hitoCvIngles` estaban en el tipo y **no se usaban en todo
      el portal**: el artefacto central de un programa de empleabilidad, que
      además vale el 30% del puntaje, nunca se le pedía al estudiante
- [x] **`MiRuta`: los seis pasos en orden, con su peso.** El portal enseñaba un
      porcentaje suelto —«31%»— y los hitos repartidos entre pantallas. Un 31%
      no dice si falta la hoja de vida o si falta que lo contraten: la pregunta
      no es «cuánto llevo», es **«qué hago ahora»**
- [x] Son **seis** y no cinco: la colocación pesa el 30%, casi un tercio.
      Omitirla habría dejado la ruta sumando 70 y al estudiante sin ver que el
      último paso vale el doble que cualquier otro
- [x] Se enseña **el peso de cada paso** porque no valen igual —la hoja en
      inglés vale tanto como la de español—, y sin verlo la ruta parece una
      lista de recados
- [x] La colocación aparece bloqueada y con «lo registra tu asesor»: no la marca
      el estudiante. Un paso sin explicación de por qué no se puede tocar se lee
      como que la aplicación está rota
- [x] Solo se hace pulsable lo que lleva a algún sitio, y el «por qué» solo
      aparece en lo que falta: en lo ya hecho es ruido que aleja del pulgar el
      paso que sí importa
- [x] Los pesos salen a `lib/ruta-empleabilidad.ts`: son dato del dominio
      —copian `PuntajeEmpleabilidad`, la fórmula con la que el programa reporta
      a su financiador— y no decoración de un componente
- [x] `ruta-empleabilidad.test.ts` — 4 casos. Fija que sumen 100, que coincidan
      con los del backend, que la colocación sea el mayor, y que el aporte de un
      hito a medias sean 7 puntos fijos y **no** la mitad del peso: es una
      rareza heredada de la hoja y alguien la «arreglaría»
- [x] Verificado contra el backend con un estudiante sembrado a medias: la ruta
      muestra **22%** y la API devuelve 22 —15 del perfil ocupacional + 7 del
      hito en proceso—. Si los pesos estuvieran mal, ese número no cuadraría
- [x] «Termina tu hoja de vida» sale marcado como **Sigue** por ser el primer
      paso sin cerrar que depende del estudiante; el paso hecho oculta su
      explicación; la colocación sale bloqueada
- [x] Móvil comprobado a 375 px: sin desborde horizontal y los seis pasos por
      encima del mínimo táctil de 44 px

> **Lo que no se hizo**: reordenar las nueve áreas del portal. Con la ruta
> arriba, la portada ya responde «qué me toca» sin tocar la navegación, y mover
> nueve secciones es un cambio que conviene hacer viendo por dónde entra la
> gente de verdad, no adivinando.

### 16. Interfaz del coordinador · HECHO

Tres cosas construidas y sin puerta de entrada. Ninguna era un rediseño: era
enchufar lo que ya existía.

- [x] **La pantalla de Estudiantes abría en un programa vacío.** Elegía
      `list[0]`, el primero que devolviera el servidor: con «Ruta Bolivar» (0
      participantes) y «Ruta Accelerator» (108), lo primero que veía un
      coordinador al entrar a la pantalla donde está todo su trabajo era **«no
      hay estudiantes»**
- [x] Ahora manda lo último que eligió esa persona; si no hay memoria, el que
      tiene gente. Un programa vacío es un destino válido —se acaba de crear—
      pero nunca un buen sitio donde aterrizar
- [x] Se recuerda **al cambiar**, no al cargar: guardar la elección automática
      la convertiría en «elegida por la persona»
- [x] **«Los míos» y «Sin asignar»**, que el backend servía desde el punto 13 y
      ninguna pantalla llamaba: el filtro estaba hecho y no se podía usar
- [x] Los dos juntos y no en un desplegable: son las dos preguntas que se hacen
      de verdad —«qué llevo yo» y «qué no lleva nadie»—, y la segunda es la que
      hace falta para repartir
- [x] Un solo estado y no dos casillas: salen del mismo endpoint —la ausencia de
      `responsableId` **es** el filtro de «sin asignar»— y dos casillas podrían
      quedar marcadas a la vez pidiendo cosas contrarias
- [x] **Las entrevistas llegan al tablero.** El dato y las dos consultas existen
      desde el punto 6, y las alertas del dashboard —seis— no mencionaban
      ninguna: vivían en `/agenda`, que hay que acordarse de abrir
- [x] `ENTREVISTA_HOY` con la hora y el nombre de la primera: es lo único de esa
      lista que tiene hora. Y `ENTREVISTA_SIN_CERRAR`, que es la que cuesta más
      cuanto más se tarda —o se hizo y falta el resultado, o no se presentó, y
      distinguirlo a las tres semanas ya no se puede—
- [x] Verificado en vivo: sin memoria previa la pantalla abre con **20 filas** en
      vez de vacía; «Los míos» da 0 y, tras asignarme 3 por la barra en lote, da
      3 y esos tres desaparecen de «Sin asignar». Las dos alertas nuevas
      aparecen al crear las citas y con los datos correctos
- [x] Los datos de prueba, borrados: 108 estudiantes, 0 asignados, las 2
      postulaciones originales

> Queda fuera «quién lleva tres semanas sin movimiento»: necesita una consulta
> nueva y, sobre todo, decidir qué cuenta como movimiento —¿una nota?, ¿una
> postulación?, ¿un cambio de hito?—. Es una definición del programa, no una
> consulta. Va al punto 17, con las notas y las tareas.

### 17. Notas y tareas por registro · PARCIAL

**El punto estaba mal planteado y la auditoría se equivocó.** Al ir a
construirlo, casi todo existía:

- [x] ~~Notas con autor y fecha en el estudiante~~ — **ya estaba**. `Seguimiento`
      es exactamente eso: `observacion` (la nota), `responsable`, `fecha`, y con
      formulario completo en la ficha del estudiante
- [x] ~~Tareas con responsable y vencimiento~~ — **ya estaba**, en los mismos
      registros: `proximaAccion` + `fechaProxima` + `estado`
- [x] ~~Las vencidas arriba~~ — **ya estaba**. `findVencidos` alimenta las
      alertas del tablero vía `AlertasEmpleabilidad.porSeguimientosVencidos`. No
      aparecían en mi recuento de «seis alertas» porque se generan aparte, no
      con un `AlertaResponse` literal
- [x] **Lo que sí faltaba, y era peor de lo que decía el punto: en la empresa el
      hilo era una mentira.** `ContactoEmpresa`, sus dos DTO y la tabla existían
      desde la migración V9 con **cero filas para siempre**: nadie los escribía
      ni los leía, no había repositorio ni endpoint
- [x] Cada acercamiento se **concatenaba a un campo de texto** de la ficha:
      `"2026-08-16: llamé y no contestan"` pegado al anterior. Eso parece un
      hilo y no lo es — sin autor por línea, corregir una obliga a editar el
      bloque, no se puede ordenar ni contar, y **dos personas guardando a la vez
      se pisan**, porque las dos leyeron el mismo texto antes de añadir la suya
- [x] Ahora se escribe una fila por acercamiento, con el autor sacado del token,
      y `GET /empresas/{id}/contactos` devuelve el hilo, lo más reciente primero
- [x] `empresa.notas` **se queda como está**: son las notas generales de la
      ficha y además llegan desde la importación de Excel. Lo que deja de hacer
      es acumular el historial
- [x] Verificado contra la base: dos apuntes escritos, los dos con
      `coordinador@local.test` y su fecha, y el campo `notas` **intacto**
- [x] **La pantalla, hecha**: `HiloDeContactos` en la ficha de la empresa. Cada
      apunte con su asunto, su fecha y **su autor**, lo más reciente arriba: al
      abrir una ficha la pregunta es «¿en qué quedamos?», no «¿cómo empezó»
- [x] Se cerró una regresión que yo mismo había abierto: la ficha pintaba
      `seleccionada.notas`, el bloque concatenado. Al dejar de concatenar, ese
      panel habría dejado de mostrar las notas nuevas para siempre
- [x] Las notas generales de la ficha **siguen visibles**, pero rotuladas como
      lo que son y separadas del historial. Antes compartían sitio y por eso se
      confundían: unas vienen del Excel, las otras son el trabajo del día
- [x] El hilo se recarga al guardar sin cerrar la ficha. Sin eso, la nota recién
      escrita no aparece hasta reabrir, y quien la escribió cree que se perdió
- [x] Verificado en el navegador: dos apuntes con `coordinador@local.test`, en
      orden, y el estado vacío cuando no hay ninguno
- [ ] **«Sin movimiento en tres semanas»**, que viene del punto 16. Con
      `Seguimiento` y ahora `ContactoEmpresa` como fuentes, la pregunta pendiente
      sigue siendo cuál de las dos cuenta como movimiento
- [ ] **«Sin movimiento en tres semanas»**, que viene del punto 16. Antes de la
      consulta hay que decidir qué cuenta como movimiento: ¿una nota?, ¿una
      postulación?, ¿un cambio de hito? Con notas y tareas en el modelo la
      respuesta es más fácil, y por eso se aparcó aquí

### 18. Reglas de asignación de responsable · HECHO

- [x] **Apagada por defecto** (V63, `configuracion_global.regla_asignacion`), y
      no es prudencia de más: la advertencia que quedó escrita en este punto
      —una regla que no coincide con cómo trabaja el equipo se desactiva la
      primera semana, y hasta entonces asigna mal— se resuelve obligando a que
      alguien la encienda. Una regla heredada por defecto no la decidió nadie
- [x] **Un solo modo, y las alternativas se descartaron por motivos concretos.**
      Por programa: los 108 están en uno solo, así que los asignaría todos a la
      misma persona —el mismo motivo por el que se descartó el responsable «por
      proyecto» en el punto 13—. Por ciudad: obliga a mantener un mapa
      ciudad→persona, y las ciudades entran del Excel como texto libre; hay
      filas con «Otro» y con «Sin dato»
- [x] `ROTATIVO` reparte **al de menos carga en ese momento**, no con un puntero
      que rota. Un puntero necesita estado guardado y se descoloca en cuanto
      alguien entra, sale o se le reasignan casos; mirar quién lleva menos no
      guarda nada y se corrige solo
- [x] **Nunca pisa una asignación hecha a mano**: quien la puso sabía algo que
      la regla no sabe
- [x] **Nunca lanza.** Que falle el reparto no puede tumbar un alta ni una
      importación de trescientas filas; sin responsable es un estado normal y la
      pantalla tiene el filtro «Sin asignar» justo para eso
- [x] Una regla desconocida en la configuración se trata como apagada, no como
      «elige una»: repartir según una regla que nadie escribió es peor que no
      repartir
- [x] Solo reparte entre cuentas del equipo activas. Una cuenta de baja tiene
      cero casos y sería siempre «la de menos carga»
- [x] A igualdad de carga el desempate es estable (por correo). Al azar, dos
      altas seguidas irían a personas distintas y el reparto dejaría de poder
      explicarse
- [x] `AsignacionAutomaticaTest` — 8 casos, casi todos negativos: lo que fija no
      es que funcione, es que **no se dispare sola**
- [x] Corregido de paso: `getRoles()` puede ser nulo —lo asume ya
      `Usuario.esCuentaDeEmpresa`— y tanto el reparto nuevo como el filtro de la
      asignación en lote del punto 13 lo llamaban sin guarda. Un NPE ahí dejaba
      sin responsable a todo el mundo

### 19. Constructor de informes y captación pública · HECHO

- [x] **Constructor de informes, hecho.** `POST /reportes/personalizado/export`
      con las columnas que se pidan, en xlsx, csv o pdf, y los filtros de
      programa, ciudad y estado académico
- [x] **Catálogo cerrado, no SQL libre** (`ColumnaDeInforme`): 23 columnas
      declaradas como funciones Java sobre `Estudiante`. Un constructor que
      aceptara nombres de campo sería un generador de consultas contra la base
      expuesto por HTTP — da igual cuánto se escape, el siguiente que añada un
      campo decide sin querer qué sale de la institución
- [x] **Comprobado**: pedir `(SELECT password FROM usuario)` como columna
      devuelve «Columna no disponible para informes», y pedir cero columnas
      también se rechaza —un archivo vacío parece un fallo del sistema—
- [x] Seis columnas van marcadas como **personales** (documento, correo,
      celular, teléfono, dirección, barrio). No se bloquean —el equipo puede
      exportar su censo— pero quedan señaladas: el informe de estudiantes ya
      salía por correo con documento y celular sin que nadie lo hubiera
      decidido, y de ahí nació el banco de perfiles del punto 12
- [x] Una columna que no existe **se nombra en el error** en vez de omitirse: un
      archivo al que le falta una columna en silencio parece correcto
- [x] **Pantalla hecha** (`constructor-de-informes.tsx`, dentro de Reportes).
      Las columnas salen del catálogo que sirve el backend, no de una lista
      copiada en el frontend: si viviera aquí, añadir un campo al modelo lo
      metería en el informe sin que nadie lo revise
- [x] Las seis columnas personales van **en su propio bloque, con el aviso al
      lado de las casillas** y no en un pie de página: quien las marca está a un
      clic de adjuntar el archivo a un correo. El pie recuerda cuántas van
      marcadas —«6 elegidas · 2 de ellas identifican o contactan a una persona»—
- [x] **El orden de las columnas es el del catálogo**, no el orden en que se
      marcaron: dos personas que elijan lo mismo tienen que obtener archivos
      iguales o dejan de poder compararse
- [x] La ciudad es **lista y no caja de texto**, y para eso se añadió
      `GET /reportes/ciudades`. El filtro compara por igualdad y la ciudad entró
      del Excel como texto libre: hoy hay cinco valores y uno es «Otro».
      Escribir «Bogota» donde la ficha dice otra cosa devolvía cero filas en
      silencio, y un informe vacío no se distingue de uno sin resultados
- [x] Sin columnas marcadas los botones están desactivados —y el servidor lo
      rechaza igual—: las dos puertas, porque la del cliente se puede saltar
- [x] Va **después de los dos bancos**: esos cubren los dos casos frecuentes y
      el constructor es para cuando ninguno sirve. Primero, convertiría cada
      descarga rutinaria en una decisión de veintitrés casillas
- [x] **Formulario público de captación, hecho.** `POST /api/v1/publico/vacantes`
      sin autenticar, y la pantalla en `/publicar-vacante`. Hoy una empresa que
      llega por su cuenta no tiene por dónde entrar: las cuentas del portal son
      por invitación
- [x] **Nace sin revisar** y entra en la cola de moderación que ya existía, por
      lo ya escrito en `Vacante.revisada`
- [x] **Y además no se ve hasta que alguien la lee**, que es más de lo que hace
      la cola. Una oferta sugerida por un participante sí se ve sin revisar —la
      escribió alguien conocido y solo se le niega el matching—; esto lo escribe
      un desconocido de internet, y enseñarlo antes sería publicar lo que mande
      cualquiera. El listado excluye `FORMULARIO_PUBLICO` mientras no esté
      revisada
- [x] **No enlaza con ninguna empresa del CRM.** El alta interna busca la empresa
      por nombre; aquí eso dejaría que un desconocido publique como «Tecnoglass»
      y que la empresa real lo viera entre las suyas en su portal. El nombre
      queda como texto declarado (V64) y el enlace lo hace una persona al aprobar
- [x] **No lee ninguna URL, y por eso no hay campo de enlace.** El alta interna
      completa datos leyendo la página de la oferta; sin autenticar eso convierte
      al servidor en un cliente HTTP a las órdenes de cualquiera, capaz de
      alcanzar direcciones internas que desde fuera no se ven
- [x] **No manda ningún correo**, ni de confirmación. La dirección no está
      verificada: escribirle convierte el formulario en un relay —se pone el
      correo de una víctima y el sistema le escribe— y delata si existe
- [x] **No crea ninguna cuenta.** Un formulario público que crea credenciales es
      un alta de usuarios abierta a internet
- [x] **Tres ofertas por hora y por dirección**, con su propio contador en
      `RateLimitFilter`: con el general —cien al minuto— una sola máquina llena
      la cola en una tarde, y compartiendo el del login cada envío gastaría
      intentos de inicio de sesión de quien salga por esa misma IP. Regulable
      por `RATE_LIMIT_PUBLICO_MAX` sin tocar código
- [x] Corregido de paso un agujero que abría el límite nuevo: el purgador
      olvidaba contadores a los 30 minutos, así que con una ventana de 60 el cupo
      se recuperaba esperando. El TTL nunca baja de la ventana más larga
- [x] **Campo trampa** escondido, fuera del recorrido del teclado y del lector de
      pantalla —una persona ciega no puede caer en una trampa que no ve—. Se
      rechaza con un mensaje claro en vez de fingir que se guardó: si un
      autocompletado se lo llena a alguien de verdad, tiene que poder corregirlo
- [x] **Reenviar lo mismo no duplica**: huella sobre empresa y cargo, sin
      distinguir mayúsculas. El botón pulsado tres veces no son tres ofertas que
      alguien tenga que leer y descartar una por una
- [x] La respuesta es **siempre la misma frase, sin identificador**, y el código
      es 202 y no 201: no se ha creado nada que quien envía pueda ver
- [x] En la cola de revisión se ve **quién la mandó, marcado como sin verificar**,
      con correo y teléfono para poder contestar. Sin eso, lo único que se puede
      hacer con una oferta pública es aprobarla a ciegas o descartarla. Esos
      datos son de gestión: no viajan al estudiante, igual que `creadaPor`
- [x] `CaptacionPublicaServiceTest` (9 casos) y dos casos nuevos en
      `RateLimitFilterTest`
- [x] `NingunEndpointSinAutorizacionTest` lo cazó solo y obligó a apuntarlo en
      `PUBLICOS_A_PROPOSITO` **con el motivo escrito**. Es lo que tenía que
      pasar: un endpoint público no se cuela, se declara
- [x] **Fallo aparte encontrado por el camino**: `findVigentes` —el listado que
      ve el estudiante— no excluía los borradores, aunque `Vacante.borrador` dice
      que «no lo ve nadie más que quien lo escribe». Una empresa redactando en su
      portal aparecía en el listado. Estaba latente (0 borradores hoy); corregido
      en la misma consulta

---

## Hecho

- [x] Quitar el modelo 3D del asistente y volver al zorro plano en SVG
- [x] Campos de cita y contacto en `Postulacion` (V53) + endpoints de agenda
- [x] Lenguaje visual de consola tipo Zoho: lateral con acordeones, densidad,
      cabecera de pantalla, barra de utilidades
- [x] Migración del cromo a Lucide

### Fotos del chat: falso positivo, no defecto

- [x] `fotos.test.ts` marcaba en rojo dos imágenes del chat del estudiante
      (`src={fotoChat}`). **No estaban rotas**: `fotoChat` se compone una vez con
      `fotoDeGrupo(…)` o `fotoDe(…)` y se pinta en dos sitios
- [x] El guardián exigía ver la llamada **dentro del propio `src`**, y eso
      obligaba a repetir un ternario de tres líneas en los dos usos: peor código
      para contentar a una comprobación
- [x] Ahora acepta también una variable compuesta en el mismo fichero. Se sigue
      exigiendo lo mismo —que la ruta pase por un ayudante—, solo que puede
      verse una línea más arriba
- [x] **Comprobado que sigue mordiendo**: se inyectaron dos violaciones reales
      —el campo pelado y una variable que no pasa por ayudante— y las cazó las
      dos. 28/28 en verde

## Descartado, con motivo

- **Power BI incrustado**: sin licencia solo cabe «Publicar en la web», que hace
  el informe público. Con datos de estudiantes, no. Se construye la analítica
  nativa y se deja una vista SQL de solo lectura por si se compra licencia.
- **Iconos animados de Flaticon**: licencia con atribución obligatoria en cada
  pantalla, y la animación permanente compite con los datos en una herramienta
  de trabajo.

### 20. Scraping bilingüe y mapa del Atlántico · HECHO

Los dos salen de lo mismo: el programa es de **empleabilidad bilingüe en el
Atlántico**, y ni el rastreo ni el panel lo sabían.

**El rastreo ahora busca en bilingüe**

- [x] **Núcleo fijo que se busca siempre** —«bilingue», «call center bilingue»,
      «asesor bilingue», «bpo»— en español y no en inglés: las ofertas de
      Computrabajo y Elempleo están escritas en español aunque el trabajo sea en
      inglés, y «bilingue» a secas es el término con el que las empresas del
      Atlántico publican estas plazas
- [x] **Corregido un fallo de fondo en cómo se elegían los términos.** Se tomaban
      los ocho primeros de un `SELECT DISTINCT` sobre `cargoObjetivo`, y como
      cada participante escribe el suyo eran 108 cadenas únicas en el orden que
      quisiera la base: la corrida podía buscar «bilingual special education
      teacher» —un caso— y no «bilingual customer service agent», que es a lo
      que apunta media cohorte. Ahora se cuenta la frecuencia **después de
      trocear**, que es donde los trozos sí coinciden entre fichas
- [x] Lo que declara una ficha solo entra **si habla de inglés o de BPO**. Hay
      fichas que apuntan a diseño o a docencia; buscar eso gasta consultas en
      ofertas que la cohorte no puede tomar
- [x] El orden es **estable**: dos corridas seguidas sobre la misma cohorte
      buscan lo mismo. Si cambiara, no habría forma de saber si un portal dejó de
      responder o es que se le pidió otra cosa
- [x] **`FiltroBilingue`**: lo que llega sin mencionar el idioma no se guarda.
      Buscar «bilingue» acerca pero no basta —el buscador devuelve también
      «asesor comercial»—
- [x] **No cuentan como prueba de inglés** ni el nombre de la empresa —los
      grandes BPO del Atlántico contratan también campañas en español— ni el
      cargo escrito en inglés —«Customer Service Agent» titula plazas
      enteramente en español—. Un «B2» solo cuenta si está pegado a una palabra
      de idioma: «operario zona B2» no es bilingüe
- [x] Lo que ya nace en inglés (`REMOTO_INGLES`) no se examina: pedirle a
      Remotive que además diga «bilingüe» sería descartarla entera
- [x] **Cuántas se descartan queda escrito en la corrida** (V65,
      `descartadas_por_idioma`) y se ve en el registro de rastreo. Un filtro que
      descarta en silencio es indistinguible de un portal caído: los dos se leen
      como «0 nuevas»
- [x] **Comprobado contra los portales reales**: la corrida trajo 1.934 ofertas,
      descartó 750 por no exigir inglés y guardó 112 nuevas — todas bilingües
      («Agente bilingue C1 con exp en BPO», «Customer service agent / C1
      English», «Call Center Bilingüe»)
- [x] `FiltroBilingueTest` (9 casos) y cinco casos nuevos en
      `TerminosDeBusquedaTest`

**Mapa del Atlántico en el panel**

- [x] Los **23 municipios** del departamento, con el conteo de participantes
      activos encima. `GET /dashboard/mapa-atlantico?programaId=`
- [x] **Un solo endpoint para «todos» y para un proyecto concreto**: dos que
      calculen lo mismo con un filtro de diferencia acaban divergiendo, y el
      total de uno deja de cuadrar con la suma de los otros
- [x] **Los 23 se pintan siempre**, también los que están a cero. Un municipio
      que desaparece cuando no tiene a nadie deja un hueco que se lee como un
      fallo de dibujo, no como un cero
- [x] **Escala por tramos, no continua.** Con 73 en Barranquilla y 1 en Galapa,
      un degradado lineal pinta de un mismo pálido todo lo que no es
      Barranquilla y el mapa deja de distinguir 26 de 1
- [x] **Lo que no se ubica se enseña, no se reparte** (`MunicipiosDelAtlantico`).
      La ciudad es texto libre del Excel de matrícula: hoy hay 3 fichas con
      «Otro» y 1 vacía. Colarlas en el municipio más parecido daría un mapa más
      bonito y mentiroso, y taparía justo lo que hay que corregir. El bloque de
      «sin ubicar» enseña el texto tal cual está escrito
- [x] **Los totales cuadran**: municipios + sin ubicar + sin dato = 108
      exactamente. Comprobado contra la base
- [x] Alias por cómo se escribe de verdad —«Barranquilla D.E.», «Sto Tomas»,
      «Pto. Colombia»— y sin confundir **Sabanagrande con Sabanalarga**, que son
      dos municipios distintos a 30 km
- [x] La geometría sale de límites abiertos (geoBoundaries gbOpen COL ADM2)
      emparejados con los códigos DANE del departamento 08, simplificados con
      Douglas-Peucker: 24 KB de rutas en vez de varios megas. La clave entre el
      dibujo y los datos es el **código DANE**, no el nombre
- [x] Comprobado en el navegador: 23 rutas sin coordenadas rotas, geografía en su
      sitio —Puerto Colombia y Barranquilla al norte, Soledad debajo, Suan al
      sur— y el selector de proyecto cambiando de 108 a «este proyecto no tiene
      participantes activos» con Ruta Bolívar

**Depuración de lo que ya estaba guardado y remate del mapa**

- [x] **106 ofertas cerradas por no exigir inglés.** Se guardaron antes de que
      existiera el colador y seguían en el tablón compitiendo por la atención de
      gente que no puede tomarlas
- [x] **Cerradas, no borradas**, y con motivo propio: `FUERA_DE_PERFIL`, no
      `RETIRADA`. La oferta sigue abierta en su portal y es buena para otra
      persona; lo que dice es que no es de esta población. Contarlas como
      retiradas inflaría las que «se perdieron» y haría pensar que el programa
      llega tarde. Borrarlas perdería el histórico de qué se vio y de qué portal
- [x] Va por un endpoint (`POST /vacantes/depurar-no-bilingues`) y no por SQL a
      mano: usa el mismo criterio que el colador —un solo sitio que cambiar— y
      se puede repetir
- [x] **Un falso positivo del filtro, encontrado al depurar y corregido.** Una
      oferta de Remotive de 14.000 caracteres pasaba por decir «fluent written
      communication» sin pedir inglés en ninguna parte. `fluent` y
      `conversational` solo pueden decidir algo cuando el idioma no se nombra
      —justo cuando no prueban nada—; acompañando al idioma ya los cubre la
      palabra suelta. Fuera de la lista, con su caso en la prueba
- [x] Quedan **157 abiertas y todas bilingües**. Las dos que no dicen el idioma
      en el texto lo declaran de otra forma: una trae `nivelInglesRequerido = B1`
      y la otra es `REMOTO_INGLES`
- [x] **Del mapa se puede llegar a las personas.** Pulsar un municipio abre la
      lista de estudiantes con ese nombre ya escrito en la búsqueda. Ver
      «Soledad 26» sin poder alcanzar a esas 26 era el mismo «construido sin
      puerta» que ya apareció cuatro veces aquí. Comprobado: el mapa dice 26 y
      la lista dice «26 estudiantes», todos de Soledad
- [x] Se **siembra la búsqueda** en vez de aplicar un filtro invisible: el
      término queda a la vista, así que quien llega sabe por qué ve esas 26 y lo
      puede borrar
- [x] Los municipios a cero se pintan pero **no se pulsan**: un enlace a una
      lista vacía es un callejón sin salida
- [x] El realce es el propio contorno —se oscurece y engorda— y sirve igual para
      el ratón y para el teclado. Un `outline` del navegador sobre una forma
      irregular dibuja un rectángulo alrededor y parece un fallo de pintado;
      quitarlo sin poner nada dejaría el mapa sin indicar dónde está el foco
- [x] Comprobado en móvil (375 px, sin desbordes, la tabla baja debajo del mapa)
      y en modo oscuro (los cinco tramos y los números se recalculan)

### 21. Repaso de interfaz sobre lo reportado · HECHO

- [x] **Las divisiones del mapa no se veían.** El contorno usaba el color de
      fondo, así que entre dos municipios vacíos —los dos del mismo gris— no
      había línea y el sur del departamento se leía como una sola mancha. Ahora
      usa el gris del texto secundario a media opacidad, con
      `non-scaling-stroke` para que el grosor no dependa del tamaño al que se
      pinte el dibujo
- [x] **Un estudiante de fuera del Atlántico** cae en «Fuera del mapa», con la
      ciudad tal y como está escrita. No se reparte ni se inventa: son dos casos
      con el mismo síntoma —quien vive en Cartagena no tiene nada que corregir y
      quien tiene «Otro» en la ficha sí—, y el texto crudo es lo único que los
      distingue. El aviso lo dice ahora explícitamente
- [x] **El hueco al final de los indicadores era una tarjeta duplicada.** Había
      dos «Docs. pendientes» con el mismo campo y el mismo rótulo, cambiando
      solo el texto de apoyo: dos tarjetas enseñando el mismo 108 y sugiriendo
      que se contaban dos cosas. Quitada la copia quedan ocho, y con cuatro
      columnas cierran en dos filas exactas
- [x] **Faltaba una gráfica que el backend ya calculaba.** `charts.empleabilidad`
      se enviaba en cada carga del panel y no la pintaba nadie —el mismo
      «construido sin puerta» del registro de rastreo y del hilo de contactos—.
      Ya está, y no repite a la de estado: aquella dice quién sigue en el
      programa, esta si el programa le sirvió para trabajar
- [x] **La búsqueda general dejó de ser una hoja lateral.** Ahora escribe y
      muestra resultados debajo de la caja, con 250 ms de retardo. Buscar es una
      acción de un segundo; abrir un panel que tapa media pantalla obligaba a
      cerrarlo para volver a lo que se estaba haciendo, aunque no se hubiera
      encontrado nada. En móvil el icono despliega el mismo campo en su fila
- [x] **La mensajería ya no sale de lado.** Va centrada, para lo que se añadió
      un `side="center"` al componente de hoja. Un lateral sirve para asomarse a
      algo sin salir de donde estás; cuando lo que se abre es la tarea en sí, el
      sitio es el centro. No se movió a otra pantalla para no perder el chat
      directo y los adjuntos, que la pantalla de mensajes no tiene
- [x] **La caja dentro de la caja del buscador** era el dibujo nativo de
      `input[type=search]`: en Windows pinta su propio recuadro y su crucecita
      dentro del borde de la aplicación. `appearance-none` y las dos reglas de
      `-webkit-search-*`, en el componente `Input` y en el buscador del menú, así
      que no vuelve a aparecer en ninguna pantalla
- [x] **Postulaciones se fusionó en Seguimiento** como la vista «Por
      postulación». Son dos ejes de lo mismo —cómo va la persona y cómo va cada
      proceso— y estaban en dos entradas del menú: quien entraba en una no tenía
      forma de saber que existía la otra. El eje por proceso no se podía tirar
      —una persona puede tener entrevista en una empresa, rechazo en otra y tres
      postulaciones calladas—, pero un eje distinto de los mismos datos es una
      vista, no un módulo
- [x] `/postulaciones` se queda como redirección y no como 404: hay marcadores
      apuntando ahí y un error no explica a dónde se fue la pantalla

### 22. Cuentas del portal de empresas · HECHO

- [x] **No había forma de dar acceso a una empresa desde la interfaz**, y el
      backend lo tenía desde que se hizo el portal: `POST` y `DELETE` sobre
      `/empresas/{id}/cuentas`, sin una sola pantalla que los llamara. Quinta
      vez que aparece lo mismo en este proyecto
- [x] **Y no funcionaba.** Al probarlo por primera vez devolvió un 409: la
      invitación decidía si la cuenta era nueva preguntando
      `usuario.getId() == null`, pero `BaseEntity` asigna el identificador al
      declarar el campo, así que un `new Usuario()` ya trae uno. La respuesta
      era siempre «no es nueva», no se llegaba a poner el correo y la petición
      moría contra el NOT NULL de `usuario.email`. **Invitar a una empresa no
      funcionó nunca**, y nadie lo notó porque no había puerta que lo ejecutara
- [x] Corregido: nueva es la que no vino de la base (`existente.isEmpty()`), no
      la que no tiene identificador
- [x] `CuentasEmpresaServiceTest`, 8 casos, empezando por el que faltaba: que la
      cuenta nueva se guarde con su correo
- [x] Añadido `GET /empresas/{id}/cuentas` —no existía— y el bloque **«Acceso al
      portal»** en la ficha de la empresa: invitar, ver quién tiene acceso y
      revocar
- [x] **Aquí no se escribe una contraseña.** Se invita y la persona define la
      suya con el enlace. Que el equipo teclee la clave de alguien de fuera
      significa que la conoce, y una clave que conocen dos personas ya no
      identifica a ninguna. Es la diferencia con el alta de cuentas del equipo,
      donde sí se escribe una inicial
- [x] Las revocadas siguen a la vista, marcadas: ocultarlas llevaba a invitar
      otra vez el mismo correo y chocar con un error que desde la ficha no
      explica nada
- [x] Se distingue «invitada y sin entrar» de «en uso»: una invitación perdida
      en el correo se veía igual que una cuenta activa
- [x] Comprobado en el navegador contra una empresa real: invitación creada,
      listada como «Activa · Invitación pendiente», y el aviso honesto de que el
      correo no salió —la lista de destinatarios permitidos de este entorno lo
      bloqueó—, que es justo cuando hay que reenviar

### 23. Lo que tienen Zoho y Salesforce y aquí no está · PENDIENTE

Cada punto se comprobó contra el código antes de escribirlo; no es una lista de
folleto. Ordenados por lo que le sirve a **esta** institución, no por lo que
vende mejor.

- [x] **Fusionar fichas de empresa duplicadas · HECHO.** Ver más abajo, punto 24
- [ ] **Reglas de automatización** («si una postulación lleva 14 días sin
      respuesta, avisa al responsable»). Hoy las alertas están escritas en Java:
      añadir una es tocar código. Zoho y Salesforce las dejan configurar. Aquí
      el valor concreto es dejar de perder seguimientos por olvido
- [ ] **Campos personalizados.** Todo campo nuevo es una migración más una
      pantalla. Para una institución que cambia de convocatoria y quiere anotar
      algo distinto cada año, esto es lo que obliga a llamar al programador
- [ ] **Etapas configurables.** `EtapaEmpleabilidad` y los estados del
      seguimiento son enums de Java. Si el programa cambia su recorrido, hoy no
      se puede reflejar sin desplegar
- [ ] **Segundo factor de autenticación**, al menos para ADMIN. El sistema
      guarda documentos de identidad y datos de contacto de 108 personas, y hoy
      la única barrera es una contraseña
- [ ] **API y webhooks para terceros.** Hay claves de API salientes (Groq,
      JSearch) pero nada entrante: ningún sistema externo puede leer ni avisar.
      Es lo que haría falta el día que la institución quiera cruzar esto con su
      plataforma académica
- [ ] **Permisos por campo o roles configurables.** Son cuatro roles fijos en un
      enum. Sirve mientras el equipo sea pequeño; deja de servir cuando haya que
      dar acceso parcial a alguien —un practicante que puede ver pero no
      exportar—
- [ ] **Campañas de correo a empresas.** A estudiantes ya se puede anunciar en
      bloque; a empresas no hay envío masivo con plantilla y seguimiento de
      quién abrió

Lo que **sí** hay y estos CRM cobran aparte, para no rehacerlo por creer que
falta: portal de empresas con cuentas, matching por habilidades, rastreo de
portales de empleo, informes a medida, vistas guardadas, auditoría con IP,
línea de tiempo por registro, plantillas de correo, WhatsApp, asistente de IA,
importación desde Excel con previsualización y formulario público de captación.

### 24. Fusionar fichas de empresa duplicadas · HECHO

- [x] **Son cinco pares, no tres.** El detector encontró dos que la consulta a
      mano no vio: «ADECCO COLOMBIA S A» con «Adecco Colombia» y «ALLIED GLOBAL
      COLOMBIA S.A.S.» con «Allied Global», además de Manpower, Gi Group y TTEC
- [x] Las duplicadas no llegan por descuido, llegan por el camino normal: el
      Excel de una feria trae «Manpower Group Colombia», el rastreo registra
      «ManpowerGroup» y el alta manual escribe «Manpower». El daño no es la fila
      de más: es que el historial queda repartido, se mira una ficha, dice «sin
      contactar», y se llama a alguien con quien ya se habló el mes pasado
- [x] **Nada se borra.** La absorbida se desactiva y conserva su rastro;
      borrarla se llevaría por delante la auditoría de lo que se hizo con ella.
      Su nombre queda escrito en la nota de la que se queda, para que quien lo
      busque dentro de un mes lo encuentre en vez de volver a crear la ficha
- [x] **Nada se pisa.** Los campos de la que se queda solo se rellenan donde
      estaban vacíos, las notas se suman, y la fecha de primer contacto se queda
      con la más antigua: es cuando empezó la relación, no cuando se importó
- [x] **Se mueve todo lo que apunta a la absorbida**: vacantes, acercamientos,
      postulaciones, colocaciones y cuentas del portal. Lo que se quedara atrás
      desaparecería de la vista sin dejar de existir
- [x] **Se sugiere, no se decide.** Dos nombres casi iguales pueden ser dos
      empresas distintas del mismo grupo, y esto no se puede deshacer. La
      pantalla propone, marca por defecto la que más registros tiene y deja
      elegir cuál se queda
- [x] La confirmación **dice cuántos registros se van a mover**, con el número.
      Una acción irreversible tiene que enseñar su alcance donde se confirma, no
      en la documentación
- [x] La clave de comparación ignora tildes, puntuación y las coletillas que no
      distinguen a nadie —«S.A.S.», «Ltda», «Colombia»—, pero **con límite de
      palabra**: sin él «Sassafras» perdía su «SAS» y dos nombres distintos
      acababan iguales. `FusionDeEmpresasTest`, 6 casos, la mitad de ellos sobre
      lo que **no** debe juntarse
- [x] La tarjeta solo aparece si hay duplicados, y va arriba en Empresas: una
      ficha repetida se arregla cuando se ve
- [x] Comprobado de punta a punta con fichas de prueba —un acercamiento y una
      vacante cambiaron de empresa, la absorbida quedó inactiva, los datos
      vacíos se rellenaron y quedó el asiento en auditoría— y borradas después.
      **Los cinco pares reales se dejaron intactos**: unir fichas de la
      institución es una decisión del equipo, no mía

