'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowsClockwise,
  Bank,
  Bell,
  CheckCircle,
  CircleNotch,
  Cloud,
  Certificate,
  Database,
  EnvelopeSimple,
  FloppyDisk,
  Gear,
  Globe,
  Key,
  IdentificationCard,
  InstagramLogo,
  LinkedinLogo,
  LockKey,
  Monitor,
  MapPin,
  Moon,
  Palette,
  Phone,
  Plus,
  RocketLaunch,
  ShareNetwork,
  Shield,
  ShieldWarning,
  Sliders,
  Sun,
  Trash,
  User,
  Users,
  WarningCircle,
  WhatsappLogo,
  type Icon,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import { PageSpinner } from '@/components/ui/page-spinner'
import { PanelCuentasEstudiante } from '@/components/admin/panel-cuentas-estudiante'
import { PanelBranding } from '@/components/admin/panel-branding'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EstadoDot } from '@/components/ui/estado-dot'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { adminApi, programasApi, usuariosApi, ApiCallError } from '@/lib/api'
import type { UsuarioResponse } from '@/lib/types'

const ROLES_DISPONIBLES = ['ADMIN', 'COORDINADOR'] as const

type SettingsSectionProps = {
  icon: Icon
  title: string
  description: string
  children: ReactNode
}

function SettingsSection({
  icon: IconComponent,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="group/section rounded-2xl border border-white/65 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_14px_34px_-28px_rgba(24,65,120,0.5)] backdrop-blur-xl transition-all duration-300 hover:border-primary/20 hover:bg-card/50 dark:border-white/10 dark:bg-slate-950/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_38px_-30px_rgba(0,0,0,0.8)] sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-300 group-hover/section:scale-105">
          <IconComponent className="size-5" weight="duotone" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="text-[13px] font-semibold leading-none text-foreground/85">
      {children}
      {required && <span className="ml-1 text-primary">*</span>}
    </label>
  )
}

type TabKey = 'institucion' | 'academico' | 'integraciones' | 'usuarios' | 'mantenimiento'

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const { theme, setTheme, locale, setLocale, t } = usePreferences()
  const [activeTab, setActiveTab] = useState<TabKey>('institucion')

  // ── 1. Estado Institucional (Persistente) ─────────────────────────────────
  const [instData, setInstData] = useState({
    nombreOficial: 'Academy CAC - Centro de Capacitación y Empleabilidad',
    nit: '901.452.839-4',
    registroEducativo: 'Resolución SED 4143.0.21.9872',
    sedePrincipal: 'Calle 79 # 50-24, Sede Principal, Barranquilla, Atlántico',
    telefonoContacto: '+57 (605) 385 9000',
    whatsappSoporte: '+57 300 123 4567',
    emailContacto: 'contacto@academia.edu.co',
    emailSoporte: 'empleabilidad@academia.edu.co',
    sitioWeb: 'https://academia.edu.co',
    linkedinUrl: 'https://linkedin.com/company/academia-cac',
    instagramUrl: 'https://instagram.com/academiacac',
  })
  const [savingInst, setSavingInst] = useState(false)
  const [instSuccess, setInstSuccess] = useState(false)

  // ── 2. Parámetros Académicos & Empleabilidad (Persistente) ─────────────────
  const [academicData, setAcademicData] = useState({
    cohorteActiva: '2026-I',
    umbralMatchMinimo: '70',
    diasRetencionPapelera: '30',
    plantillaCvPredeterminada: 'CV_PROFESIONAL_CAC_V2',
    alertaNotificarEmpresa: true,
    alertaNuevoEstudiante: true,
    requerirLinkedInObligatorio: false,
  })
  const [savingAcademic, setSavingAcademic] = useState(false)
  const [academicSuccess, setAcademicSuccess] = useState(false)

  // ── 3. Integraciones & APIs (Persistente) ──────────────────────────────────
  const [integrationData, setIntegrationData] = useState({
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: '587',
    smtpUser: 'apikey',
    smtpFromEmail: 'notificaciones@academycac.edu.co',
    powerBiWorkspaceId: 'cac-pbi-workspace-prod-01',
    powerBiReportId: 'report-empleabilidad-2026',
    linkedInClientId: '78cac_linkedin_api_key_v2',
    cloudStorageBucket: 'cac-documentos-hojas-de-vida-s3',
  })
  const [savingIntegration, setSavingIntegration] = useState(false)
  const [integrationSuccess, setIntegrationSuccess] = useState(false)

  // ── 4. Usuarios & Programas ──────────────────────────────────────────────
  const [programas, setProgramas] = useState<{ id: string; nombre: string }[]>([])
  const [selectedPgm, setSelectedPgm] = useState('')
  const [loadingPgms, setLoadingPgms] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const [usuarios, setUsuarios] = useState<UsuarioResponse[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [usuariosError, setUsuariosError] = useState<string | null>(null)
  const [sinPermisoUsuarios, setSinPermisoUsuarios] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: '',
    email: '',
    password: '',
    roles: ['COORDINADOR'] as string[],
  })
  const [creandoUsuario, setCreandoUsuario] = useState(false)
  const [usuarioFormError, setUsuarioFormError] = useState<string | null>(null)
  const [usuarioBusy, setUsuarioBusy] = useState<string | null>(null)

  // Cargar configuración guardada en localStorage
  useEffect(() => {
    try {
      const savedInst = localStorage.getItem('nova_inst_config')
      if (savedInst) setInstData(JSON.parse(savedInst))

      const savedAcad = localStorage.getItem('nova_acad_config')
      if (savedAcad) setAcademicData(JSON.parse(savedAcad))

      const savedInteg = localStorage.getItem('nova_integ_config')
      if (savedInteg) setIntegrationData(JSON.parse(savedInteg))
    } catch {
      // Si falla lectura de localStorage, usa valores por defecto
    }
  }, [])

  // Guardar datos institucionales
  const handleSaveInst = (e: React.FormEvent) => {
    e.preventDefault()
    setSavingInst(true)
    setTimeout(() => {
      localStorage.setItem('nova_inst_config', JSON.stringify(instData))
      setSavingInst(false)
      setInstSuccess(true)
      setTimeout(() => setInstSuccess(false), 3000)
    }, 400)
  }

  // Guardar datos académicos
  const handleSaveAcademic = (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAcademic(true)
    setTimeout(() => {
      localStorage.setItem('nova_acad_config', JSON.stringify(academicData))
      setSavingAcademic(false)
      setAcademicSuccess(true)
      setTimeout(() => setAcademicSuccess(false), 3000)
    }, 400)
  }

  // Guardar datos de integraciones
  const handleSaveIntegration = (e: React.FormEvent) => {
    e.preventDefault()
    setSavingIntegration(true)
    setTimeout(() => {
      localStorage.setItem('nova_integ_config', JSON.stringify(integrationData))
      setSavingIntegration(false)
      setIntegrationSuccess(true)
      setTimeout(() => setIntegrationSuccess(false), 3000)
    }, 400)
  }

  const loadUsuarios = useCallback(async () => {
    setLoadingUsuarios(true)
    setUsuariosError(null)
    setSinPermisoUsuarios(false)
    try {
      setUsuarios(await usuariosApi.listar())
    } catch (err) {
      if (err instanceof ApiCallError && (err.status === 401 || err.status === 403)) {
        setSinPermisoUsuarios(true)
      } else if (err instanceof ApiCallError) {
        setUsuariosError(`Error al cargar los usuarios (HTTP ${err.status}).`)
      } else {
        setUsuariosError('No se pudo conectar con el backend.')
      }
    } finally {
      setLoadingUsuarios(false)
    }
  }, [])

  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios])

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsuarioFormError(null)
    if (!nuevoUsuario.nombre.trim()) {
      setUsuarioFormError('El nombre es obligatorio.')
      return
    }
    if (!nuevoUsuario.email.trim()) {
      setUsuarioFormError('El email es obligatorio.')
      return
    }
    if (nuevoUsuario.password.length < 8) {
      setUsuarioFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (nuevoUsuario.roles.length === 0) {
      setUsuarioFormError('Selecciona al menos un rol.')
      return
    }
    setCreandoUsuario(true)
    try {
      await usuariosApi.crear({
        nombre: nuevoUsuario.nombre.trim(),
        email: nuevoUsuario.email.trim(),
        password: nuevoUsuario.password,
        roles: nuevoUsuario.roles,
      })
      setNuevoUsuario({ nombre: '', email: '', password: '', roles: ['COORDINADOR'] })
      loadUsuarios()
    } catch (err) {
      if (err instanceof ApiCallError) {
        if (err.status === 409)
          setUsuarioFormError('Ya existe un usuario con ese correo electrónico.')
        else if (err.status === 401 || err.status === 403)
          setUsuarioFormError('Solo los administradores pueden gestionar usuarios.')
        else setUsuarioFormError(err.body.message ?? `Error del servidor (HTTP ${err.status}).`)
      } else {
        setUsuarioFormError('No se pudo conectar con el backend.')
      }
    } finally {
      setCreandoUsuario(false)
    }
  }

  const toggleRolNuevoUsuario = (rol: string) => {
    setNuevoUsuario((prev) => ({
      ...prev,
      roles: prev.roles.includes(rol)
        ? prev.roles.filter((r) => r !== rol)
        : [...prev.roles, rol],
    }))
  }

  const handleToggleActivo = async (u: UsuarioResponse) => {
    setUsuarioBusy(u.id)
    try {
      await usuariosApi.actualizar(u.id, { activo: !u.activo })
      loadUsuarios()
    } catch (err) {
      alert(
        err instanceof ApiCallError && (err.status === 401 || err.status === 403)
          ? 'Solo los administradores pueden gestionar usuarios.'
          : 'Error al actualizar el usuario.',
      )
    } finally {
      setUsuarioBusy(null)
    }
  }

  useEffect(() => {
    if (user?.roles?.includes('ADMIN')) {
      setLoadingPgms(true)
      programasApi
        .listar()
        .then((list) => {
          setProgramas(list)
          if (list.length > 0) setSelectedPgm(list[0].id)
        })
        .catch(() => {})
        .finally(() => setLoadingPgms(false))
    }
  }, [user])

  const handleSoftDeletePrograma = async () => {
    if (!selectedPgm) return
    const pgm = programas.find((p) => p.id === selectedPgm)
    if (
      !confirm(
        `¿Estás seguro de que deseas desactivar todos los estudiantes del programa "${pgm?.nombre}"? Pasarán a la papelera.`,
      )
    )
      return
    setBusyAction('soft-delete')
    try {
      const res = await adminApi.softDeletePrograma(selectedPgm)
      alert(`Éxito: Se enviaron ${res.eliminados} estudiantes a la papelera.`)
    } catch {
      alert('Error al realizar la desactivación masiva.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleResetPrograma = async () => {
    if (!selectedPgm) return
    const pgm = programas.find((p) => p.id === selectedPgm)
    if (
      !confirm(
        `¡ADVERTENCIA CRÍTICA! ¿Estás seguro de resetear el programa "${pgm?.nombre}"?\nSe eliminarán físicamente todos los estudiantes, matches, notificaciones, certificaciones y configuraciones de LinkedIn vinculados a este programa. Esta acción es irreversible.`,
      )
    )
      return
    setBusyAction('reset')
    try {
      const res = await adminApi.resetPrograma(selectedPgm)
      alert(
        `Éxito: Se eliminaron permanentemente ${res.estudiantesEliminados} estudiantes y todos sus registros asociados.`,
      )
    } catch {
      alert('Error al resetear el programa.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRestaurarPrograma = async () => {
    if (!selectedPgm) return
    const pgm = programas.find((p) => p.id === selectedPgm)
    if (
      !confirm(
        `¿Deseas restaurar todos los estudiantes de la papelera del programa "${pgm?.nombre}"?`,
      )
    )
      return
    setBusyAction('restore')
    try {
      const res = await adminApi.restaurarProgramaEstudiantes(selectedPgm)
      alert(`Éxito: ${res.mensaje}`)
    } catch {
      alert('Error al restaurar los estudiantes del programa.')
    } finally {
      setBusyAction(null)
    }
  }

  const handlePurgarPapelera = async () => {
    if (
      !confirm(
        '¿Deseas purgar de manera permanente todos los estudiantes que lleven más de 30 días en la papelera?',
      )
    )
      return
    setBusyAction('purge')
    try {
      const res = await adminApi.purgarPapelera()
      alert(`Éxito: Se eliminaron físicamente ${res.eliminados} estudiantes antiguos de la papelera.`)
    } catch {
      alert('Error al purgar la papelera.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleCleanupSystem = async () => {
    if (
      !confirm(
        '¡PELIGRO EXTREMO! ¿Estás seguro de que deseas vaciar por completo todo el sistema transaccional?\nSe eliminarán físicamente TODOS los estudiantes del sistema, vacantes, matches, habilidades y certificaciones. Sólo se conservarán los programas vacíos, empresas y usuarios administradores. Esta acción es irreversible.',
      )
    )
      return
    setBusyAction('cleanup')
    try {
      const res = await adminApi.cleanupSystem()
      alert(`Éxito: ${res.mensaje}`)
    } catch {
      alert('Error al limpiar el sistema transaccional.')
    } finally {
      setBusyAction(null)
    }
  }

  const themeOptions = [
    { id: 'light' as const, label: t('light'), icon: Sun },
    { id: 'dark' as const, label: t('dark'), icon: Moon },
    { id: 'system' as const, label: t('system'), icon: Monitor },
  ]

  const tabsNav: { id: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'institucion', label: 'Institución & Sede', icon: Bank },
    { id: 'academico', label: 'Parámetros Académicos', icon: Sliders },
    { id: 'integraciones', label: 'Integraciones & APIs', icon: ShareNetwork },
    { id: 'usuarios', label: 'Usuarios & Seguridad', icon: Shield },
    { id: 'mantenimiento', label: 'Apariencia & Mantenimiento', icon: Gear },
  ]

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Navegación por Pestañas Adaptable a Móvil, Tablet y Laptop */}
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [::-webkit-scrollbar]:hidden border-b border-border pb-2 min-w-0">
        {tabsNav.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── PESTAÑA 1: INFORMACIÓN INSTITUCIONAL ───────────────────────────── */}
      {activeTab === 'institucion' && (
        <form onSubmit={handleSaveInst}>
          <Card className="rounded-3xl">
            <CardHeader className="border-b border-border/60 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400 text-primary-foreground shadow-[0_10px_24px_-12px_rgba(18,104,232,0.8)]">
                    <Bank className="size-5" weight="duotone" />
                  </span>
                  <div>
                    <CardTitle className="text-lg">Perfil institucional</CardTitle>
                    <CardDescription className="mt-1 max-w-2xl leading-relaxed">
                      Información oficial utilizada en certificaciones, reportes y hojas de vida.
                    </CardDescription>
                  </div>
                </div>
                <Button type="submit" disabled={savingInst} size="lg" className="self-start">
                  {savingInst ? (
                    <CircleNotch className="size-4 animate-spin" />
                  ) : (
                    <FloppyDisk className="size-4" />
                  )}
                  Guardar cambios
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-5 pt-1">
              {instSuccess && (
                <div role="status" className="flex items-center gap-3 rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-300">
                  <span className="flex size-8 items-center justify-center rounded-full bg-green-500/15">
                    <CheckCircle className="size-4 shrink-0" weight="fill" />
                  </span>
                  <span>Datos institucionales actualizados y guardados con éxito.</span>
                </div>
              )}

              <SettingsSection
                icon={IdentificationCard}
                title="Identidad legal y sede"
                description="Datos que identifican oficialmente a la institución."
              >
                <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <FieldLabel required>Nombre oficial de la institución</FieldLabel>
                    <Input
                      className="h-11"
                      value={instData.nombreOficial}
                      onChange={(e) => setInstData((p) => ({ ...p, nombreOficial: e.target.value }))}
                      placeholder="Ej. Academy CAC"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <FieldLabel required>NIT / Identificación tributaria</FieldLabel>
                    <div className="relative">
                      <Certificate className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-11 pl-10"
                        value={instData.nit}
                        onChange={(e) => setInstData((p) => ({ ...p, nit: e.target.value }))}
                        placeholder="901.452.839-4"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <FieldLabel>Registro educativo o licencia</FieldLabel>
                    <Input
                      className="h-11"
                      value={instData.registroEducativo}
                      onChange={(e) => setInstData((p) => ({ ...p, registroEducativo: e.target.value }))}
                      placeholder="Resolución SED..."
                    />
                  </div>

                  <div className="flex flex-col gap-2 md:col-span-2">
                    <FieldLabel required>Dirección de la sede principal</FieldLabel>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-primary" weight="duotone" />
                      <Input
                        className="h-11 pl-10"
                        value={instData.sedePrincipal}
                        onChange={(e) => setInstData((p) => ({ ...p, sedePrincipal: e.target.value }))}
                        placeholder="Calle 79 # 50-24, Barranquilla"
                      />
                    </div>
                  </div>
                </div>
              </SettingsSection>

              <div className="grid gap-5 xl:grid-cols-2">
                <SettingsSection
                  icon={Phone}
                  title="Canales de contacto"
                  description="Medios de atención para estudiantes y empresas."
                >
                  <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <FieldLabel>Teléfono PBX</FieldLabel>
                      <Input
                        className="h-11"
                        value={instData.telefonoContacto}
                        onChange={(e) => setInstData((p) => ({ ...p, telefonoContacto: e.target.value }))}
                        placeholder="+57 (605) 385 9000"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <FieldLabel>WhatsApp institucional</FieldLabel>
                      <div className="relative">
                        <WhatsappLogo className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-green-500" weight="fill" />
                        <Input
                          className="h-11 pl-10"
                          value={instData.whatsappSoporte}
                          onChange={(e) => setInstData((p) => ({ ...p, whatsappSoporte: e.target.value }))}
                          placeholder="+57 300 123 4567"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <FieldLabel>Correo institucional</FieldLabel>
                      <Input
                        className="h-11"
                        type="email"
                        value={instData.emailContacto}
                        onChange={(e) => setInstData((p) => ({ ...p, emailContacto: e.target.value }))}
                        placeholder="contacto@academia.edu.co"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <FieldLabel>Correo de empleabilidad</FieldLabel>
                      <Input
                        className="h-11"
                        type="email"
                        value={instData.emailSoporte}
                        onChange={(e) => setInstData((p) => ({ ...p, emailSoporte: e.target.value }))}
                        placeholder="empleabilidad@academia.edu.co"
                      />
                    </div>
                  </div>
                </SettingsSection>

                <SettingsSection
                  icon={Globe}
                  title="Presencia digital"
                  description="Enlaces oficiales visibles en comunicaciones externas."
                >
                  <div className="grid gap-y-5">
                    <div className="flex flex-col gap-2">
                      <FieldLabel>Sitio web oficial</FieldLabel>
                      <div className="relative">
                        <Globe className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-primary" weight="duotone" />
                        <Input
                          className="h-11 pl-10"
                          value={instData.sitioWeb}
                          onChange={(e) => setInstData((p) => ({ ...p, sitioWeb: e.target.value }))}
                          placeholder="https://academia.edu.co"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <FieldLabel>LinkedIn institucional</FieldLabel>
                      <div className="relative">
                        <LinkedinLogo className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-[#0A66C2]" weight="fill" />
                        <Input
                          className="h-11 pl-10"
                          value={instData.linkedinUrl}
                          onChange={(e) => setInstData((p) => ({ ...p, linkedinUrl: e.target.value }))}
                          placeholder="https://linkedin.com/company/academia-cac"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <FieldLabel>Instagram institucional</FieldLabel>
                      <div className="relative">
                        <InstagramLogo className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-fuchsia-500" weight="duotone" />
                        <Input
                          className="h-11 pl-10"
                          value={instData.instagramUrl}
                          onChange={(e) => setInstData((p) => ({ ...p, instagramUrl: e.target.value }))}
                          placeholder="https://instagram.com/academiacac"
                        />
                      </div>
                    </div>
                  </div>
                </SettingsSection>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* ── PESTAÑA 2: PARÁMETROS ACADÉMICOS & EMPLEABILIDAD ───────────────── */}
      {activeTab === 'academico' && (
        <form onSubmit={handleSaveAcademic} className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sliders className="size-5 text-primary" /> Reglas de Negocio & Empleabilidad
                  </CardTitle>
                  <CardDescription>
                    Parámetros de cálculo del motor de matching, ciclo académico y alertas a empresas.
                  </CardDescription>
                </div>
                <Button type="submit" disabled={savingAcademic} size="sm">
                  {savingAcademic ? (
                    <CircleNotch className="size-4 animate-spin mr-1" />
                  ) : (
                    <FloppyDisk className="size-4 mr-1" />
                  )}
                  Guardar Reglas
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-6">
              {academicSuccess && (
                <div role="status" className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 p-3 text-xs font-medium text-green-600 dark:text-green-400">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>Reglas académicas y de empleabilidad guardadas correctamente.</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cohorte / Período Activo *
                  </label>
                  <Input
                    value={academicData.cohorteActiva}
                    onChange={(e) => setAcademicData((p) => ({ ...p, cohorteActiva: e.target.value }))}
                    placeholder="2026-I"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Umbral Mínimo de Match (%) *
                  </label>
                  <Input
                    type="number"
                    min="10"
                    max="100"
                    value={academicData.umbralMatchMinimo}
                    onChange={(e) => setAcademicData((p) => ({ ...p, umbralMatchMinimo: e.target.value }))}
                    placeholder="70"
                  />
                  <span className="text-[10px] text-muted-foreground">Porcentaje mínimo de habilidades para sugerir match.</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Días en Papelera antes de Purga
                  </label>
                  <Input
                    type="number"
                    min="7"
                    max="365"
                    value={academicData.diasRetencionPapelera}
                    onChange={(e) => setAcademicData((p) => ({ ...p, diasRetencionPapelera: e.target.value }))}
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">Alertas & Automatización</h3>
                <label className="flex items-center gap-3 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={academicData.alertaNotificarEmpresa}
                    onChange={(e) => setAcademicData((p) => ({ ...p, alertaNotificarEmpresa: e.target.checked }))}
                    className="size-4 cursor-pointer"
                  />
                  <span>Enviar alerta por correo a la empresa cuando un candidato supera el 85% de match.</span>
                </label>

                <label className="flex items-center gap-3 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={academicData.alertaNuevoEstudiante}
                    onChange={(e) => setAcademicData((p) => ({ ...p, alertaNuevoEstudiante: e.target.checked }))}
                    className="size-4 cursor-pointer"
                  />
                  <span>Notificar al coordinador de área cuando se matricule un nuevo estudiante.</span>
                </label>

                <label className="flex items-center gap-3 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={academicData.requerirLinkedInObligatorio}
                    onChange={(e) => setAcademicData((p) => ({ ...p, requerirLinkedInObligatorio: e.target.checked }))}
                    className="size-4 cursor-pointer"
                  />
                  <span>Requerir perfil de LinkedIn validado antes de exportar hoja de vida a empresas.</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* ── PESTAÑA 3: INTEGRACIONES & APIS ────────────────────────────────── */}
      {activeTab === 'integraciones' && (
        <form onSubmit={handleSaveIntegration} className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShareNetwork className="size-5 text-primary" /> Servicios Externos e Integraciones
                  </CardTitle>
                  <CardDescription>
                    Parámetros de conexión con SendGrid (emails), Power BI, LinkedIn Jobs y almacenamiento en nube.
                  </CardDescription>
                </div>
                <Button type="submit" disabled={savingIntegration} size="sm">
                  {savingIntegration ? (
                    <CircleNotch className="size-4 animate-spin mr-1" />
                  ) : (
                    <FloppyDisk className="size-4 mr-1" />
                  )}
                  Guardar Conexiones
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-6">
              {integrationSuccess && (
                <div role="status" className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 p-3 text-xs font-medium text-green-600 dark:text-green-400">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>Parámetros de conexión de integraciones guardados correctamente.</span>
                </div>
              )}

              {/* SMTP */}
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-secondary/10">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <EnvelopeSimple className="size-4 text-primary" /> Servidor SMTP Transaccional (Emails)
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={integrationData.smtpHost}
                    onChange={(e) => setIntegrationData((p) => ({ ...p, smtpHost: e.target.value }))}
                    placeholder="smtp.sendgrid.net"
                  />
                  <Input
                    value={integrationData.smtpPort}
                    onChange={(e) => setIntegrationData((p) => ({ ...p, smtpPort: e.target.value }))}
                    placeholder="587"
                  />
                </div>
              </div>

              {/* Power BI & LinkedIn */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-secondary/10">
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <Database className="size-4 text-amber-500" /> Power BI Embedded Workspace
                  </h3>
                  <Input
                    value={integrationData.powerBiWorkspaceId}
                    onChange={(e) => setIntegrationData((p) => ({ ...p, powerBiWorkspaceId: e.target.value }))}
                    placeholder="Workspace ID"
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-secondary/10">
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <LinkedinLogo className="size-4 text-[#0A66C2]" /> LinkedIn Jobs API Client ID
                  </h3>
                  <Input
                    value={integrationData.linkedInClientId}
                    onChange={(e) => setIntegrationData((p) => ({ ...p, linkedInClientId: e.target.value }))}
                    placeholder="Client ID"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* ── PESTAÑA 4: USUARIOS & SEGURIDAD ────────────────────────────────── */}
      {activeTab === 'usuarios' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Perfil del Usuario Actual */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4 text-primary" /> Perfil de Usuario en Sesión
                </CardTitle>
                <CardDescription>Información del usuario actualmente autenticado.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold shrink-0">
                    {user?.iniciales ?? 'AD'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{user?.nombre ?? 'Administrador'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email ?? 'admin@academia.edu.co'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Rol Principal</span>
                    <Badge variant="outline" className="mt-0.5">{user?.roles?.[0] ?? 'ADMIN'}</Badge>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">ID de Usuario</span>
                    <span className="font-mono text-muted-foreground">{user?.usuarioId ? user.usuarioId.slice(0, 8) + '…' : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estado de Seguridad JWT */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="size-4 text-primary" /> Estado de la Sesión & Seguridad
                </CardTitle>
                <CardDescription>Validación del token JWT y políticas de acceso.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 px-3 py-2.5">
                  <CheckCircle className="size-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">Token JWT firmado y verificado</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>• El token se guarda en una cookie HttpOnly, inaccesible desde el navegador.</p>
                  <p>• La sesión caduca a las 8 horas y se renueva sola durante 7 días.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Usuarios (Solo ADMIN) */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-5 text-primary" /> Usuarios Administradores & Coordinadores
                  </CardTitle>
                  <CardDescription>Gestión de cuentas con acceso al CRM de Academy CAC.</CardDescription>
                </div>
                {!sinPermisoUsuarios && (
                  <Button variant="outline" size="sm" onClick={loadUsuarios} disabled={loadingUsuarios}>
                    <ArrowsClockwise className="size-3.5 mr-1" /> Refrescar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-6">
              {sinPermisoUsuarios ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
                  <Shield className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Solo los usuarios con rol ADMIN pueden gestionar usuarios.</span>
                </div>
              ) : (
                <>
                  {/* Formulario Crear Usuario */}
                  <form onSubmit={handleCrearUsuario} className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-secondary/10">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Crear Nuevo Usuario</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nombre Completo *</label>
                        <Input
                          value={nuevoUsuario.nombre}
                          onChange={(e) => setNuevoUsuario((p) => ({ ...p, nombre: e.target.value }))}
                          placeholder="Nombre y apellido"
                          disabled={creandoUsuario}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email *</label>
                        <Input
                          type="email"
                          value={nuevoUsuario.email}
                          onChange={(e) => setNuevoUsuario((p) => ({ ...p, email: e.target.value }))}
                          placeholder="coordinador@academia.edu.co"
                          disabled={creandoUsuario}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contraseña * (mín. 8)</label>
                        <Input
                          type="password"
                          minLength={8}
                          value={nuevoUsuario.password}
                          onChange={(e) => setNuevoUsuario((p) => ({ ...p, password: e.target.value }))}
                          placeholder="••••••••"
                          disabled={creandoUsuario}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Roles:</span>
                      {ROLES_DISPONIBLES.map((rol) => (
                        <label key={rol} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={nuevoUsuario.roles.includes(rol)}
                            onChange={() => toggleRolNuevoUsuario(rol)}
                            disabled={creandoUsuario}
                            className="size-4 cursor-pointer"
                          />
                          {rol}
                        </label>
                      ))}
                      <div className="ml-auto">
                        <Button type="submit" size="sm" disabled={creandoUsuario}>
                          {creandoUsuario ? (
                            <><CircleNotch className="size-3.5 animate-spin mr-1" /> Creando…</>
                          ) : (
                            <><Plus className="size-3.5 mr-1" /> Crear Usuario</>
                          )}
                        </Button>
                      </div>
                    </div>
                    {usuarioFormError && (
                      <div role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        <WarningCircle className="mt-0.5 size-4 shrink-0" />
                        <span>{usuarioFormError}</span>
                      </div>
                    )}
                  </form>

                  {/* Lista de Usuarios */}
                  {loadingUsuarios ? (
                    <div className="flex items-center justify-center py-8">
                      <PageSpinner />
                      <span className="ml-2 text-xs text-muted-foreground">Cargando cuentas…</span>
                    </div>
                  ) : usuariosError ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <WarningCircle className="size-6 text-destructive" />
                      <p className="text-xs text-destructive">{usuariosError}</p>
                    </div>
                  ) : usuarios.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <Users className="size-8 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">No hay usuarios adicionales registrados.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-secondary/50">
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Nombre</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Roles</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {usuarios.map((u) => (
                            <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-3 font-semibold text-foreground">{u.nombre}</td>
                              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {u.roles.map((r) => (
                                    <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <EstadoDot
                                  label={u.activo ? 'Activo' : 'Inactivo'}
                                  dot={u.activo ? 'bg-success' : 'bg-muted-foreground/40'}
                                  text={u.activo ? 'text-[#0F6E56]' : 'text-muted-foreground'}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    disabled={usuarioBusy === u.id}
                                    onClick={() => handleToggleActivo(u)}
                                  >
                                    {usuarioBusy === u.id ? <CircleNotch className="size-3 animate-spin" /> : (u.activo ? 'Inactivar' : 'Activar')}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Cuentas de los estudiantes. Aparte de la tabla de arriba porque
              son otro tipo de cuenta —rol ESTUDIANTE, alta masiva, sin
              contrasena que nadie teclee— y porque basta con COORDINADOR. */}
          <PanelCuentasEstudiante />
        </div>
      )}

      {/* ── PESTAÑA 5: APARIENCIA & MANTENIMIENTO ──────────────────────────── */}
      {activeTab === 'mantenimiento' && (
        <div className="flex flex-col gap-6">
          {/* Identidad de cada proyecto. Va antes que el tema claro/oscuro
              porque es lo que ve el cliente; el tema es preferencia personal. */}
          <PanelBranding />

          {/* Apariencia */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-5 text-primary" /> {t('interfaceAppearance')}
              </CardTitle>
              <CardDescription>{t('interfaceAppearanceDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-3 sm:max-w-md">
                {themeOptions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 ${
                      theme === t.id
                        ? 'border-primary bg-primary/10 shadow-md scale-105'
                        : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                    }`}
                  >
                    <t.icon className={`size-6 ${theme === t.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-semibold ${theme === t.id ? 'text-primary' : 'text-muted-foreground'}`}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-7 border-t border-border/60 pt-6 sm:max-w-md">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{t('language')}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('languageDescription')}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([
                    ['es', t('spanish')],
                    ['en', t('english')],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLocale(value)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                        locale === value
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-secondary/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acciones Masivas y Limpieza (ADMIN) */}
          {user?.roles?.includes('ADMIN') && (
            <Card className="rounded-2xl shadow-sm border-destructive/30">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <ShieldWarning className="size-5" /> Mantenimiento Transaccional & Zona de Peligro
                </CardTitle>
                <CardDescription>
                  Operaciones masivas de limpieza de datos en la base de datos de Academy CAC.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                {/* Operaciones por Programa */}
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-secondary/10">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Acciones Masivas por Programa Académico</h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <label className="text-xs font-medium text-muted-foreground">Seleccionar Programa:</label>
                      {loadingPgms ? (
                        <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
                          <CircleNotch className="size-3.5 animate-spin" /> Cargando lista...
                        </div>
                      ) : (
                        <select
                          className="h-9 rounded-xl border border-input bg-background px-3 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring"
                          value={selectedPgm}
                          onChange={(e) => setSelectedPgm(e.target.value)}
                        >
                          {programas.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-xl"
                        disabled={!!busyAction || !selectedPgm}
                        onClick={handleRestaurarPrograma}
                      >
                        {busyAction === 'restore' ? <CircleNotch className="size-3.5 animate-spin mr-1" /> : null}
                        Restaurar Todo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        disabled={!!busyAction || !selectedPgm}
                        onClick={handleSoftDeletePrograma}
                      >
                        {busyAction === 'soft-delete' ? <CircleNotch className="size-3.5 animate-spin mr-1" /> : null}
                        Desactivar Todo
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="text-xs rounded-xl"
                        disabled={!!busyAction || !selectedPgm}
                        onClick={handleResetPrograma}
                      >
                        {busyAction === 'reset' ? <CircleNotch className="size-3.5 animate-spin mr-1" /> : null}
                        Resetear Programa
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Purga Global */}
                <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 p-4 bg-destructive/5">
                  <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider">Purga Global de Datos Transaccionales</h3>
                  <p className="text-xs text-muted-foreground">
                    Eliminación permanente de estudiantes inactivos o vaciado del entorno de prueba.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={!!busyAction}
                      onClick={handlePurgarPapelera}
                    >
                      {busyAction === 'purge' ? <CircleNotch className="size-3.5 animate-spin mr-1" /> : null}
                      Purgar Papelera (&gt;30 días)
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="text-xs rounded-xl"
                      disabled={!!busyAction}
                      onClick={handleCleanupSystem}
                    >
                      {busyAction === 'cleanup' ? <CircleNotch className="size-3.5 animate-spin mr-1" /> : null}
                      Limpiar CRM Transaccional
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
