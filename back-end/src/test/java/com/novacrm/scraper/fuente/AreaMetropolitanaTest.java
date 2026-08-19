package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AreaMetropolitanaTest {

    @Test
    @DisplayName("Acepta vacantes ubicadas físicamente en el departamento del Atlántico")
    void aceptaVacantesEnElAtlantico() {
        Vacante v1 = new Vacante();
        v1.setCiudad("Barranquilla");
        v1.setUbicacion("Barranquilla, Atlántico");
        v1.setModalidadTrabajo("Presencial");

        Vacante v2 = new Vacante();
        v2.setCiudad("Soledad");
        v2.setUbicacion("Soledad, Atlántico");
        v2.setModalidadTrabajo("Presencial");

        Vacante v3 = new Vacante();
        v3.setCiudad("Malambo");
        v3.setUbicacion("Parque Industrial Malambo");
        v3.setModalidadTrabajo("Presencial");

        Vacante v4 = new Vacante();
        v4.setCiudad("Puerto Colombia");
        v4.setModalidadTrabajo("Presencial");

        assertThat(AreaMetropolitana.esAtlanticoORemota(v1)).isTrue();
        assertThat(AreaMetropolitana.esAtlanticoORemota(v2)).isTrue();
        assertThat(AreaMetropolitana.esAtlanticoORemota(v3)).isTrue();
        assertThat(AreaMetropolitana.esAtlanticoORemota(v4)).isTrue();
    }

    @Test
    @DisplayName("Acepta vacantes 100% remotas incluso si están registradas en Bogotá u otra ciudad")
    void aceptaVacantesRemotasEnCualquierCiudad() {
        Vacante vBogotaRemota = new Vacante();
        vBogotaRemota.setCiudad("Bogotá");
        vBogotaRemota.setUbicacion("Bogotá D.C.");
        vBogotaRemota.setModalidadTrabajo("Remoto");
        vBogotaRemota.setDescripcion("Trabajo 100% remoto desde casa para cualquier ciudad de Colombia.");

        Vacante vMedellinTeletrabajo = new Vacante();
        vMedellinTeletrabajo.setCiudad("Medellín");
        vMedellinTeletrabajo.setUbicacion("Medellín, Antioquia");
        vMedellinTeletrabajo.setTitulo("Bilingual Agent - Home Office / Teletrabajo");

        Vacante vRemotoIngles = new Vacante();
        vRemotoIngles.setSegmento(Segmento.REMOTO_INGLES);
        vRemotoIngles.setTitulo("Customer Success Specialist");

        assertThat(AreaMetropolitana.esAtlanticoORemota(vBogotaRemota)).isTrue();
        assertThat(AreaMetropolitana.esAtlanticoORemota(vMedellinTeletrabajo)).isTrue();
        assertThat(AreaMetropolitana.esAtlanticoORemota(vRemotoIngles)).isTrue();
    }

    @Test
    @DisplayName("Rechaza estrictamente vacantes presenciales fuera del Atlántico (ej: Bogotá, Medellín, Cali)")
    void rechazaVacantesPresencialesFueraDelAtlantico() {
        Vacante vBogotaPresencial = new Vacante();
        vBogotaPresencial.setCiudad("Bogotá");
        vBogotaPresencial.setUbicacion("Bogotá, Chapinero");
        vBogotaPresencial.setModalidadTrabajo("Presencial");
        vBogotaPresencial.setTitulo("Asesor Bilingüe Presencial");
        vBogotaPresencial.setDescripcion("Trabajo en sitio en sede Bogotá.");

        Vacante vMedellinPresencial = new Vacante();
        vMedellinPresencial.setCiudad("Medellín");
        vMedellinPresencial.setUbicacion("Medellín, Poblado");
        vMedellinPresencial.setModalidadTrabajo("Presencial");

        Vacante vCaliPresencial = new Vacante();
        vCaliPresencial.setCiudad("Cali");
        vCaliPresencial.setUbicacion("Cali, Valle del Cauca");
        vCaliPresencial.setModalidadTrabajo("Presencial");

        assertThat(AreaMetropolitana.esAtlanticoORemota(vBogotaPresencial)).isFalse();
        assertThat(AreaMetropolitana.esAtlanticoORemota(vMedellinPresencial)).isFalse();
        assertThat(AreaMetropolitana.esAtlanticoORemota(vCaliPresencial)).isFalse();
    }
}
