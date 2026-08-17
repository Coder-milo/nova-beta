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

import { CheckCircle2, Circle, CircleDot, Lock } from 'lucide-react'
import type { EstudianteResponse, EstadoHito } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/lib/preferences'

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

// Los pesos viven en `lib/ruta-empleabilidad`: son dato del dominio —copian la
// fórmula con la que el programa reporta— y allí los cubre un test. Aquí solo
// se pintan.
import { PESOS_RUTA as PESOS } from '@/lib/ruta-empleabilidad'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'My path',
        descripcion: 'The six steps the programme measures, in order. The percentage is the sum of what you have completed.',
        hecho: 'Done',
        enProceso: 'In progress',
        pendiente: 'Pending',
        ahora: 'Next',
        loRegistraElEquipo: 'Your advisor records this one',
        vale: (n: number) => `worth ${n}%`,
        pasos: {
          perfilOcupacional: ['Define your occupational profile', 'What role you are aiming for. Everything else is written against this.'],
          cvListo: ['Finish your résumé', 'It is what a company reads first.'],
          cvIngles: ['Résumé in English', 'It is what sets this programme apart, and it is worth as much as the Spanish one.'],
          linkedinCreado: ['Create your LinkedIn', 'So recruiters can find you outside the programme.'],
          linkedinOptimizado: ['Improve your LinkedIn', 'Headline, summary and keywords. Having it is not the same as it working.'],
          colocado: ['Get hired', 'Almost a third of the score. Your advisor records it with the contract.'],
        },
      }
    : {
        titulo: 'Mi ruta',
        descripcion: 'Los seis pasos que mide el programa, en orden. El porcentaje es la suma de lo que llevas hecho.',
        hecho: 'Hecho',
        enProceso: 'En proceso',
        pendiente: 'Pendiente',
        ahora: 'Sigue',
        loRegistraElEquipo: 'Este lo registra tu asesor',
        vale: (n: number) => `vale ${n}%`,
        pasos: {
          perfilOcupacional: ['Define tu perfil ocupacional', 'A qué cargo apuntas. Todo lo demás se escribe en función de esto.'],
          cvListo: ['Termina tu hoja de vida', 'Es lo primero que lee una empresa.'],
          cvIngles: ['Hoja de vida en inglés', 'Es el diferenciador del programa, y vale lo mismo que la de español.'],
          linkedinCreado: ['Crea tu LinkedIn', 'Para que te encuentren fuera del programa.'],
          linkedinOptimizado: ['Mejora tu LinkedIn', 'Titular, extracto y palabras clave. Tenerlo no es lo mismo que que funcione.'],
          colocado: ['Consigue empleo', 'Casi un tercio del puntaje. Lo registra tu asesor con el contrato.'],
        },
      }
}

export function MiRuta({ perfil }: { perfil: EstudianteResponse }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const pasos: Paso[] = [
    { id: 'perfilOcupacional', peso: PESOS.perfilOcupacional, estado: perfil.hitoPerfilOcupacional,
      href: '/configuracion-estudiante',
      titulo: T.pasos.perfilOcupacional[0], porque: T.pasos.perfilOcupacional[1] },
    { id: 'cvListo', peso: PESOS.cvListo, estado: perfil.hitoCvListo, href: '/mi-hoja-de-vida',
      titulo: T.pasos.cvListo[0], porque: T.pasos.cvListo[1] },
    { id: 'cvIngles', peso: PESOS.cvIngles, estado: perfil.hitoCvIngles, href: '/mi-hoja-de-vida',
      titulo: T.pasos.cvIngles[0], porque: T.pasos.cvIngles[1] },
    { id: 'linkedinCreado', peso: PESOS.linkedinCreado, estado: perfil.hitoLinkedinCreado,
      href: '/configuracion-estudiante',
      titulo: T.pasos.linkedinCreado[0], porque: T.pasos.linkedinCreado[1] },
    { id: 'linkedinOptimizado', peso: PESOS.linkedinOptimizado, estado: perfil.hitoLinkedinOptimizado,
      href: perfil.linkedinUrl || '/configuracion-estudiante',
      titulo: T.pasos.linkedinOptimizado[0], porque: T.pasos.linkedinOptimizado[1] },
    // La colocación no la marca el estudiante: la registra el equipo con el
    // contrato, y de ahí salen las cifras del cierre de cohorte. Se muestra
    // igual porque es casi un tercio del puntaje y omitirla haría que la ruta
    // no sumara 100.
    { id: 'colocado', peso: PESOS.colocado, estado: perfil.colocado ? 'SI' : 'NO', href: null,
      titulo: T.pasos.colocado[0], porque: T.pasos.colocado[1] },
  ]

  // El siguiente paso es el primero sin terminar que dependa del estudiante.
  // «En proceso» cuenta como no terminado: es justo donde alguien se quedó.
  const siguiente = pasos.find((p) => p.estado !== 'SI' && p.href !== null)?.id

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-base">{T.titulo}</CardTitle>
          <span className="text-2xl font-semibold tabular-nums text-primary">
            {perfil.porcentajeEmpleabilidad}%
          </span>
        </div>
        <CardDescription>{T.descripcion}</CardDescription>
      </CardHeader>

      <CardContent>
        <ol className="flex flex-col">
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
                  <Icono
                    className={`size-5 shrink-0 ${
                      hecho ? 'text-emerald-600 dark:text-emerald-400'
                        : enProceso ? 'text-amber-600 dark:text-amber-400'
                          : esElSiguiente ? 'text-primary' : 'text-muted-foreground/50'
                    }`}
                    strokeWidth={2}
                  />
                  {i < pasos.length - 1 && (
                    <span className={`mt-1 w-px flex-1 ${hecho ? 'bg-emerald-600/40' : 'bg-border'}`} />
                  )}
                </span>

                <span className="min-w-0 flex-1 pb-4">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-sm font-semibold ${hecho ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>
                      {paso.titulo}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{T.vale(paso.peso)}</span>
                    {esElSiguiente && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {T.ahora}
                      </span>
                    )}
                    {enProceso && !esElSiguiente && (
                      <span className="text-xs text-amber-700 dark:text-amber-400">{T.enProceso}</span>
                    )}
                  </span>
                  {/* El «por qué» solo en lo que falta: en lo ya hecho es ruido
                      que aleja el paso siguiente del pulgar. */}
                  {!hecho && (
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                      {paso.porque}
                      {paso.href === null && ` · ${T.loRegistraElEquipo}`}
                    </span>
                  )}
                </span>
              </>
            )

            const clases = `flex gap-3 rounded-md ${paso.href ? 'cursor-pointer hover:bg-secondary/40' : ''} ${esElSiguiente ? 'bg-primary/5' : ''} px-2 -mx-2 pt-2`

            // Solo se hace pulsable lo que lleva a algún sitio. Una lista donde
            // todo parece enlace y la mitad no lo es enseña a no pulsar nada.
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
              <li key={paso.id} className={clases}>{contenido}</li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
