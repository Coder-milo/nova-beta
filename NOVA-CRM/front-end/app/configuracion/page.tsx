'use client'

/**
 * Página de Configuración.
 *
 * Pantalla de ajustes del panel: perfil del usuario autenticado
 * y preferencias de la interfaz. No tiene un endpoint dedicado en el
 * backend más allá de la info del JWT, así que consume useAuth().
 */

import { useState, useEffect } from 'react'
import {
  Settings, User, Shield, Palette, Bell,
  CheckCircle2, Moon, Sun, Monitor, ShieldAlert,
  Trash2, Loader2, AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { adminApi, programasApi } from '@/lib/api'

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')

  const [programas, setProgramas] = useState<{ id: string; nombre: string }[]>([])
  const [selectedPgm, setSelectedPgm] = useState('')
  const [loadingPgms, setLoadingPgms] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  useEffect(() => {
    if (user?.roles?.includes('ADMIN')) {
      setLoadingPgms(true)
      programasApi.listar()
        .then((list) => {
          setProgramas(list)
          if (list.length > 0) setSelectedPgm(list[0].id)
        })
        .catch(() => {})
        .finally(() => setLoadingPgms(false))
    }
  }, [user])

  const handleSoftDeletePrograma = async () => {
    if (!selectedPgm) return
    const pgm = programas.find((p) => p.id === selectedPgm)
    if (!confirm(`¿Estás seguro de que deseas desactivar todos los estudiantes del programa "${pgm?.nombre}"? Pasarán a la papelera.`)) return
    setBusyAction('soft-delete')
    try {
      const res = await adminApi.softDeletePrograma(selectedPgm)
      alert(`Éxito: Se enviaron ${res.eliminados} estudiantes a la papelera.`)
    } catch {
      alert('Error al realizar la desactivación masiva.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleResetPrograma = async () => {
    if (!selectedPgm) return
    const pgm = programas.find((p) => p.id === selectedPgm)
    if (!confirm(`¡ADVERTENCIA CRÍTICA! ¿Estás seguro de resetear el programa "${pgm?.nombre}"?\nSe eliminarán físicamente todos los estudiantes, matches, notificaciones, certificaciones y configuraciones de LinkedIn vinculados a este programa. Esta acción es irreversible.`)) return
    setBusyAction('reset')
    try {
      const res = await adminApi.resetPrograma(selectedPgm)
      alert(`Éxito: Se eliminaron permanentemente ${res.estudiantesEliminados} estudiantes y todos sus registros asociados.`)
    } catch {
      alert('Error al resetear el programa.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRestaurarPrograma = async () => {
    if (!selectedPgm) return
    const pgm = programas.find((p) => p.id === selectedPgm)
    if (!confirm(`¿Deseas restaurar todos los estudiantes de la papelera del programa "${pgm?.nombre}"?`)) return
    setBusyAction('restore')
    try {
      const res = await adminApi.restaurarProgramaEstudiantes(selectedPgm)
      alert(`Éxito: ${res.mensaje}`)
    } catch {
      alert('Error al restaurar los estudiantes del programa.')
    } finally {
      setBusyAction(null)
    }
  }

  const handlePurgarPapelera = async () => {
    if (!confirm('¿Deseas purgar de manera permanente todos los estudiantes que lleven más de 30 días en la papelera?')) return
    setBusyAction('purge')
    try {
      const res = await adminApi.purgarPapelera()
      alert(`Éxito: Se eliminaron físicamente ${res.eliminados} estudiantes antiguos de la papelera.`)
    } catch {
      alert('Error al purgar la papelera.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleCleanupSystem = async () => {
    if (!confirm('¡PELIGRO EXTREMO! ¿Estás seguro de que deseas vaciar por completo todo el sistema transaccional?\nSe eliminarán físicamente TODOS los estudiantes del sistema, vacantes, matches, habilidades y certificaciones. Sólo se conservarán los programas vacíos, empresas y usuarios administradores. Esta acción es irreversible.')) return
    setBusyAction('cleanup')
    try {
      const res = await adminApi.cleanupSystem()
      alert(`Éxito: ${res.mensaje}`)
    } catch {
      alert('Error al limpiar el sistema transaccional.')
    } finally {
      setBusyAction(null)
    }
  }

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t)
    const root = document.documentElement
    if (t === 'dark') {
      root.classList.add('dark')
    } else if (t === 'light') {
      root.classList.remove('dark')
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  const themeOptions = [
    { id: 'light' as const, label: 'Claro', icon: Sun },
    { id: 'dark' as const, label: 'Oscuro', icon: Moon },
    { id: 'system' as const, label: 'Sistema', icon: Monitor },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Settings className="size-5" /> Configuración
        </h2>
        <p className="text-sm text-muted-foreground">Ajustes generales del panel administrativo.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Perfil */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><User className="size-4" /> Perfil de Usuario</CardTitle>
            <CardDescription>Información de la sesión actual.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold shrink-0">
                {user?.iniciales ?? 'AD'}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{user?.nombre ?? 'Administrador'}</p>
                <p className="text-xs text-muted-foreground">{user?.email ?? 'admin@academia.edu.co'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Rol</span>
                <Badge variant="outline" className="mt-0.5">{user?.roles?.[0] ?? 'ADMIN'}</Badge>
              </div>
              <div>
                <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">ID</span>
                <span className="font-mono text-muted-foreground">{user?.usuarioId ? user.usuarioId.slice(0, 8) + '…' : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4" /> Seguridad</CardTitle>
            <CardDescription>Estado de la sesión y permisos.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-2.5">
              <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-300">Sesión activa con JWT válido</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p>• El token se almacena en localStorage y como cookie HTTP.</p>
              <p>• La sesión expira según la configuración del backend.</p>
              <p>• Usa el botón de cerrar sesión en la barra lateral para desconectarte.</p>
            </div>
            {user?.roles && user.roles.length > 0 && (
              <div>
                <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-1.5">Permisos asignados</span>
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tema */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Palette className="size-4" /> Apariencia</CardTitle>
            <CardDescription>Selecciona el tema visual del panel.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((t) => (
                <button key={t.id} type="button" onClick={() => applyTheme(t.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${theme === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-secondary/50'}`}>
                  <t.icon className={`size-6 ${theme === t.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${theme === t.id ? 'text-primary' : 'text-muted-foreground'}`}>{t.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notificaciones (info) */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4" /> Notificaciones</CardTitle>
            <CardDescription>Configuración del sistema de alertas.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p>• Las notificaciones de matches se generan automáticamente por el motor de matching.</p>
              <p>• Puedes ver las notificaciones de cada estudiante desde el módulo de Estudiantes → Matches.</p>
              <p>• Las alertas del dashboard se actualizan en tiempo real con cada carga del panel.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Badge variant="outline" className="text-[10px]">Matches automáticos</Badge>
              <Badge variant="outline" className="text-[10px]">Alertas en dashboard</Badge>
              <Badge variant="outline" className="text-[10px]">Importación masiva</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Acciones Administrativas Masivas (Solo ADMIN) */}
        {user?.roles?.includes('ADMIN') && (
          <Card className="rounded-xl shadow-sm border-destructive/20 lg:col-span-2">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ShieldAlert className="size-5" /> Acciones Administrativas Masivas
              </CardTitle>
              <CardDescription>
                Herramientas avanzadas de limpieza y mantenimiento del sistema. Úselas con precaución.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-6">
              {/* Operaciones sobre programa */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4 bg-secondary/10">
                <h3 className="text-sm font-semibold text-foreground">Acciones por Programa Académico</h3>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <label htmlFor="adm-pgm" className="text-xs font-medium text-muted-foreground">Seleccionar Programa:</label>
                    {loadingPgms ? (
                      <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Cargando programas...</div>
                    ) : (
                      <select
                        id="adm-pgm"
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring"
                        value={selectedPgm}
                        onChange={(e) => setSelectedPgm(e.target.value)}
                        aria-label="Seleccionar programa para acciones masivas"
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
                      className="text-xs"
                      disabled={!!busyAction || !selectedPgm}
                      onClick={handleRestaurarPrograma}
                    >
                      {busyAction === 'restore' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                      Restaurar Todo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/10"
                      disabled={!!busyAction || !selectedPgm}
                      onClick={handleSoftDeletePrograma}
                    >
                      {busyAction === 'soft-delete' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                      Desactivar Todo
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                      disabled={!!busyAction || !selectedPgm}
                      onClick={handleResetPrograma}
                    >
                      {busyAction === 'reset' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                      Resetear Programa
                    </Button>
                  </div>
                </div>
              </div>

              {/* Operaciones globales del sistema */}
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 p-4 bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive">Mantenimiento Global y Purga</h3>
                <p className="text-xs text-muted-foreground">
                  Estas acciones afectan de manera global a todos los datos transaccionales del CRM y son irreversibles.
                </p>
                <div className="flex flex-wrap gap-2 pt-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={!!busyAction}
                    onClick={handlePurgarPapelera}
                  >
                    {busyAction === 'purge' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                    Purgar Papelera (&gt;30 días)
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="text-xs bg-destructive hover:bg-destructive/90"
                    disabled={!!busyAction}
                    onClick={handleCleanupSystem}
                  >
                    {busyAction === 'cleanup' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                    Limpiar Sistema Transaccional
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
