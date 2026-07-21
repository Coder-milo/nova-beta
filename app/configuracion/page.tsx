'use client'

/**
 * Página de Configuración.
 *
 * Pantalla de ajustes del panel: perfil del usuario autenticado
 * y preferencias de la interfaz. No tiene un endpoint dedicado en el
 * backend más allá de la info del JWT, así que consume useAuth().
 */

import { useState } from 'react'
import {
  Settings, User, Shield, Palette, Bell,
  CheckCircle2, Moon, Sun, Monitor,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')

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
                <span className="font-mono text-muted-foreground">{user?.id ? user.id.slice(0, 8) + '…' : 'N/A'}</span>
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
      </div>
    </div>
  )
}
