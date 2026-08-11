'use client'

/**
 * Estado de sesión para la interfaz.
 *
 * Aquí NO vive el token. El access token y el refresh token se guardan en
 * cookies HttpOnly que escribe el servidor (`/auth/session`), así que el
 * JavaScript de la página no puede leerlos y un XSS no puede robarlos. Antes
 * se guardaban en localStorage y se copiaban a una cookie escrita desde JS,
 * que por definición no puede ser HttpOnly ni llevaba el flag Secure.
 *
 * Lo único que se conserva en el navegador son los datos que la interfaz
 * necesita pintar (nombre, correo, roles). Son datos de presentación: quien
 * los manipule solo cambia lo que ve, porque cada permiso lo vuelve a
 * comprobar el backend en cada petición.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { authApi, ApiCallError, type UsuarioSesion } from '@/lib/api'

const USER_KEY = 'nova_user'

interface AuthUser extends UsuarioSesion {
  iniciales: string
}

interface AuthContextValue {
  user: AuthUser | null
  /**
   * La sesión todavía no se ha leído del navegador.
   *
   * El usuario se recupera en un efecto —no se puede leer `localStorage`
   * durante el render sin romper la hidratación—, así que entre el montaje y
   * ese efecto `user` es `null` sin que eso signifique "no hay sesión". Quien
   * ramifique por el rol tiene que esperar: durante esa ventana
   * `soloEsEstudiante(undefined)` devuelve `false` y un estudiante pasa por
   * administrador, que fue justo el origen de los 403 al montar la cabecera.
   */
  cargando: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function parseUser(r: UsuarioSesion): AuthUser {
  const partes = r.nombre.trim().split(' ').filter(Boolean)
  const iniciales =
    partes.length >= 2
      ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
      : r.nombre.slice(0, 2).toUpperCase()
  return { ...r, iniciales }
}

function getInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const savedUser = localStorage.getItem(USER_KEY)
    return savedUser ? JSON.parse(savedUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY)
      if (savedUser) setUser(JSON.parse(savedUser))
      else setUser(null)
    } catch {
      localStorage.removeItem(USER_KEY)
      setUser(null)
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const usuario = parseUser(await authApi.login({ email, password }))
    localStorage.setItem(USER_KEY, JSON.stringify(usuario))
    window.dispatchEvent(new StorageEvent('storage', { key: USER_KEY, newValue: JSON.stringify(usuario) }))
    setUser(usuario)
    setCargando(false)
    return usuario
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem(USER_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: USER_KEY, newValue: null }))
    setUser(null)
    setCargando(false)
    // Solo el servidor puede borrar las cookies HttpOnly.
    try {
      await authApi.logout()
    } catch {
      // Aunque falle, la sesión local ya está limpia y la cookie caducará.
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, cargando, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

// Re-exportar ApiCallError para que los componentes no importen de lib/api
export { ApiCallError }
