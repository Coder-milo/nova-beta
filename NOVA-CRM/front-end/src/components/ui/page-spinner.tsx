'use client'

import Image from '@/compat/next-image'

/**
 * Cargador minimalista de marca.
 * Todas las cargas se muestran como overlay global para conservar una
 * experiencia consistente entre páginas, tablas y formularios.
 */
export function PageSpinner({
  label = 'Cargando…',
  fullscreen: _fullscreen = false,
}: {
  label?: string
  fullscreen?: boolean
}) {
  return (
    <div
      className="cac-loader cac-loader--fullscreen"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="cac-logo-spinner" aria-hidden="true">
        <span className="cac-logo-spinner__ring cac-logo-spinner__ring--outer" />
        <span className="cac-logo-spinner__ring cac-logo-spinner__ring--inner" />
        <span className="cac-logo-spinner__mark">
          <Image
            src="/cac-logo.png"
            alt=""
            width={88}
            height={54}
            priority
            className="cac-logo-spinner__image"
          />
        </span>
      </div>

      <p className="cac-loader__label">{label}</p>
    </div>
  )
}
