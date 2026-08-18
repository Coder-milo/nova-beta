package com.novacrm.excel;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * El análisis de una previsualización, guardado hasta que se confirme.
 *
 * <p>Su identificador es lo que viaja a la pantalla y vuelve con la
 * importación real: es la forma de decir «ejecuta exactamente lo que enseñaste»
 * en vez de «vuelve a analizar el archivo y confía en que salga igual».
 *
 * <p>Vive en la base y no en memoria a propósito. Entre previsualizar y
 * confirmar puede pasar de todo —el turno de quien carga, un redespliegue— y
 * un plan perdido obliga a repetir el análisis, que es justo lo que se quería
 * evitar. Además deja constancia: por qué una columna acabó en un campo
 * concreto se puede responder después, y con la IA de por medio esa pregunta
 * se hace sola.
 */
@Entity
@Table(name = "plan_de_importacion")
public class PlanDeImportacion extends BaseEntity {

    /** SHA-256 del archivo previsualizado, en hexadecimal. */
    @Column(nullable = false, length = 64)
    private String huella;

    @Column(nullable = false, length = 255)
    private String archivo;

    /** Quién previsualizó. El plan solo lo puede ejecutar esa misma cuenta. */
    @Column(nullable = false, length = 255)
    private String usuario;

    /** El {@code AnalisisDeLibro} serializado. */
    @Column(nullable = false, columnDefinition = "text")
    private String analisis;

    @Column(name = "expira_en", nullable = false)
    private Instant expiraEn;

    public String getHuella() { return huella; }
    public void setHuella(String huella) { this.huella = huella; }

    public String getArchivo() { return archivo; }
    public void setArchivo(String archivo) { this.archivo = archivo; }

    public String getUsuario() { return usuario; }
    public void setUsuario(String usuario) { this.usuario = usuario; }

    public String getAnalisis() { return analisis; }
    public void setAnalisis(String analisis) { this.analisis = analisis; }

    public Instant getExpiraEn() { return expiraEn; }
    public void setExpiraEn(Instant expiraEn) { this.expiraEn = expiraEn; }

    public boolean caducado(Instant ahora) {
        return expiraEn.isBefore(ahora);
    }
}
