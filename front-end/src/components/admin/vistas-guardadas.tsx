'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Check, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useConfirmar } from '@/components/ui/confirmar'
import { vistasApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import type { ModuloDeVista, VistaGuardada } from '@/lib/types'

type Props<F extends object> = {
  modulo: ModuloDeVista
  /** Los filtros aplicados ahora mismo en la pantalla. */
  filtrosActuales: F
  /**
   * Aplica una vista.
   *
   * Recibe el objeto ya parseado. La pantalla decide qué hacer con cada clave
   * y **ha de ignorar las que no conozca**: una vista guardada hace meses puede
   * traer un filtro que ya no existe, y reventar al abrirla sería peor que
   * filtrar de menos.
   */
  onAplicar: (filtros: Record<string, unknown>) => void
  /** Si hay algo filtrado. Sin esto no tiene sentido ofrecer guardar. */
  hayFiltros: boolean
}

/**
 * Vistas guardadas de una lista.
 *
 * <p>Lo que resuelve no es el ahorro de clics. Mientras cada coordinador
 * reconstruye «los activos sin colocar» a mano, dos personas que dicen mirar lo
 * mismo miran conjuntos distintos y las cifras de la reunión no cuadran sin que
 * nadie sepa por qué. Una vista compartida es un acuerdo sobre qué significa
 * esa frase.
 */
export function VistasGuardadas<F extends object>({
  modulo,
  filtrosActuales,
  onAplicar,
  hayFiltros,
}: Props<F>) {
  const { locale } = usePreferences()
  const en = locale === 'en'
  const { confirmar, dialogo } = useConfirmar()

  const [vistas, setVistas] = useState<VistaGuardada[]>([])
  const [aplicada, setAplicada] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [compartir, setCompartir] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setVistas(await vistasApi.listar(modulo))
    } catch {
      // Que fallen las vistas no puede romper la lista: es una comodidad
      // encima de una pantalla que funciona sin ellas.
    }
  }, [modulo])

  useEffect(() => { void cargar() }, [cargar])

  const aplicar = (v: VistaGuardada) => {
    let filtros: Record<string, unknown> = {}
    try {
      const parseado = JSON.parse(v.filtros)
      if (parseado && typeof parseado === 'object' && !Array.isArray(parseado)) {
        filtros = parseado as Record<string, unknown>
      }
    } catch {
      // Una vista con JSON corrupto se aplica como «sin filtros» en vez de
      // tirar la pantalla. El backend ya valida al guardar, así que esto solo
      // cubre datos anteriores a esa validación.
    }
    onAplicar(filtros)
    setAplicada(v.id)
  }

  const guardar = async () => {
    const limpio = nombre.trim()
    if (!limpio) return
    setError(null)
    try {
      await vistasApi.guardar({
        modulo,
        nombre: limpio,
        filtros: JSON.stringify(filtrosActuales),
        compartida: compartir,
      })
      setNombre('')
      setCompartir(false)
      setGuardando(false)
      await cargar()
    } catch (e) {
      setError(errorDe(e, en ? 'Could not save the view.' : 'No se pudo guardar la vista.'))
    }
  }

  const borrar = async (v: VistaGuardada) => {
    const ok = await confirmar({
      titulo: en ? `Delete “${v.nombre}”?` : `¿Borrar «${v.nombre}»?`,
      descripcion: v.compartida
        ? (en
            ? 'It is shared: it will disappear for everyone on the team.'
            : 'Está compartida: desaparece para todo el equipo.')
        : undefined,
      textoConfirmar: en ? 'Delete view' : 'Borrar vista',
    })
    if (!ok) return
    try {
      await vistasApi.eliminar(v.id)
      if (aplicada === v.id) setAplicada(null)
      await cargar()
    } catch (e) {
      setError(errorDe(e))
    }
  }

  const activa = vistas.find((v) => v.id === aplicada)

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <Bookmark className={cn('size-3.5', activa && 'fill-current')} />
              {activa ? activa.nombre : (en ? 'Views' : 'Vistas')}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {en ? 'Saved views' : 'Vistas guardadas'}
          </DropdownMenuLabel>

          {vistas.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {en
                ? 'None yet. Filter the list and save it.'
                : 'Ninguna todavía. Filtra la lista y guárdala.'}
            </p>
          )}

          {vistas.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onClick={() => aplicar(v)}
              className="flex items-center gap-2"
            >
              {aplicada === v.id
                ? <Check className="size-3.5 shrink-0 text-primary" />
                : <span className="size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{v.nombre}</span>
              {/* Quién la comparte importa: al abrir una vista ajena conviene
                  saber que no eres tú quien decide qué significa. */}
              {v.compartida && !v.mia && (
                <Users className="size-3 shrink-0 text-muted-foreground" />
              )}
              {v.mia && (
                <button
                  type="button"
                  aria-label={en ? 'Delete view' : 'Borrar vista'}
                  onClick={(e) => { e.stopPropagation(); void borrar(v) }}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </DropdownMenuItem>
          ))}

          {activa && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setAplicada(null); onAplicar({}) }}>
                <X className="size-3.5" />
                {en ? 'Clear view' : 'Quitar la vista'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Guardar solo aparece si hay algo que guardar: el botón sobre una lista
          sin filtrar crearía vistas vacías que no hacen nada. */}
      {hayFiltros && !guardando && (
        <Button variant="ghost" size="sm" onClick={() => setGuardando(true)}>
          {en ? 'Save view' : 'Guardar vista'}
        </Button>
      )}

      {guardando && (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void guardar()
              if (e.key === 'Escape') { setGuardando(false); setNombre('') }
            }}
            placeholder={en ? 'View name' : 'Nombre de la vista'}
            className="h-8 w-44"
          />
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={compartir}
              onChange={(e) => setCompartir(e.target.checked)}
            />
            {en ? 'Share' : 'Compartir'}
          </label>
          <Button size="sm" onClick={() => void guardar()} disabled={!nombre.trim()}>
            {en ? 'Save' : 'Guardar'}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={en ? 'Cancel' : 'Cancelar'}
            onClick={() => { setGuardando(false); setNombre(''); setError(null) }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      {dialogo}
    </div>
  )
}
