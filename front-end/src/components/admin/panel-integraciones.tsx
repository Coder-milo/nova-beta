'use client'

/**
 * Estado real de las integraciones externas.
 *
 * <p>Antes esto era un formulario: campos para escribir la clave de Groq, el
 * token de WhatsApp y la de JSearch, un botón de «Guardar Conexiones» y un
 * `localStorage.setItem`. Dos problemas. El primero es de seguridad — las
 * claves quedaban en texto plano, legibles por cualquier script inyectado, que
 * es justo el fallo que se corrigió para el JWT—. El segundo es que no hacía
 * nada: el backend lee esas credenciales de variables de entorno al arrancar,
 * así que lo que se escribiera aquí no llegaba al servidor jamás.
 *
 * <p>Ahora es un tablero de solo lectura contra
 * `GET /api/v1/configuracion/integraciones`: qué hay conectado, con cuánto cupo
 * y en qué variable de entorno se cambia. Las claves no viajan al navegador ni
 * para mostrarse enmascaradas.
 */

import { useCallback, useEffect, useState } from 'react'
import { CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, CopyIcon as Copy, PlugsIcon as Plugs, PlugsConnectedIcon as PlugsConnected, ShieldWarningIcon as ShieldWarning, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import { configuracionApi } from '@/lib/api'
import type { EstadoIntegracion } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorDe } from '@/lib/errores'

export function PanelIntegraciones() {
  const [estados, setEstados] = useState<EstadoIntegracion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [probando, setProbando] = useState<string | null>(null)
  const [pruebas, setPruebas] = useState<Record<string, { exito: boolean; mensaje: string }>>({})

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setEstados(await configuracionApi.integraciones())
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const probar = async (id: string) => {
    setProbando(id)
    try {
      const resultado = await configuracionApi.probarIntegracion(id)
      setPruebas((previas) => ({ ...previas, [id]: resultado }))
    } catch (err) {
      setPruebas((previas) => ({ ...previas, [id]: { exito: false, mensaje: errorDe(err) } }))
    } finally {
      setProbando(null)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <CircleNotch className="size-5 animate-spin" />
        Consultando el estado de las integraciones…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        <WarningCircle className="size-5 shrink-0" />
        {error}
      </div>
    )
  }

  const categorias = [...new Set(estados.map((e) => e.categoria))]
  const sinConfigurar = estados.filter((e) => !e.configurada).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
        <ShieldWarning className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <span className="mb-0.5 block text-sm font-semibold text-foreground">
            Las credenciales no se editan desde aquí
          </span>
          Viven en variables de entorno del servidor, que es donde tienen que estar: nunca
          se envían al navegador, ni siquiera enmascaradas. Esta pantalla dice qué está
          conectado y en qué variable se cambia cada cosa. Para modificar una, edita el
          entorno del despliegue y reinicia el backend.
          {sinConfigurar > 0 && (
            <span className="mt-1 block">
              {sinConfigurar} integración{sinConfigurar === 1 ? '' : 'es'} sin configurar.
            </span>
          )}
        </div>
      </div>

      {categorias.map((categoria) => (
        <section key={categoria} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {categoria}
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {estados
              .filter((e) => e.categoria === categoria)
              .map((estado) => (
                <TarjetaIntegracion
                  key={estado.id}
                  estado={estado}
                  prueba={pruebas[estado.id]}
                  probando={probando === estado.id}
                  onProbar={() => probar(estado.id)}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function TarjetaIntegracion({
  estado,
  prueba,
  probando,
  onProbar,
}: {
  estado: EstadoIntegracion
  prueba?: { exito: boolean; mensaje: string }
  probando: boolean
  onProbar: () => void
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {estado.configurada ? (
                <PlugsConnected className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <Plugs className="size-4 shrink-0 text-muted-foreground" />
              )}
              {estado.nombre}
            </CardTitle>
            <CardDescription className="mt-1">{estado.resumen}</CardDescription>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              estado.configurada
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {estado.configurada ? 'Conectada' : 'Sin configurar'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        {estado.detalles.length > 0 && (
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {estado.detalles.map((d) => (
              <div key={d.etiqueta} className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">{d.etiqueta}</dt>
                <dd className="truncate font-medium" title={d.valor}>
                  {d.valor}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {estado.advertencia && (
          <p className="flex gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <ShieldWarning className="mt-0.5 size-3.5 shrink-0" />
            {estado.advertencia}
          </p>
        )}

        {estado.variablesEntorno.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Se configura en:</span>
            {estado.variablesEntorno.map((v) => (
              <VariableEntorno key={v} nombre={v} />
            ))}
          </div>
        )}

        {estado.probable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={onProbar} disabled={probando}>
              {probando && <CircleNotch className="size-3.5 animate-spin" />}
              Probar conexión
            </Button>
            {prueba && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${
                  prueba.exito
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-destructive'
                }`}
              >
                {prueba.exito ? (
                  <CheckCircle className="size-3.5" />
                ) : (
                  <WarningCircle className="size-3.5" />
                )}
                {prueba.mensaje}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Nombre de variable, copiable: se va a pegar en el panel del despliegue. */
function VariableEntorno({ nombre }: { nombre: string }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(nombre)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sin permiso de portapapeles el nombre sigue a la vista para copiarlo a mano.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Copiado' : `Copiar ${nombre}`}
      className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground transition-colors hover:bg-secondary/70"
    >
      {nombre}
      {copiado ? <CheckCircle className="size-3 text-emerald-600" /> : <Copy className="size-3 opacity-50" />}
    </button>
  )
}
