'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Info,
  LoaderCircle,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { LinkedinLogo } from '@/components/ui/iconos-de-marca'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Campo, Aviso } from '@/components/ui/campo'
import { Badge } from '@/components/ui/badge'
import { estudiantesApi, hvApi, mensajeDeError } from '@/lib/api'
import type { EstudianteRequest, EstudianteResponse, PlantillaResponse } from '@/lib/types'
import { normalizarUrlLinkedin, validarUrlLinkedin, calcularPorcentajeEmpleabilidad } from '@/lib/ruta-empleabilidad'
import { usePreferences } from '@/lib/preferences'
import Link from '@/compat/next-link'
import { SeccionAuditoriaLinkedin } from './seccion-auditoria-linkedin'

export interface ModalAccionRapidaRutaProps {
  pasoId: string | null
  abierto: boolean
  onCerrar: () => void
  perfil: EstudianteResponse
  onPerfilActualizado: (perfilActualizado: EstudianteResponse, mensajeFeedback?: string) => void
}

function textos(english: boolean) {
  return english
    ? {
        cerrar: 'Close',
        guardar: 'Save changes',
        guardando: 'Saving…',
        generarYDescargar: 'Generate & Download PDF',
        generando: 'Generating PDF…',
        editorCompleto: 'Open full résumé editor',
        cancelar: 'Cancel',
        perfilOcupacional: {
          titulo: 'Define your occupational profile',
          subtitulo: 'Set your target role and professional summary (+15% score).',
          cargoEtiqueta: 'Target role',
          cargoAyuda: 'e.g. Frontend Developer, Data Analyst, QA Specialist',
          perfilEtiqueta: 'Professional summary',
          perfilAyuda: 'A concise summary of your skills, background and goals.',
          competenciasEtiqueta: 'Key skills (optional)',
          competenciasAyuda: 'e.g. React, TypeScript, Tailwind CSS, SQL',
          notaHito: 'Filling in either role or summary sets the milestone to Done (+15%). Leaving both empty reverts the milestone to Pending (0%).',
          exitoGuardado: 'Occupational profile updated (+15%).',
          exitoVaciado: 'Occupational profile cleared (0%).',
        },
        linkedin: {
          titulo: 'Register your LinkedIn profile',
          tituloOptimizar: 'Improve your LinkedIn profile',
          subtitulo: 'Connect your public LinkedIn profile so recruiters find you (+10% / +15% score).',
          subtituloOptimizar: 'Upload your PDF exported from LinkedIn to analyze its ATS strength and validate your optimization score (+15%).',
          urlEtiqueta: 'LinkedIn profile URL',
          urlPlaceholder: 'https://www.linkedin.com/in/your-username',
          urlAyuda: 'Accepted format: https://www.linkedin.com/in/username',
          vistaPrevia: 'Normalized link preview:',
          consejosTitulo: 'Profile optimization checklist:',
          consejo1: 'Headline with your target role and primary tech stack',
          consejo2: 'About summary written in first person highlighting achievements',
          consejo3: 'Professional photo with neutral background and good lighting',
          consejo4: 'Customized clean URL without random numbers',
          notaHito: 'Saving a valid LinkedIn URL activates the milestone (+10%). Removing the URL reverts LinkedIn milestones to Pending (0%).',
          exitoGuardado: 'LinkedIn profile linked (+10%).',
          exitoVaciado: 'LinkedIn link removed (0%).',
        },
        cv: {
          tituloEs: 'Spanish ATS Résumé (Local Market)',
          subtituloEs: 'Generate your official Spanish CV ready for local and national companies (+15% score).',
          tituloEn: 'English Resume & Bilingual Profile (Global Market)',
          subtituloEn: 'Adapt your résumé to international ATS standards with action verbs for remote jobs (+15% score).',
          idiomaEtiqueta: 'Language',
          espanol: 'Spanish (ES)',
          ingles: 'English (EN)',
          plantillaEtiqueta: 'Preferred template',
          plantillaPorDefecto: 'Institutional Default',
          notaEditor: 'Need to add specific work experiences or education?',
          exitoGeneradoEs: 'Spanish résumé generated and downloaded (+15%).',
          exitoGeneradoEn: 'English Resume adapted, generated and downloaded (+15%).',
          nivelInglesEtiqueta: 'Your English proficiency level:',
          botonAdaptarIa: 'Translate & adapt to English with AI',
          adaptandoIa: 'Optimizing résumé in English with AI…',
          resumenEnEtiqueta: 'Adapted Professional Summary (Action-verbs)',
          cargoEnEtiqueta: 'Adapted Target Role',
          habilidadesEnEtiqueta: 'Standardized English Skills',
          verbosAccionTitulo: 'ATS Action Verbs applied:',
          descargarEs: 'Download Spanish CV (PDF) & Finish step',
          descargarEn: 'Download English Resume (PDF) & Finish step',
        },
        colocado: {
          titulo: 'Job Placement (30%)',
          subtitulo: 'The culminating milestone of your employability journey.',
          estadoHecho: '¡Congratulations! You are recorded as placed.',
          estadoPendiente: 'Milestone pending coordinator verification',
          explicacion:
            'This milestone represents formal employment placement and accounts for 30% of your total score. It is verified and recorded by your employability coordinator upon confirmation of your signed employment contract.',
          consejo:
            'Have you recently signed an employment contract or received a formal offer? Reach out to your advisor or coordinator to record your placement.',
          verProceso: 'View my full process',
        },
      }
    : {
        cerrar: 'Cerrar',
        guardar: 'Guardar cambios',
        guardando: 'Guardando…',
        generarYDescargar: 'Generar y Descargar PDF',
        generando: 'Generando PDF…',
        editorCompleto: 'Abrir editor completo de hoja de vida',
        cancelar: 'Cancelar',
        perfilOcupacional: {
          titulo: 'Define tu perfil ocupacional',
          subtitulo: 'Establece tu cargo objetivo y resumen profesional (+15% de empleabilidad).',
          cargoEtiqueta: 'Cargo objetivo',
          cargoAyuda: 'ej. Desarrollador Frontend React, Analista de Datos, Especialista QA',
          perfilEtiqueta: 'Perfil profesional / Extracto',
          perfilAyuda: 'Un resumen conciso de tus competencias, trayectoria y enfoque laboral.',
          competenciasEtiqueta: 'Competencias clave (opcional)',
          competenciasAyuda: 'ej. React, TypeScript, Tailwind CSS, SQL',
          notaHito: 'Completar tu cargo objetivo o perfil profesional activa el hito (+15%). Si dejas ambos campos vacíos, el hito volverá a Pendiente (0%).',
          exitoGuardado: 'Perfil ocupacional actualizado (+15%).',
          exitoVaciado: 'Perfil ocupacional vaciado (0%).',
        },
        linkedin: {
          titulo: 'Registra tu perfil de LinkedIn',
          tituloOptimizar: 'Optimiza tu perfil de LinkedIn',
          subtitulo: 'Vincula tu perfil público de LinkedIn para que te encuentren reclutadores (+10% / +15% de empleabilidad).',
          subtituloOptimizar: 'Sube tu perfil exportado en PDF de LinkedIn para evaluarlo con nuestro auditor ATS y validar tu optimización (+15%).',
          urlEtiqueta: 'URL de tu perfil de LinkedIn',
          urlPlaceholder: 'https://www.linkedin.com/in/tu-nombre',
          urlAyuda: 'Formato admitido: https://www.linkedin.com/in/usuario',
          vistaPrevia: 'Vista previa de enlace normalizado:',
          consejosTitulo: 'Recomendaciones clave para un perfil estelar:',
          consejo1: 'Titular profesional con tu cargo objetivo y tecnologías principales',
          consejo2: 'Extracto / Acerca de enfocado en logros y fortalezas clave',
          consejo3: 'Foto profesional con buena iluminación y fondo neutro',
          consejo4: 'URL pública personalizada sin números aleatorios',
          notaHito: 'Guardar un enlace válido de LinkedIn activa el hito (+10%). Borrar el enlace revertirá los hitos de LinkedIn a Pendiente (0%).',
          exitoGuardado: 'Perfil de LinkedIn vinculado (+10%).',
          exitoVaciado: 'Enlace de LinkedIn removido (0%).',
        },
        cv: {
          tituloEs: 'Hoja de vida en español (Formato ATS Nacional)',
          subtituloEs: 'Genera tu currículum oficial en español listo para postularte a empresas locales y nacionales (+15% de empleabilidad).',
          tituloEn: 'English Resume & Perfil Bilingüe (Estándar Global)',
          subtituloEn: 'Adapta tu currículum al estándar anglosajón con verbos de acción para vacantes remotas e internacionales (+15% de empleabilidad).',
          idiomaEtiqueta: 'Idioma del documento',
          espanol: 'Español (ES)',
          ingles: 'Inglés (EN)',
          plantillaEtiqueta: 'Plantilla preferida',
          plantillaPorDefecto: 'Predeterminada institucional',
          notaEditor: '¿Deseas editar tus experiencias laborales o estudios en detalle?',
          exitoGeneradoEs: 'Hoja de vida en español generada y descargada (+15%).',
          exitoGeneradoEn: 'English Resume adaptado, generado y descargado (+15%).',
          nivelInglesEtiqueta: 'Tu nivel de dominio de inglés:',
          botonAdaptarIa: 'Traducir y adaptar mi perfil al inglés con IA',
          adaptandoIa: 'Optimizando currículum en inglés con IA…',
          resumenEnEtiqueta: 'Professional Summary adaptado (Action-verbs)',
          cargoEnEtiqueta: 'Target Role (Cargo adaptado)',
          habilidadesEnEtiqueta: 'Competencias estandarizadas en inglés',
          verbosAccionTitulo: 'Verbos de acción ATS aplicados:',
          descargarEs: 'Descargar Hoja de Vida (PDF) y Completar Hito',
          descargarEn: 'Descargar English Resume (PDF) y Aprobar Hito',
        },
        colocado: {
          titulo: 'Colocación Laboral (30%)',
          subtitulo: 'El hito culminante de tu proceso de empleabilidad.',
          estadoHecho: '¡Felicitaciones! Has sido registrado como colocado.',
          estadoPendiente: 'Hito pendiente de validación por coordinación',
          explicacion:
            'Este hito representa tu contratación formal y aporta el 30% restante de tu puntaje de empleabilidad. Es registrado y validado por tu coordinador de empleabilidad al confirmar la firma de tu contrato o acuerdo de vinculación.',
          consejo:
            '¿Conseguiste empleo o firmaste contrato recientemente? Comunícate con tu asesor o escribe al equipo para reportar tu vinculación y actualizar tu expediente.',
          verProceso: 'Consultar mi proceso completo',
        },
      }
}

export function ModalAccionRapidaRuta({
  pasoId,
  abierto,
  onCerrar,
  perfil,
  onPerfilActualizado,
}: ModalAccionRapidaRutaProps) {
  const { locale } = usePreferences()
  const en = locale === 'en'
  const T = textos(en)

  // Estado del formulario de Perfil Ocupacional
  const [cargoObjetivo, setCargoObjetivo] = useState(perfil.cargoObjetivo || '')
  const [perfilProfesional, setPerfilProfesional] = useState(perfil.perfilProfesional || '')
  const [competencias, setCompetencias] = useState(perfil.competencias || '')

  // Estado del formulario de LinkedIn
  const [linkedinUrl, setLinkedinUrl] = useState(perfil.linkedinUrl || '')

  // Estado de adaptación English Resume con IA (Paso 3)
  const [nivelIngles, setNivelIngles] = useState(perfil.nivelIngles || 'B2')
  const [targetRoleEn, setTargetRoleEn] = useState('')
  const [professionalSummaryEn, setProfessionalSummaryEn] = useState('')
  const [skillsEn, setSkillsEn] = useState('')
  const [actionVerbs, setActionVerbs] = useState<string[]>([])
  const [adaptandoIa, setAdaptandoIa] = useState(false)
  const [yaAdaptadoIa, setYaAdaptadoIa] = useState(false)

  // Estado de plantillas y descarga
  const [plantillas, setPlantillas] = useState<PlantillaResponse[]>([])
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>(
    perfil.plantillaPreferidaId || '',
  )

  // Estados de carga y error
  const [guardando, setGuardando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sincronizar formulario cada vez que se abre el modal o cambia el paso
  useEffect(() => {
    if (abierto) {
      setError(null)
      setCargoObjetivo(perfil.cargoObjetivo || '')
      setPerfilProfesional(perfil.perfilProfesional || '')
      setCompetencias(perfil.competencias || '')
      setLinkedinUrl(perfil.linkedinUrl || '')
      setNivelIngles(perfil.nivelIngles || 'B2')
      setPlantillaSeleccionada(perfil.plantillaPreferidaId || '')

      if (pasoId === 'cvListo' || pasoId === 'cvIngles') {
        void hvApi
          .plantillas()
          .then((res) => {
            setPlantillas(res)
            if (!perfil.plantillaPreferidaId && res.length > 0) {
              const predet = res.find((p) => p.predeterminada) || res[0]
              setPlantillaSeleccionada(predet.id)
            }
          })
          .catch(() => {
            // Ignorar error no bloqueante de plantillas
          })
      }
    }
  }, [abierto, pasoId, perfil])

  // Guardar Perfil Ocupacional
  const handleGuardarPerfilOcupacional = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const cargoTrim = cargoObjetivo.trim()
      const perfilTrim = perfilProfesional.trim()
      const compTrim = competencias.trim()

      const body: EstudianteRequest = {
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        email: perfil.email,
        programaId: perfil.programaId,
        cargoObjetivo: cargoTrim,
        perfilProfesional: perfilTrim,
        competencias: compTrim,
      }

      const res = await estudiantesApi.actualizarMiPerfil(body)
      const tieneDatos = cargoTrim.length > 0 || perfilTrim.length > 0
      const nuevoHito = tieneDatos ? 'SI' : 'NO'
      const basePerfil = res || perfil
      const perfilActualizado: EstudianteResponse = {
        ...basePerfil,
        cargoObjetivo: cargoTrim,
        perfilProfesional: perfilTrim,
        competencias: compTrim,
        hitoPerfilOcupacional: nuevoHito,
        porcentajeEmpleabilidad: calcularPorcentajeEmpleabilidad({
          ...basePerfil,
          cargoObjetivo: cargoTrim,
          perfilProfesional: perfilTrim,
          hitoPerfilOcupacional: nuevoHito,
        }),
      }

      const mensajeFeedback = tieneDatos
        ? T.perfilOcupacional.exitoGuardado
        : T.perfilOcupacional.exitoVaciado

      onPerfilActualizado(perfilActualizado, mensajeFeedback)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar el perfil ocupacional.'))
    } finally {
      setGuardando(false)
    }
  }

  // Guardar LinkedIn
  const handleGuardarLinkedin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validacion = validarUrlLinkedin(linkedinUrl)
    if (!validacion.valido) {
      setError(validacion.mensaje || 'Enlace de LinkedIn no válido')
      return
    }

    setGuardando(true)
    try {
      const urlNormalizada = normalizarUrlLinkedin(linkedinUrl)
      const body: EstudianteRequest = {
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        email: perfil.email,
        programaId: perfil.programaId,
        linkedinUrl: urlNormalizada,
      }

      const res = await estudiantesApi.actualizarMiPerfil(body)
      const tieneLinkedin = urlNormalizada.length > 0
      const nuevoHitoLinkedin = tieneLinkedin ? 'SI' : 'NO'
      const basePerfil = res || perfil
      const perfilActualizado: EstudianteResponse = {
        ...basePerfil,
        linkedinUrl: urlNormalizada,
        hitoLinkedinCreado: nuevoHitoLinkedin,
        hitoLinkedinOptimizado: tieneLinkedin ? basePerfil.hitoLinkedinOptimizado : 'NO',
        porcentajeEmpleabilidad: calcularPorcentajeEmpleabilidad({
          ...basePerfil,
          linkedinUrl: urlNormalizada,
          hitoLinkedinCreado: nuevoHitoLinkedin,
          hitoLinkedinOptimizado: tieneLinkedin ? basePerfil.hitoLinkedinOptimizado : 'NO',
        }),
      }

      const mensajeFeedback = tieneLinkedin
        ? T.linkedin.exitoGuardado
        : T.linkedin.exitoVaciado

      onPerfilActualizado(perfilActualizado, mensajeFeedback)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar el enlace de LinkedIn.'))
    } finally {
      setGuardando(false)
    }
  }

  // Generar y Descargar Hoja de Vida en Español (Paso 2)
  const handleGenerarHvEs = async () => {
    setError(null)
    setDescargando(true)
    try {
      const plantillaId = plantillaSeleccionada || undefined
      const nombreArchivo = `Hoja-de-Vida-${(perfil.nombre || 'Estudiante').replace(/\s+/g, '-')}-ES.pdf`

      await estudiantesApi.descargarMiHvPdf('es', plantillaId, nombreArchivo)

      const actualizado = await estudiantesApi.obtenerMiPerfil()
      const nuevoHitoCv = 'SI'
      const perfilActualizado: EstudianteResponse = {
        ...actualizado,
        hitoCvListo: nuevoHitoCv,
        porcentajeEmpleabilidad: calcularPorcentajeEmpleabilidad({
          ...actualizado,
          hitoCvListo: nuevoHitoCv,
        }),
      }
      onPerfilActualizado(perfilActualizado, T.cv.exitoGeneradoEs)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo generar ni descargar la hoja de vida en español.'))
    } finally {
      setDescargando(false)
    }
  }

  // Adaptar perfil a English Resume con IA (Paso 3)
  const handleAdaptarIa = async () => {
    setError(null)
    setAdaptandoIa(true)
    try {
      const res = await hvApi.adaptarIngles({
        cargoObjetivo: cargoObjetivo || perfil.cargoObjetivo || undefined,
        perfilProfesional: perfilProfesional || perfil.perfilProfesional || undefined,
        competencias: competencias || perfil.competencias || undefined,
        nivelIngles,
      })
      setTargetRoleEn(res.targetRole || '')
      setProfessionalSummaryEn(res.professionalSummary || '')
      setSkillsEn(res.skills || '')
      setActionVerbs(res.actionVerbsUsed || [])
      setYaAdaptadoIa(true)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo completar la adaptación con IA. Inténtalo de nuevo.'))
    } finally {
      setAdaptandoIa(false)
    }
  }

  // Guardar y Descargar English Resume (Paso 3)
  const handleGuardarYDescargarEn = async () => {
    setError(null)
    setDescargando(true)
    try {
      if (yaAdaptadoIa) {
        await hvApi.aplicarIngles({
          nivelIngles,
          targetRole: targetRoleEn,
          professionalSummary: professionalSummaryEn,
          skills: skillsEn,
        })
      } else {
        await hvApi.aplicarIngles({
          nivelIngles,
        })
      }

      const plantillaId = plantillaSeleccionada || undefined
      const nombreArchivo = `Resume-${(perfil.nombre || 'Estudiante').replace(/\s+/g, '-')}-EN.pdf`
      await estudiantesApi.descargarMiHvPdf('en', plantillaId, nombreArchivo)

      const actualizado = await estudiantesApi.obtenerMiPerfil()
      const nuevoHitoEn = 'SI'
      const perfilActualizado: EstudianteResponse = {
        ...actualizado,
        nivelIngles,
        hitoCvIngles: nuevoHitoEn,
        porcentajeEmpleabilidad: calcularPorcentajeEmpleabilidad({
          ...actualizado,
          nivelIngles,
          hitoCvIngles: nuevoHitoEn,
        }),
      }
      onPerfilActualizado(perfilActualizado, T.cv.exitoGeneradoEn)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo generar ni descargar el English Resume.'))
    } finally {
      setDescargando(false)
    }
  }

  if (!abierto || !pasoId) return null

  // 1. Paso: Perfil Ocupacional
  if (pasoId === 'perfilOcupacional') {
    return (
      <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Briefcase className="size-5" />
              <Badge variant="secondary" className="font-semibold">
                Paso 1 · 15%
              </Badge>
            </div>
            <DialogTitle>{T.perfilOcupacional.titulo}</DialogTitle>
            <DialogDescription>{T.perfilOcupacional.subtitulo}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardarPerfilOcupacional} className="space-y-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            <Campo
              etiqueta={T.perfilOcupacional.cargoEtiqueta}
              ayuda={T.perfilOcupacional.cargoAyuda}
            >
              <Input
                value={cargoObjetivo}
                onChange={(e) => setCargoObjetivo(e.target.value)}
                placeholder="ej. Desarrollador Frontend React"
                maxLength={500}
                autoFocus
              />
            </Campo>

            <Campo
              etiqueta={T.perfilOcupacional.perfilEtiqueta}
              ayuda={`${perfilProfesional.length}/3000 caracteres · ${T.perfilOcupacional.perfilAyuda}`}
            >
              <Textarea
                value={perfilProfesional}
                onChange={(e) => setPerfilProfesional(e.target.value)}
                placeholder="ej. Desarrollador web con sólida formación en React, Node.js y bases de datos relacionales..."
                minRows={4}
                maxRows={8}
                maxLength={3000}
              />
            </Campo>

            <Campo
              etiqueta={T.perfilOcupacional.competenciasEtiqueta}
              ayuda={T.perfilOcupacional.competenciasAyuda}
            >
              <Input
                value={competencias}
                onChange={(e) => setCompetencias(e.target.value)}
                placeholder="ej. React, TypeScript, Tailwind CSS, Git"
                maxLength={3000}
              />
            </Campo>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{T.perfilOcupacional.notaHito}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
                {T.cancelar}
              </Button>
              <Button type="submit" disabled={guardando} className="gap-2">
                {guardando ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    {T.guardando}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    {T.guardar}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // 2. Paso: LinkedIn Optimizado (Auditoría ATS con PDF de LinkedIn)
  if (pasoId === 'linkedinOptimizado') {
    return (
      <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <LinkedinLogo className="size-5" />
              <Badge variant="secondary" className="font-semibold">
                {en ? 'Step 5 · 15%' : 'Paso 5 · 15%'}
              </Badge>
            </div>
            <DialogTitle>
              {T.linkedin.tituloOptimizar}
            </DialogTitle>
            <DialogDescription>
              {T.linkedin.subtituloOptimizar}
            </DialogDescription>
          </DialogHeader>

          <SeccionAuditoriaLinkedin
            perfil={perfil}
            onPerfilActualizado={onPerfilActualizado}
            onCerrar={onCerrar}
          />
        </DialogContent>
      </Dialog>
    )
  }

  // 3. Paso: LinkedIn Creado (Vincular URL pública)
  if (pasoId === 'linkedinCreado') {
    const urlNormalizada = normalizarUrlLinkedin(linkedinUrl)
    const validacion = validarUrlLinkedin(linkedinUrl)

    return (
      <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <LinkedinLogo className="size-5" />
              <Badge variant="secondary" className="font-semibold">
                Paso 4 · 10%
              </Badge>
            </div>
            <DialogTitle>{T.linkedin.titulo}</DialogTitle>
            <DialogDescription>{T.linkedin.subtitulo}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardarLinkedin} className="space-y-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            <Campo
              etiqueta={T.linkedin.urlEtiqueta}
              ayuda={T.linkedin.urlAyuda}
              error={!validacion.valido ? validacion.mensaje : undefined}
            >
              <Input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder={T.linkedin.urlPlaceholder}
                maxLength={1000}
                autoFocus
              />
            </Campo>

            {urlNormalizada && validacion.valido && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                <span className="font-semibold text-muted-foreground">{T.linkedin.vistaPrevia} </span>
                <span className="break-all font-mono text-primary">{urlNormalizada}</span>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-border bg-card p-3.5 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                {T.linkedin.consejosTitulo}
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{T.linkedin.consejo1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{T.linkedin.consejo2}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{T.linkedin.consejo3}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{T.linkedin.consejo4}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{T.linkedin.notaHito}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
                {T.cancelar}
              </Button>
              <Button type="submit" disabled={guardando || !validacion.valido} className="gap-2">
                {guardando ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    {T.guardando}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    {T.guardar}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // 3. Paso 2: Hoja de Vida en Español (Formato ATS Nacional · 15%)
  if (pasoId === 'cvListo') {
    const tienePerfil = Boolean(perfil.cargoObjetivo?.trim() || perfil.perfilProfesional?.trim())

    return (
      <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <FileText className="size-5" />
              <Badge variant="secondary" className="font-semibold">
                Paso 2 · 15%
              </Badge>
            </div>
            <DialogTitle>{T.cv.tituloEs}</DialogTitle>
            <DialogDescription>{T.cv.subtituloEs}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            {/* Checklist ATS de completitud */}
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Verificación de estructura ATS
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-foreground">
                  <span>Datos personales y de contacto:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Completo</span>
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span>Perfil ocupacional / Resumen:</span>
                  <span className={tienePerfil ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-amber-500 font-medium"}>
                    {tienePerfil ? (perfil.cargoObjetivo || 'Estructurado') : 'Pendiente'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span>Formato de descarga:</span>
                  <span className="font-medium text-primary">PDF ATS Nacional</span>
                </div>
              </div>
            </div>

            {/* Selector de plantilla */}
            {plantillas.length > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="selector-plantilla-modal-es" className="block text-sm font-medium text-foreground">
                  {T.cv.plantillaEtiqueta}
                </label>
                <select
                  id="selector-plantilla-modal-es"
                  value={plantillaSeleccionada}
                  onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">{T.cv.plantillaPorDefecto}</option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.predeterminada ? '(Predeterminada)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Enlace secundario hacia editor completo */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
              <span className="text-muted-foreground">{T.cv.notaEditor}</span>
              <Link
                href="/mi-hoja-de-vida"
                onClick={onCerrar}
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
              >
                {T.editorCompleto}
                <ExternalLink className="size-3.5" />
              </Link>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onCerrar} disabled={descargando}>
                {T.cerrar}
              </Button>
              <Button
                type="button"
                onClick={handleGenerarHvEs}
                disabled={descargando}
                className="gap-2"
              >
                {descargando ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    {T.generando}
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    {T.cv.descargarEs}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 4. Paso 3: English Resume & Perfil Bilingüe con Asistente IA (15%)
  if (pasoId === 'cvIngles') {
    const niveles = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

    return (
      <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5 text-amber-500" />
              <Badge variant="secondary" className="font-semibold">
                Paso 3 · 15%
              </Badge>
            </div>
            <DialogTitle>{T.cv.tituloEn}</DialogTitle>
            <DialogDescription>{T.cv.subtituloEn}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            {/* Selector de nivel de inglés */}
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {T.cv.nivelInglesEtiqueta}
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {niveles.map((niv) => (
                  <Button
                    key={niv}
                    type="button"
                    size="sm"
                    variant={nivelIngles === niv ? 'default' : 'outline'}
                    onClick={() => setNivelIngles(niv)}
                    className="h-8 w-full text-xs font-bold"
                  >
                    {niv}
                  </Button>
                ))}
              </div>
            </div>

            {/* Asistente IA de traducción / adaptación */}
            <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Sparkles className="size-4" />
                  <span>Asistente IA · Adaptación a Estándar Anglosajón</span>
                </div>
                {!yaAdaptadoIa && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAdaptarIa}
                    disabled={adaptandoIa}
                    className="h-7 gap-1.5 text-xs font-semibold"
                  >
                    {adaptandoIa ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin" />
                        {T.cv.adaptandoIa}
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" />
                        {T.cv.botonAdaptarIa}
                      </>
                    )}
                  </Button>
                )}
              </div>

              {yaAdaptadoIa ? (
                <div className="space-y-3 pt-2">
                  {actionVerbs.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">{T.cv.verbosAccionTitulo}</span>
                      <div className="flex flex-wrap gap-1">
                        {actionVerbs.map((v) => (
                          <Badge key={v} variant="outline" className="border-primary/30 bg-primary/10 text-[10px] font-medium text-primary">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground">{T.cv.cargoEnEtiqueta}</label>
                    <Input
                      value={targetRoleEn}
                      onChange={(e) => setTargetRoleEn(e.target.value)}
                      placeholder="e.g. Backend Software Developer"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground">{T.cv.resumenEnEtiqueta}</label>
                    <Textarea
                      value={professionalSummaryEn}
                      onChange={(e) => setProfessionalSummaryEn(e.target.value)}
                      placeholder="e.g. Results-driven Software Developer with expertise in Java, Spring Boot, and scalable API architecture..."
                      minRows={3}
                      className="text-xs leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAdaptarIa}
                      disabled={adaptandoIa}
                      className="h-7 text-xs text-primary hover:bg-primary/10"
                    >
                      {adaptandoIa ? <LoaderCircle className="size-3 animate-spin mr-1" /> : <Sparkles className="size-3 mr-1" />}
                      Re-generar con IA
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Convierte tu extracto y trayectoria en un <strong>Professional Summary</strong> redactado en inglés profesional con verbos de acción ATS (*Developed, Spearheaded, Engineered*) optimizado para reclutadores globales.
                </p>
              )}
            </div>

            {/* Selector de plantilla */}
            {plantillas.length > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="selector-plantilla-modal-en" className="block text-sm font-medium text-foreground">
                  {T.cv.plantillaEtiqueta}
                </label>
                <select
                  id="selector-plantilla-modal-en"
                  value={plantillaSeleccionada}
                  onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">{T.cv.plantillaPorDefecto}</option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.predeterminada ? '(Predeterminada)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onCerrar} disabled={descargando}>
                {T.cerrar}
              </Button>
              <Button
                type="button"
                onClick={handleGuardarYDescargarEn}
                disabled={descargando || adaptandoIa}
                className="gap-2"
              >
                {descargando ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    {T.generando}
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    {T.cv.descargarEn}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 4. Paso: Colocación Laboral (30%)
  if (pasoId === 'colocado') {
    const colocado = Boolean(perfil.colocado)

    return (
      <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Trophy className="size-5" />
              <Badge variant="secondary" className="font-semibold">
                Paso 6 · 30%
              </Badge>
            </div>
            <DialogTitle>{T.colocado.titulo}</DialogTitle>
            <DialogDescription>{T.colocado.subtitulo}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className={`rounded-xl border p-4 text-sm ${
                colocado
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-border bg-card text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                {colocado ? (
                  <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Info className="size-6 text-primary" />
                )}
                <div>
                  <p className="font-semibold">
                    {colocado ? T.colocado.estadoHecho : T.colocado.estadoPendiente}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {T.colocado.explicacion}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground">
              <p className="font-semibold text-primary">¿Qué puedes hacer?</p>
              <p className="mt-1 leading-5 text-muted-foreground">{T.colocado.consejo}</p>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onCerrar}>
                {T.cerrar}
              </Button>
              <Link
                href="/mi-proceso"
                onClick={onCerrar}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {T.colocado.verProceso}
                <ArrowRight className="size-4" />
              </Link>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
