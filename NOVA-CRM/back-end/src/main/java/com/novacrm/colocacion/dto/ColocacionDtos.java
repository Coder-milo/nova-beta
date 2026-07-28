package com.novacrm.colocacion.dto;

import com.novacrm.colocacion.CanalConsecucion;
import com.novacrm.colocacion.TipoVinculacion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ColocacionDtos {

    private ColocacionDtos() {
    }

    public record GuardarColocacion(
            UUID estudianteId,
            /** De que proceso salio, si salio de uno registrado. */
            UUID postulacionId,
            @NotBlank(message = "Falta el nombre de la empresa")
            @Size(max = 255) String empresaNombre,
            @Size(max = 255) String cargo,
            TipoVinculacion tipoVinculacion,
            LocalDate fechaInicio,
            CanalConsecucion canalConsecucion,
            @PositiveOrZero(message = "El salario no puede ser negativo") BigDecimal salario,
            @Size(max = 255) String bonificaciones,
            @Size(max = 40) String modalidad,
            @Size(max = 60) String tipoContrato,
            Boolean chkContrato,
            Boolean chkVerificacionVacante,
            Boolean chkBenchmark,
            Boolean chkReglamentoInterno,
            Boolean chkColillaPago,
            String observaciones) {}

    public record ColocacionResponse(
            UUID id,
            UUID estudianteId,
            String estudianteNombre,
            String sectorObjetivo,
            String nivelIngles,
            Integer porcentajeEmpleabilidad,
            String empresaNombre,
            String cargo,
            String tipoVinculacion,
            String tipoVinculacionEtiqueta,
            LocalDate fechaInicio,
            String canalConsecucion,
            String canalConsecucionEtiqueta,
            /** Si se le atribuye al programa o la persona lo consiguio sola. */
            boolean gestionadaPorElPrograma,
            BigDecimal salario,
            /** Contra la meta configurada. Positivo = por encima. */
            BigDecimal diferenciaVsMeta,
            boolean superaMeta,
            String bonificaciones,
            String modalidad,
            String tipoContrato,
            Boolean chkContrato,
            Boolean chkVerificacionVacante,
            Boolean chkBenchmark,
            Boolean chkReglamentoInterno,
            Boolean chkColillaPago,
            int checklistVerificados,
            int checklistTotal,
            String checklistResumen,
            /** Miradas y no cumplen: lo unico que hay que perseguir. */
            List<String> checklistIncumplidos,
            String observaciones,
            boolean activa) {}

    /** Cifras de cierre de cohorte. Es lo que se reporta. */
    public record ResumenColocaciones(
            long total,
            long sobreMeta,
            long bajoMeta,
            long gestionadasPorElPrograma,
            long autogestionadas,
            BigDecimal metaSalarial,
            BigDecimal salarioPromedio,
            long checklistCompletos,
            List<ConteoCanal> porCanal) {}

    public record ConteoCanal(String canal, String etiqueta, long total) {}
}
