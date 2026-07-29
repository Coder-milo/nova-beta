'use client'

/**
 * Identidad visual del proyecto en el que está el usuario.
 *
 * Aplica la paleta escribiendo variables CSS en `<html>`, no cambiando clases
 * de Tailwind: los componentes ya consumen `--primary` y compañía, así que la
 * personalización no obliga a tocar ni uno solo de ellos.
 *
 * Si el proyecto no tiene color propio, **no se escribe nada** y quedan los
 * valores de `globals.css`, que es exactamente lo que significa "usa la gama
 * global del panel".
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { brandingApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { soloEsEstudiante } from '@/lib/navigation'
import { paletaDesde, type VariablesTema } from '@/lib/paleta'
import type { BrandingResponse } from '@/lib/types'

/**
 * Solo se expone la identidad de **quien está dentro**, y no hay forma de
 * forzar otra desde fuera.
 *
 * Hubo un `previsualizar()` que escribía la gama de cualquier proyecto en el
 * documento entero: editar un proyecto repintaba el panel del administrador
 * —menú, cabecera, botones—, que no es ese proyecto. La vista previa vive ahora
 * dentro del editor, acotada a un contenedor, así que este contexto no necesita
 * dejar que nadie le cambie el tema al documento.
 */
interface EstadoBranding {
  branding: BrandingResponse | null
  cargando: boolean
  /** Vuelve a pedirlo. Lo usa la pantalla de edición tras guardar. */
  refrescar: () => void
}

const Contexto = createContext<EstadoBranding>({
  branding: null,
  cargando: true,
  refrescar: () => {},
})

/** Las variables que este módulo escribe. Se borran todas al limpiar. */
/**
 * Lo que se escribió la última vez, para saber qué quitar.
 *
 * Antes había aquí una lista fija con los nombres de las variables, y eso es la
 * misma decisión tomada en dos sitios: al añadir una a `paletaDesde` había que
 * acordarse de añadirla también aquí, y si no, se quedaba pegada al volver a la
 * gama global.
 */
let aplicadasAntes: string[] = []

function aplicar(variables: VariablesTema | null): void {
  if (typeof document === 'undefined') return
  const raiz = document.documentElement

  // Quitarlas y no ponerlas «al valor global» es deliberado: si algún día
  // cambia globals.css, el panel debe seguir la hoja de estilos y no una copia
  // que se quedó congelada aquí.
  aplicadasAntes.forEach((v) => raiz.style.removeProperty(v))
  aplicadasAntes = []

  if (!variables) return

  Object.entries(variables).forEach(([nombre, valor]) => {
    raiz.style.setProperty(nombre, valor)
  })
  aplicadasAntes = Object.keys(variables)
}

/**
 * Qué proyecto viste el panel de quien gestiona.
 *
 * Un estudiante tiene uno solo y el servidor lo deduce de su sesión. Un
 * administrador gestiona varios, así que no hay respuesta automática: se
 * recuerda el último que dejó configurado. Va en `localStorage` y no en el
 * servidor porque es una preferencia de su pantalla, no un dato del programa.
 */
const CLAVE_PROYECTO_ACTIVO = 'nova_tema_proyecto'

export function leerProyectoActivo(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(CLAVE_PROYECTO_ACTIVO)
}

export function guardarProyectoActivo(programaId: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (programaId) localStorage.setItem(CLAVE_PROYECTO_ACTIVO, programaId)
  else localStorage.removeItem(CLAVE_PROYECTO_ACTIVO)
}

export function ProveedorBranding({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [branding, setBranding] = useState<BrandingResponse | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      // Primero el proyecto del propio usuario. Para un estudiante es el suyo
      // y es lo único que puede ver; para quien gestiona, esto falla —no está
      // matriculado— y se cae al proyecto que dejó elegido.
      setBranding(await brandingApi.mio())
    } catch {
      const elegido = leerProyectoActivo()
      if (!elegido) {
        setBranding(null)
        setCargando(false)
        return
      }
      try {
        setBranding(await brandingApi.obtener(elegido))
      } catch {
        // El proyecto ya no existe o no tiene permiso: se olvida en vez de
        // reintentarlo en cada carga.
        guardarProyectoActivo(null)
        setBranding(null)
      }
    } finally {
      setCargando(false)
    }
  }, [])

  // Se vuelve a pedir cuando cambia quién está dentro. El proveedor se monta
  // en la pantalla de acceso, cuando todavía no hay sesión: sin esta
  // dependencia, el estudiante iniciaba sesión y su panel se quedaba con la
  // gama global hasta que recargara a mano.
  useEffect(() => {
    if (!user) {
      setBranding(null)
      setCargando(false)
      return
    }
    // La identidad elegida por un administrador sirve para editar y previsualizar
    // un proyecto, no para repintar su panel de trabajo. Solo el estudiante
    // recibe la marca de su propio programa desde el servidor.
    if (!soloEsEstudiante(user.roles)) {
      setBranding(null)
      setCargando(false)
      return
    }
    cargar()
  }, [user, cargar])

  const colorActivo = branding?.colorPrimario ?? null

  useEffect(() => {
    aplicar(colorActivo ? paletaDesde(colorActivo) : null)
    return () => aplicar(null)
  }, [colorActivo])

  const valor = useMemo<EstadoBranding>(
    () => ({ branding, cargando, refrescar: cargar }),
    [branding, cargando, cargar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useBranding(): EstadoBranding {
  return useContext(Contexto)
}
