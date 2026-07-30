'use client'

/**
 * Alta y corrección de una oferta a mano.
 *
 * <p>El backend aceptaba `POST /api/v1/vacantes` desde el principio y ninguna
 * pantalla lo llamaba: solo se podían tener vacantes escaneando portales. Las
 * ofertas que el equipo consigue por su cuenta —ferias, empresas aliadas, un
 * contacto— son justo las que no están en ningún portal, y eran las únicas que
 * no se podían registrar.
 *
 * <p><strong>El enlace no es obligatorio.</strong> El backend pide enlace *o*
 * título (`VacanteRequest.isIdentificable`) y aquí se refleja igual: exigir URL
 * dejaba fuera las ofertas de feria.
 */

import { useState } from 'react'
import { Aviso, Campo, Selector } from '@/components/ui/campo'
import { FormSheet } from '@/components/ui/form-sheet'
import { Input } from '@/components/ui/input'
import { vacantesApi } from '@/lib/api'
import { errorDeGestion } from '@/lib/errores'
import type { CrearVacante, VacanteResponse } from '@/lib/types'

import { Textarea } from '@/components/ui/textarea'
const MODALIDADES = ['Presencial', 'Remoto', 'Híbrido']
const JORNADAS = ['Tiempo completo', 'Medio tiempo', 'Por horas']
const TIPOS_CONTRATO = [
  'Indefinido',
  'Término fijo',
  'Obra o labor',
  'Prestación de servicios',
  'Aprendizaje',
]
const NIVELES_INGLES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const VACIA: CrearVacante = {
  url: '',
  titulo: '',
  empresaNombre: '',
  ciudad: '',
  ubicacion: '',
  modalidadTrabajo: '',
  jornada: '',
  tipoContrato: '',
  rangoSalarial: '',
  nivelInglesRequerido: '',
  descripcion: '',
  requisitos: '',
}

/** Pasa una vacante existente al formato del formulario. */
export function aFormulario(v: VacanteResponse): CrearVacante {
  return {
    url: v.urlOrigen ?? '',
    titulo: v.titulo ?? '',
    empresaNombre: v.empresaNombre ?? '',
    ciudad: v.ciudad ?? '',
    ubicacion: v.ubicacion ?? '',
    modalidadTrabajo: v.modalidadTrabajo ?? '',
    jornada: v.jornada ?? '',
    tipoContrato: v.tipoContrato ?? '',
    rangoSalarial: v.rangoSalarial ?? '',
    nivelInglesRequerido: v.nivelInglesRequerido ?? '',
    aniosExperienciaRequeridos: v.aniosExperienciaRequeridos ?? undefined,
    descripcion: v.descripcion ?? '',
    requisitos: v.requisitos ?? '',
    urlAplicar: v.urlAplicar ?? '',
  }
}

export function FormularioVacante({
  abierto,
  inicial,
  vacanteId,
  onGuardada,
  onCancelar,
}: {
  abierto: boolean
  /** Omitir para un alta en blanco. */
  inicial?: CrearVacante
  /** Presente = edición. */
  vacanteId?: string
  onGuardada: (v: VacanteResponse) => void
  onCancelar: () => void
}) {
  const base = inicial ?? VACIA
  const [datos, setDatos] = useState<CrearVacante>(base)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sucio = JSON.stringify(datos) !== JSON.stringify(base)
  const listo =
    (datos.url?.trim().length ?? 0) > 0 || (datos.titulo?.trim().length ?? 0) > 0

  const campo = (clave: keyof CrearVacante) => (valor: string) =>
    setDatos({ ...datos, [clave]: valor })

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      // Las cadenas vacías se quitan: el backend las validaría como formato
      // inválido (una URL "" no pasa el patrón `^$|^https?://`... y un `Size`
      // vacío tampoco aporta nada).
      const limpio = Object.fromEntries(
        Object.entries(datos).filter(([, v]) => typeof v !== 'string' || v.trim() !== ''),
      ) as CrearVacante
      const guardada = vacanteId
        ? await vacantesApi.actualizar(vacanteId, limpio)
        : await vacantesApi.crear(limpio)
      onGuardada(guardada)
    } catch (err) {
      setError(errorDeGestion(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <FormSheet
      open={abierto}
      onOpenChange={(v) => !v && onCancelar()}
      titulo={vacanteId ? 'Editar oferta' : 'Registrar una oferta'}
      descripcion="Con el enlace basta: el título y la descripción se leen de la página. Si la oferta no está en ningún portal, escríbela a mano."
      sucio={sucio}
      guardando={guardando}
      puedeGuardar={listo}
      textoGuardar={vacanteId ? 'Guardar cambios' : 'Registrar oferta'}
      onGuardar={guardar}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Enlace de la oferta"
            ancho
            ayuda="Opcional. Con enlace, el título y la descripción se completan solos."
          >
            <Input
              type="url"
              value={datos.url ?? ''}
              onChange={(e) => campo('url')(e.target.value)}
              placeholder="https://..."
            />
          </Campo>

          <Campo
            etiqueta="Cargo"
            requerido={!datos.url?.trim()}
            ayuda={datos.url?.trim() ? 'Si lo dejas vacío, se lee del enlace.' : undefined}
          >
            <Input
              value={datos.titulo ?? ''}
              onChange={(e) => campo('titulo')(e.target.value)}
              placeholder="Bilingual Customer Service Representative"
              maxLength={255}
            />
          </Campo>

          <Campo etiqueta="Empresa">
            <Input
              value={datos.empresaNombre ?? ''}
              onChange={(e) => campo('empresaNombre')(e.target.value)}
              placeholder="Solvo Global"
              maxLength={255}
            />
          </Campo>

          <Campo etiqueta="Ciudad" ayuda="Se usa para filtrar. Aparte del texto del anuncio.">
            <Input
              value={datos.ciudad ?? ''}
              onChange={(e) => campo('ciudad')(e.target.value)}
              placeholder="Barranquilla"
              maxLength={255}
            />
          </Campo>

          <Campo etiqueta="Ubicación del anuncio">
            <Input
              value={datos.ubicacion ?? ''}
              onChange={(e) => campo('ubicacion')(e.target.value)}
              placeholder="Barranquilla, Atlántico — Zona norte"
              maxLength={255}
            />
          </Campo>

          <Campo etiqueta="Modalidad">
            <Selector
              value={datos.modalidadTrabajo ?? ''}
              vacio="Sin especificar"
              opciones={MODALIDADES}
              onChange={campo('modalidadTrabajo')}
            />
          </Campo>

          <Campo etiqueta="Jornada" ayuda="Distinto del tipo de contrato.">
            <Selector
              value={datos.jornada ?? ''}
              vacio="Sin especificar"
              opciones={JORNADAS}
              onChange={campo('jornada')}
            />
          </Campo>

          <Campo etiqueta="Tipo de contrato">
            <Selector
              value={datos.tipoContrato ?? ''}
              vacio="Sin especificar"
              opciones={TIPOS_CONTRATO}
              onChange={campo('tipoContrato')}
            />
          </Campo>

          <Campo etiqueta="Salario">
            <Input
              value={datos.rangoSalarial ?? ''}
              onChange={(e) => campo('rangoSalarial')(e.target.value)}
              placeholder="$2.800.000 - $3.200.000 + bonos"
              maxLength={255}
            />
          </Campo>

          <Campo
            etiqueta="Inglés requerido"
            ayuda="Se compara contra el nivel medido en las pruebas, no el declarado."
          >
            <Selector
              value={datos.nivelInglesRequerido ?? ''}
              vacio="Sin especificar"
              opciones={NIVELES_INGLES}
              onChange={campo('nivelInglesRequerido')}
            />
          </Campo>

          <Campo etiqueta="Años de experiencia">
            <Input
              type="number"
              min={0}
              max={40}
              value={datos.aniosExperienciaRequeridos ?? ''}
              onChange={(e) =>
                setDatos({
                  ...datos,
                  aniosExperienciaRequeridos:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              placeholder="0"
            />
          </Campo>

          <Campo etiqueta="Descripción" ancho>
            <Textarea
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              minRows={4}
              value={datos.descripcion ?? ''}
              onChange={(e) => campo('descripcion')(e.target.value)}
              placeholder="Funciones, horario, a quién buscan."
            />
          </Campo>

          <Campo etiqueta="Requisitos" ancho>
            <Textarea
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              minRows={3}
              value={datos.requisitos ?? ''}
              onChange={(e) => campo('requisitos')(e.target.value)}
              placeholder="Estudios, herramientas, certificaciones."
            />
          </Campo>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </FormSheet>
  )
}
