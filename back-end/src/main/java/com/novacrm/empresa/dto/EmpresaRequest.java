package com.novacrm.empresa.dto;
import jakarta.validation.constraints.*;
public record EmpresaRequest(@NotBlank String nombre,String sector,String sitioWeb,String telefono,
 @Email String email,String direccion,Boolean activo){}
