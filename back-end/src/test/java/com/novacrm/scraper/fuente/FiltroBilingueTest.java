package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Suite de pruebas exhaustiva para el filtro bilingüe multidisciplinar (FiltroBilingue).
 */
class FiltroBilingueTest {

    private static Vacante oferta(String titulo, String descripcion) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setDescripcion(descripcion);
        v.setSegmento(Segmento.LOCAL_COLOMBIA);
        return v;
    }

    private static Vacante ofertaConRequisitos(String titulo, String descripcion, String requisitos) {
        var v = oferta(titulo, descripcion);
        v.setRequisitos(requisitos);
        return v;
    }

    @Nested
    @DisplayName("Reglas base y compatibilidad previa")
    class ReglasBase {
        @Test
        @DisplayName("pasa la que dice bilingue, con tilde o sin ella")
        void bilingueEnElTitulo() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Asesor Bilingüe Call Center", "Turnos rotativos."))).isTrue();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Agente bilingue", "BPO en Barranquilla."))).isTrue();
        }

        @Test
        @DisplayName("pasa la que pide ingles en la descripcion aunque el titulo no lo diga")
        void elIdiomaPuedeEstarSoloEnElCuerpo() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Asesor de servicio al cliente",
                            "Requisito: ingles conversacional para atender clientes de USA.")))
                    .isTrue();
        }

        @Test
        @DisplayName("cae la que no menciona el idioma por ningun lado")
        void sinIdiomaNoPasa() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Asesor comercial", "Ventas en punto fijo, horario de lunes a sabado.")))
                    .isFalse();
        }

        @Test
        @DisplayName("un cargo en ingles no prueba que el trabajo sea en ingles")
        void elCargoEnInglesNoBasta() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Customer Service Agent", "Atencion a usuarios en Barranquilla.")))
                    .isFalse();
        }

        @Test
        @DisplayName("el nombre de un BPO tampoco prueba nada")
        void laEmpresaNoEsPrueba() {
            var v = oferta("Asesor de servicio", "Vacante en contact center, campana nacional.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isFalse();
        }

        @Test
        @DisplayName("un anuncio escrito en ingles no es, por eso, una plaza que pida ingles")
        void escritoEnInglesNoEsPedirIngles() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(oferta(
                    "Head of Marketing & Communications",
                    "We are hiring a Head of Marketing to tell the story across the internet. "
                            + "You bring fluent written communication and a conversational tone.")))
                    .isFalse();
        }

        @Test
        @DisplayName("un B2 pegado a idioma cuenta; un B2 de otra cosa, no")
        void elNivelSoloCuentaSiEsDeIdioma() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Agente de soporte", "Nivel de idioma B2 requerido.")))
                    .isTrue();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Operario de planta", "Zona B2, turno nocturno, pago quincenal.")))
                    .as("«zona B2» no es un nivel de idioma")
                    .isFalse();
        }

        @Test
        @DisplayName("lo que ya nace en ingles no se examina")
        void elRemotoEnInglesPasaSiempre() {
            var v = oferta("Senior Backend Engineer", "Remote position, competitive salary.");
            v.setSegmento(Segmento.REMOTO_INGLES);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("si la propia oferta declara nivel de ingles, se cree")
        void elCampoDeNivelBasta() {
            var v = oferta("Agente de soporte", "Turnos rotativos.");
            v.setNivelInglesRequerido("B2");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }

        @Test
        @DisplayName("una oferta nula no revienta el filtro")
        void nadaNoPasa() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(null)).isFalse();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(oferta(null, null))).isFalse();
        }
    }

    @Nested
    @DisplayName("Vacantes multidisciplinares bilingües")
    class Multidisciplinar {
        @Test
        @DisplayName("Ingeniería de Software / Tech con C1")
        void techSoftwareEngineerC1() {
            var v = oferta("Software Engineer", "Desarrollo en Java/Spring Boot. Requisitos: Inglés C1 para reuniones diarias con USA.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();

            var v2 = oferta("QA Automation Engineer", "Selenium, Cypress. English proficiency required for documentation.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v2)).isTrue();
        }

        @Test
        @DisplayName("Finanzas, Contabilidad y Negocios con B2 / MCER")
        void finanzasYNegocios() {
            var vFin = oferta("Financial Analyst", "Preparación de informes bajo NIIF. B2 English required.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vFin)).isTrue();

            var vCont = oferta("Contador Bilingüe", "Auditoría financiera y reportería internacional.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vCont)).isTrue();

            var vMcer = oferta("Business Analyst", "Levantamiento de requerimientos. Requisito: MCER B2.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vMcer)).isTrue();

            var vCefr = oferta("Auditor Internacional", "Certificación CEFR C1 indispensable.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vCefr)).isTrue();
        }

        @Test
        @DisplayName("Diseño Gráfico, UI/UX y Marketing")
        void disenoYMarketing() {
            var vDis = oferta("Diseñador Gráfico", "Creación de piezas publicitarias, indispensable inglés conversacional.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vDis)).isTrue();

            var vUi = oferta("UI/UX Designer", "Design systems, Figma. Professional working English required.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vUi)).isTrue();

            var vMkt = oferta("Marketing Specialist", "Gestión de pauta digital, perfil 100% bilingüe.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vMkt)).isTrue();
        }

        @Test
        @DisplayName("Ingenierías tradicionales con inglés técnico")
        void ingenieriasTradicionales() {
            var vInd = oferta("Ingeniero Industrial", "Optimización de procesos de planta, inglés técnico indispensable.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vInd)).isTrue();

            var vOp = oferta("Ingeniero de Operaciones", "Supervisión de manufactura, dominio de inglés intermedio.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vOp)).isTrue();
        }

        @Test
        @DisplayName("Niveles con notación +, rangos y compuestos")
        void nivelesCompuestos() {
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Bilingual Specialist", "Required: B2+ English communication skills."))).isTrue();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Project Manager", "Requisitos: Nivel B1/B2 de inglés comprobable."))).isTrue();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Backend Lead", "Requisitos: Nivel B2/C1 para trato con clientes internacionales."))).isTrue();
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(
                    oferta("Data Scientist", "Level C1 required for cross-border research."))).isTrue();
        }
    }

    @Nested
    @DisplayName("Filtro de falsos positivos y exclusiones no bilingües")
    class FalsosPositivos {
        @Test
        @DisplayName("Excluye acrónimos comerciales B2B, B2C, B2G")
        void excluyeB2B_B2C() {
            var vB2B = oferta("Ejecutivo de cuentas B2B", "Ventas corporativas a empresas, nivel de ingresos alto.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vB2B)).isFalse();

            var vB2C = oferta("E-commerce Specialist B2C", "Gestión de tienda online, nivel profesional.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vB2C)).isFalse();

            var vMix = oferta("Gerente Comercial B2B / B2C", "Estrategia para canal mayorista y minorista.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vMix)).isFalse();
        }

        @Test
        @DisplayName("Excluye ubicaciones físicas: Bodega B1, Piso B2, Zona B2, Pasillo B1")
        void excluyeUbicacionesFisicas() {
            var vBod = oferta("Operario de Bodega B1", "Cargue y descargue, nivel de estudios bachiller.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vBod)).isFalse();

            var vPiso = oferta("Supervisor de Piso B2", "Supervisión en piso B2, turno rotativo.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vPiso)).isFalse();

            var vPas = oferta("Auxiliar de Pasillo B1", "Acomodación de mercancía en pasillo B1.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vPas)).isFalse();

            var vSec = oferta("Mantenimiento Sector B2", "Mantenimiento en sector B2 de la fábrica.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vSec)).isFalse();
        }

        @Test
        @DisplayName("Excluye licencias de conducción en Colombia (C1, B2, C2)")
        void excluyeLicenciasConduccion() {
            var vLicC1 = oferta("Conductor con Licencia C1", "Reparto de mercancías en Barranquilla, nivel bachiller.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vLicC1)).isFalse();

            var vPase = oferta("Chofer con Pase C1", "Transporte de personal, pase C1 vigente.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vPase)).isFalse();

            var vCat = oferta("Conductor Categoria B2", "Conducción de camión particular, experiencia 2 años.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vCat)).isFalse();

            var vCond = oferta("Mensajero con Licencia de Conducción C1", "Entrega de correspondencia.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vCond)).isFalse();
        }

        @Test
        @DisplayName("Excluye vitaminas y suplementos")
        void excluyeVitaminas() {
            var vVit = oferta("Auxiliar de Farmacia", "Dispensación de Vitamina B1 y complejo B2.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vVit)).isFalse();
        }

        @Test
        @DisplayName("Conductor con pase C1 que además sea bilingüe SÍ debe pasar")
        void conductorBilinguePasa() {
            var v = oferta("Conductor Bilingüe", "Pase C1 vigente para transporte de turistas internacionales en Barranquilla.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
        }
    }
}
