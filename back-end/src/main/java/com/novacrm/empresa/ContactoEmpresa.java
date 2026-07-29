package com.novacrm.empresa;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="contacto_empresa")
public class ContactoEmpresa extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="empresa_id",nullable=false) private Empresa empresa;
 @Column(nullable=false) private LocalDateTime fecha;
 @Column(nullable=false) private String tipo;
 @Column(nullable=false) private String asunto;
 private String contacto; private String responsable;
 @Column(columnDefinition="TEXT") private String notas;
 public Empresa getEmpresa(){return empresa;} public void setEmpresa(Empresa v){empresa=v;}
 public LocalDateTime getFecha(){return fecha;} public void setFecha(LocalDateTime v){fecha=v;}
 public String getTipo(){return tipo;} public void setTipo(String v){tipo=v;}
 public String getAsunto(){return asunto;} public void setAsunto(String v){asunto=v;}
 public String getContacto(){return contacto;} public void setContacto(String v){contacto=v;}
 public String getResponsable(){return responsable;} public void setResponsable(String v){responsable=v;}
 public String getNotas(){return notas;} public void setNotas(String v){notas=v;}
}
