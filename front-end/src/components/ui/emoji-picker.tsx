import { useEffect, useMemo, useState } from 'react'
import { Search as MagnifyingGlass } from 'lucide-react'
import { CATEGORIAS_EMOJI, buscarEmojis } from '@/lib/emojis'
import { cn } from '@/lib/utils'

const CLAVE_RECIENTES = 'nova-crm:emojis-recientes'
const MAXIMO_RECIENTES = 24

/**
 * Los últimos que se usaron, guardados en el navegador.
 *
 * <p>Es la categoría que más se usa en cualquier chat: la gente repite cuatro o
 * cinco emojis y los quiere a un toque. Se guardan en localStorage y no en el
 * servidor porque son una preferencia de esta máquina, no un dato del programa.
 */
function leerRecientes(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const crudo = window.localStorage.getItem(CLAVE_RECIENTES)
    const lista: unknown = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? lista.filter((e): e is string => typeof e === 'string') : []
  } catch {
    // Un localStorage lleno o bloqueado no puede impedir escribir un mensaje.
    return []
  }
}

function guardarReciente(emoji: string) {
  if (typeof window === 'undefined') return
  try {
    const siguiente = [emoji, ...leerRecientes().filter((e) => e !== emoji)].slice(0, MAXIMO_RECIENTES)
    window.localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(siguiente))
  } catch {
    // Igual que arriba: se pierde el histórico, no el mensaje.
  }
}

interface Props {
  onSelect: (emoji: string) => void
  english?: boolean
  className?: string
}

/**
 * Buscador de emojis por categorías.
 *
 * <p>Sustituye a la tira de diez emojis fijos que había en el chat. El catálogo
 * es una selección y no el juego completo de Unicode: ver `lib/emojis.ts`.
 */
export function EmojiPicker({ onSelect, english = false, className }: Props) {
  const [termino, setTermino] = useState('')
  const [categoria, setCategoria] = useState<string>('recientes')
  const [recientes, setRecientes] = useState<string[]>([])

  // En el primer render del cliente: en el servidor no hay localStorage.
  useEffect(() => {
    const guardados = leerRecientes()
    setRecientes(guardados)
    if (guardados.length === 0) setCategoria(CATEGORIAS_EMOJI[0].id)
  }, [])

  const resultados = useMemo(() => (termino.trim() ? buscarEmojis(termino) : null), [termino])

  const elegir = (emoji: string) => {
    guardarReciente(emoji)
    setRecientes((previos) => [emoji, ...previos.filter((e) => e !== emoji)].slice(0, MAXIMO_RECIENTES))
    onSelect(emoji)
  }

  const activa = CATEGORIAS_EMOJI.find((c) => c.id === categoria)
  const aMostrar = resultados
    ? resultados.map((e) => e.char)
    : categoria === 'recientes'
      ? recientes
      : (activa?.emojis ?? []).map((e) => e.char)

  return (
    <div className={cn('flex h-64 flex-col border-t border-border bg-card dark:bg-[#0f172a]', className)}>
      <div className="p-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder={english ? 'Search emoji' : 'Buscar emoji'}
            className="w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {aMostrar.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {termino.trim()
              ? (english ? 'No emoji matches that.' : 'Ningún emoji coincide con eso.')
              : (english ? 'You have not used any yet.' : 'Todavía no has usado ninguno.')}
          </p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {aMostrar.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => elegir(emoji)}
                className="rounded-lg p-1.5 text-lg transition hover:bg-muted"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Las categorías se ocultan mientras se busca: el resultado ya es de
          todas, y dejar una marcada haría creer que filtra dentro de ella. */}
      {!termino.trim() && (
        <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-border p-1.5">
          <button
            type="button"
            onClick={() => setCategoria('recientes')}
            title={english ? 'Recent' : 'Recientes'}
            className={cn(
              'shrink-0 rounded-lg px-2 py-1 text-base transition',
              categoria === 'recientes' ? 'bg-primary/15' : 'hover:bg-muted',
            )}
          >
            🕘
          </button>
          {CATEGORIAS_EMOJI.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoria(c.id)}
              title={english ? c.etiqueta.en : c.etiqueta.es}
              className={cn(
                'shrink-0 rounded-lg px-2 py-1 text-base transition',
                categoria === c.id ? 'bg-primary/15' : 'hover:bg-muted',
              )}
            >
              {c.icono}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
