'use client'

/**
 * Previsualización de los correos automáticos.
 *
 * <p>El envío a estudiantes es masivo y de una sola pasada: los correos de
 * activación salen de golpe para toda la cohorte y no hay forma de retirarlos.
 * Sin poder mirar antes cómo quedan, los fallos que se descubren son siempre los
 * mismos —el logo del programa no carga, el color no contrasta con el texto del
 * botón, el pie quedó con la marca de otro cliente— y se descubren cuando ya los
 * recibió todo el mundo.
 *
 * <p>El HTML lo arma el backend con el mismo código que usa el envío real, así
 * que lo que se ve aquí es lo que llega. Se pinta en un `iframe` porque el
 * correo va maquetado con tablas y estilos en línea pensados para Outlook:
 * incrustarlo en la página lo rompería, y además heredaría los estilos del
 * panel, que es justo lo que no tiene el cliente de correo del destinatario.
 *
 * Consume:
 *   GET /api/v1/correos/tipos
 *   GET /api/v1/correos/vista-previa/{tipo}?programaId=
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowsClockwiseIcon as ArrowsClockwise, CircleNotchIcon as CircleNotch, EnvelopeIcon as Envelope, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import { ApiCallError, correosApi, programasApi } from '@/lib/api'
import type { TipoCorreo } from '@/lib/api'
import type { ProgramaResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Campo, Selector } from '@/components/ui/campo'

function mensajeDe(error: unknown): string {
  if (error instanceof ApiCallError) {
    if (error.status === 401 || error.status === 403) {
      return 'Sin permisos. Inicia sesión como ADMIN o COORDINADOR.'
    }
    return error.body.message ?? `Error del servidor (HTTP ${error.status}).`
  }
  return 'No se pudo conectar con el servidor.'
}

export function VistaPreviaCorreos() {
  const [tipos, setTipos] = useState<TipoCorreo[]>([])
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [tipo, setTipo] = useState('')
  const [programaId, setProgramaId] = useState('')
  const [html, setHtml] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    correosApi
      .tipos()
      .then((lista) => {
        setTipos(lista)
        if (lista.length > 0) setTipo((actual) => actual || lista[0].id)
      })
      .catch((e) => setError(mensajeDe(e)))

    // Sin programas la pantalla sigue sirviendo: se ve la marca institucional.
    programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  const cargar = useCallback(async () => {
    if (!tipo) return
    setCargando(true)
    setError(null)
    try {
      setHtml(await correosApi.vistaPrevia(tipo, programaId || undefined))
    } catch (e) {
      setError(mensajeDe(e))
      setHtml('')
    } finally {
      setCargando(false)
    }
  }, [tipo, programaId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const elegido = tipos.find((t) => t.id === tipo)

  return (
    <Card className="rounded-lg border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Envelope className="size-4 text-primary" weight="duotone" />
          Correos que envía el sistema
        </CardTitle>
        <CardDescription>
          Míralos antes de que salgan. Se muestran con datos de ejemplo y con la marca del
          programa que elijas, tal como los va a recibir el estudiante.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Correo" ayuda={elegido?.cuando}>
            <Selector
              value={tipo}
              onChange={setTipo}
              opciones={tipos.map((t) => ({ valor: t.id, etiqueta: t.etiqueta }))}
            />
          </Campo>

          <Campo
            etiqueta="Marca del programa"
            ayuda="Cada programa puede tener su cabecera, su pie y su color."
          >
            <Selector
              value={programaId}
              onChange={setProgramaId}
              opciones={programas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
              vacio="Marca institucional"
            />
          </Campo>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            <WarningCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando}>
            <ArrowsClockwise className={cargando ? 'size-3.5 animate-spin' : 'size-3.5'} />
            Actualizar
          </Button>
        </div>

        {cargando && !html ? (
          <div className="flex h-96 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 text-sm text-muted-foreground">
            <CircleNotch className="size-5 animate-spin" />
            Montando el correo…
          </div>
        ) : html ? (
          <iframe
            // `srcDoc` y no una URL: el HTML ya viene completo y así no hay que
            // crear ni revocar object URLs. El sandbox sin `allow-scripts` deja
            // el correo inerte, que es como lo abre un cliente de correo.
            title={`Vista previa del correo: ${elegido?.etiqueta ?? tipo}`}
            srcDoc={html}
            sandbox=""
            className="h-[38rem] w-full rounded-xl border border-border bg-white"
          />
        ) : (
          !error && (
            <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              Elige un correo para verlo.
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
