/**
 * Bloques modulares prediseñados y utilidades de simulación para plantillas de correo.
 *
 * Estructuras HTML 100% compatibles con clientes de correo (Outlook, Gmail, Apple Mail)
 * mediante tablas HTML (`<table role="presentation">`), espaciado seguro y estilos en línea.
 */

export interface BloqueCorreo {
  id: string
  nombre: string
  descripcion: string
  categoria: 'cabecera' | 'contenido' | 'citas' | 'alertas' | 'pie'
  html: string
}

export const BLOQUES_PREDISENADOS: BloqueCorreo[] = [
  {
    id: 'cabecera',
    nombre: 'Cabecera con Logo',
    descripcion: 'Logo institucional centrado con título y espaciado superior',
    categoria: 'cabecera',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:16px 0 8px 0;">
      <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#1E293B;letter-spacing:-0.02em;">
        NOVA CRM · {{programa}}
      </h1>
      <p style="margin:6px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#64748B;">
        Programa de Formación y Empleabilidad
      </p>
    </td>
  </tr>
</table>`,
  },
  {
    id: 'boton_cta',
    nombre: 'Botón de Acción (CTA)',
    descripcion: 'Botón destacado centrado con bordes redondeados y contraste óptimo',
    categoria: 'contenido',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
        <tr>
          <td align="center" style="background-color:#1B6DF5;border-radius:8px;padding:12px 28px;">
            <a href="{{enlace_boton}}" target="_blank" rel="noopener noreferrer" style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
              Confirmar Participación
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  },
  {
    id: 'tarjeta_entrevista',
    nombre: 'Tarjeta de Entrevista / Cita',
    descripcion: 'Tarjeta informativa con borde de acento, fecha, modalidad y lugar',
    categoria: 'citas',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid #1B6DF5;border-radius:8px;">
  <tr>
    <td style="padding:18px 20px;">
      <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">
        Detalles de la Cita de Entrevista
      </p>
      <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#1E293B;line-height:1.5;">
        <strong style="color:#0F172A;">Empresa / Vacante:</strong> {{empresa}} &mdash; {{cargo}}
      </p>
      <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#1E293B;line-height:1.5;">
        <strong style="color:#0F172A;">Fecha y Hora:</strong> {{fecha_entrevista}}
      </p>
      <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#1E293B;line-height:1.5;">
        <strong style="color:#0F172A;">Modalidad:</strong> {{modalidad_entrevista}}
      </p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#1E293B;line-height:1.5;">
        <strong style="color:#0F172A;">Lugar / Enlace:</strong> {{lugar_entrevista}}
      </p>
    </td>
  </tr>
</table>`,
  },
  {
    id: 'banner_aviso',
    nombre: 'Banner de Aviso / Alerta',
    descripcion: 'Caja destacada ámbar con borde para advertencias o notas importantes',
    categoria: 'alertas',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;background-color:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;">
  <tr>
    <td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#92400E;line-height:1.5;">
      <strong style="color:#78350F;">Aviso Importante:</strong> Por favor confirma tu asistencia con al menos 24 horas de anticipación para garantizar tu cupo.
    </td>
  </tr>
</table>`,
  },
  {
    id: 'firma_institucional',
    nombre: 'Firma Institucional',
    descripcion: 'Pie de página formal con remitente, datos de contacto y confidencialidad',
    categoria: 'pie',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #E2E8F0;padding-top:16px;border-collapse:collapse;">
  <tr>
    <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#64748B;line-height:1.6;">
      <p style="margin:0 0 4px 0;font-weight:700;color:#334155;font-size:13px;">
        Equipo de Coordinación y Empleabilidad
      </p>
      <p style="margin:0 0 2px 0;">
        NOVA CRM &bull; Plataforma Integral de Gestión de Talento
      </p>
      <p style="margin:0 0 8px 0;">
        Barranquilla, Atlántico &bull; contacto@novacrm.org
      </p>
      <p style="margin:0;font-size:11px;color:#94A3B8;font-style:italic;">
        Este correo electrónico contiene información confidencial dirigida exclusivamente a su destinatario.
      </p>
    </td>
  </tr>
</table>`,
  },
]

/**
 * Perfiles de datos simulados para pruebas y previsualización interactiva.
 */
export interface PerfilSimulacion {
  id: string
  nombrePerfil: string
  descripcion: string
  variables: Record<string, string>
}

export const PERFILES_SIMULACION_PREDETERMINADOS: PerfilSimulacion[] = [
  {
    id: 'estudiante_estandar',
    nombrePerfil: 'Estudiante Estándar (María Gómez)',
    descripcion: 'Datos típicos de estudiante en proceso de formación BPO',
    variables: {
      nombre: 'María Fernanda',
      apellido: 'Gómez Castro',
      email: 'maria.gomez@ejemplo.com',
      programa: 'Ruta Bilingüe BPO & Tech',
      empresa: 'Konecta Colombia',
      cargo: 'Bilingual Customer Representative',
      fecha_entrevista: 'Jueves, 28 de Agosto a las 10:00 AM',
      modalidad_entrevista: 'Virtual (Microsoft Teams)',
      lugar_entrevista: 'https://teams.microsoft.com/l/meetup-join/ejemplo-entrevista',
      enlace_boton: 'https://portal.novacrm.org/postulaciones',
      link: 'https://portal.novacrm.org/auth/activar?token=sim-token-12345',
    },
  },
  {
    id: 'estudiante_entrevista_presencial',
    nombrePerfil: 'Entrevista Presencial (Carlos Ruiz)',
    descripcion: 'Cita en sede física empresarial para vacante de soporte técnico',
    variables: {
      nombre: 'Carlos Andrés',
      apellido: 'Ruiz Morales',
      email: 'carlos.ruiz@ejemplo.com',
      programa: 'Desarrollo de Software & Cloud',
      empresa: 'TecnoSoluciones del Caribe',
      cargo: 'Junior Cloud Support Analyst',
      fecha_entrevista: 'Viernes, 29 de Agosto a las 2:30 PM',
      modalidad_entrevista: 'Presencial',
      lugar_entrevista: 'Cra 53 # 82-86, Edificio Prado Office, Piso 4, Barranquilla',
      enlace_boton: 'https://portal.novacrm.org/citas/confirmar',
      link: 'https://portal.novacrm.org/auth/activar?token=sim-token-67890',
    },
  },
  {
    id: 'caso_borde_texto_largo',
    nombrePerfil: 'Caso Extremo (Nombres y Textos Extensos)',
    descripcion: 'Prueba de desbordamiento visual con nombres compuestos y URLs largas',
    variables: {
      nombre: 'Juan Francisco Alexander De la Santísima Trinidad',
      apellido: 'González-Rodríguez de la Torre y Montemayor',
      email: 'juan.francisco.gonzalez.rodriguez.montemayor@corporativo-ejemplo.edu.co',
      programa: 'Diplomado Superior en Inteligencia Artificial Generativa y Automatización Robótica de Procesos Empresariales',
      empresa: 'Corporación Multilateral de Servicios Globales y Tecnologías Avanzadas de Colombia S.A.S.',
      cargo: 'Lead Artificial Intelligence Solutions Architect & Full-Stack Cloud Reliability Engineer',
      fecha_entrevista: 'Miércoles, 15 de Septiembre a las 11:45 AM (Hora de Colombia UTC-5)',
      modalidad_entrevista: 'Híbrida (Reunión inicial en Teams y presentación en sala de juntas)',
      lugar_entrevista: 'https://meet.google.com/abc-defg-hij?authuser=2&meeting_access_code=9876543210&utm_source=novacrm_test_long_url',
      enlace_boton: 'https://portal.novacrm.org/programas/convocatorias/2026/registro-detallado-confirmacion',
      link: 'https://portal.novacrm.org/auth/reset-password?jwt_auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.super_long_payload_sample_token',
    },
  },
]

/**
 * Aplica sustitución de variables `{{clave}}` en un string dado.
 */
export function interpolarVariables(texto: string, variables: Record<string, string>): string {
  if (!texto) return ''
  return texto.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, clave) => {
    return variables[clave] !== undefined ? variables[clave] : match
  })
}

/**
 * Envuelve el contenido de un correo en un contenedor de correo HTML seguro y responsive.
 */
export function envolverEnDocumentoEmail(htmlCuerpo: string, asunto: string = 'Vista Previa'): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${asunto}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .email-content { padding: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0">
        <tr>
        <td>
        <![endif]-->
        <div class="email-container" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <div class="email-content" style="padding:28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
            ${htmlCuerpo}
          </div>
        </div>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}
