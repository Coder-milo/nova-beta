package com.novacrm.scraper;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Registro de cada actualizacion de vacantes.
 *
 * <p>Existe para poder responder "cuantas ofertas entraron en la ultima
 * actualizacion", que es lo que se muestra en el panel. Antes el numero solo
 * quedaba en el log del servidor.
 */
@Entity
@Table(name = "scraping_ejecucion")
public class ScrapingEjecucion extends BaseEntity {

    /** Quien disparo la actualizacion. */
    public enum Origen { PROGRAMADA, MANUAL }

    @Column(nullable = false)
    private LocalDateTime inicio;

    private LocalDateTime fin;

    @Column(name = "vacantes_nuevas", nullable = false)
    private int vacantesNuevas;

    @Column(name = "vacantes_cerradas", nullable = false)
    private int vacantesCerradas;

    /** Portales consultados, separados por coma. */
    private String portales;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Origen origen = Origen.PROGRAMADA;

    @Column(columnDefinition = "TEXT")
    private String error;

    public LocalDateTime getInicio() { return inicio; }
    public void setInicio(LocalDateTime inicio) { this.inicio = inicio; }
    public LocalDateTime getFin() { return fin; }
    public void setFin(LocalDateTime fin) { this.fin = fin; }
    public int getVacantesNuevas() { return vacantesNuevas; }
    public void setVacantesNuevas(int vacantesNuevas) { this.vacantesNuevas = vacantesNuevas; }
    public int getVacantesCerradas() { return vacantesCerradas; }
    public void setVacantesCerradas(int vacantesCerradas) { this.vacantesCerradas = vacantesCerradas; }
    public String getPortales() { return portales; }
    public void setPortales(String portales) { this.portales = portales; }
    public Origen getOrigen() { return origen; }
    public void setOrigen(Origen origen) { this.origen = origen; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
