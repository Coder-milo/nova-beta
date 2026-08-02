package com.novacrm.scraper.fuente;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Consumo de una fuente con cupo limitado, contado por periodo.
 *
 * <p>Hace falta que sea persistente: JSearch da 200 peticiones al mes y el
 * proceso se reinicia con cada despliegue, asi que un contador en memoria
 * volveria a cero sin que el proveedor lo hiciera. Sin esto, el bucle de
 * busqueda —decenas de peticiones por corrida, con cron diario— quema el cupo
 * del mes en menos de una semana y las tres semanas restantes no hay vacantes
 * colombianas.
 */
@Entity
@Table(name = "cuota_fuente", uniqueConstraints = @UniqueConstraint(
        name = "uk_cuota_fuente_periodo", columnNames = {"fuente", "periodo"}))
public class CuotaFuente extends BaseEntity {

    private static final DateTimeFormatter MES = DateTimeFormatter.ofPattern("yyyy-MM");

    @Column(nullable = false, length = 40)
    private String fuente;

    /** Periodo de facturacion del proveedor, en formato {@code yyyy-MM}. */
    @Column(nullable = false, length = 7)
    private String periodo;

    @Column(nullable = false)
    private int consumidas = 0;

    @Column(nullable = false)
    private int limite;

    protected CuotaFuente() {
    }

    public CuotaFuente(String fuente, String periodo, int limite) {
        this.fuente = fuente;
        this.periodo = periodo;
        this.limite = limite;
    }

    /** El periodo al que pertenece una fecha. */
    public static String periodoDe(LocalDate fecha) {
        return fecha.format(MES);
    }

    public String getFuente() { return fuente; }
    public String getPeriodo() { return periodo; }
    public int getConsumidas() { return consumidas; }
    public int getLimite() { return limite; }
    public void setLimite(int limite) { this.limite = limite; }
    public int getRestantes() { return Math.max(0, limite - consumidas); }
}
