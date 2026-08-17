package com.novacrm.excel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.exception.BusinessException;
import com.novacrm.excel.libro.AnalisisDeLibro;
import com.novacrm.excel.libro.DestinoDeHoja;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cuándo un plan aprobado deja de valer.
 *
 * <p>El plan dice «esta columna va a este campo». Aplicarlo a un archivo que no
 * es el que se revisó escribiría datos en columnas equivocadas <em>sin fallar
 * nada</em>: los tipos encajan, las filas se leen, el resumen sale verde. Por
 * eso lo que se compara es el contenido y no el nombre —un archivo corregido
 * entre las dos pantallas se sigue llamando igual—.
 */
class PlanesDeImportacionTest {

    private PlanDeImportacionRepository repositorio;
    private PlanesDeImportacion planes;

    private static final MockMultipartFile REVISADO =
            new MockMultipartFile("archivo", "seguimiento.xlsx", null, "columnas originales".getBytes());
    private static final MockMultipartFile CORREGIDO =
            new MockMultipartFile("archivo", "seguimiento.xlsx", null, "columnas cambiadas".getBytes());

    private static final AnalisisDeLibro ANALISIS = new AnalisisDeLibro(List.of(
            new AnalisisDeLibro.Hoja("Aliados", DestinoDeHoja.EMPRESAS, null, 0,
                    new LinkedHashMap<>(java.util.Map.of(0, "Empresa")),
                    new LinkedHashMap<>(java.util.Map.of(0, "nombre")),
                    List.of(), false)));

    @BeforeEach
    void preparar() {
        repositorio = mock(PlanDeImportacionRepository.class);
        planes = new PlanesDeImportacion(repositorio, new ObjectMapper());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("coordinador@local.test", "x", List.of()));
    }

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
    }

    /** Un plan tal como quedaría tras previsualizar {@code archivo}. */
    private PlanDeImportacion guardado(MockMultipartFile archivo, String usuario, Instant expira) {
        var plan = new PlanDeImportacion();
        plan.setHuella(PlanesDeImportacion.huella(archivo));
        plan.setArchivo(archivo.getOriginalFilename());
        plan.setUsuario(usuario);
        plan.setExpiraEn(expira);
        try {
            plan.setAnalisis(new ObjectMapper().writeValueAsString(ANALISIS));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        return plan;
    }

    private void enLaBase(PlanDeImportacion plan) {
        when(repositorio.findById(any())).thenReturn(Optional.of(plan));
    }

    @Test
    @DisplayName("el mismo archivo devuelve el análisis aprobado")
    void elMismoArchivoLoRecupera() {
        enLaBase(guardado(REVISADO, "coordinador@local.test", Instant.now().plusSeconds(600)));

        var recuperado = planes.recuperar(UUID.randomUUID(), REVISADO);

        assertThat(recuperado.hojas()).hasSize(1);
        assertThat(recuperado.hojas().get(0).destino()).isEqualTo(DestinoDeHoja.EMPRESAS);
        assertThat(recuperado.hojas().get(0).campos()).containsEntry(0, "nombre");
    }

    @Test
    @DisplayName("un archivo distinto con el mismo nombre se rechaza")
    void elArchivoCambiadoSeRechaza() {
        enLaBase(guardado(REVISADO, "coordinador@local.test", Instant.now().plusSeconds(600)));

        assertThatThrownBy(() -> planes.recuperar(UUID.randomUUID(), CORREGIDO))
                .isInstanceOf(BusinessException.class)
                // El mensaje dice que hay que volver a previsualizar. Un "error
                // al importar" a secas invita a reintentar, que es justo lo que
                // no arregla nada aqui.
                .hasMessageContaining("no es el que se previsualizó");
    }

    @Test
    @DisplayName("un plan caducado obliga a previsualizar de nuevo")
    void elPlanCaducadoNoVale() {
        enLaBase(guardado(REVISADO, "coordinador@local.test", Instant.now().minusSeconds(1)));

        assertThatThrownBy(() -> planes.recuperar(UUID.randomUUID(), REVISADO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Vuelve a subir el archivo");
    }

    @Test
    @DisplayName("el plan de otra cuenta no se ejecuta")
    void elPlanAjenoNoVale() {
        enLaBase(guardado(REVISADO, "otra@local.test", Instant.now().plusSeconds(600)));

        assertThatThrownBy(() -> planes.recuperar(UUID.randomUUID(), REVISADO))
                .isInstanceOf(BusinessException.class)
                // Mismo mensaje que "no existe": distinguirlos no ayuda a quien
                // carga y si diria que identificadores existen.
                .hasMessageContaining("Vuelve a subir el archivo");
    }

    @Test
    @DisplayName("un plan que no existe no revienta con un 500")
    void elPlanInexistente() {
        when(repositorio.findById(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> planes.recuperar(UUID.randomUUID(), REVISADO))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("la huella distingue contenidos, no nombres")
    void laHuellaEsDelContenido() {
        var mismoContenidoOtroNombre =
                new MockMultipartFile("archivo", "otro.xlsx", null, "columnas originales".getBytes());

        assertThat(PlanesDeImportacion.huella(REVISADO))
                .isEqualTo(PlanesDeImportacion.huella(mismoContenidoOtroNombre));
        assertThat(PlanesDeImportacion.huella(REVISADO))
                .isNotEqualTo(PlanesDeImportacion.huella(CORREGIDO));
    }
}
