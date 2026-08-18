'use client'

/**
 * Alta de las cuentas de acceso de los estudiantes.
 *
 * Vive en Configuracion > Usuarios & Seguridad, junto a la gestion de
 * administradores y coordinadores: las dos responden a la misma pregunta
 * —quien puede entrar al panel—, asi que tenerlas separadas obligaba a saber
 * de antemano en cual de las dos buscar.
 *
 * Se puede lanzar sobre todos los estudiantes o sobre los que se elijan a mano.
 * Antes de crear nada de verdad se pide confirmacion diciendo a cuanta gente
 * afecta: la diferencia entre escribirle a una persona y a 107 es un clic.
 *
 * Consume:
 *   GET  /api/v1/admin/cuentas-estudiante   (padron, solo lectura)
 *   POST /api/v1/admin/cuentas-estudiante   (alta)
 *
 * Requiere ADMIN o COORDINADOR.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, Key, LoaderCircle as CircleNotch, Mail as Envelope, RefreshCw as ArrowsClockwise, Search as MagnifyingGlass } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Confirmar } from '@/components/ui/confirmar'
import { comunicacionesApi } from '@/lib/api'
import type { FilaPadron, Padron, ResumenAltaCuentas, ResultadoCuenta } from '@/lib/types'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

type Alcance = 'todos' | 'seleccion'
type Filtro = 'todos' | 'sin-cuenta' | 'con-cuenta'

/** Sin tildes ni mayúsculas, para que buscar "hector" encuentre "Héctor". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento
}

function FilaResultado({ cuenta }: { cuenta: ResultadoCuenta }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const color =
    cuenta.estado === 'CREADA'
      ? 'text-emerald-600 dark:text-emerald-400'
      : cuenta.estado === 'YA_TENIA'
        ? 'text-muted-foreground'
        : 'text-amber-600 dark:text-amber-400'

  return (
    <tr className="border-b border-border/60">
      <td className="px-3 py-2 text-sm">{cuenta.nombre}</td>
      <td className="px-3 py-2 text-sm text-muted-foreground">
        {cuenta.email ?? '—'}
      </td>
      <td className={`px-3 py-2 text-sm font-medium ${color}`}>{cuenta.estado}</td>
      <td className="px-3 py-2 text-sm">
        {cuenta.envio === 'ENVIADO' ? (
          <span className="text-emerald-600 dark:text-emerald-400">{T.enviado}</span>
        ) : (
          // Un fallo del proveedor se destaca: es lo unico que hay que
          // reintentar. Que la lista de pruebas bloquee un correo, no.
          <span
            className={
              cuenta.envio === 'FALLIDO' ? 'text-destructive' : 'text-muted-foreground'
            }
          >
            {cuenta.detalle}
          </span>
        )}
      </td>
    </tr>
  )
}

function FilaSeleccion({
  fila,
  marcada,
  onToggle,
  avisarBloqueo,
}: {
  fila: FilaPadron
  marcada: boolean
  onToggle: () => void
  avisarBloqueo: boolean
}) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const sinCorreo = fila.email === null

  return (
    <tr
      className={`border-b border-border/50 transition-colors ${
        sinCorreo ? 'opacity-60' : 'hover:bg-secondary/30'
      }`}
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          className="size-4 cursor-pointer disabled:cursor-not-allowed"
          checked={marcada}
          disabled={sinCorreo}
          onChange={onToggle}
          aria-label={T.seleccionarA(fila.nombre)}
        />
      </td>
      <td className="px-3 py-2 text-sm">{fila.nombre}</td>
      <td className="px-3 py-2 text-sm text-muted-foreground">
        {fila.email ?? T.sinCorreoEn}
      </td>
      <td className="px-3 py-2 text-sm">
        {fila.tieneCuenta ? (
          <span className="text-muted-foreground">{T.yaTieneCuenta}</span>
        ) : sinCorreo ? (
          <span className="text-amber-600 dark:text-amber-400">{T.noSeLe}</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">{T.sinCuentaX}</span>
        )}
        {avisarBloqueo && !sinCorreo && !fila.sePuedeEscribir && (
          <span className="ml-2 text-xs text-muted-foreground">
            {T.fueraDeLa}
          </span>
        )}
      </td>
    </tr>
  )
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        creaElUsuario: 'Creates the account for every student who does not have one yet and emails them a link to set their password. Their username is their email.',
        cadaEstudianteDefine: 'Each student sets their own password from the link they receive. Nobody — not even you — gets to see it.',
        seLesEnviara: 'They will be emailed their activation link.',
        enviarlesSuEnlace: 'Email them their activation link',
        ningunEstudianteCoincide: 'No student matches the search.',
        cuentasDeAcceso: 'Student sign-in accounts',
        soloLosQue: 'Only those who already have an account',
        soloLosQueX: 'Only those without an account',
        todosLosEstudiantes: 'All active students',
        buscarPorNombre: 'Search by name or email…',
        noSeEnviara: 'No email will be sent.',
        aQuien: 'Who',
        enviado: 'Sent',
        seleccionarA: (n: string) => `Select ${n}`,
        fueraDeLa: '(outside the test list)',
        simulacionNoSe: 'Dry run — nothing was created or sent',
        eligeAlMenos: 'Choose at least one student.',
        simularNoCrea: 'Dry run (creates nothing)',
        crearCuentasDe: 'Create sign-in accounts',
        soloLosQueXX: 'Only the ones I pick',
        limpiarSeleccion: 'Clear selection',
        sinCorreoEn: 'No email on the record',
        sinCorreoEnX: 'no email on the record',
        estudiantesActivos: 'active students',
        noSeLe: 'Cannot be created',
        yaTienenCuenta: 'already have an account',
        yaTenianCuenta: 'already had an account',
        yaTieneCuenta: 'Already has an account',
        seCrearian: 'would be created',
        crearCuentas: 'Create accounts',
        sinCuenta: 'no account',
        sinCuentaX: 'No account',
        todos: 'All',
      }
    : {
        creaElUsuario: 'Crea el usuario de cada estudiante que aún no lo tenga y le envía un enlace para que defina su contraseña. El usuario es su correo.',
        cadaEstudianteDefine: 'Cada estudiante define su propia contraseña desde el enlace que recibe. Nadie —tampoco tú— llega a conocerla.',
        seLesEnviara: 'Se les enviará su enlace de activación por correo.',
        enviarlesSuEnlace: 'Enviarles su enlace de activación por correo',
        ningunEstudianteCoincide: 'Ningún estudiante coincide con la búsqueda.',
        cuentasDeAcceso: 'Cuentas de acceso de los estudiantes',
        soloLosQue: 'Solo los que ya tienen cuenta',
        soloLosQueX: 'Solo los que no tienen cuenta',
        todosLosEstudiantes: 'Todos los estudiantes activos',
        buscarPorNombre: 'Buscar por nombre o correo…',
        noSeEnviara: 'No se enviará ningún correo.',
        aQuien: 'A quién',
        enviado: 'Enviado',
        seleccionarA: (n: string) => `Seleccionar a ${n}`,
        fueraDeLa: '(fuera de la lista de pruebas)',
        simulacionNoSe: 'Simulación — no se creó ni se envió nada',
        eligeAlMenos: 'Elige al menos un estudiante.',
        simularNoCrea: 'Simular (no crea nada)',
        crearCuentasDe: 'Crear cuentas de acceso',
        soloLosQueXX: 'Solo los que yo elija',
        limpiarSeleccion: 'Limpiar selección',
        sinCorreoEn: 'Sin correo en la ficha',
        sinCorreoEnX: 'sin correo en la ficha',
        estudiantesActivos: 'estudiantes activos',
        noSeLe: 'No se le puede crear',
        yaTienenCuenta: 'ya tienen cuenta',
        yaTenianCuenta: 'ya tenían cuenta',
        yaTieneCuenta: 'Ya tiene cuenta',
        seCrearian: 'se crearían',
        crearCuentas: 'Crear cuentas',
        sinCuenta: 'sin cuenta',
        sinCuentaX: 'Sin cuenta',
        todos: 'Todos',
      }
}

export function PanelCuentasEstudiante() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [padron, setPadron] = useState<Padron | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorPadron, setErrorPadron] = useState<string | null>(null)

  const [alcance, setAlcance] = useState<Alcance>('seleccion')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const [enviarCorreo, setEnviarCorreo] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [resumen, setResumen] = useState<ResumenAltaCuentas | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargarPadron = useCallback(async () => {
    setCargando(true)
    setErrorPadron(null)
    try {
      setPadron(await comunicacionesApi.padronEstudiantes())
    } catch (err) {
      setErrorPadron(errorDe(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarPadron()
  }, [cargarPadron])

  const hayListaDePruebas = (padron?.destinatariosPermitidos.length ?? 0) > 0

  const visibles = useMemo(() => {
    if (!padron) return []
    const q = normalizar(busqueda.trim())
    return padron.estudiantes.filter((f) => {
      if (filtro === 'sin-cuenta' && (f.tieneCuenta || f.email === null)) return false
      if (filtro === 'con-cuenta' && !f.tieneCuenta) return false
      if (!q) return true
      return normalizar(f.nombre).includes(q) || normalizar(f.email ?? '').includes(q)
    })
  }, [padron, busqueda, filtro])

  /** Solo cuenta lo que de verdad se puede procesar. */
  const seleccionables = useMemo(
    () => visibles.filter((f) => f.email !== null),
    [visibles],
  )
  const todasVisiblesMarcadas =
    seleccionables.length > 0 && seleccionables.every((f) => seleccion.has(f.estudianteId))

  const alternar = (id: string) => {
    setSeleccion((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  /** Actúa solo sobre lo que hay filtrado, que es lo que la persona está viendo. */
  const alternarVisibles = () => {
    setSeleccion((prev) => {
      const siguiente = new Set(prev)
      for (const f of seleccionables) {
        if (todasVisiblesMarcadas) siguiente.delete(f.estudianteId)
        else siguiente.add(f.estudianteId)
      }
      return siguiente
    })
  }

  const destinatarios = alcance === 'todos' ? (padron?.total ?? 0) : seleccion.size

  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const ejecutar = async (simulacion: boolean) => {
    setProcesando(true)
    setError(null)
    setResumen(null)
    try {
      setResumen(
        await comunicacionesApi.crearCuentasEstudiante({
          // Vacío significa {'todos'} en el backend; mandar la lista explícita
          // cuando se eligió a mano evita depender de esa convención.
          estudianteIds: alcance === 'todos' ? undefined : [...seleccion],
          enviarCorreo,
          simulacion,
        }),
      )
      if (!simulacion) cargarPadron()
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setProcesando(false)
    }
  }

  const nadaQueHacer = alcance === 'seleccion' && seleccion.size === 0

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="size-5 text-primary" />
              {T.cuentasDeAcceso}
            </CardTitle>
            <CardDescription>
              {T.creaElUsuario}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={cargarPadron} disabled={cargando}>
            <ArrowsClockwise className="mr-1 size-3.5" /> Refrescar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-6">
        {errorPadron && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            <WarningCircle className="mt-0.5 size-4 shrink-0" />
            {errorPadron}
          </p>
        )}

        {cargando && !padron && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" /> Cargando estudiantes…
          </p>
        )}

        {padron && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                <strong>{padron.total}</strong> {T.estudiantesActivos}
              </span>
              <span className="text-muted-foreground">
                <strong>{padron.conCuenta}</strong> {T.yaTienenCuenta}
              </span>
              <span className="text-muted-foreground">
                <strong>{padron.sinCuenta}</strong> {T.sinCuenta}
              </span>
              {padron.sinCorreo > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  <strong>{padron.sinCorreo}</strong> {T.sinCorreoEnX}
                </span>
              )}
            </div>

            {/* ── A quién ─────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-2 rounded-xl border border-border/60 bg-secondary/10 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {T.aQuien}
              </legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="size-4 cursor-pointer"
                  checked={alcance === 'seleccion'}
                  onChange={() => setAlcance('seleccion')}
                />
                <span>
                  {T.soloLosQueXX}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="size-4 cursor-pointer"
                  checked={alcance === 'todos'}
                  onChange={() => setAlcance('todos')}
                />
                <span>
                  {T.todosLosEstudiantes}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {padron.total} personas
                  </span>
                </span>
              </label>
            </fieldset>

            {/* ── Selector ────────────────────────────────────────────── */}
            {alcance === 'seleccion' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-56 flex-1">
                    <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-9 pl-9"
                      placeholder={T.buscarPorNombre}
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value as Filtro)}
                  >
                    <option value={'todos'}>{T.todos}</option>
                    <option value="sin-cuenta">{T.soloLosQueX}</option>
                    <option value="con-cuenta">{T.soloLosQue}</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={alternarVisibles}
                    disabled={seleccionables.length === 0}
                  >
                    {todasVisiblesMarcadas ? 'Quitar' : 'Marcar'} los {seleccionables.length}{' '}
                    visibles
                  </Button>
                  {seleccion.size > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setSeleccion(new Set())}>
                      {T.limpiarSeleccion}
                    </Button>
                  )}
                </div>

                <div className="max-h-80 overflow-auto rounded-xl border border-border">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="w-10 px-3 py-2" />
                        <th className="px-3 py-2">Estudiante</th>
                        <th className="px-3 py-2">Correo</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((f) => (
                        <FilaSeleccion
                          key={f.estudianteId}
                          fila={f}
                          marcada={seleccion.has(f.estudianteId)}
                          onToggle={() => alternar(f.estudianteId)}
                          avisarBloqueo={hayListaDePruebas}
                        />
                      ))}
                      {visibles.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-6 text-center text-sm text-muted-foreground"
                          >
                            {T.ningunEstudianteCoincide}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Correo ──────────────────────────────────────────────── */}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 cursor-pointer"
                checked={enviarCorreo}
                onChange={(e) => setEnviarCorreo(e.target.checked)}
              />
              <span>
                {T.enviarlesSuEnlace}
                <span className="block text-xs text-muted-foreground">
                  Canal configurado: <strong>{padron.canalDeCorreo}</strong>.
                </span>
              </span>
            </label>

            {hayListaDePruebas && enviarCorreo && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <WarningCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  El servidor tiene una lista de direcciones de prueba, así que{' '}
                  <strong>solo se escribirá a {padron.destinatariosPermitidos.join(', ')}</strong>.
                  Al resto se le creará la cuenta pero no recibirá el correo. Para
                  habilitar el envío real hay que vaciar{' '}
                  <code className="text-xs">CORREO_DESTINATARIOS_PERMITIDOS</code>.
                </span>
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                <WarningCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => ejecutar(true)}
                disabled={procesando || nadaQueHacer}
              >
                {procesando ? (
                  <>
                    <CircleNotch className="size-4 animate-spin" /> Calculando…
                  </>
                ) : (
                  T.simularNoCrea
                )}
              </Button>
              <Button onClick={() => setShowConfirmModal(true)} disabled={procesando || nadaQueHacer}>
                <Envelope className="size-4" />
                {alcance === 'todos'
                  ? `Crear cuentas para los ${destinatarios}`
                  : `Crear cuentas para ${destinatarios} seleccionado${destinatarios === 1 ? '' : 's'}`}
              </Button>
              {nadaQueHacer && (
                <span className="text-xs text-muted-foreground">
                  {T.eligeAlMenos}
                </span>
              )}
            </div>

            <Confirmar
              open={showConfirmModal}
              onOpenChange={setShowConfirmModal}
              titulo={T.crearCuentasDe}
              descripcion={
                <>
                  Se van a crear las cuentas que falten para{' '}
                  <strong>
                    {alcance === 'todos'
                      ? `los ${destinatarios} estudiantes activos`
                      : `${destinatarios} estudiante${destinatarios === 1 ? '' : 's'}`}
                  </strong>
                  .
                  {enviarCorreo
                    ? ` ${T.seLesEnviara}`
                    : ` ${T.noSeEnviara}`}
                </>
              }
              textoConfirmar={T.crearCuentas}
              destructivo={false}
              onConfirmar={() => ejecutar(false)}
            />
          </>
        )}

        {/* ── Resultado ───────────────────────────────────────────────── */}
        {resumen && (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
            {/* En simulación todo va en condicional. Un «107 creadas» junto a
                un aviso de que no se creó nada obliga a leer dos veces para
                saber si el trabajo ya se hizo. */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {resumen.simulacion && (
                <span className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-700 dark:text-amber-400">
                  {T.simulacionNoSe}
                </span>
              )}
              <span>
                <strong>{resumen.creadas}</strong>{' '}
                {resumen.simulacion ? T.seCrearian : 'creadas'}
              </span>
              <span className="text-muted-foreground">
                <strong>{resumen.yaTenian}</strong> {T.yaTenianCuenta}
              </span>
              <span className="text-muted-foreground">
                <strong>{resumen.sinCorreo}</strong> {T.sinCorreoEnX}
              </span>
              {!resumen.simulacion && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  <strong>{resumen.correosEnviados}</strong> correos enviados
                </span>
              )}
              {resumen.correosFallidos > 0 && (
                <span className="text-destructive">
                  <strong>{resumen.correosFallidos}</strong> correos fallidos
                </span>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {T.cadaEstudianteDefine}
              </span>
            </p>

            <div className="max-h-96 overflow-auto rounded-xl border border-border">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Estudiante</th>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.detalle.map((c) => (
                    <FilaResultado key={c.estudianteId} cuenta={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
