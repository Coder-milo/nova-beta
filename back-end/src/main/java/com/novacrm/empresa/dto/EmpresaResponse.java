package com.novacrm.empresa.dto;
import java.time.Instant; import java.util.UUID;
public record EmpresaResponse(UUID id,String nombre,String sector,String sitioWeb,String telefono,
 String email,String direccion,boolean activo,long vacantes,Instant createdAt,Instant updatedAt){}
