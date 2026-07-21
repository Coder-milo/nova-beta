'use client'

/**
 * Página de Auditoría.
 *
 * Muestra el registro histórico de importaciones y la actividad del sistema.
 * El backend expone la importación de datos y la creación de programas y estudiantes,
 * por lo que aquí listamos las alertas del sistema e importaciones.
 */

import { useState, useEffect } from 'react'
import { ShieldCheck, Loader2, AlertCircle, RefreshCw, History, FileText, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { dashboardApi, ApiCallError } from '@/lib/api'
import type { AlertaResponse } from '@/lib/types'

export default function AuditoriaPage() {
  const [alertas, setAlertas] = useState<AlertaResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const data = await dashboardApi.alerts()
      setAlertas(data)
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? 'Sin permisos. Inicia sesión como ADMIN o COORDINADOR.'
          : `Error al cargar logs (HTTP ${err.status}).`)
      } else {
        setError('No se pudo conectar con el backend.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <ShieldCheck className="size-5" />
            Auditoría
          </h2>
          <p className="text-sm text-muted-foreground">
            Historial de alertas y registros críticos de actividad del sistema.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-3.5" /> Refrescar
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Cargando registros de auditoría…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="size-4" /> Reintentar
          </Button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-6">
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4" />
                Alertas de Datos y Sistema
              </CardTitle>
              <CardDescription>
                Alertas activas que requieren revisión o que registran problemas de integridad de datos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertas.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground/60">
                  <CheckCircle2 className="size-8 text-green-500" />
                  <p className="text-sm">No se encontraron alertas críticas en el sistema.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {alertas.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/20">
                      <AlertCircle className={`size-5 shrink-0 mt-0.5 ${
                        a.severidad === 'ALTA' ? 'text-destructive' : a.severidad === 'MEDIA' ? 'text-amber-500' : 'text-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-foreground">{a.titulo}</h4>
                          <Badge variant={a.severidad === 'ALTA' ? 'destructive' : a.severidad === 'MEDIA' ? 'default' : 'outline'} className="text-[9px] py-0 px-1">
                            {a.severidad}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] py-0 px-1">{a.tipo}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{a.detalle}</p>
                        {a.referenciaId && (
                          <span className="block text-[10px] text-muted-foreground font-mono mt-1">ID Ref: {a.referenciaId}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información del Sistema de Auditoría */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" />
                Integridad de Datos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                El panel de auditoría del frontend recopila las alertas de consistencia del backend en tiempo real. 
                El backend realiza validaciones automáticas periódicas buscando:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Estudiantes sin información de contacto clave (móvil, email).</li>
                <li>Registros con inconsistencias en el estado académico versus empleabilidad.</li>
                <li>Programas activos próximos a finalizar sin transiciones definidas.</li>
                <li>Hojas de vida incompletas listas para el motor de matching.</li>
              </ul>
              <p className="pt-2 border-t border-border">
                Todas las modificaciones de usuarios y registros se auditan internamente a nivel de persistencia de base de datos.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
