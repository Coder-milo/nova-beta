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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const savedUser = localStorage.getItem(USER_KEY)
    if (!savedUser) return
    try {
      setUser(JSON.parse(savedUser))
    } catch {
      localStorage.removeItem(USER_KEY)
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const usuario = parseUser(await authApi.login({ email, password }))
    localStorage.setItem(USER_KEY, JSON.stringify(usuario))
    setUser(usuario)
    return usuario
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem(USER_KEY)
    setUser(null)
    // Solo el servidor puede borrar las cookies HttpOnly.
    try {
      await authApi.logout()
    } catch {
      // Aunque falle, la sesión local ya está limpia y la cookie caducará.
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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
