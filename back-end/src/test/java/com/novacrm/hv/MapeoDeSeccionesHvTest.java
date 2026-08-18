package com.novacrm.hv;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Donde empieza cada seccion de la hoja de vida.
 *
 * <p>Los encabezados se buscaban con {@code indexOf} sobre el documento
 * entero, y sus palabras son las mismas que usa cualquiera al escribir. Un
 * perfil que dice «con mas de cinco años de <em>experiencia</em> en servicio al
 * cliente» abria ahi el bloque de experiencia laboral: el perfil se cortaba a
 * la mitad y el primer «cargo» que se leia era el resto de esa frase. Lo mismo
 * con «educacion» o «habilidades» mencionadas de paso.
 *
 * <p>La otra mitad del mismo problema es lo que se rellenaba cuando no habia
 * dato: «Cargo Desempeñado», «Empresa / Organización», «Institución Educativa»,
 * y los años 2022 y 2023 puestos a dedo. Eso no se queda en la pantalla de
 * revision: se imprime en el PDF que la persona manda a las empresas.
 */
class MapeoDeSeccionesHvTest {

    private static MockMultipartFile pdfCon(List<String> lineas) throws Exception {
        byte[] pdfBytes;
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream contents = new PDPageContentStream(doc, page)) {
                contents.beginText();
                contents.setFont(PDType1Font.HELVETICA, 10);
                contents.newLineAtOffset(50, 740);
                boolean primera = true;
                for (String linea : lineas) {
                    if (!primera) contents.newLineAtOffset(0, -15);
                    primera = false;
                    contents.showText(linea);
                }
                contents.endText();
            }
            var out = new ByteArrayOutputStream();
            doc.save(out);
            pdfBytes = out.toByteArray();
        }
        return new MockMultipartFile("archivo", "hoja.pdf", "application/pdf", pdfBytes);
    }

    @Test
    @DisplayName("la palabra 'experiencia' dentro del perfil no abre la seccion de experiencia")
    void laPalabraSueltaNoAbreLaSeccion() throws Exception {
        var pdf = pdfCon(List.of(
                "Maria Fernanda Lopez",
                "maria.lopez@example.com",
                "PERFIL PROFESIONAL",
                "Tecnica con cinco anos de experiencia en servicio al cliente y ventas.",
                "EXPERIENCIA LABORAL",
                "Asesora de servicio",
                "Contact Center SAS",
                "2021 - 2023",
                "- Atencion de usuarios por linea telefonica."));

        var datos = new ExtraccionHvService().extraer(pdf).datosEstructurados();

        assertThat(datos.perfilProfesional())
                .as("el perfil llega entero y no cortado en la palabra 'experiencia'")
                .contains("servicio al cliente");
        assertThat(datos.experiencias()).hasSize(1);
        assertThat(datos.experiencias().get(0).cargo()).isEqualTo("Asesora de servicio");
        assertThat(datos.experiencias().get(0).empresa()).isEqualTo("Contact Center SAS");
    }

    @Test
    @DisplayName("sin experiencia escrita no se inventa un empleo")
    void sinExperienciaNoSeInventaUnEmpleo() throws Exception {
        var pdf = pdfCon(List.of(
                "Maria Fernanda Lopez",
                "maria.lopez@example.com",
                "EXPERIENCIA LABORAL",
                "- Sin experiencia laboral formal."));

        var datos = new ExtraccionHvService().extraer(pdf).datosEstructurados();

        assertThat(datos.experiencias())
                .as("una viñeta suelta no es un empleo con cargo y empresa")
                .allSatisfy(x -> {
                    assertThat(x.cargo()).isNotEqualTo("Cargo Desempeñado");
                    assertThat(x.empresa()).isNotEqualTo("Empresa / Organización");
                });
    }

    @Test
    @DisplayName("las fechas que nadie escribio no se rellenan")
    void lasFechasNoSeRellenan() throws Exception {
        var pdf = pdfCon(List.of(
                "Maria Fernanda Lopez",
                "maria.lopez@example.com",
                "EXPERIENCIA LABORAL",
                "Asesora de servicio",
                "Contact Center SAS",
                "- Atencion de usuarios."));

        var datos = new ExtraccionHvService().extraer(pdf).datosEstructurados();

        assertThat(datos.experiencias()).isNotEmpty();
        assertThat(datos.experiencias().get(0).fechaInicio())
                .as("2022 por defecto fechaba empleos que nadie fecho")
                .isNull();
    }

    @Test
    @DisplayName("la institucion y el ano de los estudios no se rellenan de oficio")
    void laEducacionNoSeRellena() throws Exception {
        var pdf = pdfCon(List.of(
                "Maria Fernanda Lopez",
                "maria.lopez@example.com",
                "EDUCACION",
                "Tecnica en asistencia administrativa"));

        var datos = new ExtraccionHvService().extraer(pdf).datosEstructurados();

        assertThat(datos.formaciones()).hasSize(1);
        var formacion = datos.formaciones().get(0);
        assertThat(formacion.programa()).isEqualTo("Tecnica en asistencia administrativa");
        assertThat(formacion.institucion()).isNull();
        assertThat(formacion.fechaFin()).isNull();
    }

    @Test
    @DisplayName("el numero de contacto no se cuela como documento de identidad")
    void elCelularNoSeCuelaComoDocumento() throws Exception {
        var pdf = pdfCon(List.of(
                "Maria Fernanda Lopez",
                "maria.lopez@example.com",
                "3009876543"));

        var campos = new ExtraccionHvService().extraer(pdf).campos();

        assertThat(campos)
                .filteredOn(c -> c.campo().equals("numeroDocumento"))
                .allSatisfy(c -> assertThat(c.valor()).isNotEqualTo("3009876543"));
    }
}
