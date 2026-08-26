package com.novacrm.scraper.fuente;

import com.novacrm.catalogo.nivel_ingles.NivelMcer;
import com.novacrm.vacante.EnriquecedorDeVacante;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Batería de pruebas de estrés y adversariales empíricas (Challenger M3).
 * Evalúa cientos de ofertas laborales colombianas reales y sintéticas con tokens no idiomáticos
 * (licencias C1/B2/C2, bodegas B1/B2, pisos, zonas, acrónimos B2B/B2C, vitaminas, formatos de papel,
 * niveles educativos "bachiller") asegurando 0% de falsos positivos y 100% de verdaderos positivos.
 */
class FiltroBilingueAdversarialTest {

    private final EnriquecedorDeVacante enriquecedor = new EnriquecedorDeVacante(30);

    private static Vacante vacante(String titulo, String descripcion) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setDescripcion(descripcion);
        v.setSegmento(Segmento.LOCAL_COLOMBIA);
        return v;
    }

    private static Vacante vacanteConRequisitos(String titulo, String descripcion, String requisitos) {
        var v = vacante(titulo, descripcion);
        v.setRequisitos(requisitos);
        return v;
    }

    @Nested
    @DisplayName("1. Batería de Falsos Positivos: Licencias de Conducción en Colombia (C1, B2, C2, B1)")
    class FalsosPositivosLicenciasConduccion {

        @ParameterizedTest
        @ValueSource(strings = {
                "Conductor de camión con pase C1 para reparto en Bogotá",
                "Chofer de furgón con pase C2 vigente y experiencia de 2 años",
                "Conductor de ambulancia categoría C1 en Barranquilla",
                "Mensajero motorizado con licencia A2 y pase carro B1",
                "Conductor escolta con licencia categoría B2 y curso de seguridad",
                "Conductor de buseta urbana con pase C2 al día",
                "Chofer particular con licencia B1 sin comparendos",
                "Conductor de tractomula con pase C3 y experiencia en carretera",
                "Conductor de taxi en Medellín con licencia C1 vigente",
                "Auxiliar de reparto y conductor con pase C1, nivel bachiller",
                "Chofer de reparto alimentos, categoría C1 requerida",
                "Conductor institucional licencia B2 para transporte de directivos",
                "Conductor de volqueta doble troque pase C2",
                "Operador de grúa y conductor con pase C1 al día",
                "Conductor furgón turbo categoría C1, horario lunes a sábado",
                "Chofer con licencia de conducción C1 para distribución urbana",
                "Conductor de camioneta con pase B1 / B2 en Cali",
                "Motorista con pase C1 para transporte de carga liviana",
                "Conductor repartidor pase C1, salario mínimo más prestaciones",
                "Chofer transportador con licencia C2 para viajes intermunicipales"
        })
        @DisplayName("Rechaza conductores y choferes con pase/licencia C1/B2/C2/B1 sin inglés")
        void rechazaConductoresSinIngles(String texto) {
            var v = vacante("Conductor / Chofer", texto);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("No debe filtrar como bilingüe una licencia de conducción: " + texto)
                    .isFalse();

            enriquecedor.enriquecer(v);
            assertNull(v.getNivelInglesRequerido(),
                    "No debe inferir nivel de inglés de una licencia de conducción: " + texto);
        }
    }

    @Nested
    @DisplayName("2. Batería de Falsos Positivos: Ubicaciones e Infraestructura Física (Bodega, Piso, Zona, Pasillo, etc.)")
    class FalsosPositivosUbicacionesFisicas {

        @ParameterizedTest
        @ValueSource(strings = {
                "Auxiliar de bodega para Bodega B1 en Fontibón",
                "Operario de logística en Bodega B2, turnos rotativos",
                "Supervisor de empaque ubicado en Piso B1 del centro comercial",
                "Acomodador de mercancía en Piso B2, nivel bachiller",
                "Coordinador de almacén para Zona B1 en parque industrial",
                "Vigilante de seguridad para Zona B2 en Soledad",
                "Auxiliar de recibo para Pasillo B1 en supermercado",
                "Operario de surtido en Pasillo B2 de tienda retail",
                "Técnico de soporte en Módulo B1 de la planta",
                "Operario de producción en Módulo B2, contrato directo",
                "Auxiliar de ensamble en Bloque B1, zona franca",
                "Operario de planta en Bloque B2, experiencia 1 año",
                "Guarda de seguridad para Torre B1 en centro empresarial",
                "Recepcionista de oficina en Torre B2, atención a visitantes",
                "Operario de aseo para Manzana B1 en conjunto cerrado",
                "Jefe de cuadrilla en Manzana B2 del proyecto vial",
                "Controlador de acceso en Puerta B1 del estadio",
                "Vigilante para Puerta B2 de la fábrica",
                "Auxiliar de archivo ubicado en Sótano B1 de la sede central",
                "Operario de mantenimiento en Sótano B2",
                "Cotero de descargue para Andén B1 en central de abastos",
                "Operador logístico para Andén B2 en terminal de carga",
                "Cajero para Parqueadero B1 en centro comercial",
                "Valet parking para Parqueadero B2 en hotel",
                "Vendedor de mostrador para Local B1 en Unicentro",
                "Asesor de ventas para Local B2 en Buenavista",
                "Promotor de tecnología para Stand B1 en feria",
                "Impulsadora de alimentos para Stand B2 en almacén de cadena",
                "Ingeniero de procesos en Planta B1 de alimentos",
                "Supervisor de turno en Planta B2 de plásticos",
                "Asistente administrativo para Sede B1 en Bogotá",
                "Recepcionista para Sede B2 en Medellín",
                "Auxiliar de bodega para Estante B1 en droguería",
                "Inventariador para Estante B2 en almacén central"
        })
        @DisplayName("Rechaza 100% de ubicaciones físicas que coinciden con códigos B1/B2")
        void rechazaUbicacionesFisicas(String descripcion) {
            var v = vacante("Operario / Auxiliar", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("Ubicación física no debe pasar como bilingüe: " + descripcion)
                    .isFalse();

            enriquecedor.enriquecer(v);
            assertNull(v.getNivelInglesRequerido(),
                    "No debe inferir nivel de inglés de ubicación física: " + descripcion);
        }
    }

    @Nested
    @DisplayName("3. Batería de Falsos Positivos: Modelos Comerciales (B2B, B2C, B2G, B2E, C2C)")
    class FalsosPositivosAcroNimosComerciales {

        @ParameterizedTest
        @ValueSource(strings = {
                "Ejecutivo de cuentas corporativas B2B para venta de software en Colombia",
                "Gerente comercial de canal B2B con experiencia en retail",
                "Especialista en marketing digital B2C para tienda de calzado",
                "Key Account Manager B2B en sector consumo masivo",
                "Director de ventas B2B y B2C para empresa de alimentos",
                "Analista de operaciones comerciales B2G para contratación estatal",
                "Representante de ventas consultivas B2B, comisiones sin techo",
                "Coordinador de fidelización B2C para plataforma de comercio electrónico",
                "Líder de prospección comercial B2B en Barranquilla",
                "Asesor comercial B2B para venta de planes corporativos de telefonía"
        })
        @DisplayName("Rechaza ofertas comerciales con acrónimos B2B/B2C sin inglés")
        void rechazaAcroNimosComerciales(String descripcion) {
            var v = vacante("Ejecutivo Comercial", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("Acrónimo comercial no debe pasar como bilingüe: " + descripcion)
                    .isFalse();

            enriquecedor.enriquecer(v);
            assertNull(v.getNivelInglesRequerido(),
                    "No debe inferir nivel de inglés de acrónimo comercial: " + descripcion);
        }
    }

    @Nested
    @DisplayName("4. Batería de Falsos Positivos: Vitaminas, Formatos de Papel y Niveles Educativos")
    class FalsosPositivosOtros {

        @ParameterizedTest
        @ValueSource(strings = {
                "Visitador médico para promoción de línea Vitamina B1 y complejo B2",
                "Regente de farmacia con conocimiento en suplementos Vitamina B1, B2 y C1",
                "Auxiliar de laboratorio químico para formulación de Vitamina B1",
                "Prensista de artes gráficas con manejo de máquinas formato B1 y B2",
                "Impresor litográfico para pliegos tamaño B1 y tamaño B2 en Bogotá",
                "Auxiliar administrativo. Nivel académico: Bachiller. Experiencia en digitación.",
                "Asesor de servicio al cliente. Nivel educativo: Bachiller comercial.",
                "Operario de producción. Nivel de escolaridad: Bachiller académico.",
                "Cajero de almacén. Nivel académico requerido: Bachiller o técnico.",
                "Mensajero urbano. Nivel de estudios: Bachiller. Moto propia con papeles al día."
        })
        @DisplayName("Rechaza vitaminas, formatos de papel y nivel académico bachiller")
        void rechazaVitaminasFormatosYNivelesAcademicos(String descripcion) {
            var v = vacante("Auxiliar / Técnico", descripcion);
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                    .as("No debe confundir vitaminas, papel o bachiller con idioma: " + descripcion)
                    .isFalse();

            enriquecedor.enriquecer(v);
            assertNull(v.getNivelInglesRequerido(),
                    "No debe inferir nivel de inglés de vitaminas o niveles académicos: " + descripcion);
        }
    }

    @Nested
    @DisplayName("5. Batería de Verdaderos Positivos: Multidisciplinar y Conductores Bilingües (MUST PASS)")
    class VerdaderosPositivosMultidisciplinar {

        @Test
        @DisplayName("Conductor con pase C1 que además sea bilingüe pasa 100% y enriquece correctamente")
        void conductorBilinguePasa() {
            var v1 = vacante("Conductor Bilingüe", "Pase C1 vigente para transporte de turistas internacionales.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v1)).isTrue();
            enriquecedor.enriquecer(v1);
            assertEquals("B1", v1.getNivelInglesRequerido());

            var v2 = vacante("Chofer Ejecutivo", "Requisitos: Licencia C1 al día y dominio de inglés conversacional.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v2)).isTrue();
            enriquecedor.enriquecer(v2);
            assertEquals("B1", v2.getNivelInglesRequerido());

            var v3 = vacante("Conductor Turístico", "Pase C1. Requisito: English proficiency B2 for VIP clients.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(v3)).isTrue();
            enriquecedor.enriquecer(v3);
            assertEquals("B2", v3.getNivelInglesRequerido());
        }

        @Test
        @DisplayName("Software, Tech y Datos (C1, B2+, CEFR, MCER)")
        void techYSoftware() {
            var vDev = vacante("Senior Java Developer", "Microservicios, Spring Boot. Requisito: Inglés C1 para daily scrums con USA.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vDev)).isTrue();
            enriquecedor.enriquecer(vDev);
            assertEquals("C1", vDev.getNivelInglesRequerido());

            var vQa = vacante("QA Automation Lead", "Cypress, CI/CD. Required: B2+ English communication.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vQa)).isTrue();
            enriquecedor.enriquecer(vQa);
            assertEquals("B2", vQa.getNivelInglesRequerido());

            var vData = vacante("Data Scientist", "Python, Spark, ML. Requisito: MCER B2 comprobable.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vData)).isTrue();
            enriquecedor.enriquecer(vData);
            assertEquals("B2", vData.getNivelInglesRequerido());

            var vCloud = vacante("Cloud Architect", "AWS, Terraform. Certification CEFR C1 required.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vCloud)).isTrue();
            enriquecedor.enriquecer(vCloud);
            assertEquals("C1", vCloud.getNivelInglesRequerido());
        }

        @Test
        @DisplayName("Finanzas, Negocios y B2B Bilingüe")
        void finanzasYNegociosBilingue() {
            var vB2bBilingue = vacante("Key Account Manager B2B", "Ventas corporativas en sector B2B con clientes en USA. Inglés avanzado requerido.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vB2bBilingue)).isTrue();
            enriquecedor.enriquecer(vB2bBilingue);
            assertEquals("B2", vB2bBilingue.getNivelInglesRequerido());

            var vCont = vacante("Contador Senior Bilingüe", "Consolidación de estados financieros bajo NIIF y US GAAP.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vCont)).isTrue();
            enriquecedor.enriquecer(vCont);
            assertEquals("B1", vCont.getNivelInglesRequerido());

            var vAud = vacante("Auditor de Procesos", "Auditoría interna. Requisito: Marco común europeo B2.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vAud)).isTrue();
            enriquecedor.enriquecer(vAud);
            assertEquals("B2", vAud.getNivelInglesRequerido());
        }

        @Test
        @DisplayName("Diseño UI/UX, Marketing y Creativos")
        void disenoYMarketingBilingue() {
            var vUi = vacante("Product Designer", "Figma, User Research. Professional working English is mandatory.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vUi)).isTrue();
            enriquecedor.enriquecer(vUi);
            assertEquals("C1", vUi.getNivelInglesRequerido());

            var vMkt = vacante("Growth Marketing Manager", "Gestión de pauta global, perfil 100% bilingüe.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vMkt)).isTrue();
            enriquecedor.enriquecer(vMkt);
            assertEquals("B2", vMkt.getNivelInglesRequerido());
        }

        @Test
        @DisplayName("Ingenierías Tradicionales (Civil, Mecánica, Industrial, Eléctrica) con Inglés Técnico")
        void ingenieriasTradicionales() {
            var vInd = vacante("Ingeniero Industrial", "Optimización de manufactura lean. Inglés técnico indispensable.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vInd)).isTrue();
            enriquecedor.enriquecer(vInd);
            assertEquals("B1", vInd.getNivelInglesRequerido());

            var vMec = vacante("Ingeniero Mecánico", "Diseño de turbinas. Technical English proficiency required.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vMec)).isTrue();
            enriquecedor.enriquecer(vMec);
            assertEquals("B1", vMec.getNivelInglesRequerido());

            var vOp = vacante("Director de Operaciones", "Cadena de suministro global. Inglés fluido.");
            assertThat(FiltroBilingue.esDeTrabajoEnIngles(vOp)).isTrue();
            enriquecedor.enriquecer(vOp);
            assertEquals("B2", vOp.getNivelInglesRequerido());
        }
    }

    @Nested
    @DisplayName("6. Generador Masivo de 100+ Casos Colombianos Sintéticos y Reales")
    class GeneradorMasivoEstres {

        @Test
        @DisplayName("Genera y evalúa 120 combinaciones sintéticas colombianas no bilingües asegurando 0% falsos positivos")
        void generadorMasivoFalsosPositivos() {
            String[] cargos = {
                    "Auxiliar de bodega", "Operario de empaque", "Supervisor de producción",
                    "Vigilante de seguridad", "Cajero de tienda", "Asistente administrativo",
                    "Conductor de reparto", "Chofer institucional", "Mensajero urbano",
                    "Promotor comercial", "Ejecutivo de ventas", "Asesor de cobranzas"
            };

            String[] falsosPositivos = {
                    "Bodega B1", "Bodega B2", "Piso B1", "Piso B2", "Zona B1", "Zona B2",
                    "Pasillo B1", "Pasillo B2", "Módulo B1", "Módulo B2", "Bloque B1", "Bloque B2",
                    "Torre B1", "Torre B2", "Pase C1", "Pase C2", "Licencia C1", "Licencia B2",
                    "Canal B2B", "Sector B2C", "Vitamina B1", "Complejo B2", "Formato B1", "Formato B2"
            };

            List<String> fallos = new ArrayList<>();
            int total = 0;

            for (String cargo : cargos) {
                for (String fp : falsosPositivos) {
                    total++;
                    String desc = "Se busca " + cargo + " para laborar en " + fp + " en Barranquilla. Nivel académico: Bachiller. Salario mínimo legal vigente.";
                    var v = vacante(cargo, desc);

                    if (FiltroBilingue.esDeTrabajoEnIngles(v)) {
                        fallos.add("Falso Positivo en FiltroBilingue: [" + cargo + " | " + fp + "] -> " + desc);
                    }

                    enriquecedor.enriquecer(v);
                    if (v.getNivelInglesRequerido() != null) {
                        fallos.add("Falso Positivo en Enriquecedor: [" + cargo + " | " + fp + "] infirió: " + v.getNivelInglesRequerido());
                    }
                }
            }

            System.out.println("Total combinaciones masivas probadas: " + total);
            assertThat(fallos)
                    .as("No debe haber ningún falso positivo en el generador masivo")
                    .isEmpty();
        }

        @Test
        @DisplayName("Genera y evalúa 60 combinaciones sintéticas bilingües asegurando 100% verdaderos positivos")
        void generadorMasivoVerdaderosPositivos() {
            String[] cargos = {
                    "Software Engineer", "Data Analyst", "Bilingual CSR", "Contador Bilingüe",
                    "Diseñador UI/UX", "Project Manager", "Ingeniero Industrial", "Conductor Bilingüe",
                    "Ejecutivo B2B Bilingüe", "Customer Success Specialist"
            };

            String[] requisitosIdioma = {
                    "Inglés B2 requerido", "Required: C1 English", "100% bilingüe", "MCER B2",
                    "CEFR C1", "Inglés conversacional", "Technical English"
            };

            List<String> fallos = new ArrayList<>();
            int total = 0;

            for (String cargo : cargos) {
                for (String req : requisitosIdioma) {
                    total++;
                    String desc = "Vacante para " + cargo + " en Barranquilla / Remoto. Requisitos: " + req + ". Salario competitivo.";
                    var v = vacante(cargo, desc);

                    if (!FiltroBilingue.esDeTrabajoEnIngles(v)) {
                        fallos.add("Falso Negativo en FiltroBilingue: [" + cargo + " | " + req + "]");
                    }

                    enriquecedor.enriquecer(v);
                    if (v.getNivelInglesRequerido() == null) {
                        fallos.add("Falso Negativo en Enriquecedor: [" + cargo + " | " + req + "] no infirió nivel de inglés");
                    }
                }
            }

            System.out.println("Total combinaciones bilingües probadas: " + total);
            assertThat(fallos)
                    .as("No debe haber ningún falso negativo en ofertas bilingües legítimas")
                    .isEmpty();
        }
    }
}
