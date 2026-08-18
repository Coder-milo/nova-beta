'use client'

import { useState } from 'react'
import { Car, Cat, Flag, Heart, Lightbulb, Search as MagnifyingGlass, Smile as Smiley, Utensils as ForkKnife, Volleyball as SoccerBall, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void
  onClose?: () => void
  compact?: boolean
}

const CATEGORIAS_EMOJIS = [
  {
    id: 'caras',
    nombre: 'Caras y personas',
    icon: Smiley,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊',
      '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
      '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
      '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
      '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
      '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
    ],
  },
  {
    id: 'animales',
    nombre: 'Animales y naturaleza',
    icon: Cat,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
      '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣',
      '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
      '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑',
      '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅',
      '🐆', '🦓', '🐘', '🦏', '🦛', '🐪', '🐫', '🦙', '🦘', '🦒', '🐃', '🐂',
    ],
  },
  {
    id: 'comida',
    nombre: 'Comida y bebida',
    icon: ForkKnife,
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕',
      '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓',
      '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗',
      '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙',
    ],
  },
  {
    id: 'deportes',
    nombre: 'Actividades y deportes',
    icon: SoccerBall,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓',
      '🏸', '🏒', '🏑', '🥍', '🏏', '🎯', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️',
      '🌁', '🏄‍♂️', '🏊‍♂️', '🏋️‍♂️', '🚴‍♂️', '🚵‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️',
    ],
  },
  {
    id: 'vehiculos',
    nombre: 'Objetos y vehículos',
    icon: Car,
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🏣', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛',
      '🚜', '🦯', '🦽', '🦼', '🚲', '🛴', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚘',
      '✈️', '🛫', '🛬', '🛩️', '🚁', '🛰️', '🚀', '🛸', '⚓', '⛵', '🚤', '🛳️',
    ],
  },
  {
    id: 'simbolos',
    nombre: 'Símbolos y objetos',
    icon: Lightbulb,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️',
      '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌',
      '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️',
    ],
  },
  {
    id: 'banderas',
    nombre: 'Banderas',
    icon: Flag,
    emojis: [
      '🇨🇴', '🇲🇽', '🇦🇷', '🇪🇸', '🇺🇸', '🇧🇷', '🇨🇱', '🇵🇪', '🇪🇨', '🇻🇪', '🇺🇾', '🇵🇾',
      '🇧🇴', '🇨🇷', '🇵🇦', '🇩🇴', '🇬🇹', '🇭🇳', '🇸🇻', '🇳🇮', '🇨🇺', '🇵🇷', '🇬🇧', '🇫🇷',
    ],
  },
]

export function EmojiPickerPopover({ onSelectEmoji, onClose, compact = false }: EmojiPickerProps) {
  const [query, setQuery] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState('caras')

  const emojisFiltrados = query.trim()
    ? CATEGORIAS_EMOJIS.flatMap((c) => c.emojis).filter((e) => e.includes(query.trim()))
    : CATEGORIAS_EMOJIS.find((c) => c.id === categoriaActiva)?.emojis ?? CATEGORIAS_EMOJIS[0].emojis

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card/95 p-2.5 shadow-2xl backdrop-blur-md dark:bg-card',
        compact ? 'w-[265px] space-y-2' : 'w-80 space-y-3',
      )}
    >
      {/* Cabecera con Buscador */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar emoji..."
            className="w-full rounded-xl border border-border bg-background py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Grid de Emojis */}
      <div className={cn('overflow-y-auto pr-1', compact ? 'h-44' : 'h-52')}>
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {query.trim() ? 'Resultados' : CATEGORIAS_EMOJIS.find((c) => c.id === categoriaActiva)?.nombre}
        </p>
        <div className={cn('grid gap-1', compact ? 'grid-cols-6' : 'grid-cols-7')}>
          {emojisFiltrados.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              type="button"
              onClick={() => onSelectEmoji(emoji)}
              className="flex size-8 items-center justify-center rounded-xl text-base transition hover:scale-125 hover:bg-primary/15"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Barra Inferior de Categorías */}
      {!query.trim() && (
        <div className="flex items-center justify-between border-t border-border pt-2">
          {CATEGORIAS_EMOJIS.map((cat) => {
            const Icon = cat.icon
            const active = categoriaActiva === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaActiva(cat.id)}
                title={cat.nombre}
                className={cn(
                  'rounded-lg p-1.5 transition',
                  active ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
