'use client'

/**
 * Pantalla de configuración: navegación entre paneles y nada más.
 *
 * Tenía 1288 líneas porque los formularios de institución y de operación, y
 * toda la gestión de usuarios, vivían escritos aquí dentro. Los dos primeros
 * guardaban en `localStorage`, así que cada navegador tenía su propia versión
 * de los datos de la institución y el umbral de match que se editaba no era el
 * que usaba el motor. Ahora cada pestaña es un panel con su propio GET y PUT
 * contra el servidor, como ya hacían branding y WhatsApp.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from '@/compat/next-navigation'
import { CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, Globe, Landmark as Bank, LayoutGrid as SquaresFour, LoaderCircle as CircleNotch, Monitor, Moon, Palette, Settings as Gear, Search as MagnifyingGlass, Share2 as ShareNetwork, Shield, ShieldAlert as ShieldWarning, SlidersHorizontal as Sliders, Sun, X } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Confirmar } from '@/components/ui/confirmar'
import { PanelAcademico } from '@/components/admin/panel-academico'
import { PanelBranding } from '@/components/admin/panel-branding'
import { PanelCuentasEstudiante } from '@/components/admin/panel-cuentas-estudiante'
import { PanelInstitucion } from '@/components/admin/panel-institucion'
import { PanelIntegraciones } from '@/components/admin/panel-integraciones'
import { PanelPlataformas } from '@/components/admin/panel-plataformas'
import { PanelUsuarios } from '@/components/admin/panel-usuarios'
import { PanelWhatsapp } from '@/components/admin/panel-whatsapp'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { adminApi, configuracionApi, programasApi } from '@/lib/api'
import { textosAdmin } from '@/lib/textos-admin'

/**
 * Las secciones, reagrupadas por **qué cambias y a quién afecta**.
 *
 * Antes eran seis y tres llevaban «&» en el nombre, que es la señal de que cada
 * una era dos cosas. La peor era «Apariencia & Mantenimiento»: ahí convivían la
 * identidad que ve el cliente, el canal de WhatsApp, tu preferencia personal de
 * tema claro/oscuro y los botones de «Desactivar todo» y «Vaciar sistema».
 * Alguien entraba a poner el modo oscuro y pasaba por encima de la zona de
 * peligro para llegar.
 *
 * Ahora cada sección responde a una sola pregunta:
 *
 *   institucion   — los datos de la sede
 *   operacion     — cómo se comporta el programa
 *   personas      — quién entra y con qué cuenta
 *   marca         — lo que ve el cliente de cada proyecto
 *   conexiones    — los servicios de fuera: correo, IA, WhatsApp, portales
 *   preferencias  — lo que solo te afecta a ti
 *   peligro       — lo que no tiene vuelta atrás
 */
type TabKey =
  | 'institucion'
  | 'operacion'
  | 'personas'
  | 'marca'
  | 'conexiones'
  | 'preferencias'
  | 'peligro'

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        estasSeguroDe: 'Are you sure you want to completely empty the transactional system? ALL students, vacancies, matches, skills and certificates will be physically deleted. This cannot be undone.',
        operacionesMasivasDe: 'Bulk data-cleanup operations on the Academy CAC database.',
        eliminacionPermanenteDe: 'Permanently delete inactive students, or empty the test environment.',
        errorAlRestaurar: "The programme's students could not be restored.",
        errorAlRealizar: 'The bulk deactivation failed.',
        accionesMasivasPor: 'Bulk actions by academic programme',
        desactivarEstudiantesDel: "Deactivate the programme's students",
        hayanPasadoEl: 'are past the configured retention period',
        purgaGlobalDe: 'Global purge of transactional data',
        errorAlLimpiar: 'The transactional system could not be cleared.',
        errorAlResetear: 'The programme could not be reset.',
        errorAlPurgar: 'The bin could not be purged.',
        parametrosDeOperacion: 'Operating parameters',
        institucionSede: 'Institution',
        personasYAccesos: 'People and access',
        marcaDelProyecto: 'Project branding',
        conexiones: 'Connections',
        misPreferencias: 'My preferences',
        zonaDePeligro: 'Danger zone',
        buscaUnAjuste: 'Search a setting (logo, WhatsApp, threshold…)',
        nadaCoincide: 'No section matches that. Try the name of the service or the data you are looking for.',
        resumenInstitucion: 'Legal details, address and contact for the site.',
        resumenOperacion: 'How the programme behaves: match threshold, vacancy validity, retention.',
        resumenPersonas: 'Who gets in and with what account. Team, students and their invitation emails.',
        resumenMarca: 'Logo, colours and banner of each project. This is what the client sees.',
        resumenConexiones: 'Outside services: email, WhatsApp, AI, job boards and learning platforms.',
        resumenPreferencias: 'Theme and language. Affects only you, on this device.',
        resumenPeligro: 'Bulk deletion and cleanup. No undo.',
        seleccionarPrograma: 'Choose a programme:',
      }
    : {
        estasSeguroDe: '¿Estás seguro de que deseas vaciar por completo todo el sistema transaccional? Se eliminarán físicamente TODOS los estudiantes, vacantes, matches, habilidades y certificaciones. Esta acción es irreversible.',
        operacionesMasivasDe: 'Operaciones masivas de limpieza de datos en la base de datos de Academy CAC.',
        eliminacionPermanenteDe: 'Eliminación permanente de estudiantes inactivos o vaciado del entorno de prueba.',
        errorAlRestaurar: 'Error al restaurar los estudiantes del programa.',
        errorAlRealizar: 'Error al realizar la desactivación masiva.',
        accionesMasivasPor: 'Acciones masivas por programa académico',
        desactivarEstudiantesDel: 'Desactivar estudiantes del programa',
        hayanPasadoEl: 'hayan pasado el plazo de retención configurado',
        purgaGlobalDe: 'Purga global de datos transaccionales',
        errorAlLimpiar: 'Error al limpiar el sistema transaccional.',
        errorAlResetear: 'Error al resetear el programa.',
        errorAlPurgar: 'Error al purgar la papelera.',
        parametrosDeOperacion: 'Parámetros de Operación',
        institucionSede: 'Institución',
        personasYAccesos: 'Personas y accesos',
        marcaDelProyecto: 'Marca del proyecto',
        conexiones: 'Conexiones',
        misPreferencias: 'Mis preferencias',
        zonaDePeligro: 'Zona de peligro',
        buscaUnAjuste: 'Busca un ajuste (logo, WhatsApp, umbral…)',
        nadaCoincide: 'Ningún apartado coincide. Prueba con el nombre del servicio o del dato que buscas.',
        resumenInstitucion: 'Datos legales, dirección y contacto de la sede.',
        resumenOperacion: 'Cómo se comporta el programa: umbral de match, vigencia de vacantes, retención.',
        resumenPersonas: 'Quién entra y con qué cuenta. Equipo, estudiantes y sus correos de invitación.',
        resumenMarca: 'Logo, colores y banner de cada proyecto. Es lo que ve el cliente.',
        resumenConexiones: 'Servicios de fuera: correo, WhatsApp, IA, portales de empleo y plataformas.',
        resumenPreferencias: 'Tema e idioma. Solo te afecta a ti, en este dispositivo.',
        resumenPeligro: 'Borrado masivo y limpieza. No tiene vuelta atrás.',
        seleccionarPrograma: 'Seleccionar programa:',
      }
}

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const { theme, setTheme, locale, setLocale, t } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  /**
   * La sección abierta, con `?seccion=` para poder enlazarla desde fuera.
   *
   * Un aviso del panel que dice «106 participantes sin cuenta» tiene que poder
   * llevar a donde se arregla. Dejarlo en la portada de Configuración obliga a
   * adivinar cuál de las siete secciones es, que es justo lo que hace que un
   * aviso se ignore.
   */
  const parametrosConfiguracion = useSearchParams()
  const seccionPedida = parametrosConfiguracion.get('seccion') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>(seccionPedida ?? 'institucion')
  const [buscarAjuste, setBuscarAjuste] = useState('')

  const [programas, setProgramas] = useState<{ id: string; nombre: string }[]>([])
  const [selectedPgm, setSelectedPgm] = useState('')
  const [loadingPgms, setLoadingPgms] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  /**
   * Días de retención configurados. Se piden para que el aviso de la purga diga
   * el plazo real: el texto llevaba «30 días» escritos a mano, y tras subirlo a
   * 90 habría seguido prometiendo un borrado que ya no era el que ocurría.
   */
  const [diasRetencion, setDiasRetencion] = useState<number | null>(null)

  useEffect(() => {
    configuracionApi
      .obtener()
      .then((c) => setDiasRetencion(c.diasRetencionPapelera))
      .catch(() => setDiasRetencion(null))
  }, [])

  useEffect(() => {
    if (user?.roles?.includes('ADMIN')) {
      setLoadingPgms(true)
      programasApi
        .listar()
        .then((list) => {
          setProgramas(list)
          if (list.length > 0) setSelectedPgm(list[0].id)
        })
        .catch(() => {})
        .finally(() => setLoadingPgms(false))
    }
  }, [user])

  const [confirmConfigState, setConfirmConfigState] = useState<{
    open: boolean
    titulo: string
    descripcion: React.ReactNode
    destructivo?: boolean
    textoConfirmar?: string
    onConfirmar: () => void | Promise<void>
  }>({
    open: false,
    titulo: '',
    descripcion: '',
    onConfirmar: () => {},
  })
  const [adminFeedback, setAdminFeedback] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const nombrePrograma = useCallback(
    (id: string) => programas.find((p) => p.id === id)?.nombre ?? '',
    [programas],
  )

  const handleSoftDeletePrograma = () => {
    if (!selectedPgm) return
    setConfirmConfigState({
      open: true,
      titulo: T.desactivarEstudiantesDel,
      descripcion: `¿Estás seguro de que deseas desactivar todos los estudiantes del programa "${nombrePrograma(selectedPgm)}"? Pasarán a la papelera.`,
      destructivo: true,
      textoConfirmar: 'Desactivar',
      onConfirmar: async () => {
        setBusyAction('soft-delete')
        setAdminFeedback(null)
        try {
          const res = await adminApi.softDeletePrograma(selectedPgm)
          setAdminFeedback({ tipo: 'exito', texto: `Éxito: Se enviaron ${res.eliminados} estudiantes a la papelera.` })
        } catch {
          setAdminFeedback({ tipo: 'error', texto: T.errorAlRealizar })
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const handleResetPrograma = () => {
    if (!selectedPgm) return
    setConfirmConfigState({
      open: true,
      titulo: 'Resetear programa',
      descripcion: `ADVERTENCIA CRÍTICA: ¿Estás seguro de resetear el programa "${nombrePrograma(selectedPgm)}"? Se eliminarán físicamente todos los estudiantes, matches, notificaciones y configuraciones vinculadas. Esta acción es irreversible.`,
      destructivo: true,
      textoConfirmar: 'Resetear programa',
      onConfirmar: async () => {
        setBusyAction('reset')
        setAdminFeedback(null)
        try {
          const res = await adminApi.resetPrograma(selectedPgm)
          setAdminFeedback({
            tipo: 'exito',
            texto: `Éxito: Se eliminaron permanentemente ${res.estudiantesEliminados} estudiantes.`,
          })
        } catch {
          setAdminFeedback({ tipo: 'error', texto: T.errorAlResetear })
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const handleRestaurarPrograma = () => {
    if (!selectedPgm) return
    setConfirmConfigState({
      open: true,
      titulo: 'Restaurar estudiantes',
      descripcion: `¿Deseas restaurar todos los estudiantes de la papelera del programa "${nombrePrograma(selectedPgm)}"?`,
      destructivo: false,
      textoConfirmar: 'Restaurar',
      onConfirmar: async () => {
        setBusyAction('restore')
        setAdminFeedback(null)
        try {
          const res = await adminApi.restaurarProgramaEstudiantes(selectedPgm)
          setAdminFeedback({ tipo: 'exito', texto: `Éxito: ${res.mensaje}` })
        } catch {
          setAdminFeedback({ tipo: 'error', texto: T.errorAlRestaurar })
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const handlePurgarPapelera = () => {
    // Sin el plazo cargado se describe la acción sin inventarse un número: el
    // texto llevaba «30 días» a mano y habría seguido diciéndolo tras subirlo.
    const plazo =
      diasRetencion !== null
        ? `lleven más de ${diasRetencion} días en la papelera`
        : T.hayanPasadoEl
    setConfirmConfigState({
      open: true,
      titulo: 'Purgar papelera',
      descripcion: `¿Deseas purgar de manera permanente todos los estudiantes que ${plazo}?`,
      destructivo: true,
      textoConfirmar: 'Purgar papelera',
      onConfirmar: async () => {
        setBusyAction('purge')
        setAdminFeedback(null)
        try {
          const res = await adminApi.purgarPapelera()
          setAdminFeedback({
            tipo: 'exito',
            texto: `Éxito: Se eliminaron físicamente ${res.eliminados} estudiantes con más de ${res.retencion} en la papelera.`,
          })
        } catch {
          setAdminFeedback({ tipo: 'error', texto: T.errorAlPurgar })
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const handleCleanupSystem = () => {
    setConfirmConfigState({
      open: true,
      titulo: 'PELIGRO EXTREMO: Vaciar sistema',
      descripcion: T.estasSeguroDe,
      destructivo: true,
      textoConfirmar: 'Vaciar sistema completo',
      onConfirmar: async () => {
        setBusyAction('cleanup')
        setAdminFeedback(null)
        try {
          const res = await adminApi.cleanupSystem()
          setAdminFeedback({ tipo: 'exito', texto: `Éxito: ${res.mensaje}` })
        } catch {
          setAdminFeedback({ tipo: 'error', texto: T.errorAlLimpiar })
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const themeOptions = [
    { id: 'light' as const, label: t('light'), icon: Sun },
    { id: 'dark' as const, label: t('dark'), icon: Moon },
    { id: 'system' as const, label: t('system'), icon: Monitor },
  ]

  /**
   * Cada sección con lo que hay dentro, en una frase.
   *
   * El subtítulo no es adorno: con siete secciones y una treintena de ajustes,
   * el nombre solo no basta para saber cuál abrir, y la alternativa es entrar
   * en las siete. `busca` son las palabras por las que alguien buscaría eso,
   * incluidas las que **no** están en el título —«logo» para marca, «Groq»
   * para conexiones—: se busca por la palabra que uno tiene en la cabeza.
   */
  const secciones: {
    id: TabKey
    label: string
    resumen: string
    busca: string
    icon: React.ComponentType<{ className?: string }>
    soloAdmin?: boolean
    peligrosa?: boolean
  }[] = [
    { id: 'institucion', label: T.institucionSede, icon: Bank,
      resumen: T.resumenInstitucion, busca: 'nit direccion sede telefono redes sociales contacto' },
    { id: 'operacion', label: T.parametrosDeOperacion, icon: Sliders,
      resumen: T.resumenOperacion, busca: 'matching umbral vigencia vacantes salario papelera retencion' },
    { id: 'personas', label: T.personasYAccesos, icon: Shield,
      resumen: T.resumenPersonas, busca: 'usuarios roles contrasena cuentas estudiantes correos invitacion' },
    { id: 'marca', label: T.marcaDelProyecto, icon: Palette,
      resumen: T.resumenMarca, busca: 'logo colores banner identidad cliente proyecto portada' },
    { id: 'conexiones', label: T.conexiones, icon: ShareNetwork,
      resumen: T.resumenConexiones, busca: 'whatsapp correo smtp groq ia jsearch scraping minio plataformas apis' },
    { id: 'preferencias', label: T.misPreferencias, icon: SquaresFour,
      resumen: T.resumenPreferencias, busca: 'tema oscuro claro idioma español ingles apariencia' },
    { id: 'peligro', label: T.zonaDePeligro, icon: ShieldWarning, soloAdmin: true, peligrosa: true,
      resumen: T.resumenPeligro, busca: 'borrar vaciar purgar papelera desactivar masivo restaurar' },
  ]

  // La zona de peligro no se le enseña a quien no puede usarla: un botón
  // deshabilitado que no explica por qué es peor que no estar.
  const esAdmin = !!user?.roles?.includes('ADMIN')
  const visibles = secciones.filter((s) => !s.soloAdmin || esAdmin)
  const filtro = buscarAjuste.trim().toLowerCase()
  const encontradas = filtro
    ? visibles.filter((s) =>
        `${s.label} ${s.resumen} ${s.busca}`.toLowerCase().includes(filtro))
    : visibles

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Buscador de ajustes. Con siete secciones y una treintena de ajustes,
          encontrar uno significaba abrirlas todas: la memoria de dónde estaba
          cada cosa la tiene quien configuró el sistema, no quien lo usa. */}
      <div className="relative max-w-md">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={buscarAjuste}
          onChange={(e) => setBuscarAjuste(e.target.value)}
          placeholder={T.buscaUnAjuste}
          aria-label={T.buscaUnAjuste}
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Las secciones como tarjetas y no como pestañas: una pestaña solo cabe
          si su nombre es corto, y por eso los nombres eran «Apariencia &
          Mantenimiento». Con la tarjeta cabe la frase que dice qué hay dentro. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {encontradas.map((s) => {
          const Icon = s.icon
          const activa = activeTab === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveTab(s.id)}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                activa
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-secondary/40',
                // La zona de peligro se distingue siempre, esté activa o no.
                s.peligrosa && !activa && 'border-destructive/30 hover:border-destructive/50',
                s.peligrosa && activa && 'border-destructive bg-destructive/5',
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0',
                s.peligrosa ? 'text-destructive' : activa ? 'text-primary' : 'text-muted-foreground')} />
              <span className="min-w-0">
                <span className={cn('block text-sm font-semibold',
                  s.peligrosa ? 'text-destructive' : 'text-foreground')}>
                  {s.label}
                </span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                  {s.resumen}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {filtro && encontradas.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {T.nadaCoincide}
        </p>
      )}

      {activeTab === 'institucion' && <PanelInstitucion />}

      {activeTab === 'operacion' && <PanelAcademico />}

      {activeTab === 'personas' && (
        <div className="flex flex-col gap-6">
          {/* Solo la tabla del equipo. «Mi perfil» y «mi sesión» se fueron a
              «Mis preferencias»: son lo que solo te afecta a ti, y estaban aquí
              mezcladas con gestionar las cuentas de otros. */}
          <PanelUsuarios mostrar="equipo" />

          {/* Cuentas de los estudiantes. Aparte de la tabla de arriba porque
              son otro tipo de cuenta —rol ESTUDIANTE, alta masiva, sin
              contraseña que nadie teclee— y porque basta con COORDINADOR. */}
          <PanelCuentasEstudiante />
        </div>
      )}

      {/* La identidad que ve el cliente, en su propia sección. Estaba bajo
          «Apariencia & Mantenimiento», junto al tema claro/oscuro, como si
          fueran la misma clase de ajuste: uno lo ve el cliente en cada correo
          y cada informe, el otro solo lo ve quien lo pulsa. */}
      {activeTab === 'marca' && <PanelBranding />}

      {activeTab === 'conexiones' && (
        <div className="flex flex-col gap-6">
          {/* Era un formulario que guardaba las claves de Groq, WhatsApp y
              JSearch en localStorage: texto plano legible por cualquier script
              inyectado —el mismo fallo que se corrigió para el JWT— y encima
              inútil, porque el backend las lee de variables de entorno al
              arrancar y nada de lo que se escribiera aquí llegaba al servidor.
              Ahora es un tablero de solo lectura contra el estado real. */}
          <PanelIntegraciones />

          {/* WhatsApp vive aquí y no en «Apariencia», que es donde estaba: es
              un canal de salida como el correo. Y la placa de integraciones de
              arriba —que lista correo, IA, almacenamiento y scraping— no lo
              incluye, así que quien lo buscaba por ahí no lo encontraba. */}
          <PanelWhatsapp />

          {/* Plataformas de formación externas: también son servicios de
              fuera a los que se manda gente. */}
          <PanelPlataformas />
        </div>
      )}

      {activeTab === 'preferencias' && (
        <div className="flex flex-col gap-6">
          {/* Tu perfil y el estado de tu sesión. Vivían bajo «Usuarios &
              Seguridad», junto al alta de cuentas del equipo. */}
          <PanelUsuarios mostrar="mi-cuenta" />

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-5 text-primary" /> {t('interfaceAppearance')}
              </CardTitle>
              <CardDescription>{t('interfaceAppearanceDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-3 sm:max-w-md">
                {themeOptions.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setTheme(opcion.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 ${
                      theme === opcion.id
                        ? 'scale-105 border-primary bg-primary/10 shadow-md'
                        : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                    }`}
                  >
                    <opcion.icon className={`size-6 ${theme === opcion.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-semibold ${theme === opcion.id ? 'text-primary' : 'text-muted-foreground'}`}>
                      {opcion.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-7 border-t border-border/60 pt-6 sm:max-w-md">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{t('language')}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('languageDescription')}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([
                    ['es', t('spanish')],
                    ['en', t('english')],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLocale(value)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                        locale === value
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-secondary/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'peligro' && (
        <div className="flex flex-col gap-6">
          {/* Sección propia y solo para ADMIN. Estaba al final de la pestaña que
              alguien abre para poner el modo oscuro: se llegaba aquí por el
              camino, no por decisión. Ahora hay que elegir entrar. */}
          {esAdmin && (
            <Card className="rounded-2xl border-destructive/30 shadow-sm">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <ShieldWarning className="size-5" /> Mantenimiento transaccional &amp; zona de peligro
                </CardTitle>
                <CardDescription>
                  {T.operacionesMasivasDe}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-secondary/10 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {T.accionesMasivasPor}
                  </h3>
                  <div className="flex flex-col items-end gap-3 sm:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{T.seleccionarPrograma}</label>
                      {loadingPgms ? (
                        <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                          <CircleNotch className="size-3.5 animate-spin" /> Cargando lista…
                        </div>
                      ) : (
                        <select
                          className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          value={selectedPgm}
                          onChange={(e) => setSelectedPgm(e.target.value)}
                        >
                          {programas.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs"
                        disabled={!!busyAction || !selectedPgm}
                        onClick={handleRestaurarPrograma}
                      >
                        {busyAction === 'restore' ? <CircleNotch className="mr-1 size-3.5 animate-spin" /> : null}
                        Restaurar todo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        disabled={!!busyAction || !selectedPgm}
                        onClick={handleSoftDeletePrograma}
                      >
                        {busyAction === 'soft-delete' ? <CircleNotch className="mr-1 size-3.5 animate-spin" /> : null}
                        Desactivar todo
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="rounded-xl text-xs"
                        disabled={!!busyAction || !selectedPgm}
                        onClick={handleResetPrograma}
                      >
                        {busyAction === 'reset' ? <CircleNotch className="mr-1 size-3.5 animate-spin" /> : null}
                        Resetear programa
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                    {T.purgaGlobalDe}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {T.eliminacionPermanenteDe}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                      disabled={!!busyAction}
                      onClick={handlePurgarPapelera}
                    >
                      {busyAction === 'purge' ? <CircleNotch className="mr-1 size-3.5 animate-spin" /> : null}
                      Purgar papelera
                      {diasRetencion !== null && ` (>${diasRetencion} días)`}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="rounded-xl text-xs"
                      disabled={!!busyAction}
                      onClick={handleCleanupSystem}
                    >
                      {busyAction === 'cleanup' ? <CircleNotch className="mr-1 size-3.5 animate-spin" /> : null}
                      Limpiar CRM transaccional
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {adminFeedback && (
        <div
          role={adminFeedback.tipo === 'exito' ? 'status' : 'alert'}
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-xl backdrop-blur-md transition-all',
            adminFeedback.tipo === 'exito'
              ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'border border-destructive/30 bg-destructive/15 text-destructive',
          )}
        >
          {adminFeedback.tipo === 'exito' ? (
            <CheckCircle className="size-5 shrink-0" />
          ) : (
            <WarningCircle className="size-5 shrink-0" />
          )}
          <span>{adminFeedback.texto}</span>
          <button
            type="button"
            onClick={() => setAdminFeedback(null)}
            className="ml-2 rounded-md p-1 hover:bg-black/10"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <Confirmar
        open={confirmConfigState.open}
        onOpenChange={(open) => setConfirmConfigState((prev) => ({ ...prev, open }))}
        titulo={confirmConfigState.titulo}
        descripcion={confirmConfigState.descripcion}
        destructivo={confirmConfigState.destructivo}
        textoConfirmar={confirmConfigState.textoConfirmar}
        onConfirmar={confirmConfigState.onConfirmar}
      />
    </div>
  )
}
