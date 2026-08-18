'use client'

/**
 * Los dos bancos de informes.
 *
 * Existen por una diferencia que hasta ahora no estaba en ninguna parte: **a
 * quién va dirigido el archivo**. Los cuatro informes de siempre son internos;
 * cuando una empresa pedía candidatos, lo que había a mano era el de
 * estudiantes, y ese lleva documento, correo y celular. Salía del CRM, se
 * adjuntaba a un correo y ya estaba fuera de la institución. Nadie decidió
 * ceder esos datos: era el botón que estaba ahí.
 *
 * Por eso el banco de perfiles va **primero y con el aviso de qué no lleva**.
 * Un archivo seguro que nadie encuentra no sirve de nada; el que hay que
 * encontrar antes es el que se puede mandar fuera.
 */

import { useState } from 'react'
import { Download, Building2, ChartColumn, ShieldCheck } from 'lucide-react'
import { reportesApi, type TipoDeReporte } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/lib/preferences'

function textos(english: boolean) {
  return english
    ? {
        paraEmpresas: 'Candidate profile bank',
        paraEmpresasDesc:
          'Standardized report for partner employers: education, professional experience, English proficiency, and skills.',
        sinDatos: 'Anonymized document: Excludes national ID, email, phone, and address to safeguard participant privacy under data protection regulations.',
        interno: 'Executive cohort overview',
        internoDesc:
          'Consolidated management report with programme progress metrics and outcomes. PDF includes graphs; spreadsheet contains data tables.',
        soloEquipo: 'Aggregated analytics: counts by municipality, English level, academic status, and time evolution.',
        conGraficos: 'PDF with charts',
        descargando: 'Generating report…',
      }
    : {
        paraEmpresas: 'Banco de perfiles laborales',
        paraEmpresasDesc:
          'Reporte estandarizado para empresas aliadas: formación, experiencia laboral, nivel de inglés y habilidades clave.',
        sinDatos: 'Documento anonimizado: No incluye documento de identidad, correo, teléfono ni dirección para proteger la privacidad del participante.',
        interno: 'Panorama ejecutivo de la cohorte',
        internoDesc:
          'Reporte gerencial consolidado con métricas de avance y resultados del programa. El PDF incluye gráficos; la hoja contiene tablas de datos.',
        soloEquipo: 'Estadísticas agregadas por municipio, nivel de inglés, estado académico y evolución temporal.',
        conGraficos: 'PDF con gráficos',
        descargando: 'Generando reporte…',
      }
}

function BotonesDeDescarga({
  tipo,
  etiquetaPdf,
}: {
  tipo: TipoDeReporte
  etiquetaPdf: string
}) {
  const [bajando, setBajando] = useState<string | null>(null)
  const T = textos(usePreferences().locale === 'en')

  const bajar = async (formato: 'xlsx' | 'pdf' | 'csv') => {
    setBajando(formato)
    try {
      await reportesApi.exportar(tipo, formato)
    } finally {
      setBajando(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={bajando !== null} onClick={() => void bajar('pdf')}>
        <Download className="size-3.5 text-rose-600" strokeWidth={2} />
        {bajando === 'pdf' ? T.descargando : etiquetaPdf}
      </Button>
      <Button variant="outline" size="sm" disabled={bajando !== null} onClick={() => void bajar('xlsx')}>
        <Download className="size-3.5 text-emerald-600" strokeWidth={2} />
        {bajando === 'xlsx' ? T.descargando : 'Excel'}
      </Button>
      <Button variant="outline" size="sm" disabled={bajando !== null} onClick={() => void bajar('csv')}>
        <Download className="size-3.5 text-sky-600" strokeWidth={2} />
        {bajando === 'csv' ? T.descargando : 'CSV'}
      </Button>
    </div>
  )
}

export function BancosDeInformes() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-lg border-border shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" strokeWidth={2} />
            {T.paraEmpresas}
          </CardTitle>
          <CardDescription>{T.paraEmpresasDesc}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* El aviso va en la tarjeta, no en la documentación: quien descarga
              esto está a punto de adjuntarlo a un correo, y es ahí donde tiene
              que saber qué lleva y qué no. */}
          <p className="flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
            {T.sinDatos}
          </p>
          <BotonesDeDescarga tipo="perfiles-laborales" etiquetaPdf="PDF" />
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartColumn className="size-4 text-primary" strokeWidth={2} />
            {T.interno}
          </CardTitle>
          <CardDescription>{T.internoDesc}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="rounded-md border border-border bg-secondary/40 p-2.5 text-xs text-muted-foreground">
            {T.soloEquipo}
          </p>
          <BotonesDeDescarga tipo="panorama" etiquetaPdf={T.conGraficos} />
        </CardContent>
      </Card>
    </div>
  )
}
