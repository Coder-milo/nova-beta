package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HvVersionServiceTest {

    @Test
    void liberaLaVersionActualAntesDeInsertarLaNueva() {
        var repository = mock(HojaDeVidaRepository.class);
        var service = new HvVersionService(repository);
        var estudiante = mock(Estudiante.class);
        var plantilla = mock(PlantillaHv.class);
        UUID estudianteId = UUID.randomUUID();
        when(estudiante.getId()).thenReturn(estudianteId);

        var anterior = new HojaDeVida();
        anterior.setNumeroVersion(3);
        anterior.setActual(true);
        when(repository.findVersionesForUpdate(estudianteId)).thenReturn(List.of(anterior));
        when(repository.saveAndFlush(org.mockito.ArgumentMatchers.any(HojaDeVida.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var nueva = service.registrar(estudiante, plantilla, "hojas-de-vida/nueva.pdf", "admin@nova.test");

        var orden = inOrder(repository);
        orden.verify(repository).findVersionesForUpdate(estudianteId);
        orden.verify(repository).flush();
        orden.verify(repository).saveAndFlush(org.mockito.ArgumentMatchers.any(HojaDeVida.class));

        assertThat(anterior.isActual()).isFalse();
        assertThat(nueva.getNumeroVersion()).isEqualTo(4);
        assertThat(nueva.isActual()).isTrue();
        assertThat(nueva.getEstudiante()).isSameAs(estudiante);
        assertThat(nueva.getPlantilla()).isSameAs(plantilla);
        assertThat(nueva.getObjectKey()).isEqualTo("hojas-de-vida/nueva.pdf");
        assertThat(nueva.getGeneradaPor()).isEqualTo("admin@nova.test");
    }

    @Test
    void laConsultaDelHistorialNoBloqueaYLaDeEscrituraSi() throws Exception {
        var historial = HojaDeVidaRepository.class.getMethod(
                "findByEstudianteIdOrderByNumeroVersionDesc", UUID.class);
        var escritura = HojaDeVidaRepository.class.getMethod(
                "findVersionesForUpdate", UUID.class);

        assertThat(historial.getAnnotation(Lock.class)).isNull();
        assertThat(escritura.getAnnotation(Lock.class)).isNotNull();
        assertThat(escritura.getAnnotation(Lock.class).value())
                .isEqualTo(LockModeType.PESSIMISTIC_WRITE);
    }

    @Test
    void cadaRegistroUsaUnaTransaccionIndependiente() throws Exception {
        var registrar = HvVersionService.class.getMethod("registrar",
                Estudiante.class, PlantillaHv.class, String.class, String.class);

        assertThat(registrar.getAnnotation(Transactional.class)).isNotNull();
        assertThat(registrar.getAnnotation(Transactional.class).propagation())
                .isEqualTo(Propagation.REQUIRES_NEW);
    }
}
