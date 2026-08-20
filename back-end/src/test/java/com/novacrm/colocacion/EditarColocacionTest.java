package com.novacrm.colocacion;

import com.novacrm.auditoria.AuditoriaService;
import com.novacrm.colocacion.dto.ColocacionDtos.GuardarColocacion;
import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.estudiante.Estudiante;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EditarColocacionTest {

    private final ColocacionRepository colocaciones = mock(ColocacionRepository.class);
    private final EmpresaRepository empresas = mock(EmpresaRepository.class);
    private final AuditoriaService auditoria = mock(AuditoriaService.class);

    private ColocacionService servicio() {
        return new ColocacionService(
                colocaciones,
                mock(com.novacrm.estudiante.EstudianteRepository.class),
                mock(com.novacrm.postulacion.PostulacionRepository.class),
                empresas,
                mock(com.novacrm.seguimiento.SeguimientoRepository.class),
                auditoria,
                new BigDecimal("2276176"));
    }

    @Test
    void permiteEditarEmpresaCargoSalarioYDatosDeContratacion() {
        var estudiante = new Estudiante();
        estudiante.setId(UUID.randomUUID());
        estudiante.setNombre("Ana");
        estudiante.setApellido("Perez");

        var empresaAnterior = new Empresa();
        empresaAnterior.setNombre("Empresa anterior");

        var colocacion = new Colocacion();
        colocacion.setId(UUID.randomUUID());
        colocacion.setEstudiante(estudiante);
        colocacion.setEmpresa(empresaAnterior);
        colocacion.setEmpresaNombre("Empresa anterior");
        colocacion.setCargo("Auxiliar");
        colocacion.setTipoVinculacion(TipoVinculacion.EMPLEADO);
        colocacion.setActiva(true);

        when(colocaciones.findById(colocacion.getId())).thenReturn(Optional.of(colocacion));
        when(colocaciones.save(colocacion)).thenReturn(colocacion);
        when(empresas.findByNombreIgnoreCaseActiva("Empresa nueva"))
                .thenReturn(Optional.empty());

        var datos = new GuardarColocacion(
                estudiante.getId(),
                null,
                "Empresa nueva",
                "Analista de datos",
                TipoVinculacion.EMPLEADO,
                LocalDate.of(2026, 8, 20),
                CanalConsecucion.ALIADO,
                new BigDecimal("3500000"),
                "Auxilio de conectividad",
                "HIBRIDO",
                "INDEFINIDO",
                true,
                true,
                null,
                false,
                null,
                "Datos confirmados con la empresa");

        var respuesta = servicio().actualizar(colocacion.getId(), datos, "coordinadora@cac.test");

        assertNull(colocacion.getEmpresa(),
                "un nombre libre debe reemplazar y desvincular la empresa registrada anterior");
        assertEquals("Empresa nueva", respuesta.empresaNombre());
        assertEquals("Analista de datos", respuesta.cargo());
        assertEquals(new BigDecimal("3500000"), respuesta.salario());
        assertEquals("Auxilio de conectividad", respuesta.bonificaciones());
        assertEquals("HIBRIDO", respuesta.modalidad());
        assertEquals("INDEFINIDO", respuesta.tipoContrato());
        assertEquals(Boolean.FALSE, respuesta.chkReglamentoInterno());

        var anteriores = ArgumentCaptor.forClass(String.class);
        var nuevos = ArgumentCaptor.forClass(String.class);
        verify(auditoria).registrar(
                eq("Colocaciones"), eq("Actualización"), eq("Colocacion"),
                eq(colocacion.getId().toString()), eq("Ana Perez - Empresa nueva"),
                anteriores.capture(), nuevos.capture());
        assertEquals(true, anteriores.getValue().contains("Empresa anterior"));
        assertEquals(true, nuevos.getValue().contains("Analista de datos"));
    }
}
