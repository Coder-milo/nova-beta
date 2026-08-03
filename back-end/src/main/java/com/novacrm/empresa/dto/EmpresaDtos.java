package com.novacrm.empresa.dto;

import com.novacrm.empresa.EstadoRelacion;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public final class EmpresaDtos {

    private EmpresaDtos() {
    }

    public record GuardarEmpresa(
            @NotBlank(message = "Falta el nombre de la empresa")
            @Size(max = 255) String nombre,
            @Size(max = 255) String sector,
            @Size(max = 255) String ciudad,
            @Size(max = 500) String sitioWeb,
            @Size(max = 50) String telefono,
            @Email(message = "Correo de la empresa invalido") @Size(max = 255) String email,
            String direccion,
            @Size(max = 255) String contactoNombre,
            @Email(message = "Correo de contacto invalido") @Size(max = 255) String contactoEmail,
            @Size(max = 255) String contactoCanal,
            LocalDate fechaPrimerContacto,
            EstadoRelacion estadoRelacion,
            String proximoPaso,
            String notas,
            String cargosTipicos,
            @Size(max = 255) String canalPostulacion) {}

    /**
     * Ficha de empresa con los contadores calculados.
     *
     * <p>Participantes, respuestas y contratados no salen de columnas: se
     * cuentan desde postulaciones y colocaciones. En la hoja eran columnas y
     * decian "104" en todas las filas.
     */
    public record EmpresaResponse(
            UUID id,
            String nombre,
            String sector,
            String ciudad,
            String sitioWeb,
            String telefono,
            String email,
            String direccion,
            String contactoNombre,
            String contactoEmail,
            String contactoCanal,
            LocalDate fechaPrimerContacto,
            String estadoRelacion,
            String estadoRelacionEtiqueta,
            String proximoPaso,
            String notas,
            String cargosTipicos,
            String canalPostulacion,
            long participantesEnviados,
            long respuestasRecibidas,
            long contratados,
            long vacantesAbiertas,
            /** Dias desde el ultimo movimiento. Sirve para ver quien se enfria. */
            Integer diasDesdePrimerContacto,
            boolean activo) {}

    public record ResumenCrm(
            long total,
            long sinContactar,
            long contactadas,
            long enConversacion,
            long aliadas,
            long descartadas) {}
}
