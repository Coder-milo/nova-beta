'use client'

/**
 * Cuentas del equipo: administradores y coordinadores.
 *
 * Estaba escrito dentro de la página de configuración, mezclado con los
 * formularios de institución y de operación. Aquí queda junto al resto de
 * paneles y la página vuelve a ser navegación.
 *
 * Las cuentas de los estudiantes van aparte (`PanelCuentasEstudiante`): son
 * otro tipo de cuenta —rol ESTUDIANTE, alta masiva, sin contraseña que nadie
 * teclee— y basta con COORDINADOR para gestionarlas.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowsClockwiseIcon as ArrowsClockwise,
  CheckCircleIcon as CheckCircle,
  CircleNotchIcon as CircleNotch,
  KeyIcon as Key,
  PlusIcon as Plus,
  ShieldIcon as Shield,
  UserIcon as User,
  UsersIcon as Users,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from '@phosphor-icons/react'
import { Dialog } from '@base-ui/react/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EstadoDot } from '@/components/ui/estado-dot'
import { PageSpinner } from '@/components/ui/page-spinner'
import { useAuth } from '@/lib/auth'
import { usuariosApi, ApiCallError } from '@/lib/api'
import type { UsuarioResponse } from '@/lib/types'

const ROLES_DISPONIBLES = ['ADMIN', 'COORDINADOR'] as const

export function PanelUsuarios() {
  const { user } = useAuth()

  const [usuarios, setUsuarios] = useState<UsuarioResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: '',
    email: '',
    password: '',
    roles: ['COORDINADOR'] as string[],
  })
  const [creando, setCreando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const [modalPassword, setModalPassword] = useState<UsuarioResponse | null>(null)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [passwordExito, setPasswordExito] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    setSinPermiso(false)
    try {
      setUsuarios(await usuariosApi.listar())
    } catch (err) {
      if (err instanceof ApiCallError && (err.status === 401 || err.status === 403)) {
        setSinPermiso(true)
      } else if (err instanceof ApiCallError) {
        setError(`Error al cargar los usuarios (HTTP ${err.status}).`)
      } else {
        setError('No se pudo conectar con el backend.')
      }
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crearUsuario = async (evento: React.SyntheticEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorForm(null)
    if (!nuevoUsuario.nombre.trim()) {
      setErrorForm('El nombre es obligatorio.')
      return
    }
    if (!nuevoUsuario.email.trim()) {
      setErrorForm('El email es obligatorio.')
      return
    }
    if (nuevoUsuario.password.length < 8) {
      setErrorForm('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (nuevoUsuario.roles.length === 0) {
      setErrorForm('Selecciona al menos un rol.')
      return
    }
    setCreando(true)
    try {
      await usuariosApi.crear({
        nombre: nuevoUsuario.nombre.trim(),
        email: nuevoUsuario.email.trim(),
        password: nuevoUsuario.password,
        roles: nuevoUsuario.roles,
      })
      setNuevoUsuario({ nombre: '', email: '', password: '', roles: ['COORDINADOR'] })
      cargar()
    } catch (err) {
      if (err instanceof ApiCallError) {
        if (err.status === 409) setErrorForm('Ya existe un usuario con ese correo electrónico.')
        else if (err.status === 401 || err.status === 403)
          setErrorForm('Solo los administradores pueden gestionar usuarios.')
        else setErrorForm(err.body.message ?? `Error del servidor (HTTP ${err.status}).`)
      } else {
        setErrorForm('No se pudo conectar con el backend.')
      }
    } finally {
      setCreando(false)
    }
  }

  const alternarRol = (rol: string) => {
    setNuevoUsuario((previo) => ({
      ...previo,
      roles: previo.roles.includes(rol)
        ? previo.roles.filter((r) => r !== rol)
        : [...previo.roles, rol],
    }))
  }

  const alternarActivo = async (u: UsuarioResponse) => {
    setOcupado(u.id)
    setError(null)
    try {
      await usuariosApi.actualizar(u.id, { activo: !u.activo })
      cargar()
    } catch (err) {
      setError(
        err instanceof ApiCallError && (err.status === 401 || err.status === 403)
          ? 'Solo los administradores pueden gestionar usuarios.'
          : 'Error al actualizar el usuario.',
      )
    } finally {
      setOcupado(null)
    }
  }

  const cambiarPassword = async (evento: React.SyntheticEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!modalPassword) return
    setPasswordError(null)
    setPasswordExito(null)
    if (nuevaPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setCambiandoPassword(true)
    try {
      await usuariosApi.actualizar(modalPassword.id, { password: nuevaPassword })
      setPasswordExito(`Contraseña actualizada para ${modalPassword.nombre}.`)
      setTimeout(() => {
        setModalPassword(null)
        setNuevaPassword('')
        setPasswordExito(null)
      }, 1400)
    } catch (err) {
      setPasswordError(
        err instanceof ApiCallError
          ? err.body.message ?? 'Error al actualizar contraseña.'
          : 'No se pudo conectar.',
      )
    } finally {
      setCambiandoPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" /> Perfil de usuario en sesión
            </CardTitle>
            <CardDescription>Información del usuario actualmente autenticado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {user?.iniciales ?? 'AD'}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{user?.nombre ?? 'Administrador'}</p>
                <p className="text-xs text-muted-foreground">{user?.email ?? 'admin@academia.edu.co'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Rol principal</span>
                <Badge variant="outline" className="mt-0.5">{user?.roles?.[0] ?? 'ADMIN'}</Badge>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">ID de usuario</span>
                <span className="font-mono text-muted-foreground">
                  {user?.usuarioId ? user.usuarioId.slice(0, 8) + '…' : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-primary" /> Estado de la sesión &amp; seguridad
            </CardTitle>
            <CardDescription>Validación del token JWT y políticas de acceso.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2.5">
              <CheckCircle className="size-4 shrink-0 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                Token JWT firmado y verificado
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>• El token se guarda en una cookie HttpOnly, inaccesible desde el navegador.</p>
              <p>• La sesión caduca a las 8 horas y se renueva sola durante 7 días.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-5 text-primary" /> Administradores &amp; coordinadores
              </CardTitle>
              <CardDescription>Cuentas con acceso al CRM.</CardDescription>
            </div>
            {!sinPermiso && (
              <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
                <ArrowsClockwise className="mr-1 size-3.5" /> Refrescar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-6">
          {sinPermiso ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
              <Shield className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Solo los usuarios con rol ADMIN pueden gestionar usuarios.
              </span>
            </div>
          ) : (
            <>
              <form onSubmit={crearUsuario} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-secondary/10 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Crear nuevo usuario
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Nombre completo *
                    </label>
                    <Input
                      value={nuevoUsuario.nombre}
                      onChange={(e) => setNuevoUsuario((p) => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre y apellido"
                      disabled={creando}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Email *
                    </label>
                    <Input
                      type="email"
                      value={nuevoUsuario.email}
                      onChange={(e) => setNuevoUsuario((p) => ({ ...p, email: e.target.value }))}
                      placeholder="coordinador@academia.edu.co"
                      disabled={creando}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Contraseña * (mín. 8)
                    </label>
                    <Input
                      type="password"
                      minLength={8}
                      value={nuevoUsuario.password}
                      onChange={(e) => setNuevoUsuario((p) => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      disabled={creando}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Roles:
                  </span>
                  {ROLES_DISPONIBLES.map((rol) => (
                    <label key={rol} className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={nuevoUsuario.roles.includes(rol)}
                        onChange={() => alternarRol(rol)}
                        disabled={creando}
                        className="size-4 cursor-pointer"
                      />
                      {rol}
                    </label>
                  ))}
                  <div className="ml-auto">
                    <Button type="submit" size="sm" disabled={creando}>
                      {creando ? (
                        <><CircleNotch className="mr-1 size-3.5 animate-spin" /> Creando…</>
                      ) : (
                        <><Plus className="mr-1 size-3.5" /> Crear usuario</>
                      )}
                    </Button>
                  </div>
                </div>
                {errorForm && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <WarningCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{errorForm}</span>
                  </div>
                )}
              </form>

              {cargando ? (
                <div className="flex items-center justify-center py-8">
                  <PageSpinner />
                  <span className="ml-2 text-xs text-muted-foreground">Cargando cuentas…</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <WarningCircle className="size-6 text-destructive" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              ) : usuarios.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <Users className="size-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No hay usuarios adicionales registrados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">Nombre</th>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">Email</th>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">Roles</th>
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">Estado</th>
                        <th className="px-4 py-3 text-right font-medium uppercase tracking-wider text-muted-foreground">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usuarios.map((u) => (
                        <tr key={u.id} className="transition-colors hover:bg-secondary/30">
                          <td className="px-4 py-3 font-semibold text-foreground">{u.nombre}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map((r) => (
                                <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <EstadoDot
                              label={u.activo ? 'Activo' : 'Inactivo'}
                              dot={u.activo ? 'bg-success' : 'bg-muted-foreground/40'}
                              text={u.activo ? 'text-[#0F6E56]' : 'text-muted-foreground'}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                  setModalPassword(u)
                                  setNuevaPassword('')
                                  setPasswordError(null)
                                  setPasswordExito(null)
                                }}
                              >
                                <Key className="mr-1 size-3" /> Cambiar clave
                              </Button>
                              <Button
                                variant="outline"
                                size="xs"
                                disabled={ocupado === u.id}
                                onClick={() => alternarActivo(u)}
                              >
                                {ocupado === u.id ? (
                                  <CircleNotch className="size-3 animate-spin" />
                                ) : u.activo ? 'Inactivar' : 'Activar'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {modalPassword && (
        <Dialog.Root open={!!modalPassword} onOpenChange={(open) => !open && setModalPassword(null)}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs" />
            <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <Dialog.Title className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Key className="size-5 text-primary" /> Cambiar contraseña de usuario
                </Dialog.Title>
                <button
                  type="button"
                  onClick={() => setModalPassword(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Estás estableciendo una nueva contraseña para <strong>{modalPassword.nombre}</strong>{' '}
                ({modalPassword.email}).
              </p>
              <form onSubmit={cambiarPassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Nueva contraseña (mínimo 8 caracteres)
                  </label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    disabled={cambiandoPassword}
                  />
                </div>

                {passwordError && (
                  <div role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                    <WarningCircle className="size-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordExito && (
                  <div role="status" className="flex items-center gap-2 rounded-xl bg-green-500/10 p-3 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="size-4 shrink-0" />
                    <span>{passwordExito}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-border pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalPassword(null)}
                    disabled={cambiandoPassword}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={cambiandoPassword}>
                    {cambiandoPassword ? (
                      <><CircleNotch className="mr-1 size-4 animate-spin" /> Guardando…</>
                    ) : 'Actualizar contraseña'}
                  </Button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}
