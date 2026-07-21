'use client'

/**
 * Hook centralizado para autenticación JWT.
 * Persiste el token y los datos del usuario en localStorage.
 * Expone: user, token, login, logout, isAuthenticated.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { authApi, ApiCallError } from '@/lib/api'
import type { LoginResponse } from '@/lib/types'

const TOKEN_KEY = 'nova_token'
const USER_KEY  = 'nova_user'

interface AuthUser {
  usuarioId: string
  email: string
  nombre: string
  roles: string[]
  iniciales: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function parseUser(r: LoginResponse): AuthUser {
  const partes = r.nombre.trim().split(' ')
  const iniciales =
    partes.length >= 2
      ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
      : r.nombre.slice(0, 2).toUpperCase()
  return {
    usuarioId: r.usuarioId,
    email: r.email,
    nombre: r.nombre,
    roles: r.roles,
    iniciales,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user,  setUser]  = useState<AuthUser | null>(null)

  // Cargar sesión guardada al montar
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser  = localStorage.getItem(USER_KEY)
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    const parsed   = parseUser(response)
    localStorage.setItem(TOKEN_KEY, response.token)
    localStorage.setItem(USER_KEY,  JSON.stringify(parsed))
    if (typeof window !== 'undefined') {
      document.cookie = `nova_token=${response.token}; path=/; max-age=86400; SameSite=Lax`
    }
    setToken(response.token)
    setUser(parsed)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    if (typeof window !== 'undefined') {
      document.cookie = 'nova_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token, login, logout }}
    >
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
