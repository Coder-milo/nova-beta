'use client'

/**
 * La misma dirección, dos pantallas distintas.
 *
 * Aquí llegan los dos lados: el estudiante desde su menú, y el equipo desde
 * «Ver todo en Messenger» de la cabecera. Servía a ambos el portal del
 * estudiante, que empieza pidiendo la ficha de estudiante de la sesión; un
 * administrador no la tiene, así que la pantalla saludaba con «El usuario
 * admin@novacrm.com no tiene una ficha de estudiante asociada» y debajo
 * enseñaba una bandeja que no es su trabajo.
 *
 * Mientras carga la sesión no se pinta ninguna de las dos: durante esa ventana
 * `soloEsEstudiante` devuelve `false` y un estudiante vería por un instante la
 * pantalla de gestión —y sus peticiones, que le responderían 403—.
 */

import { StudentAreaPage } from '@/components/student/student-area-page'
import { AdminMensajes } from '@/components/admin/admin-mensajes'
import { PageSpinner } from '@/components/ui/page-spinner'
import { useAuth } from '@/lib/auth'
import { soloEsEstudiante } from '@/lib/navigation'

export default function Page() {
  const { user, cargando } = useAuth()

  if (cargando || !user) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <PageSpinner />
      </div>
    )
  }

  return soloEsEstudiante(user.roles)
    ? <StudentAreaPage area="mensajes" />
    : <AdminMensajes />
}
