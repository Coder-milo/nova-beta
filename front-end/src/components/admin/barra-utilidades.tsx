'use client'

import type { ReactNode } from 'react'
import { History, MessageCircle, NotebookPen, RefreshCw } from 'lucide-react'
import Link from '@/compat/next-link'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePreferences } from '@/lib/preferences'

function Utilidad({
  etiqueta,
  href,
  onClick,
  children,
}: {
  etiqueta: string
  href?: string
  onClick?: () => void
  children: ReactNode
}) {
  const clases =
    'flex size-7 items-center justify-center rounded-(--radius) text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'

  const control = href ? (
    <Link href={href} aria-label={etiqueta} className={clases}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={etiqueta} className={clases}>
      {children}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={control} />
      <TooltipContent side="top">{etiqueta}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Franja acoplada al pie del panel.
 *
 * Es el patrón de la barra inferior de Zoho: un sitio fijo, siempre presente,
 * para lo que acompaña al trabajo sin ser el trabajo —conversaciones, notas,
 * lo último que se abrió—. La alternativa era lo que había: cada una de estas
 * cosas flotando por su cuenta sobre la esquina del contenido, tapando la
 * última fila de la tabla y sin ningún orden entre ellas.
 *
 * Mide 32 px y no lleva estado propio: solo son accesos. Quien abre y cierra el
 * asistente sigue siendo `AdminAssistantChat`, que se ancla justo encima.
 */
export function BarraUtilidades() {
  const { locale } = usePreferences()
  const en = locale === 'en'

  return (
    <div className="glass-chrome relative z-30 flex h-8 shrink-0 items-center gap-1 border-t border-border px-2">
      <span className="px-1.5 text-[11px] font-medium text-muted-foreground">
        {en ? 'Workspace' : 'Espacio de trabajo'}
      </span>

      <div className="ml-auto flex items-center gap-0.5">
        <Utilidad etiqueta={en ? 'Messages' : 'Mensajes'} href="/comunicaciones">
          <MessageCircle className="size-4" />
        </Utilidad>
        <Utilidad etiqueta={en ? 'Follow-up' : 'Seguimiento'} href="/seguimiento">
          <NotebookPen className="size-4" />
        </Utilidad>
        <Utilidad etiqueta={en ? 'Audit trail' : 'Auditoría'} href="/auditoria">
          <History className="size-4" />
        </Utilidad>
        <Utilidad
          etiqueta={en ? 'Reload panel' : 'Recargar panel'}
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="size-4" />
        </Utilidad>
      </div>
    </div>
  )
}
