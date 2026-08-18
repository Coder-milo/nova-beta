package com.novacrm.busqueda;

import com.novacrm.busqueda.dto.BusquedaResponse;
import com.novacrm.colocacion.Colocacion;
import com.novacrm.documento.Documento;
import com.novacrm.empresa.Empresa;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.programa.Programa;
import com.novacrm.vacante.Vacante;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BusquedaServiceTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private TypedQuery<Estudiante> queryEstudiantes;

    @Mock
    private TypedQuery<Empresa> queryEmpresas;

    @Mock
    private TypedQuery<Vacante> queryVacantes;

    @Mock
    private TypedQuery<Programa> queryProgramas;

    @Mock
    private TypedQuery<Documento> queryDocumentos;

    @Mock
    private TypedQuery<Colocacion> queryColocaciones;

    private BusquedaService busquedaService;

    @BeforeEach
    void setUp() {
        busquedaService = new BusquedaService(entityManager);
    }

    @Test
    @DisplayName("Debe buscar y retornar resultados para las 6 categorias del sistema")
    void debeBuscarEnLasSeisCategorias() {
        // Estudiante mock
        var estudiante = new Estudiante();
        estudiante.setId(UUID.randomUUID());
        estudiante.setNombre("Hector");
        estudiante.setApellido("Suarez");
        estudiante.setEmail("hector@ejemplo.com");

        // Empresa mock
        var empresa = new Empresa();
        empresa.setId(UUID.randomUUID());
        empresa.setNombre("Tech Soluciones");
        empresa.setSector("Tecnologia");
        empresa.setCiudad("Barranquilla");

        // Vacante mock
        var vacante = new Vacante();
        vacante.setId(UUID.randomUUID());
        vacante.setTitulo("Desarrollador Junior");
        vacante.setEmpresa(empresa);
        vacante.setUbicacion("Barranquilla");

        // Programa mock
        var programa = new Programa();
        programa.setId(UUID.randomUUID());
        programa.setNombre("Desarrollo Web 2026");
        programa.setCliente("Alcaldia");

        // Documento mock
        var documento = new Documento();
        documento.setId(UUID.randomUUID());
        documento.setNombre("Hoja_de_Vida_Hector.pdf");
        documento.setTipo("HV");
        documento.setEstudiante(estudiante);

        // Colocacion mock
        var colocacion = new Colocacion();
        colocacion.setId(UUID.randomUUID());
        colocacion.setCargo("Fullstack Developer");
        colocacion.setEmpresaNombre("Tech Soluciones");
        colocacion.setEstudiante(estudiante);

        when(entityManager.createQuery(anyString(), eq(Estudiante.class))).thenReturn(queryEstudiantes);
        when(queryEstudiantes.setParameter(eq("q"), anyString())).thenReturn(queryEstudiantes);
        when(queryEstudiantes.setParameter(eq("qRaw"), anyString())).thenReturn(queryEstudiantes);
        when(queryEstudiantes.setMaxResults(5)).thenReturn(queryEstudiantes);
        when(queryEstudiantes.getResultList()).thenReturn(List.of(estudiante));

        when(entityManager.createQuery(anyString(), eq(Empresa.class))).thenReturn(queryEmpresas);
        when(queryEmpresas.setParameter(eq("q"), anyString())).thenReturn(queryEmpresas);
        when(queryEmpresas.setMaxResults(5)).thenReturn(queryEmpresas);
        when(queryEmpresas.getResultList()).thenReturn(List.of(empresa));

        when(entityManager.createQuery(anyString(), eq(Vacante.class))).thenReturn(queryVacantes);
        when(queryVacantes.setParameter(eq("q"), anyString())).thenReturn(queryVacantes);
        when(queryVacantes.setMaxResults(5)).thenReturn(queryVacantes);
        when(queryVacantes.getResultList()).thenReturn(List.of(vacante));

        when(entityManager.createQuery(anyString(), eq(Programa.class))).thenReturn(queryProgramas);
        when(queryProgramas.setParameter(eq("q"), anyString())).thenReturn(queryProgramas);
        when(queryProgramas.setMaxResults(5)).thenReturn(queryProgramas);
        when(queryProgramas.getResultList()).thenReturn(List.of(programa));

        when(entityManager.createQuery(anyString(), eq(Documento.class))).thenReturn(queryDocumentos);
        when(queryDocumentos.setParameter(eq("q"), anyString())).thenReturn(queryDocumentos);
        when(queryDocumentos.setMaxResults(5)).thenReturn(queryDocumentos);
        when(queryDocumentos.getResultList()).thenReturn(List.of(documento));

        when(entityManager.createQuery(anyString(), eq(Colocacion.class))).thenReturn(queryColocaciones);
        when(queryColocaciones.setParameter(eq("q"), anyString())).thenReturn(queryColocaciones);
        when(queryColocaciones.setMaxResults(5)).thenReturn(queryColocaciones);
        when(queryColocaciones.getResultList()).thenReturn(List.of(colocacion));

        BusquedaResponse response = busquedaService.buscar("hector");

        assertThat(response).isNotNull();
        assertThat(response.estudiantes()).hasSize(1);
        assertThat(response.estudiantes().get(0).titulo()).contains("Hector Suarez");
        assertThat(response.empresas()).hasSize(1);
        assertThat(response.empresas().get(0).titulo()).isEqualTo("Tech Soluciones");
        assertThat(response.vacantes()).hasSize(1);
        assertThat(response.vacantes().get(0).titulo()).isEqualTo("Desarrollador Junior");
        assertThat(response.programas()).hasSize(1);
        assertThat(response.programas().get(0).titulo()).isEqualTo("Desarrollo Web 2026");
        assertThat(response.documentos()).hasSize(1);
        assertThat(response.documentos().get(0).titulo()).isEqualTo("Hoja_de_Vida_Hector.pdf");
        assertThat(response.colocaciones()).hasSize(1);
        assertThat(response.colocaciones().get(0).titulo()).contains("Fullstack Developer");
    }
}
