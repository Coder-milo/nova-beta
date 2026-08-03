package com.novacrm.empresa.dto;
import java.time.LocalDateTime; import java.util.UUID;
public record ContactoEmpresaResponse(UUID id,LocalDateTime fecha,String tipo,String asunto,
 String contacto,String responsable,String notas){}
