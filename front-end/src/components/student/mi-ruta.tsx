'use client'

/**
 * El proceso del estudiante como una ruta, no como cinco casillas sueltas.
 *
 * El portal enseñaba un porcentaje —«tu perfil de empleabilidad: 31%»— y los
 * hitos repartidos entre pantallas. Con eso, la pregunta que trae aquí a
 * alguien no tiene respuesta: **no es «cuánto llevo», es «qué hago ahora»**.
 * Un 31% no dice si falta la hoja de vida o si falta que lo contraten.
 *
 * Los seis pasos y sus pesos no se inventan aquí: salen de
 * `PuntajeEmpleabilidad`, que replica la fórmula con la que el programa reporta
 * a su financiador. Enseñar el peso importa porque los pasos **no valen igual**
 * —la hoja de vida en inglés vale tanto como la hoja de vida, y la colocación
 * es casi un tercio—, y sin verlo la ruta parece una lista de recados.
 *
 * Si alguna vez cambian los pesos allí, aquí quedarían desfasados. Es el precio
 * de no pedir al servidor una estructura que ya se puede componer con lo que la
 * ficha ya trae; el test comprueba que la suma siga dando 100.
 */

import { CheckCircle2, Circle, CircleDot, Lock, Sparkles } from 'lucide-react'
import type { EstudianteResponse, EstadoHito } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/lib/preferences'
import { PESOS_RUTA as PESOS, calcularPorcentajeEmpleabilidad } from '@/lib/ruta-empleabilidad'

/** Un paso de la ruta. `peso` es lo que aporta al porcentaje del programa. */
interface Paso {
  id: string
  titulo: string
  porque: string
  peso: number
  estado: EstadoHito
  /** A dónde se va a resolverlo. Nulo cuando no depende del estudiante. */
  href: string | null
}

export interface MiRutaProps {
  perfil: EstudianteResponse
  onAbrirPaso?: (pasoId: string) => void
}

function textos(english: boolean) {
  return english
    ? {
        titulo: 'My employability path',
        descripcion: 'The six steps the programme measures, in order. The percentage is the sum of what you have completed.',
        progresoGeneral: 'Overall progress',
        hecho: 'Done',
        enProceso: 'In progress',
        pendiente: 'Pending',
        ahora: 'Next step',
        loRegistraElEquipo: 'Your advisor records this one',
        vale: (n: number) => `worth ${n}%`,
        pasos: {
          perfilOcupacional: ['Define your occupational profile', 'What role you are aiming for. Everything else is written against this.'],
          cvListo: ['Spanish ATS Résumé', 'Formatted for local and regional job opportunities.'],
          cvIngles: ['English Resume & Bilingual Profile', 'Adapted with AI for remote and multinational opportunities.'],
          linkedinCreado: ['Create your LinkedIn', 'So recruiters can find you outside the programme.'],
          linkedinOptimizado: ['Improve your LinkedIn', 'Headline, summary and keywords. Having it is not the same as it working.'],
          colocado: ['Get hired', 'Almost a third of the score. Your advisor records it with the contract.'],
        },
      }
    : {
        titulo: 'Mi ruta de empleabilidad',
        descripcion: 'Los seis pasos que mide el programa, en orden. El porcentaje es la suma de lo que llevas hecho.',
        progresoGeneral: 'Progreso general',
        hecho: 'Hecho',
        enProceso: 'En proceso',
        pendiente: 'Pendiente',
        ahora: 'Sigue',
        loRegistraElEquipo: 'Este lo registra tu asesor',
        vale: (n: number) => `vale ${n}%`,
        pasos: {
          perfilOcupacional: ['Define tu perfil ocupacional', 'A qué cargo apuntas. Todo lo demás se escribe en función de esto.'],
          cvListo: ['Hoja de vida en español (ATS)', 'Tu currículum estándar para vacantes locales y nacionales.'],
          cvIngles: ['English Resume bilingüe', 'Adaptado con IA para vacantes remotas e internacionales.'],
          linkedinCreado: ['Crea tu LinkedIn', 'Para que te encuentren fuera del programa.'],
          linkedinOptimizado: ['Mejora tu LinkedIn', 'Titular, extracto y palabras clave. Tenerlo no es lo mismo que que funcione.'],
          colocado: ['Consigue empleo', 'Casi un tercio del puntaje. Lo registra tu asesor con el contrato.'],
        },
      }
}

export function MiRuta({ perfil, onAbrirPaso }: MiRutaProps) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  // Evaluación reactiva de los hitos con base en la información real del perfil
  const hitoPerfil =
    perfil.hitoPerfilOcupacional === 'SI' ||
    Boolean(perfil.cargoObjetivo?.trim() || perfil.perfilProfesional?.trim())
      ? 'SI'
      : (perfil.hitoPerfilOcupacional || 'NO')

  const hitoLinkedin =
    perfil.hitoLinkedinCreado === 'SI' || Boolean(perfil.linkedinUrl?.trim())
      ? 'SI'
      : (perfil.hitoLinkedinCreado || 'NO')

  const pasos: Paso[] = [
    {
      id: 'perfilOcupacional',
      peso: PESOS.perfilOcupacional,
      estado: hitoPerfil,
      href: '/configuracion-estudiante',
      titulo: T.pasos.perfilOcupacional[0],
      porque: T.pasos.perfilOcupacional[1],
    },
    {
      id: 'cvListo',
      peso: PESOS.cvListo,
      estado: perfil.hitoCvListo || 'NO',
      href: '/mi-hoja-de-vida',
      titulo: T.pasos.cvListo[0],
      porque: T.pasos.cvListo[1],
    },
    {
      id: 'cvIngles',
      peso: PESOS.cvIngles,
      estado: perfil.hitoCvIngles || 'NO',
      href: '/mi-hoja-de-vida',
      titulo: T.pasos.cvIngles[0],
      porque: T.pasos.cvIngles[1],
    },
    {
      id: 'linkedinCreado',
      peso: PESOS.linkedinCreado,
      estado: hitoLinkedin,
      href: '/configuracion-estudiante',
      titulo: T.pasos.linkedinCreado[0],
      porque: T.pasos.linkedinCreado[1],
    },
    {
      id: 'linkedinOptimizado',
      peso: PESOS.linkedinOptimizado,
      estado: hitoLinkedin === 'SI' ? (perfil.hitoLinkedinOptimizado || 'NO') : 'NO',
      href: perfil.linkedinUrl || '/configuracion-estudiante',
      titulo: T.pasos.linkedinOptimizado[0],
      porque: T.pasos.linkedinOptimizado[1],
    },
    // La colocación no la marca el estudiante: la registra el equipo con el
    // contrato, y de ahí salen las cifras del cierre de cohorte. Se muestra
    // igual porque es casi un tercio del puntaje y omitirla haría que la ruta
    // no sumara 100.
    {
      id: 'colocado',
      peso: PESOS.colocado,
      estado: perfil.colocado ? 'SI' : 'NO',
      href: null,
      titulo: T.pasos.colocado[0],
      porque: T.pasos.colocado[1],
    },
  ]

  // El siguiente paso es el primero sin terminar que dependa del estudiante.
  // «En proceso» cuenta como no terminado: es justo donde alguien se quedó.
  const siguiente = pasos.find((p) => p.estado !== 'SI' && p.href !== null)?.id

  // El porcentaje calculado refleja fielmente la suma de lo completado en la ruta
  const porcentaje = calcularPorcentajeEmpleabilidad({
    hitoPerfilOcupacional: hitoPerfil,
    hitoCvListo: perfil.hitoCvListo,
    hitoCvIngles: perfil.hitoCvIngles,
    hitoLinkedinCreado: hitoLinkedin,
    hitoLinkedinOptimizado: hitoLinkedin === 'SI' ? perfil.hitoLinkedinOptimizado : 'NO',
    colocado: perfil.colocado,
  })

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{T.titulo}</CardTitle>
            {porcentaje === 100 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" /> 100%
              </span>
            )}
          </div>
          <span className="text-2xl font-semibold tabular-nums text-primary transition-all duration-500">
            {porcentaje}%
          </span>
        </div>
        <CardDescription>{T.descripcion}</CardDescription>

        {/* Barra de progreso reactiva y animada */}
        <div className="mt-3 space-y-1">
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label={T.progresoGeneral}
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <ol className="flex flex-col space-y-1">
          {pasos.map((paso, i) => {
            const hecho = paso.estado === 'SI'
            const enProceso = paso.estado === 'EN_PROCESO'
            const esElSiguiente = paso.id === siguiente
            const Icono = hecho ? CheckCircle2 : enProceso ? CircleDot : paso.href === null ? Lock : Circle

            const contenido = (
              <>
                {/* La línea que une los pasos: es lo que convierte seis
                    tarjetas en un recorrido. No se dibuja bajo el último. */}
                <span className="flex flex-col items-center self-stretch">
                  <span className={`relative flex size-6 shrink-0 items-center justify-center rounded-full ${
                    esElSiguiente ? 'ring-2 ring-primary/40 bg-primary/10' : ''
                  }`}>
                    <Icono
                      className={`size-5 shrink-0 transition-colors duration-300 ${
                        hecho
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : enProceso
                            ? 'text-amber-600 dark:text-amber-400'
                            : esElSiguiente
                              ? 'text-primary'
                              : 'text-muted-foreground/50'
                      }`}
                      strokeWidth={2}
                    />
                  </span>
                  {i < pasos.length - 1 && (
                    <span
                      className={`mt-1.5 w-px flex-1 transition-colors duration-500 ${
                        hecho ? 'bg-emerald-600/40' : 'bg-border'
                      }`}
                    />
                  )}
                </span>

                <span className="min-w-0 flex-1 pb-3 pt-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`text-sm font-semibold transition-colors ${
                        hecho
                          ? 'text-muted-foreground line-through decoration-1'
                          : esElSiguiente
                            ? 'text-foreground font-bold'
                            : 'text-foreground'
                      }`}
                    >
                      {paso.titulo}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {T.vale(paso.peso)}
                    </span>
                    {esElSiguiente && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-xs motion-safe:animate-pulse">
                        <Sparkles className="size-3" />
                        {T.ahora}
                      </span>
                    )}
                    {enProceso && !esElSiguiente && (
                      <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {T.enProceso}
                      </span>
                    )}
                    {hecho && (
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {T.hecho}
                      </span>
                    )}
                  </span>

                  {/* El «por qué» solo en lo que falta: en lo ya hecho es ruido
                      que aleja el paso siguiente del pulgar. */}
                  {!hecho && (
                    <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                      {paso.porque}
                      {paso.href === null && ` · ${T.loRegistraElEquipo}`}
                    </span>
                  )}
                </span>
              </>
            )

            const clases = `w-full text-left flex gap-3 rounded-xl px-3 -mx-3 py-2 transition-all duration-200 ${
              esElSiguiente
                ? 'bg-primary/[0.06] border border-primary/25 shadow-xs'
                : 'hover:bg-secondary/50'
            } cursor-pointer`

            // Si se proporciona onAbrirPaso, todos los pasos accionables abren el modal in-situ
            if (onAbrirPaso) {
              return (
                <li key={paso.id}>
                  <button
                    type="button"
                    onClick={() => onAbrirPaso(paso.id)}
                    className={clases}
                    aria-label={`${paso.titulo} (${paso.estado === 'SI' ? T.hecho : T.pendiente})`}
                  >
                    {contenido}
                  </button>
                </li>
              )
            }

            // Fallback si no hay controlador de modal
            return paso.href ? (
              <li key={paso.id}>
                <a
                  href={paso.href}
                  target={paso.href.startsWith('http') ? '_blank' : undefined}
                  rel={paso.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className={clases}
                >
                  {contenido}
                </a>
              </li>
            ) : (
              <li key={paso.id} className={clases}>
                {contenido}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
