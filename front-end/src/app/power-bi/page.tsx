import { useState, useEffect } from 'react'
import {
  BarChart3,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings2,
  CheckCircle2,
  Copy,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react'
import { usePreferences } from '@/lib/preferences'
import { extraerUrlEmbedPowerBi } from '@/lib/power-bi-util'

export default function PowerBiPage() {
  const { locale } = usePreferences()
  const isEn = locale === 'en'

  const STORAGE_KEY = 'novacrm_powerbi_embed_url'
  const [embedUrl, setEmbedUrl] = useState<string>('')
  const [inputUrl, setInputUrl] = useState<string>('')
  const [mostrarConfig, setMostrarConfig] = useState<boolean>(false)
  const [pantallaCompleta, setPantallaCompleta] = useState<boolean>(false)
  const [copiado, setCopiado] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const guardada = localStorage.getItem(STORAGE_KEY)
      if (guardada) {
        setEmbedUrl(guardada)
        setInputUrl(guardada)
      }
    }
  }, [])

  const guardarUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const urlLimpia = extraerUrlEmbedPowerBi(inputUrl)
    setEmbedUrl(urlLimpia)
    setInputUrl(urlLimpia)
    if (typeof window !== 'undefined') {
      if (urlLimpia) {
        localStorage.setItem(STORAGE_KEY, urlLimpia)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setMostrarConfig(false)
  }

  const copiarCredencial = () => {
    navigator.clipboard.writeText('careerservices@cacenglish.com.co')
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className={`space-y-6 ${pantallaCompleta ? 'fixed inset-0 z-50 bg-background p-6 overflow-auto' : ''}`}>
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="size-4 text-amber-500" />
            {isEn ? 'Analytics & Business Intelligence' : 'Analítica & Inteligencia de Negocios'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {isEn ? 'Employability Power BI Dashboard' : 'Tablero de Control de Empleabilidad (Power BI)'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Real-time indicators, labor placement metrics and program impact analysis.'
              : 'Indicadores en tiempo real, métricas de colocación laboral e impacto de los programas.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarConfig(!mostrarConfig)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            <Settings2 className="size-4 text-muted-foreground" />
            {mostrarConfig ? (isEn ? 'Hide Config' : 'Ocultar Config') : (isEn ? 'Configure Report' : 'Configurar Informe')}
          </button>

          {embedUrl && (
            <button
              type="button"
              onClick={() => setPantallaCompleta(!pantallaCompleta)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted"
            >
              {pantallaCompleta ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              {pantallaCompleta
                ? isEn ? 'Exit Fullscreen' : 'Salir de Pantalla Completa'
                : isEn ? 'Fullscreen' : 'Pantalla Completa'}
            </button>
          )}

          <a
            href="https://app.powerbi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:opacity-90"
          >
            {isEn ? 'Open Power BI Workspace' : 'Abrir Power BI Workspace'}
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      {/* Panel de Configuración de URL Embed */}
      {mostrarConfig && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">
            {isEn ? 'Power BI Embed URL Setup' : 'Configuración de Enlace Embed de Power BI'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isEn
              ? 'Paste the embed link or iframe URL generated from your Power BI Workspace (File > Embed report > Publish to web or Website/portal).'
              : 'Pega aquí el enlace de inserción (Embed URL) generado desde tu Power BI (Archivo > Insertar informe > Publicar en la web o Sitio web/portal).'}
          </p>

          <form onSubmit={guardarUrl} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://app.powerbi.com/view?r=... o https://app.powerbi.com/reportEmbed?..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                {isEn ? 'Save URL' : 'Guardar Enlace'}
              </button>
              {embedUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('')
                    setEmbedUrl('')
                    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
                  }}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/20"
                >
                  {isEn ? 'Clear' : 'Borrar'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Visor de Power BI o Guía Informativa */}
      {embedUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Layers className="size-3.5 text-amber-500" />
              {isEn ? 'Power BI Live Report' : 'Informe en Vivo de Power BI'}
            </span>
            <button
              type="button"
              onClick={() => {
                const ifr = document.getElementById('pbi-frame') as HTMLIFrameElement
                if (ifr) ifr.src = ifr.src
              }}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <RefreshCw className="size-3" />
              {isEn ? 'Refresh' : 'Recargar'}
            </button>
          </div>
          <div className="relative aspect-[16/9] w-full min-h-[600px] bg-background">
            <iframe
              id="pbi-frame"
              title="Power BI Report"
              src={embedUrl}
              className="h-full w-full border-0"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Tarjeta 1: Conexión con tu cuenta */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {isEn ? 'Active Power BI Account' : 'Cuenta de Power BI Lista'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isEn
                ? 'Your institution account is ready to publish analytics and reports.'
                : 'La cuenta institucional está lista para publicar analítica y reportes.'}
            </p>

            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs">
              <span className="font-medium text-foreground">careerservices@cacenglish.com.co</span>
              <button
                type="button"
                onClick={copiarCredencial}
                className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                {copiado ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copiado ? (isEn ? 'Copied' : 'Copiado al portapapeles') : (isEn ? 'Copy email' : 'Copiar correo')}
              </button>
            </div>

            <a
              href="https://app.powerbi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              {isEn ? 'Sign in to Power BI' : 'Iniciar Sesión en Power BI'}
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          {/* Tarjeta 2: Cómo incrustar tu informe */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:col-span-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {isEn ? 'How to link your report to NOVA-CRM' : 'Cómo vincular tu informe a NOVA-CRM'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isEn
                ? 'Follow these 3 simple steps to display your interactive dashboard directly inside this page:'
                : 'Sigue estos 3 sencillos pasos para visualizar tu tablero interactivo directamente en esta pantalla:'}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  1
                </span>
                <h4 className="mt-2 text-xs font-semibold text-foreground">
                  {isEn ? 'Open Report' : 'Abre tu Informe'}
                </h4>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isEn
                    ? 'In app.powerbi.com, open your employability report.'
                    : 'En app.powerbi.com, entra al informe que quieras ver.'}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  2
                </span>
                <h4 className="mt-2 text-xs font-semibold text-foreground">
                  {isEn ? 'Copy Embed Link' : 'Copia el Enlace Embed'}
                </h4>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isEn
                    ? 'Go to File > Embed report > Publish to web (or Website).'
                    : 'Ve a Archivo > Insertar informe > Publicar en la web.'}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  3
                </span>
                <h4 className="mt-2 text-xs font-semibold text-foreground">
                  {isEn ? 'Paste URL Here' : 'Pega el Enlace Aquí'}
                </h4>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isEn
                    ? 'Click "Configure Report" above and paste the URL.'
                    : 'Pulsa "Configurar Informe" arriba y pega el enlace.'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="size-4 shrink-0" />
                {isEn
                  ? 'Once configured, all team members will see the interactive report without needing to log in separately.'
                  : 'Una vez configurado, tu equipo podrá interactuar con los filtros y gráficos sin salir del CRM.'}
              </span>
              <button
                type="button"
                onClick={() => setMostrarConfig(true)}
                className="ml-3 shrink-0 font-semibold underline hover:opacity-80"
              >
                {isEn ? 'Paste link now' : 'Pegar enlace ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
