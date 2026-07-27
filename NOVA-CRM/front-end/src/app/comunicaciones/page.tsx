'use client'

/**
 * Comunicaciones — publicar un anuncio (feria de empleo, convocatoria) que le
 * llega a los estudiantes como notificación.
 *
 * El alta de cuentas de acceso vivía aquí y se movió a
 * Configuración > Usuarios & Seguridad, que es donde se gestiona quien entra
 * al panel; esto es solo para lo que se le comunica a los estudiantes.
 *
 * Consume:
 *   POST /api/v1/notificaciones/anuncio
 *   GET  /api/v1/programas
 *
 * Requiere ADMIN o COORDINADOR.
 */

import { useEffect, useState } from 'react'
import {
  CheckCircle,
  CircleNotch,
  Megaphone,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { comunicacionesApi, programasApi, ApiCallError } from '@/lib/api'
import type { ProgramaResponse } from '@/lib/types'

function errorDe(err: unknown): string {
  if (err instanceof ApiCallError) {
    if (err.status === 401 || err.status === 403) {
      return 'Sin permisos. Inicia sesión como ADMIN o COORDINADOR.'
    }
    return err.body.message ?? `Error del servidor (HTTP ${err.status}).`
  }
  return 'No se pudo conectar con el servidor.'
}

// ── Anuncios ────────────────────────────────────────────────────────────────

function PanelAnuncio({ programas }: { programas: ProgramaResponse[] }) {
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [programaId, setProgramaId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const publicar = async () => {
    setEnviando(true)
    setError(null)
    setResultado(null)
    try {
      const r = await comunicacionesApi.publicarAnuncio({
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        programaId: programaId || undefined,
      })
      setResultado(r.mensaje)
      setTitulo('')
      setMensaje('')
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setEnviando(false)
    }
  }

  const listo = titulo.trim().length > 0 && mensaje.trim().length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-5 text-primary" weight="duotone" />
          Publicar un anuncio
        </CardTitle>
        <CardDescription>
          Les llega a los estudiantes en sus notificaciones. Úsalo para ferias de
          empleo, convocatorias o avisos del programa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="anuncio-titulo">
            Título
          </label>
          <input
            id="anuncio-titulo"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Feria de empleo BPO — 12 de agosto"
            maxLength={500}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="anuncio-mensaje">
            Mensaje
          </label>
          <textarea
            id="anuncio-mensaje"
            className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Cuéntales de qué se trata, dónde y a qué hora."
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="anuncio-programa">
            Destinatarios
          </label>
          <select
            id="anuncio-programa"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={programaId}
            onChange={(e) => setProgramaId(e.target.value)}
          >
            <option value="">Todos los estudiantes activos</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                Solo el programa: {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <WarningCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        {resultado && (
          <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="mt-0.5 size-4 shrink-0" />
            {resultado}
          </p>
        )}

        <Button onClick={publicar} disabled={!listo || enviando}>
          {enviando ? (
            <>
              <CircleNotch className="size-4 animate-spin" /> Publicando…
            </>
          ) : (
            'Publicar anuncio'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function ComunicacionesPage() {
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])

  useEffect(() => {
    programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Comunicaciones</h1>
        <p className="text-sm text-muted-foreground">
          Anuncios que les llegan a los estudiantes en sus notificaciones.
        </p>
      </div>

      <PanelAnuncio programas={programas} />
    </div>
  )
}
