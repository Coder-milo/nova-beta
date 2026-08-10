'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * El zorro del asistente: un botón flotante que se puede arrastrar.
 *
 * <p>Se queda pegado al lado izquierdo o derecho de la ventana, el que quede
 * más cerca al soltarlo, y recuerda dónde lo dejaron. Arrastrar y pulsar son la
 * misma interacción con el mismo dedo, así que se distinguen por distancia: por
 * debajo de {@link UMBRAL_ARRASTRE} píxeles se considera una pulsación y se
 * abre el chat; por encima, se estaba moviendo y no se abre nada. Sin ese
 * umbral, cada intento de moverlo abriría el asistente al soltar.
 */

/** Píxeles que hay que mover antes de que deje de ser una pulsación. */
const UMBRAL_ARRASTRE = 6

/** Lo que ocupa el zorro. Se usa para que no se salga por abajo ni por arriba. */
const TAMANO = 60

const CLAVE_POSICION = 'nova-crm:zorro-posicion'

interface Posicion {
  lado: 'izquierda' | 'derecha'
  /** Distancia desde arriba, en píxeles. */
  y: number
}

function leerPosicion(): Posicion {
  if (typeof window === 'undefined') return { lado: 'derecha', y: 0 }
  const porDefecto: Posicion = {
    lado: 'derecha',
    y: Math.max(16, window.innerHeight - TAMANO - 24),
  }
  try {
    const crudo = window.localStorage.getItem(CLAVE_POSICION)
    if (!crudo) return porDefecto
    const guardada = JSON.parse(crudo) as Partial<Posicion>
    if (guardada?.lado !== 'izquierda' && guardada?.lado !== 'derecha') return porDefecto
    if (typeof guardada.y !== 'number') return porDefecto
    return { lado: guardada.lado, y: guardada.y }
  } catch {
    // Un localStorage bloqueado no puede dejar sin asistente a nadie.
    return porDefecto
  }
}

interface Props {
  /** Si el panel del asistente está abierto, para cambiar la cara del zorro. */
  abierto: boolean
  onToggle: () => void
  etiqueta: string
  /** Avisa del lado en el que quedó, para que el panel salga por ese lado. */
  onLadoChange?: (lado: 'izquierda' | 'derecha') => void
}

export function ZorroAsistente({ abierto, onToggle, etiqueta, onLadoChange }: Props) {
  const [posicion, setPosicion] = useState<Posicion>({ lado: 'derecha', y: 0 })
  const [montado, setMontado] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  const inicioRef = useRef<{ x: number; y: number; movido: boolean } | null>(null)
  const punteroRef = useRef<{ x: number; y: number } | null>(null)

  // En el cliente: en el servidor no hay ventana ni localStorage.
  useEffect(() => {
    const inicial = leerPosicion()
    setPosicion(inicial)
    setMontado(true)
    onLadoChange?.(inicial.lado)
    // Solo al montar: después manda lo que el usuario arrastre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Si la ventana encoge, el zorro no puede quedarse fuera de la pantalla.
  useEffect(() => {
    if (!montado) return
    const alRedimensionar = () => {
      setPosicion((previa) => ({
        ...previa,
        y: Math.min(previa.y, Math.max(16, window.innerHeight - TAMANO - 16)),
      }))
    }
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [montado])

  const guardar = useCallback((siguiente: Posicion) => {
    setPosicion(siguiente)
    onLadoChange?.(siguiente.lado)
    try {
      window.localStorage.setItem(CLAVE_POSICION, JSON.stringify(siguiente))
    } catch {
      // Se pierde dónde lo dejó, no el asistente.
    }
  }, [onLadoChange])

  const alBajarPuntero = (evento: React.PointerEvent<HTMLButtonElement>) => {
    evento.currentTarget.setPointerCapture(evento.pointerId)
    inicioRef.current = { x: evento.clientX, y: evento.clientY, movido: false }
    punteroRef.current = { x: evento.clientX, y: evento.clientY }
  }

  const alMoverPuntero = (evento: React.PointerEvent<HTMLButtonElement>) => {
    const inicio = inicioRef.current
    if (!inicio) return
    const dx = evento.clientX - inicio.x
    const dy = evento.clientY - inicio.y
    if (!inicio.movido && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return

    inicio.movido = true
    setArrastrando(true)
    punteroRef.current = { x: evento.clientX, y: evento.clientY }
    setPosicion((previa) => ({
      ...previa,
      y: Math.min(
        Math.max(16, evento.clientY - TAMANO / 2),
        Math.max(16, window.innerHeight - TAMANO - 16),
      ),
    }))
  }

  const alSoltarPuntero = (evento: React.PointerEvent<HTMLButtonElement>) => {
    const inicio = inicioRef.current
    inicioRef.current = null
    setArrastrando(false)
    if (!inicio) return

    if (!inicio.movido) {
      // Fue una pulsación: abre o cierra el chat.
      onToggle()
      return
    }
    // Se soltó tras arrastrar: se pega al lado más cercano.
    const lado = evento.clientX < window.innerWidth / 2 ? 'izquierda' : 'derecha'
    guardar({ lado, y: posicion.y })
  }

  // Hasta saber el alto de la ventana no se pinta, o daría un salto al montar.
  if (!montado) return null

  return (
    <button
      type="button"
      onPointerDown={alBajarPuntero}
      onPointerMove={alMoverPuntero}
      onPointerUp={alSoltarPuntero}
      onPointerCancel={() => { inicioRef.current = null; setArrastrando(false) }}
      onKeyDown={(evento) => {
        // Con teclado se mueve con las flechas; Enter y Espacio ya los maneja
        // el navegador como pulsación del botón.
        if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
          evento.preventDefault()
          const paso = evento.key === 'ArrowUp' ? -24 : 24
          guardar({
            ...posicion,
            y: Math.min(Math.max(16, posicion.y + paso), Math.max(16, window.innerHeight - TAMANO - 16)),
          })
        }
        if (evento.key === 'ArrowLeft') guardar({ ...posicion, lado: 'izquierda' })
        if (evento.key === 'ArrowRight') guardar({ ...posicion, lado: 'derecha' })
      }}
      aria-label={etiqueta}
      aria-expanded={abierto}
      title={etiqueta}
      style={{
        top: posicion.y,
        ...(posicion.lado === 'derecha' ? { right: 12 } : { left: 12 }),
      }}
      className={cn(
        'fixed z-50 flex size-[60px] touch-none select-none items-center justify-center rounded-full',
        'border border-primary/25 bg-card/95 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl',
        'hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        // Al arrastrar no hay transición: si no, el zorro persigue al dedo con
        // retraso y se siente pegajoso.
        arrastrando ? 'cursor-grabbing scale-105' : 'cursor-grab transition-all duration-300 hover:scale-105',
        abierto && 'border-primary ring-2 ring-primary/30',
      )}
    >
      <CaraDeZorro abierto={abierto} arrastrando={arrastrando} />
      {/* El halo sigue al color de marca, así que cambia con el del proyecto. */}
      <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/20 blur-md" />
    </button>
  )
}

/**
 * La cara del zorro.
 *
 * <p>Va en SVG y no como imagen: se sirve con el resto del código —nada que
 * descargar, nada que falle— y escala sin verse borrosa. Los naranjas son
 * suyos y no del tema: un zorro azul deja de ser un zorro. Lo que sí sigue a
 * la marca es el aro y el halo del botón.
 */
function CaraDeZorro({ abierto, arrastrando }: { abierto: boolean; arrastrando: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('size-11 transition-transform duration-300', arrastrando && 'rotate-6')}
      aria-hidden="true"
    >
      {/* Orejas */}
      <path d="M12 20 L16 4 L30 14 Z" fill="#E8792B" />
      <path d="M52 20 L48 4 L34 14 Z" fill="#E8792B" />
      <path d="M15 17 L17 9 L25 15 Z" fill="#8C3A12" />
      <path d="M49 17 L47 9 L39 15 Z" fill="#8C3A12" />

      {/* Cabeza */}
      <path d="M32 12 C46 12 54 22 54 33 C54 46 44 55 32 55 C20 55 10 46 10 33 C10 22 18 12 32 12 Z" fill="#F08A3C" />

      {/* Mejillas claras, que es lo que hace que se lea como zorro y no como gato */}
      <path d="M32 30 C40 30 47 34 47 40 C47 48 40 55 32 55 C24 55 17 48 17 40 C17 34 24 30 32 30 Z" fill="#FDF3E7" />

      {/* Ojos. Cerrados cuando el chat está abierto: el zorro «te atiende». */}
      {abierto ? (
        <>
          <path d="M20 31 q4 4 8 0" stroke="#2A1508" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M36 31 q4 4 8 0" stroke="#2A1508" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="24" cy="31" rx="3.2" ry="3.6" fill="#2A1508" />
          <ellipse cx="40" cy="31" rx="3.2" ry="3.6" fill="#2A1508" />
          <circle cx="25.1" cy="29.8" r="1.1" fill="#FFFFFF" />
          <circle cx="41.1" cy="29.8" r="1.1" fill="#FFFFFF" />
        </>
      )}

      {/* Hocico */}
      <path d="M32 38 L28 42 Q32 46 36 42 Z" fill="#2A1508" />
      <path d="M32 44 v4" stroke="#2A1508" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
