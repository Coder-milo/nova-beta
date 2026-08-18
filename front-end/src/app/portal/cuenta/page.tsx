'use client'

import { Settings, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'

/**
 * La cuenta, desde el lado de la empresa.
 *
 * <p>Es deliberadamente escueta. Lo único que una empresa gestiona de sí misma
 * es su sesión: los datos de la ficha —nombre, sector, contacto— los mantiene
 * el equipo del programa, porque son los que aparecen en los informes y en los
 * convenios. Dejar que se editen desde fuera significaría que una empresa puede
 * cambiar cómo figura en un reporte ya emitido.
 */
export default function CuentaDelPortalPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()
  const en = locale === 'en'

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        antetitulo={en ? 'Company portal' : 'Portal de empresas'}
        titulo={en ? 'My account' : 'Mi cuenta'}
        icono={Settings}
        campos={[
          { etiqueta: en ? 'Signed in as' : 'Sesión de', valor: user?.email ?? '—' },
        ]}
      />

      <Card className="gap-0 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--panel-positivo)]" />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-foreground">
                {en ? 'What you can see here' : 'Qué se ve desde aquí'}
              </span>
              <p className="text-[13px] leading-snug text-muted-foreground">
                {en
                  ? 'Only your own job posts and the people who applied to them. Of each candidate you see their professional profile: programme, skills, experience and English level. Personal data — ID number, address, phone and email — never leaves the institution.'
                  : 'Solo tus vacantes y quienes se postularon a ellas. De cada candidato ves su perfil profesional: programa, habilidades, experiencia y nivel de inglés. Los datos personales —documento, dirección, teléfono y correo— no salen de la institución.'}
              </p>
            </div>
          </div>

          <p className="border-t border-[var(--panel-borde)] pt-3 text-[13px] leading-snug text-muted-foreground">
            {en
              ? 'To contact a candidate, or to update your company details, write to the programme team. Company data appears in official reports, so it is kept on their side.'
              : 'Para contactar a un candidato, o para actualizar los datos de tu empresa, escribe al equipo del programa. Los datos de la empresa aparecen en informes oficiales, por eso se mantienen de su lado.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
