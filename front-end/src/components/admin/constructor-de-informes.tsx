'use client'

/**
 * El constructor de informes: elegir columnas en vez de bajar uno de los fijos.
 *
 * Existe porque los informes cerrados se usan de una manera concreta: alguien
 * necesita tres campos, baja el que más se parece —que trae veinte— y borra
 * columnas en Excel. El archivo con las veinte columnas ya salió del sistema, y
 * seis de ellas identifican a una persona.
 *
 * Dos decisiones que no son de estilo:
 *
 * 1. **El catálogo lo manda el backend** (`GET /reportes/columnas`). Si la lista
 *    viviera aquí, añadir un campo al modelo sería añadirlo al informe sin que
 *    nadie lo revise, y pedir una columna que el servidor no conoce sería un
 *    error en la descarga en vez de una casilla que no aparece.
 * 2. **Los datos personales se avisan, no se bloquean.** El equipo tiene
 *    derecho a exportar su propio censo. Lo que no puede pasar es que salgan
 *    sin que nadie lo haya decidido, que es justo lo que pasaba con el informe
 *    de estudiantes y de donde salió el banco de perfiles.
 */

import { useEffect, useMemo, useState } from 'react'
import { Download, ListChecks, ShieldAlert } from 'lucide-react'
import {
  reportesApi,
  programasApi,
  ApiCallError,
  type ColumnaDeInforme,
} from '@/lib/api'
import type { ProgramaResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAvisos } from '@/components/ui/avisos'
import { usePreferences } from '@/lib/preferences'

/** Lo que trae marcado la primera vez: identifica sin exponer contacto. */
const SELECCION_INICIAL = ['NOMBRE', 'APELLIDO', 'PROGRAMA', 'ESTADO_ACADEMICO']

const ESTADOS = ['ACTIVO', 'EN_PROCESO', 'GRADUADO', 'RETIRADO'] as const

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Build your own report',
        desc: 'Pick the columns you need. Nothing else goes into the file.',
        columnas: 'Columns',
        deLaFicha: 'Record',
        personales: 'Identifying and contact data',
        avisoPersonal:
          'These identify a person or allow contacting them. You can export them — just know they will be in the file if you send it on.',
        filtros: 'Filters',
        programa: 'Programme',
        ciudad: 'City',
        estado: 'Academic status',
        todos: 'All',
        elegidas: (n: number) => `${n} selected`,
        ninguna: 'Pick at least one column.',
        limpiar: 'Clear',
        todasLasDeLaFicha: 'Select record columns',
        descargando: 'Preparing…',
        conPersonales: (n: number) =>
          `${n} of them identify or contact a person`,
        fallo: 'The report could not be generated.',
        cargando: 'Loading the catalogue…',
      }
    : {
        titulo: 'Arma tu propio informe',
        desc: 'Elige las columnas que necesitas. Al archivo no entra nada más.',
        columnas: 'Columnas',
        deLaFicha: 'De la ficha',
        personales: 'Datos que identifican o contactan',
        avisoPersonal:
          'Estas identifican a una persona o permiten contactarla. Puedes exportarlas — solo ten presente que irán en el archivo si lo reenvías.',
        filtros: 'Filtros',
        programa: 'Programa',
        ciudad: 'Ciudad',
        estado: 'Estado académico',
        todos: 'Todos',
        elegidas: (n: number) => `${n} elegidas`,
        ninguna: 'Elige al menos una columna.',
        limpiar: 'Limpiar',
        todasLasDeLaFicha: 'Marcar las de la ficha',
        descargando: 'Preparando…',
        conPersonales: (n: number) =>
          `${n} de ellas identifican o contactan a una persona`,
        fallo: 'No se pudo generar el informe.',
        cargando: 'Cargando el catálogo…',
      }
}

export function ConstructorDeInformes() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const { mostrarError, avisos } = useAvisos()

  const [catalogo, setCatalogo] = useState<ColumnaDeInforme[]>([])
  const [ciudades, setCiudades] = useState<string[]>([])
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [elegidas, setElegidas] = useState<string[]>(SELECCION_INICIAL)
  const [programaId, setProgramaId] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [estado, setEstado] = useState('')
  const [bajando, setBajando] = useState<string | null>(null)

  useEffect(() => {
    // Los filtros son secundarios: si fallan, el constructor sigue sirviendo
    // sin ellos. El catálogo no —sin él no hay nada que marcar—.
    void reportesApi.columnas().then(setCatalogo).catch(() => setCatalogo([]))
    void reportesApi.ciudades().then(setCiudades).catch(() => setCiudades([]))
    void programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  const deLaFicha = useMemo(() => catalogo.filter((c) => !c.personal), [catalogo])
  const personales = useMemo(() => catalogo.filter((c) => c.personal), [catalogo])

  // El orden de las columnas en el archivo es el del catálogo, no el del orden
  // en que se marcaron: dos personas que marquen lo mismo tienen que obtener
  // archivos iguales, o dejan de poder compararse.
  const enOrden = useMemo(
    () => catalogo.filter((c) => elegidas.includes(c.id)).map((c) => c.id),
    [catalogo, elegidas],
  )
  const personalesElegidas = useMemo(
    () => catalogo.filter((c) => c.personal && elegidas.includes(c.id)).length,
    [catalogo, elegidas],
  )

  const alternar = (id: string) =>
    setElegidas((previas) =>
      previas.includes(id) ? previas.filter((x) => x !== id) : [...previas, id],
    )

  const bajar = async (formato: 'xlsx' | 'pdf' | 'csv') => {
    if (enOrden.length === 0) {
      mostrarError(T.ninguna)
      return
    }
    setBajando(formato)
    try {
      await reportesApi.exportarPersonalizado(
        {
          columnas: enOrden,
          programaId: programaId || undefined,
          ciudad: ciudad || undefined,
          estadoAcademico: estado || undefined,
        },
        formato,
      )
    } catch (e) {
      mostrarError(e instanceof ApiCallError ? (e.body.message ?? T.fallo) : T.fallo)
    } finally {
      setBajando(null)
    }
  }

  const casilla = (c: ColumnaDeInforme) => (
    <label
      key={c.id}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
    >
      <input
        type="checkbox"
        className="size-3.5 accent-primary"
        checked={elegidas.includes(c.id)}
        onChange={() => alternar(c.id)}
      />
      <span>{c.etiqueta}</span>
    </label>
  )

  const selectClase =
    'h-9 w-full rounded-md border border-border bg-background px-2 text-sm'

  return (
    <Card className="rounded-lg border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4 text-primary" strokeWidth={2} />
          {T.titulo}
        </CardTitle>
        <CardDescription>{T.desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {catalogo.length === 0 ? (
          <p className="text-sm text-muted-foreground">{T.cargando}</p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {T.deLaFicha}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      setElegidas((previas) => [
                        ...new Set([...previas, ...deLaFicha.map((c) => c.id)]),
                      ])
                    }
                  >
                    {T.todasLasDeLaFicha}
                  </button>
                </div>
                <div className="grid grid-cols-1 rounded-md border border-border p-1 sm:grid-cols-2">
                  {deLaFicha.map(casilla)}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {T.personales}
                </p>
                {/* El aviso va junto a las casillas y no en un pie de página:
                    quien las marca está a un clic de mandar el archivo fuera. */}
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-1">
                  <p className="flex items-start gap-2 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                    {T.avisoPersonal}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2">{personales.map(casilla)}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="ci-programa" className="text-xs font-medium">{T.programa}</label>
                <select
                  id="ci-programa"
                  className={selectClase}
                  value={programaId}
                  onChange={(e) => setProgramaId(e.target.value)}
                >
                  <option value="">{T.todos}</option>
                  {programas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ci-ciudad" className="text-xs font-medium">{T.ciudad}</label>
                {/* Lista y no caja de texto: el filtro compara por igualdad y
                    la ciudad entró del Excel como texto libre. */}
                <select
                  id="ci-ciudad"
                  className={selectClase}
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                >
                  <option value="">{T.todos}</option>
                  {ciudades.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ci-estado" className="text-xs font-medium">{T.estado}</label>
                <select
                  id="ci-estado"
                  className={selectClase}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                >
                  <option value="">{T.todos}</option>
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>{e.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {T.elegidas(enOrden.length)}
                {personalesElegidas > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {' · '}{T.conPersonales(personalesElegidas)}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={enOrden.length === 0 || bajando !== null}
                  onClick={() => setElegidas([])}
                >
                  {T.limpiar}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={enOrden.length === 0 || bajando !== null}
                  onClick={() => void bajar('xlsx')}
                >
                  <Download className="size-3.5 text-emerald-600" strokeWidth={2} />
                  {bajando === 'xlsx' ? T.descargando : 'Excel'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={enOrden.length === 0 || bajando !== null}
                  onClick={() => void bajar('csv')}
                >
                  <Download className="size-3.5 text-sky-600" strokeWidth={2} />
                  {bajando === 'csv' ? T.descargando : 'CSV'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={enOrden.length === 0 || bajando !== null}
                  onClick={() => void bajar('pdf')}
                >
                  <Download className="size-3.5 text-rose-600" strokeWidth={2} />
                  {bajando === 'pdf' ? T.descargando : 'PDF'}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
      {avisos}
    </Card>
  )
}
