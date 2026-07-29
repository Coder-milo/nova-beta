package com.novacrm.scraper.portal;

import com.novacrm.vacante.Vacante;

import java.util.List;

public interface PortalScraper {
    List<Vacante> buscar(String keyword, String ubicacion);
    String getPortalNombre();
}
