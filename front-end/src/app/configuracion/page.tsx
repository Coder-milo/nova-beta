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
import {
  BankIcon as Bank,
  CheckCircleIcon as CheckCircle,
  CircleNotchIcon as CircleNotch,
  GearIcon as Gear,
  GlobeIcon as Globe,
  MonitorIcon as Monitor,
  MoonIcon as Moon,
  PaletteIcon as Palette,
  ShareNetworkIcon as ShareNetwork,
  ShieldIcon as Shield,
  ShieldWarningIcon as ShieldWarning,
  SlidersIcon as Sliders,
  SquaresFourIcon as SquaresFour,
  SunIcon as Sun,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from '@phosphor-icons/react'
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
import { VistaPreviaCorreos } from '@/components/admin/vista-previa-correos'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { adminApi, configuracionApi, programasApi } from '@/lib/api'

type TabKey = 'institucion' | 'academico' | 'integraciones' | 'plataformas' | 'usuarios' | 'mantenimiento'

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const { theme, setTheme, locale, setLocale, t } = usePreferences()
  const [activeTab, setActiveTab] = useState<TabKey>('institucion')

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
      titulo: 'Desactivar estudiantes del programa',
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
          setAdminFeedback({ tipo: 'error', texto: 'Error al realizar la desactivación masiva.' })
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
          setAdminFeedback({ tipo: 'error', texto: 'Error al resetear el programa.' })
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
          setAdminFeedback({ tipo: 'error', texto: 'Error al restaurar los estudiantes del programa.' })
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
        : 'hayan pasado el plazo de retención configurado'
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
          setAdminFeedback({ tipo: 'error', texto: 'Error al purgar la papelera.' })
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
      descripcion: '¿Estás seguro de que deseas vaciar por completo todo el sistema transaccional? Se eliminarán físicamente TODOS los estudiantes, vacantes, matches, habilidades y certificaciones. Esta acción es irreversible.',
      destructivo: true,
      textoConfirmar: 'Vaciar sistema completo',
      onConfirmar: async () => {
        setBusyAction('cleanup')
        setAdminFeedback(null)
        try {
          const res = await adminApi.cleanupSystem()
          setAdminFeedback({ tipo: 'exito', texto: `Éxito: ${res.mensaje}` })
        } catch {
          setAdminFeedback({ tipo: 'error', texto: 'Error al limpiar el sistema transaccional.' })
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

  const tabsNav: { id: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'institucion', label: 'Institución & Sede', icon: Bank },
    { id: 'academico', label: 'Parámetros de Operación', icon: Sliders },
    { id: 'integraciones', label: 'Integraciones & APIs', icon: ShareNetwork },
    { id: 'plataformas', label: 'Plataformas', icon: SquaresFour },
    { id: 'usuarios', label: 'Usuarios & Seguridad', icon: Shield },
    { id: 'mantenimiento', label: 'Apariencia & Mantenimiento', icon: Gear },
  ]

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Navegación por pestañas adaptable a móvil, tablet y laptop */}
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto border-b border-border pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [::-webkit-scrollbar]:hidden">
        {tabsNav.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 sm:px-4 ${
                isActive
                  ? 'scale-[1.02] bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'institucion' && <PanelInstitucion />}

      {activeTab === 'academico' && <PanelAcademico />}

      {/* Era un formulario que guardaba las claves de Groq, WhatsApp y JSearch
          en localStorage: texto plano legible por cualquier script inyectado
          —el mismo fallo que se corrigió para el JWT— y encima inútil, porque
          el backend las lee de variables de entorno al arrancar y nada de lo
          que se escribiera aquí llegaba al servidor. Ahora es un tablero de
          solo lectura contra el estado real del backend. */}
      {activeTab === 'integraciones' && <PanelIntegraciones />}

      {activeTab === 'plataformas' && <PanelPlataformas />}

      {activeTab === 'usuarios' && (
        <div className="flex flex-col gap-6">
          <PanelUsuarios />

          {/* Cuentas de los estudiantes. Aparte de la tabla de arriba porque
              son otro tipo de cuenta —rol ESTUDIANTE, alta masiva, sin
              contraseña que nadie teclee— y porque basta con COORDINADOR. */}
          <PanelCuentasEstudiante />

          {/* Justo debajo del alta de cuentas: es el sitio donde alguien está a
              punto de disparar el envío masivo, y por tanto donde tiene sentido
              poder mirar antes cómo queda el correo. */}
          <VistaPreviaCorreos />
        </div>
      )}

      {activeTab === 'mantenimiento' && (
        <div className="flex flex-col gap-6">
          {/* Identidad de cada proyecto. Va antes que el tema claro/oscuro
              porque es lo que ve el cliente; el tema es preferencia personal. */}
          <PanelBranding />

          {/* Canal de WhatsApp: comparte el mismo selector de proyecto que la
              identidad; los avisos automáticos dependen de él. */}
          <PanelWhatsapp />

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

          {/* Acciones masivas y limpieza (ADMIN) */}
          {user?.roles?.includes('ADMIN') && (
            <Card className="rounded-2xl border-destructive/30 shadow-sm">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <ShieldWarning className="size-5" /> Mantenimiento transaccional &amp; zona de peligro
                </CardTitle>
                <CardDescription>
                  Operaciones masivas de limpieza de datos en la base de datos de Academy CAC.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-secondary/10 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Acciones masivas por programa académico
                  </h3>
                  <div className="flex flex-col items-end gap-3 sm:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Seleccionar programa:</label>
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
                    Purga global de datos transaccionales
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Eliminación permanente de estudiantes inactivos o vaciado del entorno de prueba.
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
