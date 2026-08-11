'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZorroThreeCanvas } from './zorro-three-canvas'
import { cn } from '@/lib/utils'

/**
 * El zorro del asistente: el personaje completo, compacto e interactivo.
 *
 * <p>Sigue el diseño del generador de Blender (`Fox_Assistant`): zorro naranja
 * con sudadera azul de cordones, pantalón cargo oscuro, zapatillas azules y
 * blancas, manos y patas marrones, cola voluminosa con la punta crema y cejas
 * marcadas.
 *
 * <p>Se dibuja en 3D con Three.js, portando la misma construcción del script de
 * Blender (ver {@link ZorroThreeCanvas}). Si el navegador no da WebGL o el
 * trozo de Three.js no llega, se cae al mismo personaje en SVG: es el único
 * caso en el que el asistente tendría que desaparecer, y desaparecer es peor
 * que verse plano.
 *
 * <p>Se orienta hacia el centro según el lado en el que se ubique
 * (izquierda/derecha), e interactúa con gestos de arrastre (inclinación en
 * vuelo, ojos O_O), pulsación para abrir/cerrar el chat (ojos ^_^) y reposo,
 * en el que la cabeza y las pupilas siguen al cursor.
 */

/** Píxeles que hay que mover antes de que deje de ser una pulsación. */
const UMBRAL_ARRASTRE = 6

/** Lo que ocupa el personaje compacto en pantalla. */
const TAMANO_Y = 80

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
  /** Se enciende si no hay WebGL o si Three.js no se pudo cargar. */
  const [sinWebgl, setSinWebgl] = useState(false)
  const alFallarWebgl = useCallback(() => setSinWebgl(true), [])

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
        'group fixed z-50 flex h-[80px] w-[72px] flex-col items-center justify-end touch-none select-none pointer-events-auto outline-none',
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
          {sinWebgl ? (
            <PersonajeZorro3D abierto={abierto} arrastrando={arrastrando} />
          ) : (
            <ZorroThreeCanvas
              abierto={abierto}
              arrastrando={arrastrando}
              onFallo={alFallarWebgl}
            />
          )}
        </div>
      </div>
    </button>
  )
}

/**
 * El cuerpo entero del zorro, tal y como lo describe el generador de Blender.
 *
 * El personaje anterior era solo cabeza y un torso recortado por abajo: se veía
 * como un busto flotando. Aquí está completo —sudadera con cordones, pantalón
 * cargo, zapatillas, cola— porque es lo que sostiene la idea de que hay alguien
 * ahí y no un icono.
 */
function PersonajeZorro3D({ abierto, arrastrando }: { abierto: boolean; arrastrando: boolean }) {
  const [ojoOffset, setOjoOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const alMover = (e: MouseEvent) => {
      if (typeof window === 'undefined') return
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const dx = Math.min(Math.max((e.clientX - cx) / cx, -1), 1)
      const dy = Math.min(Math.max((e.clientY - cy) / cy, -1), 1)
      setOjoOffset({ x: dx * 2.2, y: dy * 1.8 })
    }
    window.addEventListener('mousemove', alMover)
    return () => window.removeEventListener('mousemove', alMover)
  }, [])

  return (
    <svg
      viewBox="0 0 100 112"
      className="h-[70px] w-[70px] drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-transform duration-300 transform-gpu"
      aria-hidden="true"
    >
      <defs>
        {/* ── MATERIALES DEL GENERADOR, PASADOS A GRADIENTES ────────────────── */}

        {/* Pelaje naranja: «Fox Orange», con la luz clave arriba a la izquierda */}
        <radialGradient id="zorro-pelaje" cx="34%" cy="24%" r="78%">
          <stop offset="0%" stopColor="#FFB25A" />
          <stop offset="42%" stopColor="#FF8A2B" />
          <stop offset="82%" stopColor="#F2610B" />
          <stop offset="100%" stopColor="#C93F05" />
        </radialGradient>

        {/* «Cream Fur»: hocico, cachetes, pecho y punta de la cola */}
        <radialGradient id="zorro-crema" cx="38%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="62%" stopColor="#FFF1DC" />
          <stop offset="100%" stopColor="#F6D7AE" />
        </radialGradient>

        {/* «Hoodie Blue» con su sombra inferior */}
        <linearGradient id="zorro-sudadera" x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%" stopColor="#3B7BF0" />
          <stop offset="52%" stopColor="#1B54C8" />
          <stop offset="100%" stopColor="#0E3691" />
        </linearGradient>

        {/* Pantalón cargo oscuro */}
        <linearGradient id="zorro-pantalon" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3C4653" />
          <stop offset="100%" stopColor="#222A34" />
        </linearGradient>

        {/* «Paw Brown»: brazos, manos y patas */}
        <linearGradient id="zorro-piel" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#7A452B" />
          <stop offset="100%" stopColor="#4A2617" />
        </linearGradient>

        {/* «Ear Dark»: el interior de las orejas */}
        <linearGradient id="zorro-oreja-interior" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#9C3A12" />
          <stop offset="100%" stopColor="#4A1607" />
        </linearGradient>

        {/* Ojos de cristal marrón */}
        <radialGradient id="zorro-ojo" cx="32%" cy="28%" r="76%">
          <stop offset="0%" stopColor="#6B3A1F" />
          <stop offset="70%" stopColor="#301608" />
          <stop offset="100%" stopColor="#160800" />
        </radialGradient>

        <filter id="zorro-oclusion" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.32" />
        </filter>
      </defs>

      <g filter="url(#zorro-oclusion)">
        {/* ── COLA ESPONJOSA, DETRÁS DEL CUERPO ────────────────────────────── */}
        <g
          className={cn(
            'origin-[62px_78px] transition-transform duration-500',
            arrastrando ? '-rotate-12' : 'group-hover:rotate-6',
          )}
        >
          <path
            d="M64 84 C86 84 97 68 94 52 C92 40 80 36 72 44 C64 52 58 66 60 78 Z"
            fill="url(#zorro-pelaje)"
            stroke="#B23A05"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Punta crema, como el «TailTipWhite» del rig */}
          <path
            d="M94 52 C92 40 80 36 73 43 C79 47 84 52 87 58 C91 59 94 56 94 52 Z"
            fill="url(#zorro-crema)"
            stroke="#E0BE93"
            strokeWidth="0.9"
          />
          {/* Sombra de contacto de la cola contra la espalda */}
          <path d="M64 84 C74 82 82 74 84 64 C76 72 68 78 64 84 Z" fill="#A93704" opacity="0.28" />
        </g>

        {/* ── ZAPATILLAS ───────────────────────────────────────────────────── */}
        {[26, 62].map((x) => (
          <g key={`zapa-${x}`}>
            <path
              d={`M${x} 92 h13 a4 4 0 0 1 4 4 v3 h-19 a3 3 0 0 1 -3 -3 v-1 a3 3 0 0 1 3 -3 z`}
              fill="#F3F6FB"
              stroke="#C9D3E2"
              strokeWidth="0.9"
            />
            <path d={`M${x - 2} 99 h21 v3 a1.6 1.6 0 0 1 -1.6 1.6 h-17.8 a1.6 1.6 0 0 1 -1.6 -1.6 z`} fill="#1B54C8" />
            <path d={`M${x + 3} 92.6 l4.5 6`} stroke="#1B54C8" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ))}

        {/* ── PANTALÓN CARGO ───────────────────────────────────────────────── */}
        <path
          d="M31 70 h38 v14 c0 5 -3 9 -9 9 h-4 c-3 0 -4 -2 -4 -5 v-6 h-4 v6 c0 3 -1 5 -4 5 h-4 c-6 0 -9 -4 -9 -9 z"
          fill="url(#zorro-pantalon)"
          stroke="#1A212A"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* Bolsillos laterales del cargo */}
        <rect x="30.5" y="76" width="5" height="7" rx="1.6" fill="#4A5563" opacity="0.85" />
        <rect x="64.5" y="76" width="5" height="7" rx="1.6" fill="#4A5563" opacity="0.85" />

        {/* ── BRAZOS Y MANOS ───────────────────────────────────────────────── */}
        <path d="M33 56 C26 60 23 66 23 72" stroke="url(#zorro-piel)" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M67 56 C74 60 77 66 77 72" stroke="url(#zorro-piel)" strokeWidth="8" strokeLinecap="round" fill="none" />
        <ellipse cx="22" cy="74" rx="5.2" ry="4.6" fill="url(#zorro-piel)" />
        <ellipse cx="78" cy="74" rx="5.2" ry="4.6" fill="url(#zorro-piel)" />
        {/* Almohadillas naranjas de las palmas */}
        <ellipse cx="22" cy="74.5" rx="2.4" ry="2" fill="#FF8A2B" opacity="0.7" />
        <ellipse cx="78" cy="74.5" rx="2.4" ry="2" fill="#FF8A2B" opacity="0.7" />

        {/* ── SUDADERA ─────────────────────────────────────────────────────── */}
        <path
          d="M50 44 C62 44 70 48 70 56 L70 70 C70 73 68 74 65 74 L35 74 C32 74 30 73 30 70 L30 56 C30 48 38 44 50 44 Z"
          fill="url(#zorro-sudadera)"
          stroke="#0C2F80"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Bolsillo canguro */}
        <path d="M38 64 h24 v6 a2 2 0 0 1 -2 2 h-20 a2 2 0 0 1 -2 -2 z" fill="#0E3691" opacity="0.55" />
        {/* Capucha caída sobre los hombros */}
        <path
          d="M34 47 C39 43 61 43 66 47 C62 53 56 55 50 55 C44 55 38 53 34 47 Z"
          fill="#0E3691"
          stroke="#0C2F80"
          strokeWidth="1"
        />
        {/* Cordones blancos */}
        <path d="M45 52 V62" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M55 52 V62" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="45" cy="63" r="1.5" fill="#FFFFFF" />
        <circle cx="55" cy="63" r="1.5" fill="#FFFFFF" />

        {/* ── OREJAS ───────────────────────────────────────────────────────── */}
        <path d="M28 30 L27 4 L48 19 Z" fill="url(#zorro-pelaje)" stroke="#B23A05" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M31 26 L30 11 L42 20 Z" fill="url(#zorro-oreja-interior)" />
        <path d="M72 30 L73 4 L52 19 Z" fill="url(#zorro-pelaje)" stroke="#B23A05" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M69 26 L70 11 L58 20 Z" fill="url(#zorro-oreja-interior)" />

        {/* ── CABEZA ───────────────────────────────────────────────────────── */}
        <path
          d="M50 12 C69 12 78 22 78 33 C78 45 66 51 50 51 C34 51 22 45 22 33 C22 22 31 12 50 12 Z"
          fill="url(#zorro-pelaje)"
          stroke="#B23A05"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Luz de arriba sobre la frente */}
        <ellipse cx="44" cy="19" rx="15" ry="4.2" fill="#FFFFFF" opacity="0.26" />

        {/* Cachetes y hocico crema */}
        <path
          d="M50 30 C64 30 73 35 73 42 C73 48 63 51 50 51 C37 51 27 48 27 42 C27 35 36 30 50 30 Z"
          fill="url(#zorro-crema)"
        />
        {/* Rubor cálido */}
        <ellipse cx="33" cy="40" rx="4.2" ry="2.6" fill="#FF4D14" opacity="0.4" />
        <ellipse cx="67" cy="40" rx="4.2" ry="2.6" fill="#FF4D14" opacity="0.4" />

        {/* ── CEJAS ────────────────────────────────────────────────────────── */}
        <path
          d={arrastrando ? 'M34 20 L44 22' : 'M34 21 L44 19'}
          stroke="#4A2617"
          strokeWidth="3.2"
          strokeLinecap="round"
          className="transition-all duration-200"
        />
        <path
          d={arrastrando ? 'M66 20 L56 22' : 'M66 21 L56 19'}
          stroke="#4A2617"
          strokeWidth="3.2"
          strokeLinecap="round"
          className="transition-all duration-200"
        />

        {/* ── OJOS ─────────────────────────────────────────────────────────── */}
        {arrastrando ? (
          <>
            {/* Sorpresa en vuelo: O_O */}
            <circle cx="40" cy="32" r="6.4" fill="#FFFFFF" stroke="#4A2617" strokeWidth="1.1" />
            <circle cx="60" cy="32" r="6.4" fill="#FFFFFF" stroke="#4A2617" strokeWidth="1.1" />
            <circle cx="40" cy="32" r="3" fill="url(#zorro-ojo)" />
            <circle cx="60" cy="32" r="3" fill="url(#zorro-ojo)" />
          </>
        ) : abierto ? (
          <>
            {/* Contento con el chat abierto: ^_^ */}
            <path d="M33 34 Q40 26 47 34" stroke="#2A1206" strokeWidth="3.6" fill="none" strokeLinecap="round" />
            <path d="M53 34 Q60 26 67 34" stroke="#2A1206" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="40" cy="32" rx="5.4" ry="6.4" fill="#FFFFFF" />
            <ellipse cx="60" cy="32" rx="5.4" ry="6.4" fill="#FFFFFF" />
            <ellipse cx={40 + ojoOffset.x} cy={32 + ojoOffset.y} rx="3.6" ry="4.4" fill="url(#zorro-ojo)" />
            <ellipse cx={60 + ojoOffset.x} cy={32 + ojoOffset.y} rx="3.6" ry="4.4" fill="url(#zorro-ojo)" />
            <circle cx={38.6 + ojoOffset.x * 0.8} cy={30.4 + ojoOffset.y * 0.8} r="1.3" fill="#FFFFFF" />
            <circle cx={58.6 + ojoOffset.x * 0.8} cy={30.4 + ojoOffset.y * 0.8} r="1.3" fill="#FFFFFF" />
          </>
        )}

        {/* ── HOCICO Y NARIZ ───────────────────────────────────────────────── */}
        <ellipse cx="50" cy="40" rx="4.6" ry="3.4" fill="#241005" />
        <ellipse cx="48.6" cy="38.8" rx="1.6" ry="0.9" fill="#FFFFFF" opacity="0.75" />
        <path d="M50 43 V46" stroke="#241005" strokeWidth="2" strokeLinecap="round" />
        <path
          d={abierto ? 'M44 46 Q50 52 56 46' : 'M45 46 Q50 49.5 55 46'}
          stroke="#241005"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          className="transition-all duration-200"
        />
      </g>
    </svg>
  )
}
