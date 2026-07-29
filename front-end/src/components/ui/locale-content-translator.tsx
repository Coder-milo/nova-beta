'use client'

import { useEffect, useRef } from 'react'
import { usePreferences } from '@/lib/preferences'

/* Textos estáticos que aparecen dentro de los módulos. Los datos escritos por
   usuarios (nombres, mensajes, títulos de vacantes) nunca se traducen. */
const EN: Record<string, string> = {
  'Refrescar': 'Refresh', 'Buscar': 'Search', 'Limpiar': 'Clear', 'Cancelar': 'Cancel', 'Guardar': 'Save', 'Eliminar': 'Delete', 'Editar': 'Edit', 'Ver detalle': 'View details', 'Cerrar': 'Close', 'Volver': 'Back', 'Reintentar': 'Try again',
  'Nueva vacante': 'New job opening', 'Registrar vacante': 'Create job opening', 'Publicar vacante': 'Publish job opening', 'Vacantes': 'Job openings', 'No hay vacantes registradas.': 'There are no job openings yet.', 'Escanear y hacer matching': 'Scan and match', 'Solo matching': 'Match only',
  'Nuevo estudiante': 'New student', 'Registrar el primero': 'Register the first one', 'Estudiantes': 'Students', 'No hay estudiantes que coincidan con la búsqueda.': 'No students match your search.', 'Seguimiento de estudiantes': 'Student follow-up',
  'Empresas': 'Companies', 'Nueva empresa': 'New company', 'No hay empresas con estos filtros': 'There are no companies with these filters.', 'Documentos': 'Documents', 'Subir documento': 'Upload document', 'Subir': 'Upload', 'Vista previa': 'Preview', 'Descargar': 'Download',
  'Comunicaciones': 'Communications', 'Publicar un anuncio': 'Publish an announcement', 'Título': 'Title', 'Mensaje': 'Message', 'Destinatarios': 'Recipients', 'Todos los estudiantes activos': 'All active students',
  'Mi proceso': 'My process', 'Postulaciones': 'Applications', 'Calendario': 'Calendar', 'Configuración': 'Settings', 'Hoja de vida': 'Resume', 'Mis documentos': 'My documents', 'Mi calendario': 'My calendar',
  'Estado de mi proceso': 'My process status', 'Accesos rápidos': 'Quick access', 'Completar mi perfil': 'Complete my profile', 'Consultar mi proceso': 'View my process', 'Ver calendario': 'View calendar',
  'Alertas para avanzar': 'Progress alerts', 'Resolver ahora': 'Resolve now', 'Oportunidades': 'Opportunities', 'Notificaciones nuevas': 'New notifications', 'Postulaciones enviadas': 'Applications sent',
  'Información personal': 'Personal information', 'Información académica': 'Academic information', 'Ficha de empleabilidad': 'Employability profile', 'Perfil laboral': 'Employment profile', 'Formación y capacidades': 'Education and skills', 'Gestión de empleabilidad': 'Employability management',
  'Estado actual': 'Current status', 'Programa': 'Program', 'Formaciones': 'Training records', 'Experiencias': 'Experience', 'Documentos / HV': 'Documents / resume', 'Perfil completado': 'Profile completed',
  'Pendiente': 'Pending', 'Respondido': 'Answered', 'En seguimiento': 'In progress', 'Activo': 'Active', 'Sin información': 'No information', 'No registrado': 'Not recorded',
  'No hay mensajes para mostrar.': 'No messages to show.', 'Escribir un mensaje': 'Write a message', 'Asunto': 'Subject', 'Enviar mensaje': 'Send message', 'Tu solicitud llegará al equipo de acompañamiento.': 'Your request will be sent to the support team.',
  'No tienes notificaciones.': 'You have no notifications.', 'Próximos eventos': 'Upcoming events', 'Mes anterior': 'Previous month', 'Mes siguiente': 'Next month',
  'Apariencia': 'Appearance', 'Idioma': 'Language', 'Claro': 'Light', 'Oscuro': 'Dark', 'Sistema': 'System',
}

function reemplazar(texto: string, locale: 'es' | 'en') {
  const source = texto.trim()
  if (!source) return texto
  const destination = locale === 'en' ? EN[source] : undefined
  if (!destination) return texto
  const before = texto.slice(0, texto.indexOf(source))
  const after = texto.slice(texto.indexOf(source) + source.length)
  return `${before}${destination}${after}`
}

/**
 * Abarca contenido estático de módulos que todavía no consumían `t()`. Mantiene
 * el texto original por nodo, por lo que volver a español no altera formularios
 * ni contenido registrado por el equipo o los estudiantes.
 */
export function LocaleContentTranslator() {
  const { locale } = usePreferences()
  const originals = useRef(new WeakMap<Node, string>())
  const attributeOriginals = useRef(new WeakMap<HTMLElement, Map<string, string>>())

  useEffect(() => {
    const root = document.querySelector('main')
    if (!root) return
    let applying = false
    const apply = () => {
      if (applying) return
      applying = true
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const element = node.parentElement
        if (element && !['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(element.tagName)) {
          const original = originals.current.get(node) ?? node.nodeValue ?? ''
          if (!originals.current.has(node)) originals.current.set(node, original)
          const next = locale === 'en' ? reemplazar(original, locale) : original
          if (node.nodeValue !== next) node.nodeValue = next
        }
        node = walker.nextNode()
      }
      root.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach((element) => {
        for (const attribute of ['placeholder', 'title', 'aria-label']) {
          const current = element.getAttribute(attribute)
          if (!current) continue
          const stored = attributeOriginals.current.get(element) ?? new Map<string, string>()
          if (!stored.has(attribute)) stored.set(attribute, current)
          attributeOriginals.current.set(element, stored)
          const source = stored.get(attribute) ?? current
          const next = locale === 'en' ? reemplazar(source, locale) : source
          if (current !== next) element.setAttribute(attribute, next)
        }
      })
      applying = false
    }
    apply()
    const observer = new MutationObserver(() => window.requestAnimationFrame(apply))
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [locale])

  return null
}
