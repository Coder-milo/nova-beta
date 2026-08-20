package com.novacrm.excel.libro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.ia.ReconocimientoConIa;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Map;

import static com.novacrm.excel.libro.LibroDePrueba.fila;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Lo que se previsualiza es lo que se escribe.
 *
 * <p>Previsualizar y confirmar eran dos peticiones que analizaban el archivo
 * por separado, y desde que el reconocimiento se apoya en la IA el segundo
 * análisis podía no coincidir con el primero. El caso que más duele no es que
 * la IA «se equivoque»: es que en la segunda pasada <em>no conteste</em> —un
 * 429 del proveedor, el presupuesto agotado, un redespliegue que vació lo
 * memorizado— y entonces la columna que la previsualización enseñaba mapeada
 * simplemente deja de mapearse. Nadie ve un error: ve una importación correcta
 * a la que le falta una columna.
 *
 * <p>Aquí la IA está deliberadamente amañada para responder una vez y no volver
 * a hacerlo, que es exactamente ese caso. Si el plan se aplica, la segunda
 * lectura conserva la columna; si alguien vuelve a poner el reanálisis, esta
 * prueba enseña el dato desapareciendo.
 */
class PlanQueSeRepiteTest {

    /** El JSON del plan pasa por el mismo Jackson que la aplicación. */
    private final ObjectMapper json = new ObjectMapper();

    /**
     * Hoja de empresas con una columna que ningún sinónimo cubre.
     *
     * <p>«Empresa», «Sector» y «Ciudad» las reconoce el diccionario y bastan
     * para decidir el destino. «Bitácora del gestor» no la reconoce nadie: es
     * la que solo entra si la IA la resuelve.
     */
    private static LibroDePrueba conBitacora() {
        return LibroDePrueba.nuevo().conHoja("Aliados",
                fila("Empresa", "Sector", "Ciudad", "Bitácora del gestor"),
                fila("Solvo S.A.S.", "BPO", "Medellín", "Pidieron perfiles bilingues"),
                fila("Teleperformance", "BPO", "Bogotá", "Cerrada la convocatoria"));
    }

    /**
     * Una IA que contesta la primera vez y después se calla.
     *
     * <p>No es un capricho del test: {@code sugerirCampos} memoriza en el
     * proceso y {@code sugerirDestino} no memoriza nada, así que un reinicio o
     * un 429 dejan exactamente este comportamiento.
     */
    private static ReconocimientoConIa iaQueContestaUnaVez() {
        var ia = mock(ReconocimientoConIa.class);
        when(ia.disponible()).thenReturn(true);
        when(ia.sugerirCampos(anyList(), any()))
                .thenReturn(Map.of("Bitácora del gestor", "notas"))
                .thenReturn(Map.of());
        when(ia.sugerirDestino(anyString(), any())).thenReturn(Optional.empty());
        return ia;
    }

    @Test
    @DisplayName("el plan guardado conserva la columna que la IA ya no reconocería")
    void loQueSePrevisualizoEsLoQueSeEscribe() throws Exception {
        var libro = conBitacora();
        var archivo = libro.comoArchivo();
        var ia = iaQueContestaUnaVez();

        // ── Previsualización: la IA resuelve la columna suelta ───────────────
        var previa = LectorDeLibro.leer(archivo, ia);
        var hojaPrevia = previa.get(0);

        assertThat(hojaPrevia.importable()).as(hojaPrevia.motivo()).isTrue();
        assertThat(hojaPrevia.hoja().columnas())
                .as("la IA mapeó la columna que el diccionario no cubre")
                .containsEntry("Bitácora del gestor", "notas");
        assertThat(hojaPrevia.columnasPorIa()).containsExactly("Bitácora del gestor");

        // El plan viaja a la base como JSON y vuelve. Si el ida y vuelta
        // perdiera los indices de columna, el mapeo se aplicaria corrido.
        var plan = AnalisisDeLibro.de(previa);
        var guardado = json.readValue(json.writeValueAsString(plan), AnalisisDeLibro.class);

        // ── Confirmación: mismo archivo, plan aplicado ───────────────────────
        var repetida = LectorDeLibro.releer(archivo, guardado);
        var hojaFinal = repetida.get(0);

        assertThat(hojaFinal.destino()).isEqualTo(DestinoDeHoja.EMPRESAS);
        assertThat(hojaFinal.hoja().columnas())
                .as("la columna sigue mapeada aunque la IA ya no la reconozca")
                .containsEntry("Bitácora del gestor", "notas");
        assertThat(hojaFinal.hoja().filas().get(0).texto("notas"))
                .isEqualTo("Pidieron perfiles bilingues");
        assertThat(hojaFinal.hoja().filas()).hasSize(2);

        // Releer no consulta: es lo que hace que el resultado no dependa de si
        // el proveedor esta de pie en ese momento. La unica llamada es la de la
        // previsualizacion.
        verify(ia, times(1)).sugerirCampos(anyList(), any());
    }

    @Test
    @DisplayName("sin plan, el segundo análisis pierde la columna en silencio")
    void elReanalisisEsLoQueSeVieneAEvitar() {
        var archivo = conBitacora().comoArchivo();
        var ia = iaQueContestaUnaVez();

        LectorDeLibro.leer(archivo, ia);
        var segunda = LectorDeLibro.leer(archivo, ia).get(0);

        // Sin error, sin aviso: la hoja se importa igual y le falta un dato.
        assertThat(segunda.importable()).isTrue();
        assertThat(segunda.hoja().columnas())
                .as("esto es el defecto, no el comportamiento deseado")
                .containsEntry("Bitácora del gestor", null);
        assertThat(segunda.hoja().filas().get(0).texto("notas")).isNull();
    }

    @Test
    @DisplayName("las hojas omitidas se repiten omitidas y con su mismo motivo")
    void loQueNoSeImportaTampocoCambia() {
        var libro = LibroDePrueba.nuevo()
                .conHoja("Tablero", fila("SEGUIMIENTO DE EMPLEABILIDAD"))
                .conHoja("Aliados",
                        fila("Empresa", "Sector", "Ciudad"),
                        fila("Solvo S.A.S.", "BPO", "Medellín"));
        var archivo = libro.comoArchivo();

        var previa = LectorDeLibro.leer(archivo);
        var repetida = LectorDeLibro.releer(archivo, AnalisisDeLibro.de(previa));

        assertThat(repetida).hasSameSizeAs(previa);
        // El informe final tiene que seguir diciendo por que una pestaña no
        // entro. Perder el motivo al confirmar deja a quien carga sin saber si
        // su hoja se importo vacia o no se reconocio.
        assertThat(repetida.get(0).importable()).isFalse();
        assertThat(repetida.get(0).motivo()).isEqualTo(previa.get(0).motivo());
        assertThat(repetida.get(1).importable()).isTrue();
        assertThat(repetida.get(1).hoja().filas()).hasSize(1);
    }

    @Test
    @DisplayName("el plan guarda los índices, así que una columna en blanco no lo descuadra")
    void lasColumnasEnBlancoNoCorrenElMapeo() {
        // La hoja de empresas por sector tiene vacias la A y la C. Si el plan
        // guardara posiciones relativas en vez de indices reales, al repetirlo
        // cada campo leeria la celda de al lado.
        var archivo = LibroDePrueba.nuevo().conHoja("Aliados",
                fila(null, "Empresa", null, "Sector", "Ciudad"),
                fila(null, "Solvo S.A.S.", null, "BPO", "Medellín")).comoArchivo();

        var previa = LectorDeLibro.leer(archivo);
        var repetida = LectorDeLibro.releer(archivo, AnalisisDeLibro.de(previa));

        var fila = repetida.get(0).hoja().filas().get(0);
        assertThat(fila.texto("nombre")).isEqualTo("Solvo S.A.S.");
        assertThat(fila.texto("sector")).isEqualTo("BPO");
        assertThat(fila.texto("ciudad")).isEqualTo("Medellín");
    }

    /** El vocabulario que la IA puede proponer sale del destino, no del test. */
    @Test
    @DisplayName("el destino de la hoja también queda congelado")
    void elDestinoNoSeVuelveAPreguntar() {
        var archivo = conBitacora().comoArchivo();
        var ia = mock(ReconocimientoConIa.class);
        when(ia.disponible()).thenReturn(true);
        when(ia.sugerirCampos(anyList(), any())).thenReturn(Map.of());
        when(ia.sugerirDestino(anyString(), any())).thenReturn(Optional.empty());

        var previa = LectorDeLibro.leer(archivo, ia);
        var repetida = LectorDeLibro.releer(archivo, AnalisisDeLibro.de(previa));

        assertThat(repetida.get(0).destino()).isEqualTo(previa.get(0).destino());
        // El diccionario ya decidia esta hoja, asi que la IA no se consulta ni
        // en el primer analisis. Lo que se comprueba es que releer tampoco.
        verify(ia, never()).sugerirDestino(anyString(), anyList());
    }

    /**
     * Una hoja de un aliado puede no usar ninguno de nuestros títulos. La IA
     * logra identificar el destino por el contexto, pero antes se comprobaban
     * los campos obligatorios antes de preguntarle por las columnas: la hoja
     * se omitía aunque la IA habría resuelto «Empresa».
     */
    @Test
    @DisplayName("la IA puede mapear primero una columna obligatoria desconocida")
    void laIaRescataElCampoObligatorioAntesDeValidarLaHoja() {
        var archivo = LibroDePrueba.nuevo().conHoja("Directorio de aliados",
                fila("Razón de la organización", "Actividad principal", "Municipio de operación"),
                fila("Solvo S.A.S.", "BPO", "Barranquilla")).comoArchivo();
        var ia = mock(ReconocimientoConIa.class);
        when(ia.disponible()).thenReturn(true);
        when(ia.sugerirDestino(anyString(), anyList())).thenReturn(Optional.of(DestinoDeHoja.EMPRESAS));
        when(ia.sugerirCampos(anyList(), any())).thenReturn(Map.of(
                "Razón de la organización", "nombre",
                "Actividad principal", "sector",
                "Municipio de operación", "ciudad"));

        var hoja = LectorDeLibro.leer(archivo, ia).get(0);

        assertThat(hoja.importable()).as(hoja.motivo()).isTrue();
        assertThat(hoja.destino()).isEqualTo(DestinoDeHoja.EMPRESAS);
        assertThat(hoja.hoja().columnas()).containsEntry("Razón de la organización", "nombre");
        assertThat(hoja.hoja().filas().get(0).texto("nombre")).isEqualTo("Solvo S.A.S.");
        assertThat(hoja.columnasPorIa()).containsExactlyInAnyOrder(
                "Razón de la organización", "Actividad principal", "Municipio de operación");
    }
}
