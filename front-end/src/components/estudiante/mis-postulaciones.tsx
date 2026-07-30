'use client'

/**
 * Seguimiento de postulaciones desde la cuenta del participante.
 *
 * <p>Lo que hace útil esta pantalla no es listar: es que **el estado que el
 * estudiante cambia aquí llega al tablero del equipo**. Antes había que
 * llamarlo para saber si le habían contestado, y esa llamada no se hacía 107
 * veces, así que la hoja de seguimiento tenía una sola postulación anotada
 * mientras había ocho personas colocadas.
 *
 * Dos formularios, y son cosas distintas:
 *  - **Anotar una postulación**: ya se postuló, empieza el seguimiento.
 *  - **Compartir una oferta**: la encontró y quiere que el equipo la vea.
 *    Entra sin revisar; se ve, pero no se le recomienda a nadie más hasta que
 *    alguien del programa la valide.
 */

import { useEffect, useState } from 'react'
import {
  ArrowSquareOut,
  Briefcase,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  Clock,
  Info,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Aviso, Campo, Cifra, Selector } from '@/components/ui/campo'
import { FormSheet } from '@/components/ui/form-sheet'
import { Confirmar } from '@/components/ui/confirmar'
import { postulacionesApi, vacantesApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import type {
  CrearPostulacion,
  CrearVacante,
  EstadoPostulacion,
  PostulacionResponse,
  ResumenPostulaciones,
} from '@/lib/types'

import { Textarea } from '@/components/ui/textarea'
/**
 * Los estados y su orden, que es el del embudo.
 *
 * Se escriben aquí y no se piden al backend porque el color y el orden son
 * decisiones de presentación; las etiquetas sí llegan del servidor en cada
 * postulación (`estadoEtiqueta`) para que no haya dos verdades sobre cómo se
 * llama cada estado.
 */
const ESTADOS: { valor: EstadoPostulacion; etiqueta: string; clase: string }[] = [
  { valor: 'ENVIADA', etiqueta: 'Enviada', clase: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  { valor: 'EN_PROCESO', etiqueta: 'En proceso', clase: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { valor: 'ENTREVISTA_AGENDADA', etiqueta: 'Entrevista agendada', clase: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  { valor: 'ENTREVISTA_REALIZADA', etiqueta: 'Entrevista realizada', clase: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  { valor: 'CONTRATADO', etiqueta: 'Contratado', clase: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazado', clase: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  { valor: 'SIN_RESPUESTA', etiqueta: 'Sin respuesta', clase: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
]

const CANALES = ['LinkedIn', 'Computrabajo', 'Magneto', 'elempleo', 'Web de la empresa', 'Feria de empleo', 'Contacto directo', 'Otro']
const MODALIDADES = ['Presencial', 'Remoto', 'Híbrido']
const JORNADAS = ['Tiempo completo', 'Medio tiempo', 'Por horas']
const TIPOS_CONTRATO = ['Indefinido', 'Término fijo', 'Obra o labor', 'Prestación de servicios', 'Aprendizaje']

function claseDe(estado: EstadoPostulacion | string): string {
  return ESTADOS.find((e) => e.valor === estado)?.clase ?? 'bg-muted text-muted-foreground'
}

const hoy = () => new Date().toISOString().slice(0, 10)

// ── Formulario: anotar una postulación ──────────────────────────────────────

function FormularioPostulacion({
  abierto,
  onCreada,
  onCancelar,
}: {
  abierto: boolean
  onCreada: (p: PostulacionResponse) => void
  onCancelar: () => void
}) {
  const INICIAL: CrearPostulacion = {
    empresaNombre: '',
    cargo: '',
    canal: '',
    fechaPostulacion: hoy(),
    estado: 'ENVIADA',
    urlOferta: '',
    observaciones: '',
  }
  const [datos, setDatos] = useState<CrearPostulacion>({
    empresaNombre: '',
    cargo: '',
    canal: '',
    fechaPostulacion: hoy(),
    estado: 'ENVIADA',
    urlOferta: '',
    observaciones: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listo = datos.empresaNombre.trim().length > 0 && datos.cargo.trim().length > 0
  const sucio = JSON.stringify(datos) !== JSON.stringify(INICIAL)

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const creada = await postulacionesApi.registrarPropia({
        ...datos,
        empresaNombre: datos.empresaNombre.trim(),
        cargo: datos.cargo.trim(),
        canal: datos.canal || undefined,
        urlOferta: datos.urlOferta?.trim() || undefined,
        observaciones: datos.observaciones?.trim() || undefined,
      })
      onCreada(creada)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <FormSheet
      open={abierto}
      onOpenChange={(v: boolean) => !v && onCancelar()}
      titulo="Anotar una postulación"
      descripcion="Ya te postulaste y quieres seguirle la pista. Con la empresa y el cargo basta."
      sucio={sucio}
      guardando={guardando}
      puedeGuardar={listo}
      textoGuardar="Guardar postulación"
      onGuardar={guardar}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Empresa" requerido>
            <Input
              value={datos.empresaNombre}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, empresaNombre: e.target.value })}
              placeholder="Teleperformance"
              maxLength={255}
            />
          </Campo>
          <Campo etiqueta="Cargo" requerido>
            <Input
              value={datos.cargo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, cargo: e.target.value })}
              placeholder="Agente de servicio al cliente bilingüe"
              maxLength={255}
            />
          </Campo>
          <Campo etiqueta="Por dónde te postulaste">
            <Selector
              value={datos.canal ?? ''}
              onChange={(v: string) => setDatos({ ...datos, canal: v })}
              opciones={CANALES}
              vacio="Sin especificar"
            />
          </Campo>
          <Campo etiqueta="Fecha">
            <Input
              type="date"
              value={datos.fechaPostulacion ?? ''}
              max={hoy()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, fechaPostulacion: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Enlace de la oferta" ancho>
            <Input
              type="url"
              value={datos.urlOferta ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, urlOferta: e.target.value })}
              placeholder="https://..."
            />
          </Campo>
          <Campo etiqueta="Notas" ancho>
            <Textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              minRows={2}
              value={datos.observaciones ?? ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDatos({ ...datos, observaciones: e.target.value })}
              placeholder="Con quién hablaste, qué te dijeron, cuándo vuelven a contactarte."
            />
          </Campo>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </FormSheet>
  )
}

// ── Formulario: compartir una oferta ────────────────────────────────────────

const OFERTA_VACIA: CrearVacante = {
  titulo: '',
  empresaNombre: '',
  url: '',
  ciudad: '',
  modalidadTrabajo: '',
  jornada: '',
  tipoContrato: '',
  rangoSalarial: '',
  descripcion: '',
}

function FormularioOferta({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [datos, setDatos] = useState<CrearVacante>({
    titulo: '',
    empresaNombre: '',
    url: '',
    ciudad: '',
    modalidadTrabajo: '',
    jornada: '',
    tipoContrato: '',
    rangoSalarial: '',
    descripcion: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listoMensaje, setListoMensaje] = useState<string | null>(null)

  // El backend exige enlace o título. Se refleja aquí para no mandar una
  // petición que ya se sabe que va a fallar.
  const listo = (datos.url?.trim().length ?? 0) > 0 || (datos.titulo?.trim().length ?? 0) > 0
  // Tras enviarla el formulario queda limpio: no hay nada que se pueda perder
  // al cerrar, así que no debe preguntar.
  const sucio = !listoMensaje && JSON.stringify(datos) !== JSON.stringify(OFERTA_VACIA)

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const limpio = Object.fromEntries(
        Object.entries(datos).filter(([, v]) => typeof v !== 'string' || v.trim() !== ''),
      ) as CrearVacante
      const creada = await vacantesApi.crear(limpio)
      setListoMensaje(`"${creada.titulo}" quedó registrada. El equipo la revisará antes de recomendarla al resto.`)
      setDatos(OFERTA_VACIA)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <FormSheet
      open={abierto}
      onOpenChange={(v: boolean) => !v && onCerrar()}
      titulo="Compartir una oferta que encontraste"
      descripcion="Pega el enlace o escríbela a mano si la viste en una feria o te la pasó alguien."
      sucio={sucio}
      guardando={guardando}
      puedeGuardar={listo}
      textoGuardar="Compartir oferta"
      onGuardar={guardar}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Enlace de la oferta" ancho>
            <Input
              type="url"
              value={datos.url ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, url: e.target.value })}
              placeholder="https://..."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Con el enlace, el título y la descripción se completan solos.
            </p>
          </Campo>
          <Campo etiqueta="Cargo">
            <Input
              value={datos.titulo ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, titulo: e.target.value })}
              placeholder="Bilingual Customer Service Representative"
              maxLength={255}
            />
          </Campo>
          <Campo etiqueta="Empresa">
            <Input
              value={datos.empresaNombre ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, empresaNombre: e.target.value })}
              placeholder="Solvo Global"
              maxLength={255}
            />
          </Campo>
          <Campo etiqueta="Ciudad">
            <Input
              value={datos.ciudad ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, ciudad: e.target.value })}
              placeholder="Barranquilla"
              maxLength={255}
            />
          </Campo>
          <Campo etiqueta="Modalidad">
            <Selector
              value={datos.modalidadTrabajo ?? ''}
              onChange={(v: string) => setDatos({ ...datos, modalidadTrabajo: v })}
              opciones={MODALIDADES}
              vacio="Sin especificar"
            />
          </Campo>
          <Campo etiqueta="Jornada">
            <Selector
              value={datos.jornada ?? ''}
              onChange={(v: string) => setDatos({ ...datos, jornada: v })}
              opciones={JORNADAS}
              vacio="Sin especificar"
            />
          </Campo>
          <Campo etiqueta="Tipo de contrato">
            <Selector
              value={datos.tipoContrato ?? ''}
              onChange={(v: string) => setDatos({ ...datos, tipoContrato: v })}
              opciones={TIPOS_CONTRATO}
              vacio="Sin especificar"
            />
          </Campo>
          <Campo etiqueta="Salario" ancho>
            <Input
              value={datos.rangoSalarial ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, rangoSalarial: e.target.value })}
              placeholder="$2.800.000 - $3.200.000 + bonos"
              maxLength={255}
            />
          </Campo>
          <Campo etiqueta="Descripción" ancho>
            <Textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              minRows={3}
              value={datos.descripcion ?? ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDatos({ ...datos, descripcion: e.target.value })}
              placeholder="Funciones, requisitos, horario, lo que sepas de la oferta."
            />
          </Campo>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {listoMensaje && <Aviso tipo="ok">{listoMensaje}</Aviso>}
      </div>
    </FormSheet>
  )
}

// ── Tarjeta de una postulación ──────────────────────────────────────────────

function TarjetaPostulacion({
  postulacion,
  onCambiar,
  onEliminar,
}: {
  postulacion: PostulacionResponse
  onCambiar: (p: PostulacionResponse) => void
  onEliminar: (id: string) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const [nota, setNota] = useState(postulacion.observaciones ?? '')
  const [resultado, setResultado] = useState(postulacion.resultado ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  const cambiarEstado = async (estado: EstadoPostulacion) => {
    if (estado === postulacion.estado) return
    setGuardando(true)
    setError(null)
    try {
      onCambiar(await postulacionesApi.actualizar(postulacion.id, { estado }))
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  const guardarDetalle = async () => {
    setGuardando(true)
    setError(null)
    try {
      onCambiar(
        await postulacionesApi.actualizar(postulacion.id, {
          observaciones: nota,
          resultado: resultado,
        }),
      )
      setAbierta(false)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  // Borrar una postulación se lleva por delante su rastro en el seguimiento;
  // no puede pasar por un solo clic sin preguntar, que es como estaba.
  const eliminar = async () => {
    setGuardando(true)
    try {
      await postulacionesApi.eliminar(postulacion.id)
      onEliminar(postulacion.id)
    } catch (err) {
      setError(errorDe(err))
      setGuardando(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold">{postulacion.cargo}</h4>
            <Badge className={`text-xs ${claseDe(postulacion.estado)}`} variant="outline">
              {postulacion.estadoEtiqueta}
            </Badge>
            {postulacion.esperandoConfirmacion && (
              <Badge variant="outline" className="bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
                Pendiente de confirmar con el equipo
              </Badge>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{postulacion.empresaNombre}</span>
            <span aria-hidden>•</span>
            <span className="inline-flex items-center gap-1">
              <CalendarBlank className="size-3.5" />
              {postulacion.fechaPostulacion}
            </span>
            {postulacion.canal && (<><span aria-hidden>•</span><span>{postulacion.canal}</span></>)}
            {/* Días esperando: el dato que dice a qué empresa vale la pena volver. */}
            {postulacion.diasEsperando !== null && postulacion.diasEsperando > 0 && (
              <>
                <span aria-hidden>•</span>
                <span className={postulacion.diasEsperando > 21 ? 'text-amber-600 dark:text-amber-400' : ''}>
                  {postulacion.diasEsperando} días esperando
                </span>
              </>
            )}
            {postulacion.diasHastaRespuesta !== null && (
              <>
                <span aria-hidden>•</span>
                <span>Contestaron en {postulacion.diasHastaRespuesta} días</span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            aria-label={`Estado de la postulación en ${postulacion.empresaNombre}`}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
            value={postulacion.estado}
            disabled={guardando}
            onChange={(e) => cambiarEstado(e.target.value as EstadoPostulacion)}
          >
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
            ))}
          </select>
          {postulacion.urlOferta && (
            <a
              href={postulacion.urlOferta}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Oferta <ArrowSquareOut className="size-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setAbierta(!abierta)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
          >
            {abierta ? 'Cerrar' : 'Notas'}
          </button>
        </div>
      </div>

      {abierta && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <Campo etiqueta="Qué pasó">
            <Input
              value={resultado}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResultado(e.target.value)}
              placeholder="Me llamaron para entrevista el viernes a las 10."
            />
          </Campo>
          <Campo etiqueta="Notas">
            <Textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              minRows={3}
              value={nota}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNota(e.target.value)}
            />
          </Campo>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={guardarDetalle} disabled={guardando}>
              {guardando ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : 'Guardar'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmandoBorrado(true)}
              disabled={guardando}
            >
              <Trash className="size-4" /> Eliminar
            </Button>
          </div>
        </div>
      )}

      {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}

      <Confirmar
        open={confirmandoBorrado}
        onOpenChange={setConfirmandoBorrado}
        titulo="¿Eliminar esta postulación?"
        descripcion={`Se borra tu postulación a ${postulacion.cargo} en ${postulacion.empresaNombre}. Los apuntes que ya llegaron al seguimiento del equipo se conservan.`}
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
      />
    </Card>
  )
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export function MisPostulaciones() {
  const [postulaciones, setPostulaciones] = useState<PostulacionResponse[]>([])
  const [resumen, setResumen] = useState<ResumenPostulaciones | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<'ninguno' | 'postulacion' | 'oferta'>('ninguno')

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      const [lista, cifras] = await Promise.all([
        postulacionesApi.mias(),
        postulacionesApi.miResumen(),
      ])
      setPostulaciones(lista)
      setResumen(cifras)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  // Tras un cambio de estado se recargan las cifras: el resumen lo calcula el
  // servidor y recalcularlo aquí sería la misma decisión tomada dos veces.
  const reemplazar = (actualizada: PostulacionResponse) => {
    setPostulaciones((previas) => previas.map((p) => (p.id === actualizada.id ? actualizada : p)))
    postulacionesApi.miResumen().then(setResumen).catch(() => {})
  }

  const quitar = (id: string) => {
    setPostulaciones((previas) => previas.filter((p) => p.id !== id))
    postulacionesApi.miResumen().then(setResumen).catch(() => {})
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <CircleNotch className="mr-2 size-5 animate-spin" /> Cargando tus postulaciones…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Mis postulaciones</h2>
          <p className="text-sm text-muted-foreground">
            Actualiza aquí en qué va cada proceso. El equipo lo ve al instante.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setFormulario(formulario === 'postulacion' ? 'ninguno' : 'postulacion')}
          >
            <Plus className="size-4" /> Anotar postulación
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFormulario(formulario === 'oferta' ? 'ninguno' : 'oferta')}
          >
            <Briefcase className="size-4" /> Compartir una oferta
          </Button>
        </div>
      </div>

      {resumen && resumen.total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cifra etiqueta="Activas" valor={resumen.activas} />
          <Cifra etiqueta="Con respuesta" valor={resumen.conRespuesta} />
          <Cifra etiqueta="Entrevistas" valor={resumen.entrevistas} />
          <Cifra etiqueta="Total" valor={resumen.total} />
        </div>
      )}

      {formulario === 'postulacion' && (
        <FormularioPostulacion
          abierto
          onCreada={(nueva) => {
            setPostulaciones((previas) => [nueva, ...previas])
            setFormulario('ninguno')
            postulacionesApi.miResumen().then(setResumen).catch(() => {})
          }}
          onCancelar={() => setFormulario('ninguno')}
        />
      )}
      {formulario === 'oferta' && (
        <FormularioOferta abierto onCerrar={() => setFormulario('ninguno')} />
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      {postulaciones.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <Clock className="mx-auto mb-3 size-12 text-muted-foreground/50" />
          <h3 className="text-base font-semibold">Todavía no hay postulaciones</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cuando te postules a una vacante desde <strong>Mis vacantes</strong>, aparecerá aquí sola.
            Si te postulaste por fuera, anótala con el botón de arriba.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {postulaciones.map((p) => (
            <TarjetaPostulacion
              key={p.id}
              postulacion={p}
              onCambiar={reemplazar}
              onEliminar={quitar}
            />
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Si te contratan, márcalo aquí y avisa a tu acompañante del programa: el equipo registra el
        contrato y el salario para que cuente como colocación.
      </p>
    </div>
  )
}
