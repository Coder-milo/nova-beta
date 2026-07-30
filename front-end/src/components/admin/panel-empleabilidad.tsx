'use client'

/**
 * Los cinco hitos de preparación de un participante, y lo que salió de ellos.
 *
 * <p>Estos campos existían en la base desde la migración V12 y **no había
 * ninguna pantalla para rellenarlos**, así que el `%` de empleabilidad —el
 * indicador que el programa reporta— daba 0 para los 107 participantes. Aquí es
 * donde se capturan.
 *
 * <p>Se muestra el desglose del puntaje a propósito. La fórmula tiene rarezas
 * heredadas de la hoja de cálculo (un hito a medias aporta 0,07 fijo, y el
 * total se trunca), y sin verlas desglosadas el número parece arbitrario y
 * nadie confía en él.
 */

import { useEffect, useState } from 'react'
import { ArrowSquareOut, CircleNotch, FolderOpen, LinkedinLogo } from '@phosphor-icons/react'
import { Aviso, Campo, GrupoOpciones, Opcion } from '@/components/ui/campo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { colocacionesApi, estudiantesApi, postulacionesApi } from '@/lib/api'
import { errorDeGestion } from '@/lib/errores'
import { APORTE_EN_PROCESO } from '@/lib/types'
import type {
  ColocacionResponse,
  EstadoHito,
  EstudianteResponse,
  PostulacionResponse,
  PreparacionRequest,
} from '@/lib/types'

const HITOS: Array<{ campo: string; respuesta: keyof EstudianteResponse; etiqueta: string; peso: number }> = [
  { campo: 'hojaDeVida', respuesta: 'hvGenerada' as keyof EstudianteResponse, etiqueta: 'Hoja de Vida', peso: 20 },
  { campo: 'linkedin', respuesta: 'linkedinOptimizado' as keyof EstudianteResponse, etiqueta: 'Perfil de LinkedIn', peso: 20 },
  { campo: 'simulacro', respuesta: 'simulacroRealizado' as keyof EstudianteResponse, etiqueta: 'Simulacro de entrevista', peso: 30 },
]

const ESTADOS: { valor: EstadoHito; etiqueta: string }[] = [
  { valor: 'SI', etiqueta: 'Sí' },
  { valor: 'EN_PROCESO', etiqueta: 'En proceso' },
  { valor: 'NO', etiqueta: 'No' },
]

const pesos = (valor: number | null | undefined) =>
  valor == null ? '—' : `$${Math.round(valor).toLocaleString('es-CO')}`

/** Lo que aporta un hito al total, con la rareza de la hoja incluida. */
function aporte(estado: EstadoHito, peso: number): number {
  if (estado === 'SI') return peso
  if (estado === 'EN_PROCESO') return APORTE_EN_PROCESO
  return 0
}

export function PanelEmpleabilidad({
  estudiante,
  onActualizado,
}: {
  estudiante: EstudianteResponse
  onActualizado: (e: EstudianteResponse) => void
}) {
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [carpeta, setCarpeta] = useState(estudiante.carpetaUrl ?? '')
  const [linkedin, setLinkedin] = useState(estudiante.linkedinUrl ?? '')
  const [postulaciones, setPostulaciones] = useState<PostulacionResponse[]>([])
  const [colocaciones, setColocaciones] = useState<ColocacionResponse[]>([])

  useEffect(() => {
    // Un fallo aquí no debe romper la pestaña: los hitos siguen siendo
    // editables aunque no se puedan leer las postulaciones.
    postulacionesApi.deEstudiante(estudiante.id).then(setPostulaciones).catch(() => setPostulaciones([]))
    colocacionesApi.deEstudiante(estudiante.id).then(setColocaciones).catch(() => setColocaciones([]))
  }, [estudiante.id])

  const guardar = async (cambios: PreparacionRequest, marca: string) => {
    setGuardando(marca)
    setError(null)
    try {
      onActualizado(await estudiantesApi.actualizarPreparacion(estudiante.id, cambios))
    } catch (err) {
      setError(errorDeGestion(err))
    } finally {
      setGuardando(null)
    }
  }

  const totalHitos = HITOS.reduce(
    (suma, h) => suma + aporte(estudiante[h.respuesta] as EstadoHito, h.peso),
    0,
  )

  return (
    <div className="flex flex-col gap-5">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Puntaje con desglose */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">% de empleabilidad</h3>
            <p className="text-xs text-muted-foreground">
              Derivado de los hitos y de tener colocación. No se guarda: se recalcula.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{estudiante.porcentajeEmpleabilidad}%</div>
            <div className="text-xs text-muted-foreground">
              {estudiante.hitosCumplidos} de {HITOS.length} hitos
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${estudiante.porcentajeEmpleabilidad}%` }}
          />
        </div>

        <div className="mt-4 space-y-1 text-xs">
          {HITOS.map((h) => {
            const estado = estudiante[h.respuesta] as EstadoHito
            const suma = aporte(estado, h.peso)
            return (
              <div key={h.campo} className="flex justify-between text-muted-foreground">
                <span>{h.etiqueta}</span>
                <span className={suma > 0 ? 'font-medium text-foreground' : ''}>
                  +{suma} de {h.peso}
                </span>
              </div>
            )
          })}
          <div className="flex justify-between text-muted-foreground">
            <span>Colocado laboralmente</span>
            <span className={estudiante.colocado ? 'font-medium text-foreground' : ''}>
              +{estudiante.colocado ? 30 : 0} de 30
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-medium">
            <span>Total</span>
            <span>
              {totalHitos + (estudiante.colocado ? 30 : 0)}% → {estudiante.porcentajeEmpleabilidad}%
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Un hito «en proceso» aporta {APORTE_EN_PROCESO} puntos fijos, no la mitad de su peso, y el
          total se trunca. Son rarezas de la hoja de seguimiento que se conservan a propósito: sin
          ellas el promedio publicado del programa cambiaría de valor sin que nadie hubiera cambiado
          de situación.
        </p>
      </Card>

      {/* Hitos */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Hitos de preparación</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Cada cambio se guarda al momento. «En proceso» es un estado real, no un «sí» a medias.
        </p>
        <div className="space-y-2">
          {HITOS.map((h) => {
            const actual = estudiante[h.respuesta] as EstadoHito
            return (
              <div
                key={h.campo}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm">
                  {h.etiqueta}
                  <span className="ml-2 text-xs text-muted-foreground">{h.peso} pts</span>
                </span>
                <div className="flex items-center gap-2">
                  {guardando === h.campo && <CircleNotch className="size-4 animate-spin text-muted-foreground" />}
                  <GrupoOpciones etiqueta={h.etiqueta}>
                    {ESTADOS.map((e) => (
                      <Opcion
                        key={e.valor}
                        activa={actual === e.valor}
                        disabled={guardando !== null}
                        onClick={() => guardar({ [h.campo]: e.valor }, h.campo)}
                      >
                        {e.etiqueta}
                      </Opcion>
                    ))}
                  </GrupoOpciones>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Enlaces */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Enlaces del participante</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Carpeta de Drive">
            <Input value={carpeta} onChange={(e) => setCarpeta(e.target.value)} placeholder="https://drive.google.com/..." />
          </Campo>
          <Campo
            etiqueta="Perfil público de LinkedIn"
            ayuda="El enlace que se revisa para decidir si está optimizado."
          >
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/in/..." />
          </Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={guardando !== null}
            onClick={() => guardar({ carpetaUrl: carpeta, linkedinUrl: linkedin }, 'enlaces')}
          >
            {guardando === 'enlaces' ? (
              <><CircleNotch className="size-4 animate-spin" /> Guardando…</>
            ) : (
              'Guardar enlaces'
            )}
          </Button>
          {estudiante.carpetaUrl && (
            <a
              href={estudiante.carpetaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <FolderOpen className="size-3.5" /> Abrir carpeta <ArrowSquareOut className="size-3" />
            </a>
          )}
          {estudiante.linkedinUrl && (
            <a
              href={estudiante.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <LinkedinLogo className="size-3.5" /> Ver perfil <ArrowSquareOut className="size-3" />
            </a>
          )}
        </div>
      </Card>

      {/* Colocación */}
      {colocaciones.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Colocación</h3>
          <div className="space-y-2">
            {colocaciones.map((c) => (
              <div key={c.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.cargo ?? 'Cargo sin registrar'}</span>
                  <span className="text-muted-foreground">en {c.empresaNombre}</span>
                  {!c.activa && <Badge variant="outline" className="text-xs">Cerrada</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pesos(c.salario)}
                  {c.diferenciaVsMeta !== null && (
                    <span className={c.superaMeta ? ' text-emerald-600 dark:text-emerald-400' : ' text-amber-600 dark:text-amber-400'}>
                      {' '}({c.superaMeta ? '+' : ''}{Math.round(c.diferenciaVsMeta).toLocaleString('es-CO')} vs meta)
                    </span>
                  )}
                  {c.canalConsecucionEtiqueta && ` · ${c.canalConsecucionEtiqueta}`}
                  {` · checklist ${c.checklistVerificados}/${c.checklistTotal}`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Postulaciones */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">
          Postulaciones {postulaciones.length > 0 && `(${postulaciones.length})`}
        </h3>
        {postulaciones.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay ninguna registrada. El participante puede anotarlas desde su cuenta.
          </p>
        ) : (
          <div className="space-y-2">
            {postulaciones.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{p.cargo}</span>
                  <span className="text-muted-foreground"> — {p.empresaNombre}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.fechaPostulacion}
                    {p.canal && ` · ${p.canal}`}
                    {p.registradaPorEstudiante && ' · la anotó el participante'}
                  </span>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {p.estadoEtiqueta}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
