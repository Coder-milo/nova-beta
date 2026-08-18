'use client'

/**
 * Identidad de la institución: datos legales, canales de contacto y presencia
 * digital.
 *
 * Se guardaba en `localStorage` bajo `nova_inst_config`. Eso significaba que
 * cada navegador tenía su propia versión del NIT y de la dirección de la sede,
 * que todo se perdía al limpiar la caché, y que el coordinador y el
 * administrador podían estar mirando datos distintos sin que ninguno lo
 * supiera. Ahora va al servidor.
 *
 * Lo que hubiera en el navegador no se tira: si el servidor todavía no tiene
 * nada guardado, el formulario se rellena con lo que había ahí y se avisa de
 * que hace falta guardar para subirlo. La clave local se borra tras el primer
 * guardado correcto.
 *
 * Requiere COORDINADOR o ADMIN para guardar.
 */

import { useCallback, useEffect, useState } from 'react'
import { Award as Certificate, CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, Globe, IdCard as IdentificationCard, Info, Landmark as Bank, LoaderCircle as CircleNotch, MapPin, Phone, RefreshCw as ArrowsClockwise, Save as FloppyDisk } from 'lucide-react'
import { InstagramLogo, LinkedinLogo, WhatsappLogo } from '@/components/ui/iconos-de-marca'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldLabel, SettingsSection } from '@/components/admin/settings-section'
import { configuracionApi } from '@/lib/api'
import { errorDeGestion } from '@/lib/errores'
import type { ConfiguracionGlobalResponse } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

const CLAVE_LEGADA = 'nova_inst_config'

type Formulario = {
  nombreOficial: string
  nit: string
  registroEducativo: string
  sedePrincipal: string
  telefonoContacto: string
  whatsappSoporte: string
  emailContacto: string
  emailSoporte: string
  sitioWeb: string
  linkedinUrl: string
  instagramUrl: string
}

const VACIO: Formulario = {
  nombreOficial: '',
  nit: '',
  registroEducativo: '',
  sedePrincipal: '',
  telefonoContacto: '',
  whatsappSoporte: '',
  emailContacto: '',
  emailSoporte: '',
  sitioWeb: '',
  linkedinUrl: '',
  instagramUrl: '',
}

function deLaRespuesta(c: ConfiguracionGlobalResponse): Formulario {
  return {
    nombreOficial: c.nombreOficial ?? '',
    nit: c.nit ?? '',
    registroEducativo: c.registroEducativo ?? '',
    sedePrincipal: c.sedePrincipal ?? '',
    telefonoContacto: c.telefonoContacto ?? '',
    whatsappSoporte: c.whatsappSoporte ?? '',
    emailContacto: c.emailContacto ?? '',
    emailSoporte: c.emailSoporte ?? '',
    sitioWeb: c.sitioWeb ?? '',
    linkedinUrl: c.linkedinUrl ?? '',
    instagramUrl: c.instagramUrl ?? '',
  }
}

/** Lo que dejó la versión anterior en este navegador, si es que hay algo. */
function delNavegador(): Partial<Formulario> | null {
  try {
    const bruto = localStorage.getItem(CLAVE_LEGADA)
    return bruto ? (JSON.parse(bruto) as Partial<Formulario>) : null
  } catch {
    return null
  }
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        estosDatosVienen: 'This data comes from the previous version, which kept it only in this browser. Save it to upload it to the server so the whole team can see it.',
        datosOficialesDe: 'Official institution data, stored on the server and shared across the team.',
        todaviaNoHay: 'There is no institution data stored on the server yet.',
        datosInstitucionalesGuardados: 'Institution data stored on the server.',
        datosQueIdentifican: 'Data that officially identifies the institution.',
        mediosDeAtencion: 'Support channels for students and companies.',
        nombreOficialDe: 'Official name of the institution',
        nitIdentificacionTributaria: 'Tax ID',
        registroEducativoO: 'Education registration or licence',
        direccionDeLa: 'Main site address',
        correoDeEmpleabilidad: 'Employability email',
        identidadLegalY: 'Legal identity and site',
        canalesDeContacto: 'Contact channels',
        resolucionSed: 'SED resolution…',
        telefonoPbx: 'Switchboard number',
      }
    : {
        estosDatosVienen: 'Estos datos vienen de la versión anterior, que los guardaba solo en este navegador. Guarda para subirlos al servidor y que los vea todo el equipo.',
        datosOficialesDe: 'Datos oficiales de la institución, guardados en el servidor y compartidos por todo el equipo.',
        todaviaNoHay: 'Todavía no hay datos institucionales guardados en el servidor.',
        datosInstitucionalesGuardados: 'Datos institucionales guardados en el servidor.',
        datosQueIdentifican: 'Datos que identifican oficialmente a la institución.',
        mediosDeAtencion: 'Medios de atención para estudiantes y empresas.',
        nombreOficialDe: 'Nombre oficial de la institución',
        nitIdentificacionTributaria: 'NIT / Identificación tributaria',
        registroEducativoO: 'Registro educativo o licencia',
        direccionDeLa: 'Dirección de la sede principal',
        correoDeEmpleabilidad: 'Correo de empleabilidad',
        identidadLegalY: 'Identidad legal y sede',
        canalesDeContacto: 'Canales de contacto',
        resolucionSed: 'Resolución SED…',
        telefonoPbx: 'Teléfono PBX',
      }
}

export function PanelInstitucion() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [config, setConfig] = useState<ConfiguracionGlobalResponse | null>(null)
  const [form, setForm] = useState<Formulario>(VACIO)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vieneDelNavegador, setVieneDelNavegador] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    setGuardado(false)
    try {
      const c = await configuracionApi.obtener()
      setConfig(c)

      const local = c.guardado ? null : delNavegador()
      setForm(local ? { ...VACIO, ...local } : deLaRespuesta(c))
      setVieneDelNavegador(Boolean(local))
    } catch (err) {
      setError(errorDeGestion(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const editar = (campo: keyof Formulario, valor: string) => {
    setForm((previo) => ({ ...previo, [campo]: valor }))
    setGuardado(false)
  }

  const guardar = async (evento: React.SyntheticEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!config) return

    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      // Los parámetros académicos viajan tal y como llegaron: este formulario
      // no los edita, y mandarlos vacíos los borraría desde una pantalla que
      // ni siquiera los enseña.
      const actualizada = await configuracionApi.guardar({
        ...form,
        cohorteActiva: config.cohorteActiva,
        umbralMatchMinimo: config.umbralMatchMinimo,
        diasRetencionPapelera: config.diasRetencionPapelera,
      })
      setConfig(actualizada)
      setForm(deLaRespuesta(actualizada))
      setGuardado(true)

      // Ya está en el servidor: la copia del navegador solo puede volver a
      // desincronizarse.
      try {
        localStorage.removeItem(CLAVE_LEGADA)
      } catch {
        // Un navegador que no deja tocar localStorage no impide guardar.
      }
      setVieneDelNavegador(false)
    } catch (err) {
      setError(errorDeGestion(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar}>
      <Card className="rounded-3xl">
        <CardHeader className="border-b border-border/60 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400 text-primary-foreground shadow-[0_10px_24px_-12px_rgba(18,104,232,0.8)]">
                <Bank className="size-5" />
              </span>
              <div>
                <CardTitle className="text-lg">Perfil institucional</CardTitle>
                <CardDescription className="mt-1 max-w-2xl leading-relaxed">{T.datosOficialesDe}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start">
              <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={cargando || guardando}>
                <ArrowsClockwise className="mr-1 size-3.5" /> Recargar
              </Button>
              <Button type="submit" size="lg" disabled={cargando || guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : <FloppyDisk className="size-4" />}
                Guardar cambios
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-1">
          {cargando && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleNotch className="size-4 animate-spin" /> Cargando…
            </p>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {guardado && (
            <div role="status" className="flex items-center gap-3 rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-300">
              <span className="flex size-8 items-center justify-center rounded-full bg-green-500/15">
                <CheckCircle className="size-4 shrink-0" />
              </span>
              <span>{T.datosInstitucionalesGuardados}</span>
            </div>
          )}

          {vieneDelNavegador && !guardado && (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>{T.estosDatosVienen}</span>
            </div>
          )}

          {!cargando && config && !config.guardado && !vieneDelNavegador && (
            <p className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
              {T.todaviaNoHay}
            </p>
          )}

          <SettingsSection
            icon={IdentificationCard}
            title={T.identidadLegalY}
            description={T.datosQueIdentifican}
          >
            <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
              <div className="flex flex-col gap-2 md:col-span-2">
                <FieldLabel>{T.nombreOficialDe}</FieldLabel>
                <Input
                  className="h-11"
                  value={form.nombreOficial}
                  onChange={(e) => editar('nombreOficial', e.target.value)}
                  placeholder="Ej. Academy CAC"
                  disabled={cargando}
                />
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel>{T.nitIdentificacionTributaria}</FieldLabel>
                <div className="relative">
                  <Certificate className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 pl-10"
                    value={form.nit}
                    onChange={(e) => editar('nit', e.target.value)}
                    placeholder="901.452.839-4"
                    disabled={cargando}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel>{T.registroEducativoO}</FieldLabel>
                <Input
                  className="h-11"
                  value={form.registroEducativo}
                  onChange={(e) => editar('registroEducativo', e.target.value)}
                  placeholder={T.resolucionSed}
                  disabled={cargando}
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <FieldLabel>{T.direccionDeLa}</FieldLabel>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-primary" />
                  <Input
                    className="h-11 pl-10"
                    value={form.sedePrincipal}
                    onChange={(e) => editar('sedePrincipal', e.target.value)}
                    placeholder="Calle 79 # 50-24, Barranquilla"
                    disabled={cargando}
                  />
                </div>
              </div>
            </div>
          </SettingsSection>

          <div className="grid gap-5 xl:grid-cols-2">
            <SettingsSection
              icon={Phone}
              title={T.canalesDeContacto}
              description={T.mediosDeAtencion}
            >
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <FieldLabel>{T.telefonoPbx}</FieldLabel>
                  <Input
                    className="h-11"
                    value={form.telefonoContacto}
                    onChange={(e) => editar('telefonoContacto', e.target.value)}
                    placeholder="+57 (605) 385 9000"
                    disabled={cargando}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>WhatsApp institucional</FieldLabel>
                  <div className="relative">
                    <WhatsappLogo className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-green-500" />
                    <Input
                      className="h-11 pl-10"
                      value={form.whatsappSoporte}
                      onChange={(e) => editar('whatsappSoporte', e.target.value)}
                      placeholder="+57 300 123 4567"
                      disabled={cargando}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Número de atención publicado. El canal que envía los avisos automáticos
                    se configura aparte, en Apariencia &amp; Mantenimiento.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>Correo institucional</FieldLabel>
                  <Input
                    className="h-11"
                    type="email"
                    value={form.emailContacto}
                    onChange={(e) => editar('emailContacto', e.target.value)}
                    placeholder="contacto@academia.edu.co"
                    disabled={cargando}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>{T.correoDeEmpleabilidad}</FieldLabel>
                  <Input
                    className="h-11"
                    type="email"
                    value={form.emailSoporte}
                    onChange={(e) => editar('emailSoporte', e.target.value)}
                    placeholder="empleabilidad@academia.edu.co"
                    disabled={cargando}
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
                    <Globe className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-primary" />
                    <Input
                      className="h-11 pl-10"
                      value={form.sitioWeb}
                      onChange={(e) => editar('sitioWeb', e.target.value)}
                      placeholder="https://academia.edu.co"
                      disabled={cargando}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>LinkedIn institucional</FieldLabel>
                  <div className="relative">
                    <LinkedinLogo className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-[#0A66C2]" />
                    <Input
                      className="h-11 pl-10"
                      value={form.linkedinUrl}
                      onChange={(e) => editar('linkedinUrl', e.target.value)}
                      placeholder="https://linkedin.com/company/academia-cac"
                      disabled={cargando}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>Instagram institucional</FieldLabel>
                  <div className="relative">
                    <InstagramLogo className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-fuchsia-500" />
                    <Input
                      className="h-11 pl-10"
                      value={form.instagramUrl}
                      onChange={(e) => editar('instagramUrl', e.target.value)}
                      placeholder="https://instagram.com/academiacac"
                      disabled={cargando}
                    />
                  </div>
                </div>
              </div>
            </SettingsSection>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Estos datos quedan como registro de la institución. Todavía no se imprimen
            solos en certificados ni en los correos: la cabecera y el pie de los correos se
            configuran en Apariencia &amp; Mantenimiento.
          </p>
        </CardContent>
      </Card>
    </form>
  )
}
