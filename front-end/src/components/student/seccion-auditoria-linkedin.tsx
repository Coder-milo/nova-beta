'use client'

import { useRef, useState } from 'react'
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  FileText,
  Globe,
  Info,
  Layers,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Upload,
  User,
  XCircle,
} from 'lucide-react'
import { LinkedinLogo } from '@/components/ui/iconos-de-marca'
import { hvApi } from '@/lib/api'
import type { AuditoriaLinkedinDto, EstudianteResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Aviso } from '@/components/ui/campo'
import { usePreferences } from '@/lib/preferences'
import { calcularPorcentajeEmpleabilidad } from '@/lib/ruta-empleabilidad'

interface SeccionAuditoriaLinkedinProps {
  perfil: EstudianteResponse
  onPerfilActualizado: (nuevoPerfil: EstudianteResponse, mensajeFeedback?: string) => void
  onCerrar: () => void
}

export function SeccionAuditoriaLinkedin({
  perfil,
  onPerfilActualizado,
  onCerrar,
}: SeccionAuditoriaLinkedinProps) {
  const { locale } = usePreferences()
  const en = locale === 'en'

  const [archivo, setArchivo] = useState<File | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<AuditoriaLinkedinDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sincronizarFicha, setSincronizarFicha] = useState(true)
  const [detallesExpandidos, setDetallesExpandidos] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  const procesarArchivo = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError(en ? 'Please upload a PDF file exported from LinkedIn.' : 'Por favor sube un archivo PDF exportado de LinkedIn.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(en ? 'The PDF file is too large (max 10 MB).' : 'El archivo PDF es demasiado grande (máximo 10 MB).')
      return
    }

    setError(null)
    setArchivo(file)
    setAnalizando(true)

    try {
      const res = await hvApi.auditarLinkedin(file)
      setResultado(res)
    } catch (err: any) {
      setError(err?.message || (en ? 'Could not audit LinkedIn PDF. Make sure you use "Save to PDF" on LinkedIn.' : 'No se pudo auditar el PDF de LinkedIn. Asegúrate de exportarlo usando "Guardar en PDF" en LinkedIn.'))
    } finally {
      setAnalizando(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(true)
  }

  const handleDragLeave = () => {
    setArrastrando(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      procesarArchivo(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      procesarArchivo(e.target.files[0])
    }
  }

  const handleAplicarOptimizado = async () => {
    if (!resultado) return
    setGuardando(true)
    setError(null)

    try {
      const res = await hvApi.aplicarAuditoriaLinkedin({
        linkedinUrl: resultado.datosExtraidos?.linkedinUrl || perfil.linkedinUrl || '',
        sincronizarPerfil: sincronizarFicha,
        datosASincronizar: resultado.datosExtraidos,
      })

      const base = res || perfil
      const perfilFinal: EstudianteResponse = {
        ...base,
        hitoLinkedinCreado: 'SI',
        hitoLinkedinOptimizado: 'SI',
        porcentajeEmpleabilidad: calcularPorcentajeEmpleabilidad({
          ...base,
          hitoLinkedinCreado: 'SI',
          hitoLinkedinOptimizado: 'SI',
        }),
      }

      const mensaje = en
        ? '¡LinkedIn profile verified and optimized (+15%)!'
        : '¡Perfil de LinkedIn verificado y optimizado (+15%)!'

      onPerfilActualizado(perfilFinal, mensaje)
    } catch (err: any) {
      setError(err?.message || (en ? 'Could not save audit results.' : 'No se pudo guardar la aprobación de optimización.'))
    } finally {
      setGuardando(false)
    }
  }

  // Color de badge y medidor según puntuación
  const colorPuntuacion = (pts: number) => {
    if (pts >= 85) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
    if (pts >= 70) return 'text-primary bg-primary/10 border-primary/30'
    if (pts >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/30'
    return 'text-rose-500 bg-rose-500/10 border-rose-500/30'
  }

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* ── Vista Inicial / Carga de Archivo ── */}
      {!resultado && (
        <div className="space-y-4">
          {/* Guía en 2 pasos de LinkedIn */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-foreground space-y-2.5">
            <p className="font-semibold flex items-center gap-1.5 text-primary">
              <Sparkles className="size-3.5 text-primary" />
              {en ? 'How to export your LinkedIn profile in 2 clicks:' : 'Cómo descargar tu perfil de LinkedIn en 2 clics:'}
            </p>
            <ol className="space-y-1.5 text-muted-foreground list-decimal list-inside">
              <li>
                {en ? 'Open your public profile on ' : 'Abre tu perfil público en '}
                <a
                  href={perfil.linkedinUrl || 'https://www.linkedin.com/in/'}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  LinkedIn ↗
                </a>
              </li>
              <li>
                {en
                  ? 'Click "More" (or "...") below your headline and select "Save to PDF".'
                  : 'Haz clic en "Más" (o "...") debajo de tu titular y selecciona "Guardar en PDF".'}
              </li>
              <li>{en ? 'Drop the downloaded PDF file here.' : 'Sube o arrastra aquí el PDF descargado.'}</li>
            </ol>
          </div>

          {/* Zona Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              arrastrando
                ? 'border-primary bg-primary/10 scale-[0.99]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30 bg-card'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {analizando ? (
              <div className="flex flex-col items-center justify-center gap-2 py-4">
                <LoaderCircle className="size-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {en ? 'Analyzing LinkedIn profile…' : 'Auditando tu perfil de LinkedIn…'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {en ? 'Extracting headline, summary, skills and experience' : 'Extrayendo titular, extracto, aptitudes y trayectoria'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2.5">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Upload className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {en ? 'Drop your LinkedIn PDF here' : 'Arrastra tu PDF de LinkedIn aquí'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {en ? 'or click to browse from your computer' : 'o haz clic para buscarlo en tu equipo'}
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  {en ? 'Official LinkedIn PDF format' : 'Formato oficial de LinkedIn (PDF)'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vista Diagnóstico y Resultados (Estilo Manfred / ATS) ── */}
      {resultado && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          {/* Cabecera con Medidor de Puntuación */}
          <div className={`rounded-2xl border p-4.5 flex flex-col sm:flex-row items-center justify-between gap-4 ${colorPuntuacion(resultado.puntuacion)}`}>
            <div className="flex items-center gap-3.5 text-left">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-background border border-current font-bold text-xl">
                {resultado.puntuacion}
                <span className="text-xs font-normal opacity-70">/100</span>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-foreground">
                    {resultado.nivel}
                  </span>
                  <Badge variant={resultado.optimizado ? 'default' : 'secondary'} className="text-[11px]">
                    {resultado.optimizado
                      ? (en ? 'Optimized (+15%)' : 'Optimizado (+15%)')
                      : (en ? 'Requires improvements' : 'Requiere mejoras')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {resultado.optimizado
                    ? (en ? 'Your profile meets all professional recruiting standards.' : 'Tu perfil cumple con los estándares para posicionarte ante reclutadores.')
                    : (en ? 'Score under 70. Follow the suggestions below to level up.' : 'Puntaje inferior a 70. Aplica las sugerencias para subir de nivel.')}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setResultado(null)
                setArchivo(null)
              }}
              className="gap-1.5 text-xs self-end sm:self-center shrink-0"
            >
              <RefreshCw className="size-3.5" />
              {en ? 'Upload another PDF' : 'Subir otro PDF'}
            </Button>
          </div>

          {/* Desglose de los 5 Pilares */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5" />
              {en ? 'Audit pillars breakdown:' : 'Desglose de pilares auditados:'}
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {resultado.criterios.map((c) => (
                <div
                  key={c.clave}
                  className={`rounded-xl border p-3 text-xs space-y-1.5 transition-colors ${
                    c.cumplido
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-amber-500/20 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5 text-foreground">
                      {c.cumplido ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <XCircle className="size-4 text-amber-500" />
                      )}
                      {c.titulo}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.puntosObtenidos}/{c.puntosMaximos} pts
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{c.detalle}</p>
                  {c.sugerencia && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      💡 {c.sugerencia}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fortalezas y Recomendaciones */}
          {(resultado.fortalezas.length > 0 || resultado.recomendaciones.length > 0) && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3.5 text-xs">
              {resultado.fortalezas.length > 0 && (
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Award className="size-3.5" />
                    {en ? 'Profile Strengths:' : 'Fortalezas encontradas:'}
                  </p>
                  <ul className="space-y-1 text-muted-foreground pl-5 list-disc">
                    {resultado.fortalezas.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {resultado.recomendaciones.length > 0 && (
                <div className="space-y-1 pt-1.5 border-t border-border/50">
                  <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Lightbulb className="size-3.5" />
                    {en ? 'Next steps to improve:' : 'Sugerencias para subir de nivel:'}
                  </p>
                  <ul className="space-y-1 text-muted-foreground pl-5 list-disc">
                    {resultado.recomendaciones.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Acordeón de Datos Extraídos */}
          {resultado.datosExtraidos && (
            <div className="rounded-xl border border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setDetallesExpandidos(!detallesExpandidos)}
                className="w-full flex items-center justify-between p-3 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-primary" />
                  {en ? 'View extracted profile details' : 'Ver datos detectados del PDF'}
                </span>
                {detallesExpandidos ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>

              {detallesExpandidos && (
                <div className="p-3 pt-0 text-xs space-y-2 border-t border-border/40 text-muted-foreground">
                  {resultado.datosExtraidos.cargoObjetivo && (
                    <p><strong className="text-foreground">Titular:</strong> {resultado.datosExtraidos.cargoObjetivo}</p>
                  )}
                  {resultado.datosExtraidos.perfilProfesional && (
                    <p className="line-clamp-3"><strong className="text-foreground">Extracto:</strong> {resultado.datosExtraidos.perfilProfesional}</p>
                  )}
                  {resultado.datosExtraidos.competencias && (
                    <p><strong className="text-foreground">Aptitudes:</strong> {resultado.datosExtraidos.competencias}</p>
                  )}
                  {resultado.datosExtraidos.experiencias && resultado.datosExtraidos.experiencias.length > 0 && (
                    <p><strong className="text-foreground">Experiencias:</strong> {resultado.datosExtraidos.experiencias.map(e => `${e.cargo} (${e.empresa})`).join(', ')}</p>
                  )}
                  {resultado.datosExtraidos.formaciones && resultado.datosExtraidos.formaciones.length > 0 && (
                    <p><strong className="text-foreground">Educación:</strong> {resultado.datosExtraidos.formaciones.map(f => `${f.programa} (${f.institucion})`).join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Opción de Sincronización */}
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sincronizarFicha}
              onChange={(e) => setSincronizarFicha(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4"
            />
            <span>
              {en
                ? 'Automatically sync extracted experiences, skills and summary into my NOVA-CRM profile.'
                : 'Sincronizar automáticamente las experiencias, aptitudes y extracto en mi ficha de NOVA-CRM.'}
            </span>
          </label>

          {/* Botones de Acción Final */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
              {en ? 'Close' : 'Cerrar'}
            </Button>

            <Button
              type="button"
              onClick={handleAplicarOptimizado}
              disabled={guardando}
              className="gap-2 font-semibold shadow-sm"
            >
              {guardando ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {en ? 'Saving…' : 'Guardando…'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  {resultado.optimizado
                    ? (en ? 'Approve Optimization (+15%)' : 'Aprobar Optimización (+15%)')
                    : (en ? 'Accept & Save Progress (+15%)' : 'Guardar y Aprobar Hito (+15%)')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
