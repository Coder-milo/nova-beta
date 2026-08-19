export interface CriterioSeguridad {
  id: string
  label: string
  cumplido: boolean
}

export interface ResultadoSeguridad {
  puntaje: number // 0 a 4
  nivel: 'muy_debil' | 'debil' | 'medio' | 'fuerte' | 'muy_fuerte'
  etiqueta: string
  colorClase: string
  colorTextoClase: string
  criterios: CriterioSeguridad[]
}

/**
 * Evalúa la fortaleza de una contraseña conforme a los lineamientos NIST SP 800-63B y OWASP.
 */
export function evaluarSeguridadContrasena(password: string): ResultadoSeguridad {
  if (!password) {
    return {
      puntaje: 0,
      nivel: 'muy_debil',
      etiqueta: 'Ingresa una contraseña',
      colorClase: 'bg-muted',
      colorTextoClase: 'text-muted-foreground',
      criterios: [
        { id: 'longitud', label: 'Mínimo 8 caracteres', cumplido: false },
        { id: 'letras', label: 'Mayúsculas (A-Z) y minúsculas (a-z)', cumplido: false },
        { id: 'numeros', label: 'Al menos un número (0-9)', cumplido: false },
        { id: 'simbolos', label: 'Carácter especial (!@#$%^&*)', cumplido: false },
      ],
    }
  }

  const tieneMin8 = password.length >= 8
  const tieneMin12 = password.length >= 12
  const tieneMayus = /[A-Z]/.test(password)
  const tieneMinus = /[a-z]/.test(password)
  const tieneNum = /[0-9]/.test(password)
  const tieneSimbolo = /[^A-Za-z0-9]/.test(password)

  // Detección de secuencias y palabras clave débiles conocidas
  const esSecuenciaComun = /(?:1234|abcd|qwerty|password|admin|1111|0000)/i.test(password)

  const variedad =
    (tieneMayus ? 1 : 0) +
    (tieneMinus ? 1 : 0) +
    (tieneNum ? 1 : 0) +
    (tieneSimbolo ? 1 : 0)

  const criterios: CriterioSeguridad[] = [
    { id: 'longitud', label: 'Mínimo 8 caracteres' + (tieneMin12 ? ' (12+ excelente)' : ''), cumplido: tieneMin8 },
    { id: 'letras', label: 'Mayúsculas y minúsculas', cumplido: tieneMayus && tieneMinus },
    { id: 'numeros', label: 'Al menos un número (0-9)', cumplido: tieneNum },
    { id: 'simbolos', label: 'Carácter especial (!@#$...)', cumplido: tieneSimbolo },
  ]

  if (!tieneMin8 || variedad <= 1 || esSecuenciaComun) {
    return {
      puntaje: 1,
      nivel: 'debil',
      etiqueta: 'Baja / Débil',
      colorClase: 'bg-destructive',
      colorTextoClase: 'text-destructive',
      criterios,
    }
  }

  if (variedad === 2 || (variedad === 3 && !tieneMin12)) {
    return {
      puntaje: 2,
      nivel: 'medio',
      etiqueta: 'Media',
      colorClase: 'bg-amber-500',
      colorTextoClase: 'text-amber-600 dark:text-amber-400',
      criterios,
    }
  }

  if ((variedad === 3 && tieneMin12) || (variedad === 4 && !tieneMin12)) {
    return {
      puntaje: 3,
      nivel: 'fuerte',
      etiqueta: 'Alta / Fuerte',
      colorClase: 'bg-primary',
      colorTextoClase: 'text-primary',
      criterios,
    }
  }

  return {
    puntaje: 4,
    nivel: 'muy_fuerte',
    etiqueta: 'Muy Fuerte / Excelente',
    colorClase: 'bg-emerald-500',
    colorTextoClase: 'text-emerald-600 dark:text-emerald-400',
    criterios,
  }
}
