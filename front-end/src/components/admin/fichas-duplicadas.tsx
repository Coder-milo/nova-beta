'use client'

/**
 * Fichas de empresa que parecen la misma, y cómo unirlas.
 *
 * Las duplicadas llegan por el camino normal: el Excel de una feria trae
 * «Manpower Group Colombia», el rastreo registra «ManpowerGroup» y el alta
 * manual escribe «Manpower». El daño no es la fila de más — es que el historial
 * de acercamientos queda repartido, se mira una ficha, dice «sin contactar», y
 * se llama a alguien con quien ya se habló el mes pasado.
 *
 * Decisiones que se ven aquí:
 *
 * - **Se sugiere, no se decide.** Dos nombres casi iguales pueden ser dos
 *   empresas distintas del mismo grupo. Fusionar automáticamente lo parecido
 *   sería unir cosas que no se pueden separar después.
 * - **Se dice qué se va a mover antes de moverlo**, con el número. Una acción
 *   que no se puede deshacer tiene que enseñar su alcance en el momento de
 *   confirmarla, no en la documentación.
 * - **Se elige cuál se queda.** Por defecto la que más registros tiene, que es
 *   casi siempre la buena, pero la decisión es de quien mira.
 */

import { useCallback, useEffect, useState } from 'react'
import { GitMerge, Info, TriangleAlert } from 'lucide-react'
import { duplicadosEmpresaApi, ApiCallError, type PosibleDuplicado } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirmar } from '@/components/ui/confirmar'
import { useAvisos } from '@/components/ui/avisos'
import { usePreferences } from '@/lib/preferences'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Duplicate company records detection',
        desc: 'Companies whose commercial or legal name matches an existing entity.',
        vacio: 'No duplicate records found.',
        registros: (n: number) => `${n} linked records`,
        seQueda: 'Keep as primary',
        fusionar: 'Merge',
        fusionando: 'Merging…',
        confirmarTitulo: 'Confirm company merge?',
        confirmarTexto: (o: string, d: string, n: number) =>
          `Records from «${o}» will be consolidated into «${d}»: ${n} associated records (vacancies, interactions, applications, placements and accounts) will be transferred. The secondary record will be deactivated. This action cannot be undone.`,
        confirmarBoton: 'Confirm merge',
        hecho: (n: number) => `Successfully merged. ${n} records consolidated.`,
        fallo: 'The records could not be merged.',
        aviso: 'Please verify that both company names represent the same corporate entity before confirming the merge.',
        cargando: 'Scanning for duplicate records…',
      }
    : {
        titulo: 'Detección de empresas duplicadas',
        desc: 'Empresas cuyo nombre o razón social coincide con otra entidad registrada.',
        vacio: 'No se encontraron empresas duplicadas.',
        registros: (n: number) => `${n} registros asociados`,
        seQueda: 'Conservar como principal',
        fusionar: 'Fusionar',
        fusionando: 'Fusionando…',
        confirmarTitulo: '¿Confirmar unificación de empresas?',
        confirmarTexto: (o: string, d: string, n: number) =>
          `La información de «${o}» se integrará en «${d}»: se transferirán ${n} registros asociados (vacantes, acercamientos, postulaciones, colocaciones y cuentas). La ficha secundaria quedará desactivada. Esta acción no se puede deshacer.`,
        confirmarBoton: 'Confirmar fusión',
        hecho: (n: number) => `Fusión completada. Se consolidaron ${n} registros.`,
        fallo: 'No se pudieron fusionar las empresas.',
        aviso: 'Verifique que ambas empresas corresponden a la misma entidad corporativa antes de unificarlas.',
        cargando: 'Buscando registros duplicados…',
      }
}

export function FichasDuplicadas({ alFusionar }: { alFusionar?: () => void }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarExito, mostrarError, avisos } = useAvisos()

  const [grupos, setGrupos] = useState<PosibleDuplicado[] | null>(null)
  const [elegida, setElegida] = useState<Record<number, string>>({})
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const datos = await duplicadosEmpresaApi.posibles()
      setGrupos(datos)
      // Se preselecciona la que más registros tiene: es casi siempre la buena,
      // y así el caso normal es un clic en vez de dos decisiones.
      const inicial: Record<number, string> = {}
      datos.forEach((g, i) => {
        inicial[i] = [...g.fichas].sort((a, b) => b.registros - a.registros)[0]?.id ?? ''
      })
      setElegida(inicial)
    } catch {
      setGrupos([])
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const fusionar = async (indice: number, grupo: PosibleDuplicado) => {
    const destinoId = elegida[indice]
    const destino = grupo.fichas.find((f) => f.id === destinoId)
    const otras = grupo.fichas.filter((f) => f.id !== destinoId)
    if (!destino || otras.length === 0) return

    const cuantos = otras.reduce((s, f) => s + f.registros, 0)
    const sigue = await confirmar({
      titulo: T.confirmarTitulo,
      descripcion: T.confirmarTexto(
        otras.map((f) => f.nombre).join('», «'), destino.nombre, cuantos),
      textoConfirmar: T.confirmarBoton,
      destructivo: true,
    })
    if (!sigue) return

    setTrabajando(true)
    try {
      let movidos = 0
      // Una a una y en serie: si la tercera falla, las dos primeras ya están
      // hechas y hay que poder volver a ver el estado real.
      for (const otra of otras) {
        const r = await duplicadosEmpresaApi.fusionar(destino.id, otra.id)
        movidos += r.total
      }
      mostrarExito(T.hecho(movidos))
      await cargar()
      alFusionar?.()
    } catch (err) {
      mostrarError(err instanceof ApiCallError ? (err.body.message ?? T.fallo) : T.fallo)
      await cargar()
    } finally {
      setTrabajando(false)
    }
  }

  if (grupos !== null && grupos.length === 0) return null

  return (
    <Card className="rounded-lg border-amber-500/30 bg-amber-500/[0.03] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitMerge className="size-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
          {T.titulo}
        </CardTitle>
        <CardDescription>{T.desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {grupos === null ? (
          <p className="text-sm text-muted-foreground">{T.cargando}</p>
        ) : (
          <>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              {T.aviso}
            </p>

            {grupos.map((grupo, i) => (
              <div
                key={grupo.fichas.map((f) => f.id).join('-')}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2.5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {grupo.fichas.map((f) => (
                    <label key={f.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`duplicado-${i}`}
                        className="size-3.5 accent-primary"
                        checked={elegida[i] === f.id}
                        onChange={() => setElegida((p) => ({ ...p, [i]: f.id }))}
                      />
                      <span className="truncate font-medium">{f.nombre}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        · {T.registros(f.registros)}
                      </span>
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={trabajando || !elegida[i]}
                  onClick={() => void fusionar(i, grupo)}
                  className="gap-1.5"
                >
                  <TriangleAlert className="size-3.5" />
                  {trabajando ? T.fusionando : T.fusionar}
                </Button>
              </div>
            ))}
          </>
        )}
      </CardContent>
      {dialogo}
      {avisos}
    </Card>
  )
}
