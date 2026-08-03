'use client'

/**
 * Catálogo de plataformas externas.
 *
 * <p>Aquí se administran las plataformas en sí: nombre, enlace e imagen.
 * Cambiar cualquiera de esos campos aquí lo cambia para todos los programas y
 * estudiantes que la usen —las asignaciones no se tocan. La visibilidad se
 * decide en dos pasos que viven fuera de este panel: qué plataformas ofrece
 * el programa (en «Proyectos») y cuáles le tocan a cada estudiante (en la
 * ficha del estudiante).
 *
 * <p>Eliminar es desactivar: la plataforma deja de ofrecerse y de aparecer,
 * pero no se destruye ninguna asignación existente. Evita que el equipo
 * pierda un idioma de la ficha de sus participantes por un click.
 */

import { useState, useEffect, useCallback } from 'react'
import { ArrowSquareOutIcon as ArrowSquareOut, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, PencilSimpleIcon as PencilSimple, PlusIcon as Plus, TrashIcon as Trash, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import { plataformasApi } from '@/lib/api'
import type { PlataformaRequest, PlataformaResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Confirmar } from '@/components/ui/confirmar'
import { errorDe } from '@/lib/errores'

const vacia: PlataformaRequest = { codigo: '', nombre: '', url: '', iconoUrl: '' }

function Campo({ rotulo, valor, onChange }: {
  rotulo: string
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</span>
      <Input value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/** Formulario compartido por crear y editar. */
function FormularioPlataforma({ inicial, accion, guardando, onGuardar, onCancelar }: {
  inicial: PlataformaRequest
  accion: 'Crear' | 'Guardar'
  guardando: boolean
  onGuardar: (f: PlataformaRequest) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState<PlataformaRequest>(inicial)
  const [feedback, setFeedback] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <Campo rotulo="Código" valor={form.codigo} onChange={(v) => setForm((f) => ({ ...f, codigo: v }))} />
      <Campo rotulo="Nombre" valor={form.nombre} onChange={(v) => setForm((f) => ({ ...f, nombre: v }))} />
      <Campo rotulo="URL" valor={form.url} onChange={(v) => setForm((f) => ({ ...f, url: v }))} />
      <Campo rotulo="Icono (URL)" valor={form.iconoUrl ?? ''} onChange={(v) => setForm((f) => ({ ...f, iconoUrl: v }))} />
      {feedback && <p className="text-xs text-destructive">{feedback}</p>}
      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={guardando} onClick={async () => {
          if (!form.codigo.trim() || !form.nombre.trim() || !form.url.trim()) {
            setFeedback('Código, nombre y enlace son obligatorios')
            return
          }
          await onGuardar(form)
        }}>
          {guardando && <CircleNotch className="size-4 animate-spin" />}
          {accion}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

export function PanelPlataformas() {
  const [plataformas, setPlataformas] = useState<PlataformaResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setPlataformas(await plataformasApi.catalogo())
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const guardar = async (f: PlataformaRequest) => {
    setGuardando(true)
    setFeedback(null)
    try {
      if (editandoId === 'nueva') {
        await plataformasApi.crear(f)
        setFeedback({ tipo: 'exito', texto: 'Plataforma creada' })
      } else if (editandoId) {
        await plataformasApi.actualizar(editandoId, f)
        setFeedback({ tipo: 'exito', texto: 'Plataforma actualizada' })
      }
      setEditandoId(null)
      await cargar()
    } catch (err) {
      setFeedback({ tipo: 'error', texto: errorDe(err) })
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!confirmarBorrado) return
    try {
      await plataformasApi.eliminar(confirmarBorrado)
      setFeedback({ tipo: 'exito', texto: 'Plataforma desactivada' })
      setConfirmarBorrado(null)
      await cargar()
    } catch (err) {
      setFeedback({ tipo: 'error', texto: errorDe(err) })
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <CircleNotch className="size-5 animate-spin" />
        Cargando plataformas…
      </div>
    )
  }

  if (error && plataformas.length === 0) {
    return (
      <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        <WarningCircle className="size-5 shrink-0" />
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Plataformas de acceso</h2>
          <p className="mt-1 text-sm text-muted-foreground">Las plataformas en sí. La visibilidad se decide por programa y luego por estudiante.</p>
        </div>
        {editandoId === null && (
          <Button onClick={() => setEditandoId('nueva')}>
            <Plus className="size-4" />
            Nueva plataforma
          </Button>
        )}
      </div>

      {feedback && (
        <div className={feedback.tipo === 'exito'
          ? 'flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700'
          : 'flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive'}>
          {feedback.tipo === 'exito' ? <CheckCircle className="size-4 shrink-0" /> : <WarningCircle className="size-4 shrink-0" />}
          {feedback.texto}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {plataformas.map((p) => (
          <Card key={p.id} className="p-4 shadow-none">
            {editandoId === p.id ? (
              <FormularioPlataforma
                inicial={{ codigo: p.codigo, nombre: p.nombre, url: p.url, iconoUrl: p.iconoUrl ?? '' }}
                accion="Guardar"
                guardando={guardando}
                onGuardar={guardar}
                onCancelar={() => setEditandoId(null)}
              />
            ) : (
              <div className="flex items-start gap-3">
                {p.iconoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.iconoUrl} alt="" className="size-10 shrink-0 rounded-lg border border-border bg-muted object-contain p-1" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{p.nombre.charAt(0).toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">{p.nombre}</h3>
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{p.codigo}</span>
                  </div>
                  <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 break-all text-xs text-primary hover:underline">
                    {p.url}
                    <ArrowSquareOut className="size-3 shrink-0" />
                  </a>
                  <div className="mt-3 flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditandoId(p.id)}><PencilSimple className="size-3.5" />Editar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmarBorrado(p.id)}><Trash className="size-3.5" />Eliminar</Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}

        {editandoId === 'nueva' && (
          <Card className="border-primary/40 p-4 shadow-none">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Nueva plataforma</h3>
            <FormularioPlataforma
              inicial={vacia}
              accion="Crear"
              guardando={guardando}
              onGuardar={guardar}
              onCancelar={() => setEditandoId(null)}
            />
          </Card>
        )}
      </div>

      {plataformas.length === 0 && editandoId !== 'nueva' && (
        <p className="text-sm text-muted-foreground">Aún no hay plataformas. Crea la primera.</p>
      )}

      <Confirmar
        open={confirmarBorrado !== null}
        onOpenChange={(open) => { if (!open) setConfirmarBorrado(null) }}
        titulo="Desactivar plataforma"
        descripcion="La plataforma deja de ofrecerse y de aparecer en los portales. Las asignaciones existentes no se borran."
        textoConfirmar="Desactivar"
        onConfirmar={borrar}
      />
    </div>
  )
}