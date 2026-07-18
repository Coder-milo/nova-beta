# Academia CAC — Frontend Panel Administrativo

Este es el frontend del Panel Administrativo de la **Academia CAC** (NOVA CRM), desarrollado con React, Next.js (App Router), Tailwind CSS y `shadcn/ui`.

## 🚀 Módulos Implementados

Se ha completado la integración total de todos los endpoints provistos por el backend:

1. **Dashboard principal (`/`)**:
   - Muestra estadísticas en tiempo real consumiendo `/api/v1/dashboard/summary`.
   - Gráficos interactivos de estado académico, ingresos históricos y estudiantes por proyecto a través de `/api/v1/dashboard/charts`.
   - Tarjeta de alertas y consistencia de datos de `/api/v1/dashboard/alerts`.
   - Si el backend no está en línea, usa datos de respaldo (mock) de forma segura.

2. **Proyectos (`/proyectos`)**:
   - CRUD completo de programas de empleabilidad.
   - Control de estados del ciclo de vida del programa (`BORRADOR` → `ACTIVO` → `FINALIZADO` → `ARCHIVADO`) mediante `PATCH /api/v1/programas/{id}/estado`.

3. **Estudiantes (`/estudiantes`)**:
   - CRUD completo con paginación real del backend.
   - Formulario de creación y edición dividido en pestañas (Datos Básicos, Educación y Experiencia, Socioeconómico y Metas).
   - Drawer lateral con detalles completos del perfil del estudiante.
   - Pestaña de **Matches** en el drawer que consulta en tiempo real `/api/v1/matches?estudianteId={id}` para ver ofertas de empleo puntuadas y estado de postulación.
   - Modales de confirmación seguros para eliminación física/lógica.

4. **Hojas de Vida (`/hojas-de-vida`)**:
   - Visualización y búsqueda de vacantes de empleo activas recuperadas de `/api/v1/vacantes`.
   - Detalle de requisitos, salarios, niveles de inglés, años de experiencia y links directos para aplicar/ver fuente de la oferta.

5. **Importaciones (`/importaciones`)**:
   - Carga masiva de estudiantes mediante archivos Excel (.xlsx / .xls) asociada a un programa específico a través de `POST /api/v1/importar`.
   - Reporte inmediato con recuento de filas importadas y detalle de errores encontrados en el archivo.

6. **Documentos (`/documentos`)**:
   - Repositorio y visualización de certificaciones digitales por programa de `/api/v1/certificaciones`.
   - Detalle de horas, habilidades e integraciones de compartición en redes como LinkedIn.

7. **Reportes (`/reportes`)**:
   - Panel de control estadístico con opción de descarga de datos en formato CSV para cada gráfico y distribución.

8. **Auditoría (`/auditoria`)**:
   - Historial de consistencia de base de datos y logs del sistema.

9. **Configuración (`/configuracion`)**:
   - Perfil del usuario activo (basado en JWT decodificado), estado de la sesión y selector del tema visual (Claro / Oscuro / Sistema).

---

## 🛠️ Estructura del Código

- **`lib/api.ts`**: Cliente fetch centralizado que intercepta solicitudes para inyectar automáticamente el header `Authorization: Bearer <jwt>`.
- **`lib/types.ts`**: Interfaces de TypeScript que reflejan 1:1 los DTOs y modelos del backend en Spring Boot.
- **`lib/auth.tsx`**: Proveedor de autenticación que gestiona las credenciales locales y tokens.
- **`app/globals.css`**: Contiene la paleta de colores de la identidad de marca (Azul Navy `#0910A2` y Rojo `#D71627`).

---

## 💻 Desarrollo Local

1. Instalar dependencias en el directorio del frontend:
   ```bash
   pnpm install
   ```
2. Asegurar que las variables de entorno estén configuradas en `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```
3. Ejecutar el servidor de desarrollo:
   ```bash
   pnpm dev
   ```
4. Generar el compilado de producción para validación:
   ```bash
   pnpm build
   ```
