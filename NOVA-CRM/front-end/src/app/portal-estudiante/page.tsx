'use client'

import { ArrowSquareOut, Briefcase, Buildings, CheckCircle, CircleNotch, Clock, CurrencyDollar, DownloadSimple, FileText, FloppyDisk, MapPin, Medal, Sparkle, UserCheck, WarningCircle } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { useSearchParams } from '@/compat/next-navigation'
import { PageSpinner } from '@/components/ui/page-spinner'

import { useAuth } from '@/lib/auth'
import { estudiantesApi, matchesApi } from '@/lib/api'
import type { EstudianteResponse, MatchResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PortalEstudiantePage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const tabInicial = searchParams.get('tab') || 'vacantes'

  const [activeTab, setActiveTab] = useState(tabInicial)
  const [loading, setLoading] = useState(true)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [mensajeOk, setMensajeOk] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Datos del perfil del estudiante
  const [perfil, setPerfil] = useState<EstudianteResponse | null>(null)

  // Campos del formulario de perfil
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [cargoObjetivo, setCargoObjetivo] = useState('')
  const [perfilProfesional, setPerfilProfesional] = useState('')
  const [competencias, setCompetencias] = useState('')
  const [idiomas, setIdiomas] = useState('')
  const [celular, setCelular] = useState('')
  const [ciudad, setCiudad] = useState('')

  // Matches y Vacantes
  const [matches, setMatches] = useState<MatchResponse[]>([])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) setActiveTab(tabParam)
  }, [searchParams])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Cargar perfil
      const datosPerfil = await estudiantesApi.obtenerMiPerfil()
      setPerfil(datosPerfil)
      setNombre(datosPerfil.nombre || '')
      setApellido(datosPerfil.apellido || '')
      setCargoObjetivo(datosPerfil.cargoObjetivo || '')
      setPerfilProfesional(datosPerfil.perfilProfesional || '')
      setCompetencias(datosPerfil.competencias || '')
      setIdiomas(datosPerfil.idiomas || '')
      setCelular(datosPerfil.celular || '')
      setCiudad(datosPerfil.ciudad || '')

      // 2. Cargar vacantes matcheadas
      const resMatches = await matchesApi.obtenerMisMatches(0, 50)
      setMatches(resMatches.content || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar información del portal'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!perfil) return
    setGuardandoPerfil(true)
    setMensajeOk(null)
    setError(null)

    try {
      const requestActualizacion = {
        nombre,
        apellido,
        email: perfil.email,
        celular,
        ciudad,
        cargoObjetivo,
        perfilProfesional,
        competencias,
        idiomas,
        programaId: perfil.programaId,
      }
      const perfilActualizado = await estudiantesApi.actualizarMiPerfil(requestActualizacion)
      setPerfil(perfilActualizado)
      setMensajeOk('¡Perfil actualizado con éxito! Tu CV e información de match fueron recalculados.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la información'
      setError(msg)
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const handleDescargarHvPdf = async () => {
    setDescargandoPdf(true)
    setMensajeOk(null)
    try {
      const nombreArchivo = `HV-CAC-${nombre || 'Estudiante'}-${apellido || ''}.pdf`
      await estudiantesApi.descargarMiHvPdf(nombreArchivo)
      setMensajeOk('¡Hoja de Vida CAC ATS descargada con éxito!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar el PDF de la Hoja de Vida'
      setError(msg)
    } finally {
      setDescargandoPdf(false)
    }
  }

  const handleMarcarPostulado = async (matchId: string) => {
    try {
      await matchesApi.marcarPostulado(matchId)
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, postulado: true } : m))
      )
      setMensajeOk('¡Vacante marcada como postulada! Se añadió a tu seguimiento.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar estado de postulación'
      setError(msg)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
        <PageSpinner />
        <p className="text-sm font-medium text-muted-foreground">Cargando tu Portal de Empleabilidad…</p>
      </div>
    )
  }

  const vacantesMatcheadas = matches
  const postulacionesActivas = matches.filter((m) => m.postulado)
  const mejorMatch = matches.length > 0 ? Math.round(Math.max(...matches.map((m) => m.puntaje))) : 0

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-8">
      {/* Banner de Bienvenida */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-green-800 to-blue-950 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-md">
              <Sparkle className="size-3.5" /> Portal del Estudiante · Academia CAC
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              ¡Hola, {perfil?.nombre || user?.email}! 👋
            </h1>
            <p className="text-sm md:text-base text-blue-100/90 max-w-xl">
              Aquí encuentras las vacantes recomendadas para ti, puedes actualizar tus competencias y descargar tu **Hoja de Vida CAC ATS oficial** en un solo clic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleDescargarHvPdf}
              disabled={descargandoPdf}
              className="bg-green-400 text-blue-950 hover:bg-green-300 font-semibold shadow-lg"
            >
              {descargandoPdf ? (
                <>
                  <CircleNotch className="mr-2 size-4 animate-spin" /> Generando PDF…
                </>
              ) : (
                <>
                  <DownloadSimple className="mr-2 size-4" /> Descargar mi CV CAC ATS
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {mensajeOk && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="size-5 shrink-0" />
          <span>{mensajeOk}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <WarningCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Métricas rápidas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vacantes Matcheadas</CardTitle>
            <Briefcase className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacantesMatcheadas.length}</div>
            <p className="text-xs text-muted-foreground">Recomendadas por IA / Reglas</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mejor Coincidencia</CardTitle>
            <Medal className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mejorMatch}%</div>
            <p className="text-xs text-muted-foreground">Puntaje máximo alcanzado</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Postulaciones Enviadas</CardTitle>
            <UserCheck className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{postulacionesActivas.length}</div>
            <p className="text-xs text-muted-foreground">En seguimiento activo</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Programa</CardTitle>
            <FileText className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold truncate">{perfil?.programaNombre || 'Formación CAC'}</div>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              {perfil?.estadoEmpleabilidad || 'EN BUSQUEDA'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pestañas Principales manuales */}
      <div className="space-y-6">
        <div className="flex border-b border-border gap-2">
          <button
            onClick={() => setActiveTab('vacantes')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'vacantes'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Briefcase className="size-4" /> Mis Vacantes ({vacantesMatcheadas.length})
          </button>

          <button
            onClick={() => setActiveTab('perfil')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'perfil'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="size-4" /> Mi Perfil & CV
          </button>

          <button
            onClick={() => setActiveTab('postulaciones')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'postulaciones'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserCheck className="size-4" /> Seguimiento ({postulacionesActivas.length})
          </button>
        </div>

        {/* CONTENIDO TAB 1: VACANTES MATCHED */}
        {activeTab === 'vacantes' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Vacantes Recomendadas</h2>
              <p className="text-sm text-muted-foreground">
                Ofertas de empleo con alto porcentaje de match según tu perfil profesional.
              </p>
            </div>

            {vacantesMatcheadas.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Briefcase className="mx-auto size-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">Aún no hay vacantes recomendadas</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Completa más datos en la pestaña **Mi Perfil** (cargo objetivo, habilidades e idiomas) para que nuestro motor encuentre ofertas que se adapten a ti.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {vacantesMatcheadas.map((match) => {
                  const linkAplicacion = match.vacanteUrlAplicar || match.vacanteUrlOrigen
                  const matchScore = Math.round(match.puntaje)

                  return (
                    <Card key={match.id} className="relative overflow-hidden border-border/80 transition-all hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg font-bold text-foreground">{match.vacanteTitulo}</CardTitle>
                            <CardDescription className="flex items-center gap-1.5 mt-1">
                              <Buildings className="size-3.5" />
                              <span>{match.vacanteEmpresa || 'Empresa Confidencial'}</span>
                            </CardDescription>
                          </div>
                          <Badge
                            variant={matchScore >= 80 ? 'default' : 'secondary'}
                            className={`font-semibold shrink-0 text-xs px-2.5 py-1 ${
                              matchScore >= 80 ? 'bg-green-600 text-white' : ''
                            }`}
                          >
                            {matchScore}% Match
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4 text-sm">
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          {match.vacanteUbicacion && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3.5 text-blue-500" /> {match.vacanteUbicacion}
                            </span>
                          )}
                          {match.vacanteRangoSalarial && (
                            <span className="flex items-center gap-1">
                              <CurrencyDollar className="size-3.5 text-green-500" /> {match.vacanteRangoSalarial}
                            </span>
                          )}
                          {match.vacanteModalidadTrabajo && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              • {match.vacanteModalidadTrabajo}
                            </span>
                          )}
                        </div>

                        {match.vacanteRequisitos && (
                          <p className="line-clamp-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
                            {match.vacanteRequisitos}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border/60">
                          {match.postulado ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                              <CheckCircle className="size-4" /> Ya te postulaste
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarcarPostulado(match.id)}
                              className="text-xs"
                            >
                              <CheckCircle className="mr-1.5 size-3.5 text-green-500" /> Marcar Postulado
                            </Button>
                          )}

                          {linkAplicacion ? (
                            <a
                              href={linkAplicacion}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 shadow-sm"
                            >
                              Postularme en Sitio Web <ArrowSquareOut className="size-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Enlace no disponible</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO TAB 2: MI PERFIL Y HOJA DE VIDA */}
        {activeTab === 'perfil' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Formulario de perfil */}
            <Card className="lg:col-span-2 shadow-sm border-border/80">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Información de Empleabilidad</CardTitle>
                <CardDescription>
                  Mantén tus datos actualizados para que el motor de IA y los reclutadores te encuentren fácilmente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGuardarPerfil} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Nombre</label>
                      <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Apellido</label>
                      <Input value={apellido} onChange={(e) => setApellido(e.target.value)} required />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Teléfono / Celular</label>
                      <Input value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="Ej: 3001234567" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Ciudad de Residencia</label>
                      <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej: Bogotá" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Cargo Objetivo / Título Profesional</label>
                    <Input
                      value={cargoObjetivo}
                      onChange={(e) => setCargoObjetivo(e.target.value)}
                      placeholder="Ej: Desarrollo Backend Java / Fullstack Developer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Resumen del Perfil Profesional</label>
                    <textarea
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={perfilProfesional}
                      onChange={(e) => setPerfilProfesional(e.target.value)}
                      placeholder="Describe tu experiencia, fortalezas pedagógicas o técnicas y motivación laboral…"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Habilidades Técnicas / Competencias</label>
                    <Input
                      value={competencias}
                      onChange={(e) => setCompetencias(e.target.value)}
                      placeholder="Ej: Java, Spring Boot, SQL, React, Git, Scrum"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Idiomas</label>
                    <Input
                      value={idiomas}
                      onChange={(e) => setIdiomas(e.target.value)}
                      placeholder="Ej: Español (Nativo), Inglés (B2)"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button type="submit" disabled={guardandoPerfil} className="bg-blue-600 hover:bg-blue-700 font-semibold">
                      {guardandoPerfil ? (
                        <>
                          <CircleNotch className="mr-2 size-4 animate-spin" /> Guardando…
                        </>
                      ) : (
                        <>
                          <FloppyDisk className="mr-2 size-4" /> Guardar Perfil
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Tarjeta de descarga de Hoja de Vida */}
            <Card className="shadow-sm border-border/80 bg-gradient-to-b from-card via-card to-blue-500/5">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <FileText className="size-5" /> Generador de CV CAC ATS
                </CardTitle>
                <CardDescription>
                  Genera automáticamente tu hoja de vida con el formato oficial plano ATS aprobado por la institución.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-blue-500/10 p-4 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 space-y-2">
                  <p className="font-semibold">✨ Formato ATS Garantizado</p>
                  <p>
                    Tu Hoja de Vida se descarga compilada directamente desde tus datos guardados, estructurada a 1 columna y lista para superar filtros automáticos de empleo.
                  </p>
                </div>

                <Button
                  onClick={handleDescargarHvPdf}
                  disabled={descargandoPdf}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 shadow"
                >
                  {descargandoPdf ? (
                    <>
                      <CircleNotch className="mr-2 size-4 animate-spin" /> Generando PDF…
                    </>
                  ) : (
                    <>
                      <DownloadSimple className="mr-2 size-5" /> Descargar mi CV ATS (PDF)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CONTENIDO TAB 3: SEGUIMIENTO DE POSTULACIONES */}
        {activeTab === 'postulaciones' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Seguimiento de Mis Postulaciones</h2>
              <p className="text-sm text-muted-foreground">
                Historial de ofertas a las que has aplicado para mantener el control de tu proceso.
              </p>
            </div>

            {postulacionesActivas.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Clock className="mx-auto size-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">Sin postulaciones registradas</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Explora la pestaña **Mis Vacantes** y haz clic en **"Postularme en Sitio Web"** o **"Marcar Postulado"** para iniciar tu seguimiento.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {postulacionesActivas.map((m) => {
                  const linkAplicacion = m.vacanteUrlAplicar || m.vacanteUrlOrigen

                  return (
                    <Card key={m.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-border/80">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground text-base">{m.vacanteTitulo}</h4>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                            Postulado
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{m.vacanteEmpresa || 'Empresa'}</span>
                          <span>•</span>
                          <span>{m.vacanteUbicacion || 'Colombia'}</span>
                          <span>•</span>
                          <span>{Math.round(m.puntaje)}% Coincidencia</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {linkAplicacion && (
                          <a
                            href={linkAplicacion}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            Ver Oferta <ArrowSquareOut className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
