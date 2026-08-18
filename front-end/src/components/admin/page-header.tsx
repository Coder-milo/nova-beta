import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from '@/compat/next-link'
import { cn } from '@/lib/utils'

export type CampoCabecera = {
  /** Etiqueta corta del campo. Va en texto pequeño, encima del valor. */
  etiqueta: string
  /** El dato. Se acepta un nodo para poder meter un distintivo o un enlace. */
  valor: ReactNode
}

export type PestanaCabecera = {
  etiqueta: string
  /** Si se omite, la pestaña se pinta como botón y responde a `onSelect`. */
  href?: string
  activa?: boolean
  onSelect?: () => void
}

type PageHeaderProps = {
  /**
   * Qué es esto. En un CRM la misma plantilla sirve para un estudiante, una
   * empresa o una vacante, y sin el antetítulo hay que deducirlo del contenido.
   */
  antetitulo: string
  /** Cómo se llama el registro o la pantalla. */
  titulo: string
  icono: LucideIcon
  /**
   * Los pocos campos que se consultan sin abrir nada más: estado, responsable,
   * fecha. Deliberadamente no es la ficha entera —si cabe todo, no hay jerarquía
   * y volvemos a tener que leerlo entero para encontrar un dato—.
   */
  campos?: CampoCabecera[]
  /**
   * Secciones de la ficha. Van dentro del encabezado y no sueltas encima del
   * contenido para que al desplazarse la pestaña abierta siga junto al nombre
   * del registro, que es lo que da contexto a lo que se está mirando.
   */
  pestanas?: PestanaCabecera[]
  /** Botonera de la derecha. */
  acciones?: ReactNode
  className?: string
}

/**
 * Banda de apertura de una pantalla del panel.
 *
 * Antes cada pantalla resolvía su encabezado por su cuenta: unas con un `h1`
 * suelto, otras con el título dentro de la primera tarjeta y otras sin nada. El
 * resultado es que el punto de anclaje —dónde miras al entrar— cambiaba de
 * sitio en cada ruta, y las acciones principales aparecían tan pronto arriba a
 * la derecha como al final de un formulario.
 *
 * Al fijarlo aquí, entrar en cualquier pantalla se parece a entrar en la
 * anterior: tipo de objeto, nombre, campos clave, secciones y acciones, siempre
 * en el mismo orden y a la misma altura.
 */
export function PageHeader({
  antetitulo,
  titulo,
  icono: Icono,
  campos,
  pestanas,
  acciones,
  className,
}: PageHeaderProps) {
  const hayCampos = Boolean(campos?.length)
  const hayPestanas = Boolean(pestanas?.length)

  return (
    <header
      className={cn(
        'panel-cabecera flex flex-col px-4 pt-3',
        // Sin pestañas el encabezado cierra con su propio relleno; con ellas,
        // el filete de la pestaña activa tiene que morir en el borde de la
        // tarjeta, así que abajo no puede quedar hueco.
        hayPestanas ? 'gap-2.5 pb-0' : 'gap-3 pb-3',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="panel-cabecera__icono" aria-hidden="true">
            <Icono className="size-[18px]" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="panel-cabecera__antetitulo truncate">{antetitulo}</span>
            <h1 className="panel-cabecera__titulo truncate">{titulo}</h1>
          </div>
        </div>

        {acciones && (
          <div className="flex shrink-0 items-center gap-2">{acciones}</div>
        )}
      </div>

      {hayCampos && (
        <dl className="flex flex-col gap-2 border-t border-[var(--panel-borde)] pt-2.5 sm:flex-row sm:flex-wrap sm:gap-0 sm:gap-y-2">
          {campos!.map((campo) => (
            <div key={campo.etiqueta} className="panel-cabecera__campo sm:pe-5">
              <dt>{campo.etiqueta}</dt>
              <dd className="truncate">{campo.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {hayPestanas && (
        <nav className="panel-cabecera__pestanas border-t border-[var(--panel-borde)]">
          {pestanas!.map((pestana) => {
            const comunes = {
              className: 'panel-cabecera__pestana',
              'aria-current': pestana.activa ? ('page' as const) : undefined,
            }
            return pestana.href ? (
              <Link key={pestana.etiqueta} href={pestana.href} {...comunes}>
                {pestana.etiqueta}
              </Link>
            ) : (
              <button
                key={pestana.etiqueta}
                type="button"
                onClick={pestana.onSelect}
                {...comunes}
              >
                {pestana.etiqueta}
              </button>
            )
          })}
        </nav>
      )}
    </header>
  )
}
