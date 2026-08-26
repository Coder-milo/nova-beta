package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Empirical challenger test suite for Milestone 3 (FiltroBilingue).
 *
 * <p>Validates multidisciplinary career coverage across 10 distinct disciplines,
 * compound CEFR level notations, remote global pass-through, and resistance to
 * false positives and adversarial edge cases.
 */
class FiltroBilingueChallengerTest {

    private static Vacante local(String titulo, String descripcion) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setDescripcion(descripcion);
        v.setSegmento(Segmento.LOCAL_COLOMBIA);
        return v;
    }

    private static Vacante localConRequisitos(String titulo, String descripcion, String requisitos) {
        var v = local(titulo, descripcion);
        v.setRequisitos(requisitos);
        return v;
    }

    @Nested
    @DisplayName("1. Cobertura Multidisciplinar en 10 Disciplinas Profesionales")
    class CoberturaMultidisciplinar {

        @Test
        @DisplayName("1.1 Software Engineering / Tech: Fullstack Developer con C1")
        void disciplina1_SoftwareEngineering() {
            var v = local("Fullstack Java / React Developer",
                    "Desarrollo de microservicios. Requisitos: Inglés conversacional C1 para daily meetings.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.2 Data Analytics / Data Science: Data Analytics Consultant con CEFR C1")
        void disciplina2_DataAnalytics() {
            var v = local("Data Analytics Consultant",
                    "Modelado en PowerBI y SQL. CEFR C1 required for executive stakeholder presentations.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.3 Cloud / DevOps: Cloud DevOps Engineer con MCER B2")
        void disciplina3_CloudDevOps() {
            var v = local("Cloud DevOps Engineer",
                    "Infraestructura en AWS y Kubernetes. MCER B2 en inglés técnico y hablado indispensable.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.4 Finance: Analista Financiero con inglés avanzado")
        void disciplina4_Finance() {
            var v = local("Analista Financiero Senior",
                    "Modelación de flujos de caja y valoración. Manejo de inglés avanzado para reportes a casa matriz.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.5 Accounting: Contador General Bilingüe con US GAAP")
        void disciplina5_Accounting() {
            var v = local("Contador General Bilingüe",
                    "Consolidación de estados financieros bajo normas US GAAP e IFRS.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.6 Graphic Design / UX: Diseñador Gráfico & Motion Designer 100% bilingüe")
        void disciplina6_GraphicDesign() {
            var v = local("Diseñador Gráfico & Motion Designer",
                    "Creación de assets visuales y piezas animadas. Perfil 100% bilingüe inglés-español.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.7 Marketing: Especialista en Growth Marketing con nivel B2+")
        void disciplina7_Marketing() {
            var v = local("Especialista en Growth Marketing",
                    "Pauta digital y embudos de conversión. Requisito: Nivel B2+ de inglés comprobable.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.8 Industrial Engineering: Ingeniero Industrial de Planta con inglés técnico B1/B2")
        void disciplina8_IndustrialEngineering() {
            var v = local("Ingeniero Industrial de Planta",
                    "Optimización de líneas de producción. Requisito: lectura e interpretación de manuales técnicos en inglés (nivel B1/B2).");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.9 Logistics: Coordinador de Logística y Comercio Exterior con inglés de negociación")
        void disciplina9_Logistics() {
            var v = local("Coordinador de Logística y Comercio Exterior",
                    "Gestión de aduanas y fletes. Negociación fluida con navieras internacionales en idioma inglés.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("1.10 Customer Service / BPO: Agente Bilingüe con nivel C1/C2")
        void disciplina10_CustomerServiceBPO() {
            var v = local("Representante de Servicio al Cliente Bilingüe",
                    "Atención telefónica a usuarios en Estados Unidos. Requisito: nivel C1/C2 fluido.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }
    }

    @Nested
    @DisplayName("2. Notaciones Compuestas y Niveles CEFR / MCER")
    class NotacionesCompuestas {

        @ParameterizedTest(name = "Nivel con plus: {0}")
        @ValueSource(strings = {
                "Requisito: Nivel B2+ para reuniones con clientes internacionales.",
                "Requisito: Nivel C1+ indispensable para documentación.",
                "Nivel B1+ comprobable en entrevista técnica.",
                "Level B2+ required for cross-team collaboration.",
                "Level C1+ fluent oral communication.",
                "B2+ level in technical documentation.",
                "C1+ level required for global interactions.",
                "Requisito: B2+ conversacional para atención a usuarios.",
                "Exigencia: C1+ fluido en ambiente corporativo.",
                "Inglés B2+ requerido para operaciones internacionales."
        })
        void nivelesConPlus(String descripcion) {
            var v = local("Profesional Especialista", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("Debe reconocer niveles con notación '+' como válidos: " + descripcion)
                    .isTrue();
        }

        @ParameterizedTest(name = "Rangos de nivel compuestos: {0}")
        @ValueSource(strings = {
                "Nivel B1/B2 de inglés requerido.",
                "Exigencia: B2/C1 en inglés para trato con clientes.",
                "Nivel C1/C2 para liderazgo global.",
                "Dominio B1-B2 de inglés conversacional.",
                "Nivel B2-C1 indispensable.",
                "Exigencia: B2 a C1 de inglés.",
                "English proficiency B1 to B2 required.",
                "Rango B1/B2 requerido.",
                "B2/C1 indispensable para el cargo.",
                "C1/C2 requerido para trato con directivos."
        })
        void rangosDeNivel(String descripcion) {
            var v = local("Consultor Senior", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("Debe reconocer rangos de nivel MCER compuestos: " + descripcion)
                    .isTrue();
        }

        @ParameterizedTest(name = "Prefijos explícitos MCER / CEFR / Marco Común Europeo: {0}")
        @ValueSource(strings = {
                "Clasificación MCER B2 requerida.",
                "Requisito MCER C1 certificado.",
                "Nivel MCER-B2 indispensable.",
                "Certificación CEFR C1.",
                "Exigencia CEFR: B2+ comprobable.",
                "Requisito: Marco Común Europeo B2.",
                "Alineado a Marco Comun Europeo C1.",
                "Marco Común Europeo: B2+ indispensable.",
                "Nivel según Marco Europeo B2."
        })
        void prefijosExplicitosMarcoEuropeo(String descripcion) {
            var v = local("Líder de Proyecto", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("Debe reconocer marco europeo explícito: " + descripcion)
                    .isTrue();
        }
    }

    @Nested
    @DisplayName("3. Pass-Through Remoto Global y Pre-Marcado de Nivel")
    class RemotoGlobalYPreMarcado {

        @Test
        @DisplayName("Vacante con Segmento.REMOTO_INGLES pasa 100% sin importar el texto")
        void remotoInglesPassThrough() {
            var v1 = new Vacante();
            v1.setTitulo("Staff Engineer");
            v1.setDescripcion("Remote position, international company.");
            v1.setSegmento(Segmento.REMOTO_INGLES);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v1)).isTrue();

            var v2 = new Vacante();
            v2.setTitulo("Desarrollador");
            v2.setDescripcion("Trabajo remoto para empresa de afuera.");
            v2.setSegmento(Segmento.REMOTO_INGLES);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v2)).isTrue();

            var v3 = new Vacante();
            v3.setTitulo("Analista");
            v3.setDescripcion("");
            v3.setSegmento(Segmento.REMOTO_INGLES);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v3)).isTrue();
        }

        @Test
        @DisplayName("Vacante con nivelInglesRequerido pre-marcado pasa automáticamente")
        void nivelInglesDeclaradoPassThrough() {
            var v = local("Asesor de Operaciones", "Horarios rotativos en oficina.");
            v.setNivelInglesRequerido("B2");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();

            var vVacio = local("Asesor de Operaciones", "Horarios rotativos en oficina.");
            vVacio.setNivelInglesRequerido("   ");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vVacio)).isFalse();
        }

        @Test
        @DisplayName("Segmento.LOCAL_COLOMBIA y Segmento.MIGRACION sin idioma NO pasan")
        void otrosSegmentosSinIdiomaNoPasan() {
            var vLocal = local("Asistente Administrativo", "Manejo de archivo y correspondencia.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vLocal)).isFalse();

            var vMigracion = new Vacante();
            vMigracion.setTitulo("Soldador Industrial");
            vMigracion.setDescripcion("Vacante para trabajar en España con visado.");
            vMigracion.setSegmento(Segmento.MIGRACION);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vMigracion)).isFalse();
        }
    }

    @Nested
    @DisplayName("4. Protección contra Falsos Positivos y Casos Adversarios")
    class FalsosPositivosYAdversarios {

        @ParameterizedTest(name = "Acrónimos comerciales: {0}")
        @ValueSource(strings = {
                "Ejecutivo comercial B2B para venta de seguros corporativos.",
                "Especialista en mercadeo B2C para retail y consumo masivo.",
                "Licitaciones B2G con entidades públicas del estado.",
                "Soluciones B2E para empleados y beneficios corporativos.",
                "Plataforma C2C de compra y venta entre particulares.",
                "Canal 2B mayorista en Barranquilla.",
                "Estrategia 2C directa al consumidor final."
        })
        void rechazaAcronimosComerciales(String descripcion) {
            var v = local("Ejecutivo de Ventas", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("No debe confundir acrónimos comerciales con niveles de idioma: " + descripcion)
                    .isFalse();
        }

        @ParameterizedTest(name = "Licencias de conducción colombianas: {0}")
        @ValueSource(strings = {
                "Conductor con Licencia C1 vigente para reparto urbano.",
                "Chofer con Pase B2 para transporte particular.",
                "Conductor categoría B1 para furgón pequeño.",
                "Mensajero con pase de conducción C1 al día.",
                "Conductor de camión categoría C2 con experiencia.",
                "Chofer para gerencia con licencia de conducir B2."
        })
        void rechazaLicenciasConduccion(String descripcion) {
            var v = local("Conductor / Conductora", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("No debe confundir licencias de conducción con niveles de idioma: " + descripcion)
                    .isFalse();
        }

        @ParameterizedTest(name = "Ubicaciones físicas e infraestructura: {0}")
        @ValueSource(strings = {
                "Auxiliar de Bodega B1 en parque industrial.",
                "Supervisor de Piso B2 en centro comercial.",
                "Operario en Zona B2 de la refinería.",
                "Acomodador en Pasillo B1 del almacén.",
                "Mantenimiento en Sector B2 de la fábrica.",
                "Vigilante para Modulo B1 de oficinas.",
                "Conserje en Bloque B2 residencial.",
                "Recepcionista en Torre B1 empresarial.",
                "Topógrafo en Manzana B2 del proyecto.",
                "Control de acceso en Puerta B1 norte.",
                "Seguridad en Sotano B2 del edificio.",
                "Cargue en Anden B1 de la terminal.",
                "Valet en Parqueadero B2 techado.",
                "Vendedor para Local B1 en plaza de comidas.",
                "Técnico en Planta B2 de manufactura.",
                "Asistente en Sede B1 centro.",
                "Organizador en Estante B2 de biblioteca."
        })
        void rechazaUbicacionesFisicas(String descripcion) {
            var v = local("Operario de Instalaciones", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("No debe confundir ubicaciones físicas con niveles de idioma: " + descripcion)
                    .isFalse();
        }

        @ParameterizedTest(name = "Vitaminas, suplementos y formatos: {0}")
        @ValueSource(strings = {
                "Regente de Farmacia: control de Vitamina B1 y suplementos.",
                "Químico farmacéutico: formulación con complejo B2.",
                "Diseñador de empaques: impresión en formato B2 para litografía.",
                "Auxiliar de imprenta: manejo de papel tamaño B1."
        })
        void rechazaVitaminasYFormatos(String descripcion) {
            var v = local("Técnico Especialista", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("No debe confundir vitaminas o formatos de papel con idioma: " + descripcion)
                    .isFalse();
        }

        @ParameterizedTest(name = "Cargos en inglés sin exigencia de idioma en plaza local: {0}")
        @ValueSource(strings = {
                "Full Stack Developer",
                "Scrum Master",
                "DevOps Specialist",
                "Product Owner",
                "Community Manager",
                "Sales Executive",
                "Brand Manager",
                "Data Scientist",
                "UX/UI Designer"
        })
        void rechazaCargosEnInglesSinExigenciaDeIdioma(String titulo) {
            var v = local(titulo, "Empresa nacional requiere profesional con experiencia. Salario a convenir, contrato a término indefinido.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("El cargo en inglés NO prueba exigencia de idioma si el cuerpo no lo pide: " + titulo)
                    .isFalse();
        }

        @Test
        @DisplayName("Anuncio redactado en inglés pero sin exigencia explícita en plaza local NO pasa")
        void textoEnInglesSinExigenciaNoPasa() {
            var v = local("Marketing Lead",
                    "We are looking for an energetic leader to build great campaigns. Great compensation and team vibe.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isFalse();
        }
    }

    @Nested
    @DisplayName("5. Casos Límite, Overrides y Resiliencia")
    class CasosLimiteYOverrides {

        @Test
        @DisplayName("Oferta con contexto negativo (Bodega B1, Pase C1) pero que ADEMÁS exige inglés SÍ debe pasar")
        void negativoConExigenciaDeInglesPasa() {
            var vBodega = local("Jefe de Bodega B1",
                    "Supervisión de operaciones en bodega B1. Indispensable inglés conversacional para comunicarse con proveedores internacionales.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vBodega)).isTrue();

            var vChofer = local("Conductor Bilingüe",
                    "Pase C1 vigente. Transporte de comitivas diplomáticas internacionales en Barranquilla.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vChofer)).isTrue();

            var vB2B = local("Gerente de Ventas B2B",
                    "Ventas corporativas a multinacionales. Requisito: Nivel C1 de inglés comprobable.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vB2B)).isTrue();
        }

        @Test
        @DisplayName("Insensibilidad a mayúsculas, tildes y diacríticos")
        void diacriticosYMayusculas() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    local("INGENIERO BILINGÜE", "PROYECTOS PETROLEROS."))).isTrue();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    local("CONTADOR", "REQUISITO: INGLÉS AVANZADO."))).isTrue();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    local("ASESOR", "NIVEL SEGÚN MARCO COMÚN EUROPEO B2."))).isTrue();
        }

        @Test
        @DisplayName("El requisito de idioma puede estar en título, descripción o requisitos")
        void ubicacionDelRequisito() {
            // Solo en título
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    local("Desarrollador Bilingüe", "Trabajo presencial en Bogotá."))).isTrue();

            // Solo en descripción
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    local("Desarrollador", "Requisito: Dominio de inglés B2."))).isTrue();

            // Solo en campo requisitos
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    localConRequisitos("Desarrollador", "Trabajo en equipo.", "Inglés técnico intermedio."))).isTrue();
        }

        @Test
        @DisplayName("Robustez ante nulos, vacíos y espacios en blanco")
        void robustezAnteNulos() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(null)).isFalse();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(new Vacante())).isFalse();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(local("", ""))).isFalse();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(local("   ", "   "))).isFalse();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(localConRequisitos(null, null, null))).isFalse();
        }
    }
}
