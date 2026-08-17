'use client'
import { useCallback, useEffect, useState } from 'react'
import { CircleAlert as WarningCircle, LoaderCircle as CircleNotch } from 'lucide-react'
import { reportesChatApi, mensajeDeError } from '@/lib/api'
import type { ReporteChatResponse } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Chat reports',
        descripcion: 'Conversations that a student asked the team to look at.',
        abiertos: 'Pending',
        todos: 'All',
        sinReportes: 'No reports pending review.',
        marcarRevisado: 'Mark as reviewed',
        revisado: 'Reviewed',
        abierto: 'Pending',
        reporto: 'reported',
        sinMotivo: 'No reason given.',
        extracto: 'Copy of the conversation when it was reported',
        noSePudoCargar: 'The reports could not be loaded.',
        noSePudoMarcar: 'It could not be marked as reviewed.',
        cargando: 'Loading…',
      }
    : {
        titulo: 'Reportes del chat',
        descripcion: 'Conversaciones que un estudiante pidió que el equipo mirara.',
        abiertos: 'Pendientes',
        todos: 'Todos',
        sinReportes: 'No hay reportes pendientes de revisar.',
        marcarRevisado: 'Marcar como revisado',
        revisado: 'Revisado',
        abierto: 'Pendiente',
        reporto: 'reportó a',
        sinMotivo: 'No escribió un motivo.',
        extracto: 'Copia de la conversación en el momento del reporte',
        noSePudoCargar: 'No se pudieron cargar los reportes.',
        noSePudoMarcar: 'No se pudo marcar como revisado.',
        cargando: 'Cargando…',
      }
}

/**
 * La bandeja de reportes del chat.
 *
 * <p>Lo que se ve aquí es la copia que se guardó al reportar, no la
 * conversación en vivo: el equipo lee lo que el estudiante decidió enseñar al
 * pedir ayuda, y nada más. Por eso sigue estando aunque después se borren los
 * mensajes, que es justo lo que hace quien acosa.
 */
export default function ReportesChatPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [reportes, setReportes] = useState<ReporteChatResponse[]>([])
  const [soloAbiertos, setSoloAbiertos] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const pagina = await reportesChatApi.listar(soloAbiertos ? 'ABIERTO' : undefined)
      setReportes(pagina.content)
    } catch (e) {
      setError(mensajeDeError(e, T.noSePudoCargar))
    } finally {
      setCargando(false)
    }
  }, [soloAbiertos, T.noSePudoCargar])

  useEffect(() => { void cargar() }, [cargar])

  const marcarRevisado = async (id: string) => {
    try {
      await reportesChatApi.marcarRevisado(id)
      // Con el filtro puesto la fila ya no pertenece a la lista; sin él, cambia
      // de estado. Se recarga en vez de adivinarlo aquí.
      void cargar()
    } catch (e) {
      setError(mensajeDeError(e, T.noSePudoMarcar))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{T.titulo}</h1>
          <p className="text-sm text-muted-foreground">{T.descripcion}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={soloAbiertos ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSoloAbiertos(true)}
          >
            {T.abiertos}
          </Button>
          <Button
            variant={soloAbiertos ? 'outline' : 'default'}
            size="sm"
            onClick={() => setSoloAbiertos(false)}
          >
            {T.todos}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <WarningCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {cargando && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <CircleNotch className="size-4 animate-spin text-primary" />
          {T.cargando}
        </div>
      )}

      {!cargando && reportes.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {T.sinReportes}
          </CardContent>
        </Card>
      )}

      {!cargando && reportes.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">
                {r.denunciante} <span className="font-normal text-muted-foreground">{T.reporto}</span> {r.denunciado}
              </CardTitle>
              <CardDescription>
                {new Date(r.fecha).toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.estado === 'ABIERTO' ? 'destructive' : 'outline'}>
                {r.estado === 'ABIERTO' ? T.abierto : T.revisado}
              </Badge>
              {r.estado === 'ABIERTO' && (
                <Button size="sm" variant="outline" onClick={() => void marcarRevisado(r.id)}>
                  {T.marcarRevisado}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">
              {r.motivo?.trim() || <span className="text-muted-foreground">{T.sinMotivo}</span>}
            </p>
            {r.extracto && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {T.extracto}
                </p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-3 text-xs text-foreground">
                  {r.extracto}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
