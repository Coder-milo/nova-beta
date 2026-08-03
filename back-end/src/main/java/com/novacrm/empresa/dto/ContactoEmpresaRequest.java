package com.novacrm.empresa.dto;
import jakarta.validation.constraints.NotBlank; import java.time.LocalDateTime;
public record ContactoEmpresaRequest(LocalDateTime fecha,@NotBlank String tipo,@NotBlank String asunto,
 String contacto,String responsable,String notas){}
