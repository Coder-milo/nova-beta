package com.novacrm.hv;

import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.hv.dto.AdaptacionCvInglesRequest;
import com.novacrm.hv.dto.ExperienciaDto;
import com.novacrm.ia.NoopProveedorIa;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AdaptacionCvInglesServiceTest {

    @Test
    void testAdaptacionFallbackHeuristico() {
        var estudianteRepo = Mockito.mock(EstudianteRepository.class);
        var nivelInglesRepo = Mockito.mock(NivelInglesRepository.class);
        var service = new AdaptacionCvInglesService(new NoopProveedorIa(), estudianteRepo, nivelInglesRepo);

        var req = new AdaptacionCvInglesRequest(
                "Desarrollador Backend en Java",
                "Soy apasionado por el desarrollo de tecnologia y tengo conocimientos en bases de datos.",
                "Trabajo en equipo, liderazgo, resolucion de problemas",
                List.of(new ExperienciaDto("Profesor de ciencias", "COLEGIO GENESIS", "Barranquilla", "2024", "2025", false, false, "Apoye en labores de ensenanza")),
                "B2"
        );

        var res = service.adaptar(null, req);
        assertNotNull(res);
        assertTrue(res.targetRole().contains("Software Developer"));
        assertNotNull(res.professionalSummary());
        assertFalse(res.actionVerbsUsed().isEmpty());
        assertEquals(1, res.experiences().size());
    }
}
