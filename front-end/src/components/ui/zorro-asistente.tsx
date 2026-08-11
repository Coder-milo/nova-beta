'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * El zorro del asistente: personaje 3D de videojuego compacto e interactivo.
 *
 * <p>El personaje flota directamente sobre la pantalla como un modelo 3D compacto
 * con volumen esférico, luces de relieve y pedestal de energía bajo los pies.
 * Se orienta automáticamente hacia el centro según el lado en el que se ubique (izquierda/derecha),
 * e interactúa con gestos de arrastre (inclinación en vuelo, ojos O_O), pulsación instantánea
 * para abrir/cerrar el chat (salto 3D y ojos ^_^) y reposo.
 */

/** Píxeles que hay que mover antes de que deje de ser una pulsación. */
const UMBRAL_ARRASTRE = 6

/** Lo que ocupa el personaje compacto en pantalla. */
const TAMANO_Y = 72
const TAMANO_X = 66

const CLAVE_POSICION_DEFECTO = 'nova-crm:zorro-posicion'

interface Posicion {
  lado: 'izquierda' | 'derecha'
  /** Distancia desde arriba, en píxeles. */
  y: number
}

function leerPosicion(clave = CLAVE_POSICION_DEFECTO): Posicion {
  if (typeof window === 'undefined') return { lado: 'derecha', y: 0 }
  const porDefecto: Posicion = {
    lado: 'derecha',
    y: Math.max(16, window.innerHeight - TAMANO_Y - 24),
  }
  try {
    const crudo = window.localStorage.getItem(clave)
    if (!crudo) return porDefecto
    const guardada = JSON.parse(crudo) as Partial<Posicion>
    if (guardada?.lado !== 'izquierda' && guardada?.lado !== 'derecha') return porDefecto
    if (typeof guardada.y !== 'number') return porDefecto
    return { lado: guardada.lado, y: guardada.y }
  } catch {
    return porDefecto
  }
}

interface Props {
  /** Si el panel del asistente está abierto, para cambiar la cara y pose del zorro. */
  abierto: boolean
  onToggle: () => void
  etiqueta: string
  /** Clave opcional de localStorage para aislar la posición entre admin y estudiante. */
  claveStorage?: string
  /** Avisa del lado en el que quedó, para que el panel salga por ese lado. */
  onLadoChange?: (lado: 'izquierda' | 'derecha') => void
}

export function ZorroAsistente({
  abierto,
  onToggle,
  etiqueta,
  claveStorage = CLAVE_POSICION_DEFECTO,
  onLadoChange,
}: Props) {
  const [posicion, setPosicion] = useState<Posicion>({ lado: 'derecha', y: 0 })
  const [montado, setMontado] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  const inicioRef = useRef<{ x: number; y: number; movido: boolean } | null>(null)
  const punteroRef = useRef<{ x: number; y: number } | null>(null)
  const botonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const inicial = leerPosicion(claveStorage)
    setPosicion(inicial)
    setMontado(true)
    onLadoChange?.(inicial.lado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveStorage])

  useEffect(() => {
    if (!montado) return
    const alRedimensionar = () => {
      setPosicion((previa) => ({
        ...previa,
        y: Math.min(previa.y, Math.max(16, window.innerHeight - TAMANO_Y - 16)),
      }))
    }
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [montado])

  const guardar = useCallback(
    (siguiente: Posicion) => {
      setPosicion(siguiente)
      onLadoChange?.(siguiente.lado)
      try {
        window.localStorage.setItem(claveStorage, JSON.stringify(siguiente))
      } catch {
        // noop
      }
    },
    [claveStorage, onLadoChange],
  )

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
        Math.max(16, evento.clientY - TAMANO_Y / 2),
        Math.max(16, window.innerHeight - TAMANO_Y - 16),
      ),
    }))
  }

  const alSoltarPuntero = (evento: React.PointerEvent<HTMLButtonElement>) => {
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      try {
        evento.currentTarget.releasePointerCapture(evento.pointerId)
      } catch {
        // noop
      }
    }
    const inicio = inicioRef.current
    const puntero = punteroRef.current
    const eraMovido = inicio?.movido
    setArrastrando(false)

    if (eraMovido && puntero) {
      const centroX = window.innerWidth / 2
      const nuevoLado: 'izquierda' | 'derecha' = puntero.x < centroX ? 'izquierda' : 'derecha'
      guardar({ lado: nuevoLado, y: posicion.y })
    }
  }

  const alPulsarBoton = () => {
    const movido = inicioRef.current?.movido
    inicioRef.current = null
    punteroRef.current = null
    if (movido) return
    onToggle()
  }

  if (!montado) return null

  const facingLeft = posicion.lado === 'izquierda'

  return (
    <button
      ref={botonRef}
      type="button"
      onPointerDown={alBajarPuntero}
      onPointerMove={alMoverPuntero}
      onPointerUp={alSoltarPuntero}
      onPointerCancel={() => {
        inicioRef.current = null
        setArrastrando(false)
      }}
      onClick={alPulsarBoton}
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
          evento.preventDefault()
          const paso = evento.key === 'ArrowUp' ? -24 : 24
          guardar({
            ...posicion,
            y: Math.min(Math.max(16, posicion.y + paso), Math.max(16, window.innerHeight - TAMANO_Y - 16)),
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
        ...(facingLeft ? { left: 16 } : { right: 16 }),
      }}
      className={cn(
        'group fixed z-50 flex h-[76px] w-[68px] flex-col items-center justify-end touch-none select-none pointer-events-auto outline-none',
        arrastrando ? 'cursor-grabbing' : 'cursor-grab',
      )}
    >
      {/* ── PEDESTAL DE ENERGÍA Y SOMBRA DE SUELO 3D ─────────────────────── */}
      <div className="relative flex w-full items-center justify-center">
        {/* Sombra proyectada en el suelo 3D */}
        <div
          className={cn(
            'absolute -bottom-1 h-3 w-14 rounded-[100%] bg-primary/30 blur-sm transition-all duration-300 transform-gpu',
            'group-hover:w-16 group-hover:bg-primary/50 group-hover:blur-md',
            arrastrando && 'w-10 bg-primary/20 blur-xs scale-90',
            abierto && 'bg-primary/60 blur-md scale-110',
          )}
        />
        {/* Halo concéntrico brillante bajo el personaje */}
        <span
          className={cn(
            'absolute -bottom-1 h-2.5 w-12 rounded-[100%] border border-primary/60 opacity-70 transition-all duration-300',
            !arrastrando && 'animate-ping',
          )}
        />

        {/* ── AVATAR 3D COMPACTO DEL ZORRO CON VOLUMEN Y ORIENTACIÓN ───────── */}
        <div
          className={cn(
            'relative z-10 transition-all duration-300 transform-gpu',
            facingLeft && 'scale-x-[-1]', // Se orienta automáticamente mirando hacia el centro de la pantalla
            arrastrando
              ? 'rotate-12 scale-105 -translate-y-1.5'
              : 'group-hover:-translate-y-2 group-hover:scale-105 active:scale-95',
            abierto && '-translate-y-2 scale-110',
          )}
        >
          <PersonajeZorro3D abierto={abierto} arrastrando={arrastrando} />
        </div>
      </div>
    </button>
  )
}

/**
 * Renderizado de personaje 3D compacto con orejas firmemente integradas y sombreado esférico.
 */
function PersonajeZorro3D({ abierto, arrastrando }: { abierto: boolean; arrastrando: boolean }) {
  return (
    <svg
      viewBox="0 0 100 105"
      className="h-[68px] w-[68px] drop-shadow-[0_8px_18px_rgba(0,0,0,0.3)] transition-transform duration-300 transform-gpu"
      aria-hidden="true"
    >
      <defs>
        {/* ── GRADIENTES Y LUCES 3D ────────────────────────────────────────── */}

        {/* Luz esférica 3D para la cabeza y cuerpo */}
        <radialGradient id="zorro3d-cabeza" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#FFB74D" />
          <stop offset="50%" stopColor="#FF9800" />
          <stop offset="85%" stopColor="#F57C00" />
          <stop offset="100%" stopColor="#E65100" />
        </radialGradient>

        {/* Volumen 3D para patas y cuerpo inferior */}
        <linearGradient id="zorro3d-cuerpo-sombra" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFA726" />
          <stop offset="70%" stopColor="#F57C00" />
          <stop offset="100%" stopColor="#BF360C" />
        </linearGradient>

        {/* Volumen 3D para el pecho esponjoso de nieve */}
        <radialGradient id="zorro3d-pecho" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#FFF3E0" />
          <stop offset="100%" stopColor="#FFE0B2" />
        </radialGradient>

        {/* Interior 3D profundo de las orejas */}
        <linearGradient id="zorro3d-oreja-interior" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A1421E" />
          <stop offset="100%" stopColor="#3E1508" />
        </linearGradient>

        {/* Brillo 3D para los ojos estilo cristal de videojuego */}
        <radialGradient id="zorro3d-ojo-gloss" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#422013" />
          <stop offset="80%" stopColor="#1C0A04" />
          <stop offset="100%" stopColor="#0D0401" />
        </radialGradient>

        {/* Sombra de oclusión suave entre extremidades */}
        <filter id="zorro3d-sombra-oclusion" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter="url(#zorro3d-sombra-oclusion)">
        {/* ── COLA ESPONJOSA 3D VOLUMÉTRICA ───────────────────────────────── */}
        <g className={cn('origin-bottom-right transition-transform duration-500', arrastrando ? '-rotate-12' : 'group-hover:rotate-6')}>
          <path
            d="M62 60 C86 58 98 42 92 24 C86 12 70 18 64 30 C58 40 56 50 62 60 Z"
            fill="url(#zorro3d-cabeza)"
            stroke="#D84315"
            strokeWidth="1.5"
          />
          <path
            d="M62 60 C74 58 84 50 86 38 C76 46 66 52 62 60 Z"
            fill="#BF360C"
            opacity="0.3"
          />
          <path
            d="M92 24 C90 16 78 18 72 24 C76 30 80 36 86 34 C91 32 93 27 92 24 Z"
            fill="url(#zorro3d-pecho)"
          />
        </g>

        {/* ── PATAS TRASERAS 3D SENTADAS / APOYADAS ─────────────────────── */}
        <ellipse cx="28" cy="76" rx="12" ry="8" fill="url(#zorro3d-cuerpo-sombra)" />
        <ellipse cx="72" cy="76" rx="12" ry="8" fill="url(#zorro3d-cuerpo-sombra)" />
        <ellipse cx="25" cy="80" rx="7.5" ry="4.5" fill="#261208" />
        <ellipse cx="75" cy="80" rx="7.5" ry="4.5" fill="#261208" />
        <ellipse cx="24" cy="79" rx="3" ry="1.5" fill="#522C1A" opacity="0.6" />
        <ellipse cx="74" cy="79" rx="3" ry="1.5" fill="#522C1A" opacity="0.6" />

        {/* ── CUERPO TORSO 3D CON VOLUMEN Y LUZ ESFÉRICA ────────────────── */}
        <path
          d="M32 48 C32 38 68 38 68 48 C72 64 66 80 50 80 C34 80 28 64 32 48 Z"
          fill="url(#zorro3d-cabeza)"
          stroke="#D84315"
          strokeWidth="1.5"
        />
        <path
          d="M40 48 C40 44 60 44 60 48 C64 60 58 76 50 76 C42 76 36 60 40 48 Z"
          fill="url(#zorro3d-pecho)"
        />

        {/* ── PATITAS DELANTERAS 3D CORTAS ────────────────────────────────── */}
        <path d="M38 58 C38 58 40 76 42 77 C44 78 46 76 45 70 C44 64 43 58 43 58 Z" fill="#261208" />
        <path d="M62 58 C62 58 60 76 58 77 C56 78 54 76 55 70 C56 64 57 58 57 58 Z" fill="#261208" />

        {/* ── OREJAS 3D FIRMEMENTE ENSAMBLADAS A LA CABEZA ───────────────── */}
        {/* Oreja Izquierda 3D (Ensamblada sin desprendimiento) */}
        <path d="M22 36 L28 4 L48 24 Z" fill="url(#zorro3d-cabeza)" stroke="#D84315" strokeWidth="1.5" />
        <path d="M26 28 L30 11 L42 23 Z" fill="url(#zorro3d-oreja-interior)" />

        {/* Oreja Derecha 3D (Ensamblada sin desprendimiento) */}
        <path d="M78 36 L72 4 L52 24 Z" fill="url(#zorro3d-cabeza)" stroke="#D84315" strokeWidth="1.5" />
        <path d="M74 28 L70 11 L58 23 Z" fill="url(#zorro3d-oreja-interior)" />

        {/* ── CABEZA ESFÉRICA 3D CON LUZ LATERAL Y SOMBRAS ────────────────── */}
        <path
          d="M50 18 C72 18 82 31 82 44 C82 60 67 65 50 65 C33 65 18 60 18 44 C18 31 28 18 50 18 Z"
          fill="url(#zorro3d-cabeza)"
          stroke="#D84315"
          strokeWidth="1.5"
        />

        {/* Brillo volumétrico 3D de luz superior en la frente */}
        <ellipse cx="44" cy="24" rx="18" ry="5" fill="#FFFFFF" opacity="0.25" />

        {/* Cachetes 3D peludos acolchados de nieve */}
        <path
          d="M50 38 C65 38 76 44 76 52 C76 62 65 65 50 65 C35 65 24 62 24 52 C24 44 35 38 50 38 Z"
          fill="url(#zorro3d-pecho)"
        />

        {/* Rubor cálido en los pómulos */}
        <ellipse cx="31" cy="50" rx="4.5" ry="2.8" fill="#FF3D00" opacity="0.45" />
        <ellipse cx="69" cy="50" rx="4.5" ry="2.8" fill="#FF3D00" opacity="0.45" />

        {/* ── OJOS 3D DE CRISTAL EXPRESIVOS (REPOSO, ABIERTO O ARRASTRANDO) ─ */}
        {arrastrando ? (
          <>
            <circle cx="37" cy="42" r="6.5" fill="url(#zorro3d-ojo-gloss)" />
            <circle cx="63" cy="42" r="6.5" fill="url(#zorro3d-ojo-gloss)" />
            <circle cx="39" cy="40" r="2.8" fill="#FFFFFF" />
            <circle cx="65" cy="40" r="2.8" fill="#FFFFFF" />
          </>
        ) : abierto ? (
          <>
            <path
              d="M30 44 Q37 36 44 44"
              stroke="#261208"
              strokeWidth="3.8"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M56 44 Q63 36 70 44"
              stroke="#261208"
              strokeWidth="3.8"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <ellipse cx="37" cy="43" rx="5" ry="6" fill="url(#zorro3d-ojo-gloss)" />
            <ellipse cx="63" cy="43" rx="5" ry="6" fill="url(#zorro3d-ojo-gloss)" />
            <circle cx="39" cy="41" r="2.2" fill="#FFFFFF" />
            <circle cx="65" cy="41" r="2.2" fill="#FFFFFF" />
            <circle cx="35" cy="45" r="1.1" fill="#FFFFFF" opacity="0.85" />
            <circle cx="61" cy="45" r="1.1" fill="#FFFFFF" opacity="0.85" />
          </>
        )}

        {/* ── HOCICO 3D Y NARIZ BRILLANTE DE VIDEOJUEGO ───────────────────── */}
        <path d="M50 49 L43 54 Q50 59 57 54 Z" fill="#261208" />
        <ellipse cx="48.5" cy="51" rx="1.8" ry="0.9" fill="#FFFFFF" opacity="0.8" />
        <path d="M50 56 V60" stroke="#261208" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M45 59 Q50 63 55 59" stroke="#261208" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
