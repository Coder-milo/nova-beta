'use client'

import { CircleNotchIcon as CircleNotch, EnvelopeSimpleIcon as EnvelopeSimple, EyeIcon as Eye, PaperPlaneTiltIcon as PaperPlaneTilt, PlusIcon as Plus, TrashIcon as Trash, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
/**
 * Plantillas de correo.
 *
 * Consume:
 *   GET    /api/v1/plantillas-correo            → lista
 *   GET    /api/v1/plantillas-correo/variables  → ayuda del editor
 *   POST   /api/v1/plantillas-correo            → crear
 *   PUT    /api/v1/plantillas-correo/{id}       → corregir
 *   DELETE /api/v1/plantillas-correo/{id}       → eliminar (solo ADMIN)
 *   POST   /api/v1/plantillas-correo/previsualizar → cómo queda, sin guardar
 *   POST   /api/v1/plantillas-correo/{id}/enviar   → envío masivo
 *
 * El módulo entero existía en el backend y ninguna pantalla lo pedía.
 */

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { plantillasCorreoApi, mensajeDeError } from '@/lib/api'
import { useAvisos } from '@/components/ui/avisos'
import { useConfirmar } from '@/components/ui/confirmar'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import type {
  PlantillaCorreo, PlantillaCorreoRequest, PrevisualizacionCorreo,
  ResumenEnvioCorreo, VariableDisponible,
} from '@/lib/types'

const vacia: PlantillaCorreoRequest = {
  nombre: '', descripcion: '', asunto: '', cuerpo: '',
  botonTexto: '', botonUrl: '', activa: true,
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        titulo: 'Emails the programme sends',
        descripcion: 'Write once and send to the cohort. The preview uses sample data, so you see exactly what arrives before anyone receives it.',
        nuevaPlantilla: 'New template',
        sinPlantillas: 'No templates yet. Create the first one.',
        nombre: 'Name',
        descripcionCampo: 'What it is for',
        asunto: 'Subject',
        cuerpo: 'Body',
        botonTexto: 'Button text',
        botonUrl: 'Button link',
        activa: 'Active',
        variablesDisponibles: 'Variables you can use',
        previsualizar: 'Preview',
        vistaPrevia: 'Preview with sample data',
        avisosPrevios: 'Before sending',
        simular: 'Dry run',
        enviarDeVerdad: 'Send for real',
        confirmarEnvio: 'Send this email for real?',
        confirmarEnvioDetalle: (n: number) => `It will be sent to ${n} students and cannot be undone. Do a dry run first if you have not.`,
        resultadoEnvio: 'Result',
        destinatarios: 'Recipients',
        enviados: 'Sent',
        bloqueados: 'Blocked by the test list',
        fallidos: 'Failed',
        sinCorreo: 'No email on file',
        fueSimulacion: 'This was a dry run: nothing was sent.',
        listaDePruebas: 'Test list active: only these addresses receive anything.',
        canal: 'Channel',
        elNombreEs: 'The name, the subject and the body are required.',
        noSePudoCargar: 'The templates could not be loaded.',
        noSePudoGuardar: 'The template could not be saved.',
        noSePudoPrevisualizar: 'The preview could not be generated.',
        noSePudoEnviar: 'The email could not be sent.',
        noSePudoEliminar: 'The template could not be deleted.',
        eliminarPlantilla: 'Delete template',
        seEliminara: (n: string) => `Template “${n}” will be deleted. This cannot be undone.`,
        plantillaGuardada: 'Template saved.',
        simulaPrimero: 'Do a dry run first: it shows who it would reach.',
        guardaAntesDeEnviar: 'Save your changes first: what goes out is the saved template, not what is on screen.',
        previaDeLoNoGuardado: 'This preview shows what you have on screen. It is not saved yet, so it is not what would be sent.',
      }
    : {
        titulo: 'Correos que envía el programa',
        descripcion: 'Se escribe una vez y se manda a la cohorte. La vista previa usa datos de ejemplo, así que ves exactamente lo que llega antes de que lo reciba nadie.',
        nuevaPlantilla: 'Nueva plantilla',
        sinPlantillas: 'Todavía no hay plantillas. Crea la primera.',
        nombre: 'Nombre',
        descripcionCampo: 'Para qué sirve',
        asunto: 'Asunto',
        cuerpo: 'Cuerpo',
        botonTexto: 'Texto del botón',
        botonUrl: 'Enlace del botón',
        activa: 'Activa',
        variablesDisponibles: 'Variables que puedes usar',
        previsualizar: 'Previsualizar',
        vistaPrevia: 'Vista previa con datos de ejemplo',
        avisosPrevios: 'Antes de enviar',
        simular: 'Simular envío',
        enviarDeVerdad: 'Enviar de verdad',
        confirmarEnvio: '¿Enviar este correo de verdad?',
        confirmarEnvioDetalle: (n: number) => `Se enviará a ${n} estudiantes y no se puede deshacer. Simula primero si no lo has hecho.`,
        resultadoEnvio: 'Resultado',
        destinatarios: 'Destinatarios',
        enviados: 'Enviados',
        bloqueados: 'Bloqueados por la lista de pruebas',
        fallidos: 'Fallidos',
        sinCorreo: 'Sin correo en la ficha',
        fueSimulacion: 'Fue una simulación: no se envió nada.',
        listaDePruebas: 'Lista de pruebas activa: sólo esas direcciones reciben algo.',
        canal: 'Canal',
        elNombreEs: 'El nombre, el asunto y el cuerpo son obligatorios.',
        noSePudoCargar: 'No se pudieron cargar las plantillas.',
        noSePudoGuardar: 'No se pudo guardar la plantilla.',
        noSePudoPrevisualizar: 'No se pudo generar la vista previa.',
        noSePudoEnviar: 'No se pudo enviar el correo.',
        noSePudoEliminar: 'No se pudo eliminar la plantilla.',
        eliminarPlantilla: 'Eliminar plantilla',
        seEliminara: (n: string) => `Se eliminará la plantilla «${n}». Esta acción no se puede deshacer.`,
        plantillaGuardada: 'Plantilla guardada.',
        simulaPrimero: 'Simula primero: te dice a quién llegaría.',
        guardaAntesDeEnviar: 'Guarda los cambios primero: lo que sale es la plantilla guardada, no lo que hay en pantalla.',
        previaDeLoNoGuardado: 'Esta vista previa muestra lo que tienes en pantalla. Todavía no está guardado, así que no es lo que se enviaría.',
      }
}

export function PanelPlantillasCorreo() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { mostrarError, avisos } = useAvisos()
  // Borrar una plantilla es solo de ADMIN en el servidor. Sin esto, un
  // coordinador ve el boton, lo pulsa y recibe un 403: se le ofrece algo que
  // no puede hacer y el fallo parece del sistema.
  const { user } = useAuth()
  const puedeEliminar = user?.roles?.includes('ADMIN') ?? false
  const { confirmar, dialogo } = useConfirmar()

  const [plantillas, setPlantillas] = useState<PlantillaCorreo[]>([])
  const [variables, setVariables] = useState<VariableDisponible[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<PlantillaCorreoRequest>(vacia)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [previa, setPrevia] = useState<PrevisualizacionCorreo | null>(null)
  const [previsualizando, setPrevisualizando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resumen, setResumen] = useState<ResumenEnvioCorreo | null>(null)
  /**
   * De qué plantilla tenemos una simulación hecha.
   *
   * El envío real se apoya en ella para dos cosas: saber a cuántas personas
   * llegaría —decirlo mal en la confirmación es peor que no decirlo— y obligar
   * a mirar antes el resultado. No es una molestia de más: es la única
   * oportunidad de ver a quién alcanza algo que no se puede deshacer.
   */
  const [simuladoPara, setSimuladoPara] = useState<string | null>(null)
  /**
   * La plantilla tal como esta guardada en el servidor.
   *
   * La vista previa monta lo que hay escrito en el formulario, pero el envio
   * usa lo que el servidor tiene guardado. Editar y no guardar hacia que la
   * previsualizacion ensenara el texto nuevo y a la gente le llegara el
   * anterior, sin nada que lo advirtiera. Con esto se sabe si difieren.
   */
  const [guardado, setGuardado] = useState<string>('')

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const [lista, vars] = await Promise.all([
        plantillasCorreoApi.listar(),
        plantillasCorreoApi.variables(),
      ])
      setPlantillas(lista); setVariables(vars)
    } catch (e) {
      setError(mensajeDeError(e, T.noSePudoCargar))
    } finally { setCargando(false) }
  }, [T.noSePudoCargar])

  useEffect(() => { void cargar() }, [cargar])

  const abrirNueva = () => {
    setEditandoId(null); setForm(vacia); setFormError(null); setGuardado(JSON.stringify(vacia))
    setPrevia(null); setResumen(null); setSimuladoPara(null); setAbierto(true)
  }

  const abrirEdicion = (p: PlantillaCorreo) => {
    setEditandoId(p.id)
    const cargado = {
      programaId: p.programaId, nombre: p.nombre, descripcion: p.descripcion ?? '',
      asunto: p.asunto, cuerpo: p.cuerpo, botonTexto: p.botonTexto ?? '',
      botonUrl: p.botonUrl ?? '', rolMinimo: p.rolMinimo, activa: p.activa,
    }
    setForm(cargado)
    setGuardado(JSON.stringify(cargado))
    setFormError(null); setPrevia(null); setResumen(null); setSimuladoPara(null); setAbierto(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim() || !form.asunto.trim() || !form.cuerpo.trim()) {
      setFormError(T.elNombreEs)
      return
    }
    setGuardando(true); setFormError(null)
    try {
      const guardada = editandoId
        ? await plantillasCorreoApi.actualizar(editandoId, form)
        : await plantillasCorreoApi.crear(form)
      setEditandoId(guardada.id)
      setGuardado(JSON.stringify(form))
      // Lo guardado cambio, asi que la simulacion anterior ya no describe lo
      // que saldria: hay que volver a mirarla antes de enviar.
      setSimuladoPara(null)
      await cargar()
    } catch (e) {
      setFormError(mensajeDeError(e, T.noSePudoGuardar))
    } finally { setGuardando(false) }
  }

  const previsualizar = async () => {
    setPrevisualizando(true)
    try {
      setPrevia(await plantillasCorreoApi.previsualizar(form))
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoPrevisualizar))
    } finally { setPrevisualizando(false) }
  }

  /**
   * Envía la plantilla guardada.
   *
   * La simulación va primero y sin preguntar: no manda nada, sólo dice a
   * quién llegaría. El envío real pide confirmación aparte, porque un clic
   * distraído sobre un botón que dice «enviar» alcanza a la cohorte entera y
   * no se puede deshacer.
   */
  /** Lo escrito difiere de lo guardado, que es lo que de verdad se envia. */
  const hayCambiosSinGuardar = JSON.stringify(form) !== guardado

  const enviar = async (simulacion: boolean) => {
    if (hayCambiosSinGuardar) return
    if (!editandoId) return
    if (!simulacion) {
      if (simuladoPara !== editandoId || !resumen) return
      if (!(await confirmar({
        titulo: T.confirmarEnvio,
        descripcion: T.confirmarEnvioDetalle(resumen.destinatarios),
        textoConfirmar: T.enviarDeVerdad,
        destructivo: true,
      }))) return
    }
    setEnviando(true)
    try {
      const nuevo = await plantillasCorreoApi.enviar(editandoId, { simulacion })
      setResumen(nuevo)
      // Tras un envío real la simulación deja de valer: si se vuelve a pulsar
      // hay que volver a mirar a quién llegaría.
      setSimuladoPara(simulacion ? editandoId : null)
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoEnviar))
    } finally { setEnviando(false) }
  }

  const eliminar = async (p: PlantillaCorreo) => {
    if (!(await confirmar({
      titulo: T.eliminarPlantilla,
      descripcion: T.seEliminara(p.nombre),
      textoConfirmar: C.eliminar,
      destructivo: true,
    }))) return
    try {
      await plantillasCorreoApi.eliminar(p.id)
      if (editandoId === p.id) { setAbierto(false); setEditandoId(null) }
      await cargar()
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoEliminar))
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <EnvelopeSimple className="size-4 text-primary" /> {T.titulo}
        </CardTitle>
        <CardDescription>{T.descripcion}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={abrirNueva} disabled={cargando}>
            <Plus className="size-4" /> {T.nuevaPlantilla}
          </Button>
        </div>

        {!cargando && plantillas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {T.sinPlantillas}
          </p>
        )}

        {plantillas.length > 0 && (
          <div className="divide-y rounded-xl border">
            {plantillas.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.asunto}</p>
                </div>
                {!p.activa && <Badge variant="outline" className="text-[10px]">{C.inactivo}</Badge>}
                <Button variant="outline" size="sm" onClick={() => abrirEdicion(p)}>{C.editar}</Button>
                {puedeEliminar && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void eliminar(p)}
                    aria-label={`${C.eliminar} ${p.nombre}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {abierto && (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/10 p-4">
            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium">{T.nombre}</span>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">{T.descripcionCampo}</span>
                <Input value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium">{T.asunto}</span>
                <Input value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })} maxLength={160} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium">{T.cuerpo}</span>
                <Textarea
                  minRows={6}
                  value={form.cuerpo}
                  onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                  className="w-full resize-y rounded-xl border border-input bg-card/90 px-3.5 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">{T.botonTexto}</span>
                <Input value={form.botonTexto ?? ''} onChange={(e) => setForm({ ...form, botonTexto: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">{T.botonUrl}</span>
                <Input type="url" value={form.botonUrl ?? ''} onChange={(e) => setForm({ ...form, botonUrl: e.target.value })} placeholder="https://…" />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={form.activa ?? true}
                  onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                />
                <span className="text-xs font-medium">{T.activa}</span>
              </label>
            </div>

            {/* Las variables se listan con su marca exacta y su ejemplo. Sin
                esto hay que adivinar cómo se escribe cada una, y una mal
                tecleada no falla: sale literal en el correo del estudiante. */}
            {variables.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="mb-2 text-xs font-semibold text-foreground">{T.variablesDisponibles}</p>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <button
                      key={v.clave}
                      type="button"
                      title={`${v.descripcion} · ${v.ejemplo}`}
                      onClick={() => setForm((f) => ({ ...f, cuerpo: `${f.cuerpo}${v.marca}` }))}
                      className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      {v.marca}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : null} {C.guardar}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void previsualizar()} disabled={previsualizando}>
                <Eye className="size-3.5" /> {T.previsualizar}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void enviar(true)}
                disabled={enviando || !editandoId || hayCambiosSinGuardar}
                title={hayCambiosSinGuardar ? T.guardaAntesDeEnviar : undefined}
              >
                <PaperPlaneTilt className="size-3.5" /> {T.simular}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void enviar(false)}
                disabled={enviando || hayCambiosSinGuardar || simuladoPara !== editandoId}
                title={hayCambiosSinGuardar ? T.guardaAntesDeEnviar : simuladoPara === editandoId ? undefined : T.simulaPrimero}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <PaperPlaneTilt className="size-3.5" /> {T.enviarDeVerdad}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAbierto(false)}>{C.cerrar}</Button>
            </div>

            {previa && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">{T.vistaPrevia}</p>
                {hayCambiosSinGuardar && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                    {T.previaDeLoNoGuardado}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{previa.asunto}</p>
                {previa.avisos.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      <WarningCircle className="size-3.5" /> {T.avisosPrevios}
                    </p>
                    <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
                      {previa.avisos.map((a) => <li key={a}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {/* En un iframe con sandbox: el HTML lo arma el servidor, pero
                    esto es un correo y no debe poder ejecutar nada ni navegar
                    la pantalla que lo muestra. */}
                <iframe
                  title={T.vistaPrevia}
                  sandbox=""
                  srcDoc={previa.html}
                  className="h-96 w-full rounded-lg border border-border bg-white"
                />
              </div>
            )}

            {resumen && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">{T.resultadoEnvio}</p>
                {resumen.simulacion && (
                  <p className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-[11px] font-medium text-primary">
                    {T.fueSimulacion}
                  </p>
                )}
                {resumen.destinatariosPermitidos.length > 0 && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                    {T.listaDePruebas} {resumen.destinatariosPermitidos.join(', ')}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  {([
                    [T.destinatarios, resumen.destinatarios],
                    [T.enviados, resumen.enviados],
                    [T.bloqueados, resumen.bloqueadosPorLista],
                    [T.fallidos, resumen.fallidos],
                    [T.sinCorreo, resumen.sinCorreo],
                  ] as const).map(([rotulo, valor]) => (
                    <div key={rotulo} className="rounded-lg border border-border p-2">
                      <p className="text-base font-semibold tabular-nums text-foreground">{valor}</p>
                      <p className="text-[10px] text-muted-foreground">{rotulo}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">{T.canal}: {resumen.canalDeCorreo}</p>
              </div>
            )}
          </section>
        )}
      </CardContent>
      {dialogo}
      {avisos}
    </Card>
  )
}
