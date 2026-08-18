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
const CLAVE_IDENTIDAD_ACTUALIZADA = 'nova_identidad_proyecto_actualizada'

export function leerProyectoActivo(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(CLAVE_PROYECTO_ACTIVO)
}

export function guardarProyectoActivo(programaId: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (programaId) localStorage.setItem(CLAVE_PROYECTO_ACTIVO, programaId)
  else localStorage.removeItem(CLAVE_PROYECTO_ACTIVO)
}

/**
 * Avisa a los otros portales abiertos que un administrador acaba de publicar
 * una identidad. No cambia el tema de quien administra: el proveedor solo
 * atiende esta señal si la sesión actual es exclusivamente de estudiante.
 */
export function notificarIdentidadActualizada(programaId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CLAVE_IDENTIDAD_ACTUALIZADA, JSON.stringify({ programaId, fecha: Date.now() }))
}

export function ProveedorBranding({ children }: { children: ReactNode }) {
  const { user, cargando: cargandoSesion } = useAuth()
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
    // Mientras la sesión se lee del navegador no se sabe de quién es la
    // identidad. Decidir aquí daría "no hay marca" para todo el mundo y el
    // estudiante vería su portal con la gama global hasta el siguiente render.
    if (cargandoSesion) return
    if (!user) {
      // El proveedor vive también en las pantallas de administración. Si la
      // sesión anterior era de un estudiante, quitar la gama de su proyecto
      // antes de mostrar el panel siguiente evita que se "pegue" al gestor.
      aplicar(null)
      setBranding(null)
      setCargando(false)
      return
    }
    // La identidad elegida por un administrador sirve para editar y previsualizar
    // un proyecto, no para repintar su panel de trabajo. Solo el estudiante
    // recibe la marca de su propio programa desde el servidor.
    if (!soloEsEstudiante(user.roles)) {
      aplicar(null)
      setBranding(null)
      setCargando(false)
      return
    }
    cargar()
  }, [cargandoSesion, user, cargar])

  // Al volver al portal o cuando otra pestaña publica una identidad, se vuelve
  // a consultar la marca. Así el banner y los colores nuevos aparecen sin
  // obligar al estudiante a cerrar sesión o a vaciar la caché del navegador.
  useEffect(() => {
    if (!user || !soloEsEstudiante(user.roles)) return

    const sincronizar = () => { void cargar() }
    const alCambiarAlmacenamiento = (event: StorageEvent) => {
      if (event.key === CLAVE_IDENTIDAD_ACTUALIZADA) sincronizar()
    }
    const alRecuperarFoco = () => {
      if (document.visibilityState === 'visible') sincronizar()
    }

    window.addEventListener('storage', alCambiarAlmacenamiento)
    window.addEventListener('focus', alRecuperarFoco)
    document.addEventListener('visibilitychange', alRecuperarFoco)
    return () => {
      window.removeEventListener('storage', alCambiarAlmacenamiento)
      window.removeEventListener('focus', alRecuperarFoco)
      document.removeEventListener('visibilitychange', alRecuperarFoco)
    }
  }, [user, cargar])

  const colorActivo = branding?.colorPrimario ?? null

  useEffect(() => {
    aplicar(colorActivo ? paletaDesde(colorActivo) : null)
    return () => aplicar(null)
  }, [colorActivo])

  // `refrescar` se expone para que el portal del estudiante pueda recuperar
  // su identidad al guardar una preferencia. Nunca debe cargar ni aplicar una
  // identidad mientras se usa un panel de administración: un administrador
  // puede editar varios proyectos, pero su interfaz conserva siempre la gama
  // global de CAC Academic.
  const refrescar = useCallback(() => {
    if (!user || !soloEsEstudiante(user.roles)) {
      aplicar(null)
      setBranding(null)
      setCargando(false)
      return
    }
    void cargar()
  }, [user, cargar])

  const valor = useMemo<EstadoBranding>(
    () => ({ branding, cargando, refrescar }),
    [branding, cargando, refrescar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useBranding(): EstadoBranding {
  return useContext(Contexto)
}
