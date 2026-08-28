package com.novacrm.scraper;

import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.scraper.dto.EstadoConectorDto;
import com.novacrm.scraper.dto.ResultadoActualizacion;
import com.novacrm.scraper.dto.ResultadoPruebaFuenteDto;
import com.novacrm.scraper.fuente.*;
import com.novacrm.vacante.EnriquecedorDeVacante;
import com.novacrm.vacante.RegistroDeVacante;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Pruebas completas de arquitectura multi-nivel, circuit breaker, deduplicación y panel de control.
 */
class ScrapingServiceTest {

    private EstudianteRepository estudianteRepository;
    private VacanteRepository vacanteRepository;
    private EmpresaRepository empresaRepository;
    private ScrapingEjecucionRepository ejecucionRepository;
    private EnriquecedorDeVacante enriquecedor;
    private ControlDeCuota controlDeCuota;
    private RegistroDeVacante registroDeVacante;

    @BeforeEach
    void setUp() {
        estudianteRepository = mock(EstudianteRepository.class);
        vacanteRepository = mock(VacanteRepository.class);
        empresaRepository = mock(EmpresaRepository.class);
        ejecucionRepository = mock(ScrapingEjecucionRepository.class);
        enriquecedor = mock(EnriquecedorDeVacante.class);
        controlDeCuota = mock(ControlDeCuota.class);

        registroDeVacante = new RegistroDeVacante(vacanteRepository, empresaRepository, enriquecedor);

        when(estudianteRepository.findCargosObjetivoDeActivos())
                .thenReturn(List.of("customer service"));
        when(estudianteRepository.findSectoresObjetivoDeActivos())
                .thenReturn(List.of());
        when(estudianteRepository.findCiudadesDeActivosPorFrecuencia())
                .thenReturn(List.of("Barranquilla"));

        when(vacanteRepository.findVencidasSinCerrar(any())).thenReturn(List.of());
        when(vacanteRepository.contarVigentes(any())).thenReturn(10L);
    }

    private static String sha256(String input) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static Vacante crearVacante(String id, String fuente, String titulo, String ciudad, String ubicacion, String descripcion) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setFuente(fuente);
        v.setCiudad(ciudad);
        v.setUbicacion(ubicacion);
        v.setDescripcion(descripcion);
        v.setSegmento(Segmento.LOCAL_COLOMBIA);
        v.setHashDedup(sha256(fuente + "|" + id));
        v.setActivo(true);
        v.setRevisada(true);
        v.setFechaPublicacion(LocalDateTime.now().minusDays(1));
        return v;
    }

    @Test
    @DisplayName("1. actualizar ejecuta fuentes en hilos propios, cuenta ofertas y guarda nuevas")
    void actualizarEjecutaFuentesYGuardaNuevas() {
        var fuente1 = mock(FuenteDeVacantes.class);
        when(fuente1.nombre()).thenReturn("LINKEDIN");
        when(fuente1.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(fuente1.estaHabilitada()).thenReturn(true);
        when(fuente1.filtraPorCiudad()).thenReturn(true);
        when(fuente1.maximoConsultasPorCorrida()).thenReturn(1);

        var v1 = crearVacante("lk-1", "LINKEDIN", "Bilingual Representative B2", "Barranquilla", "Barranquilla, Atlántico", "English required B2 level");
        var v2 = crearVacante("lk-2", "LINKEDIN", "Customer Service Agent English", "Barranquilla", "Barranquilla, Atlántico", "Requires fluent English");
        when(fuente1.buscar(anyString(), anyString())).thenReturn(ResultadoBusqueda.de(List.of(
                new OfertaCruda(v1, "Sutherland"),
                new OfertaCruda(v2, "Alorica")
        )));

        var fuente2 = mock(FuenteDeVacantes.class);
        when(fuente2.nombre()).thenReturn("COMPUTRABAJO");
        when(fuente2.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(fuente2.estaHabilitada()).thenReturn(true);
        when(fuente2.filtraPorCiudad()).thenReturn(true);
        when(fuente2.maximoConsultasPorCorrida()).thenReturn(1);

        var v3 = crearVacante("ct-1", "COMPUTRABAJO", "Technical Support B2 Bilingual", "Barranquilla", "Barranquilla, Atlántico", "Requires English proficiency");
        when(fuente2.buscar(anyString(), anyString())).thenReturn(ResultadoBusqueda.de(List.of(
                new OfertaCruda(v3, "Teleperformance")
        )));

        // Configurar simulación de guardado en el repositorio
        when(vacanteRepository.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.findByHashContenido(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.save(any(Vacante.class))).thenAnswer(inv -> inv.getArgument(0));
        when(empresaRepository.findByNombreIgnoreCaseActiva(anyString())).thenReturn(Optional.empty());
        when(empresaRepository.save(any(Empresa.class))).thenAnswer(inv -> inv.getArgument(0));

        var servicio = new ScrapingService(
                List.of(fuente1, fuente2),
                estudianteRepository,
                vacanteRepository,
                ejecucionRepository,
                registroDeVacante,
                controlDeCuota
        );

        ResultadoActualizacion res = servicio.actualizar(ScrapingEjecucion.Origen.MANUAL);

        assertThat(res.vacantesNuevas()).isEqualTo(3);
        verify(vacanteRepository, times(3)).save(any(Vacante.class));

        var captor = ArgumentCaptor.forClass(ScrapingEjecucion.class);
        verify(ejecucionRepository).save(captor.capture());
        ScrapingEjecucion guardada = captor.getValue();
        assertThat(guardada.getVacantesNuevas()).isEqualTo(3);
        assertThat(guardada.getPortales()).contains("LINKEDIN").contains("COMPUTRABAJO");
        assertThat(guardada.getOfertasPorPortal()).contains("LINKEDIN=2").contains("COMPUTRABAJO=1");
        assertThat(guardada.getError()).isNull();
    }

    @Test
    @DisplayName("2. deduplicación cruzada por hashContenido descarta ofertas idénticas entre distintos portales")
    void deduplicacionPorHashContenidoDescartaDuplicadosCruzados() {
        // Misma plaza publicada en LinkedIn y en Computrabajo con títulos equivalentes
        var vLinkedIn = crearVacante("l-100", "LINKEDIN", "Bilingual Customer Support Representative", "Barranquilla", "Barranquilla, Atlántico", "Fluent English required");
        var vComputrabajo = crearVacante("c-200", "COMPUTRABAJO", "BILINGUAL CUSTOMER SUPPORT REPRESENTATIVE", "Barranquilla", "Barranquilla, Atlántico", "Fluent English required");

        // Primera inserción (LinkedIn): se guarda
        when(vacanteRepository.findByHashDedup(vLinkedIn.getHashDedup())).thenReturn(Optional.empty());
        when(vacanteRepository.findByHashContenido(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.save(any(Vacante.class))).thenReturn(vLinkedIn);

        Optional<Vacante> reg1 = registroDeVacante.registrarSiEsNueva(vLinkedIn, "Sutherland");
        assertThat(reg1).isPresent();
        assertThat(vLinkedIn.getHashContenido()).isNotNull();

        // Segunda inserción (Computrabajo): findByHashDedup es distinto pero findByHashContenido encuentra la existente
        when(vacanteRepository.findByHashDedup(vComputrabajo.getHashDedup())).thenReturn(Optional.empty());
        when(vacanteRepository.findByHashContenido(vLinkedIn.getHashContenido())).thenReturn(Optional.of(vLinkedIn));

        Optional<Vacante> reg2 = registroDeVacante.registrarSiEsNueva(vComputrabajo, "Sutherland");
        assertThat(reg2).isEmpty(); // Rechazada por duplicación cruzada de contenido
    }

    @Test
    @DisplayName("3. circuit breaker y aislamiento de errores: fallo 403 o 500 en una fuente no detiene a las demás")
    void aislamientoDeErroresCuandoFallaUnaFuente() {
        var fuenteFalla = mock(FuenteDeVacantes.class);
        when(fuenteFalla.nombre()).thenReturn("INDEED_DIRECT");
        when(fuenteFalla.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(fuenteFalla.estaHabilitada()).thenReturn(true);
        when(fuenteFalla.maximoConsultasPorCorrida()).thenReturn(1);
        when(fuenteFalla.buscar(any(), any())).thenThrow(new RuntimeException("403 Forbidden - Cloudflare Bot Protection"));

        var fuenteExitosa = mock(FuenteDeVacantes.class);
        when(fuenteExitosa.nombre()).thenReturn("SMARTRECRUITERS");
        when(fuenteExitosa.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(fuenteExitosa.estaHabilitada()).thenReturn(true);
        when(fuenteExitosa.maximoConsultasPorCorrida()).thenReturn(1);

        var vOk = crearVacante("sr-1", "SMARTRECRUITERS", "Bilingual Tier 1 Support", "Barranquilla", "Barranquilla, Atlántico", "English B2 required");
        when(fuenteExitosa.buscar(any(), any())).thenReturn(ResultadoBusqueda.de(List.of(new OfertaCruda(vOk, "Alorica"))));

        when(vacanteRepository.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.findByHashContenido(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.save(any(Vacante.class))).thenAnswer(inv -> inv.getArgument(0));

        var servicio = new ScrapingService(
                List.of(fuenteFalla, fuenteExitosa),
                estudianteRepository,
                vacanteRepository,
                ejecucionRepository,
                registroDeVacante,
                controlDeCuota
        );

        ResultadoActualizacion resultado = servicio.actualizar(ScrapingEjecucion.Origen.PROGRAMADA);

        assertThat(resultado.vacantesNuevas()).isEqualTo(1);

        var captor = ArgumentCaptor.forClass(ScrapingEjecucion.class);
        verify(ejecucionRepository).save(captor.capture());
        ScrapingEjecucion guardada = captor.getValue();
        assertThat(guardada.getError()).contains("INDEED_DIRECT: 403 Forbidden");
        assertThat(guardada.getOfertasPorPortal()).contains("SMARTRECRUITERS=1");
    }

    @Test
    @DisplayName("4. filtrado bilingüe y geográfico descarta ofertas no admisibles antes de guardar")
    void filtradoBilingueYGeograficoDescartaNoAdmisibles() {
        var fuente = mock(FuenteDeVacantes.class);
        when(fuente.nombre()).thenReturn("TEST_PORTAL");
        when(fuente.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(fuente.estaHabilitada()).thenReturn(true);
        when(fuente.maximoConsultasPorCorrida()).thenReturn(1);

        // 1. Válida: Bilingüe + Barranquilla
        var vValida = crearVacante("v-1", "TEST_PORTAL", "Bilingual Customer Support", "Barranquilla", "Barranquilla, Atlántico", "Fluent English required C1/B2");
        // 2. Descartada por idioma: Monolingüe
        var vMonolingue = crearVacante("v-2", "TEST_PORTAL", "Asesor Comercial de Mostrador", "Barranquilla", "Barranquilla, Atlántico", "Ventas presenciales en español");
        // 3. Descartada por geografía: Bogotá presencial
        var vBogota = crearVacante("v-3", "TEST_PORTAL", "Bilingual Support Representative", "Bogotá", "Bogotá, Cundinamarca", "Presencial en sede norte Bogotá, English B2");
        // 4. Válida: 100% Remota en inglés
        var vRemota = crearVacante("v-4", "TEST_PORTAL", "Remote English Chat Specialist", null, "Remoto, Colombia", "Work from home anywhere, English requirement");
        vRemota.setModalidadTrabajo("REMOTO");

        when(fuente.buscar(any(), any())).thenReturn(ResultadoBusqueda.de(List.of(
                new OfertaCruda(vValida, "Sutherland"),
                new OfertaCruda(vMonolingue, "Empresa Local"),
                new OfertaCruda(vBogota, "Call Center Bogota"),
                new OfertaCruda(vRemota, "Global BPO")
        )));

        when(vacanteRepository.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.findByHashContenido(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.save(any(Vacante.class))).thenAnswer(inv -> inv.getArgument(0));

        var servicio = new ScrapingService(
                List.of(fuente),
                estudianteRepository,
                vacanteRepository,
                ejecucionRepository,
                registroDeVacante,
                controlDeCuota
        );

        ResultadoActualizacion res = servicio.actualizar(ScrapingEjecucion.Origen.MANUAL);

        // Solo vValida y vRemota deben ser guardadas (2 de 4)
        assertThat(res.vacantesNuevas()).isEqualTo(2);

        var captor = ArgumentCaptor.forClass(ScrapingEjecucion.class);
        verify(ejecucionRepository).save(captor.capture());
        ScrapingEjecucion ejecucion = captor.getValue();
        assertThat(ejecucion.getDescartadasPorIdioma()).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("5. listarEstadoConectores, probarFuente y sincronizarFuente funcionan individualmente")
    void listarEstadoConectoresYProbarFuente() {
        var f1 = mock(FuenteDeVacantes.class);
        when(f1.nombre()).thenReturn("LINKEDIN");
        when(f1.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(f1.estaHabilitada()).thenReturn(true);
        when(f1.filtraPorCiudad()).thenReturn(true);
        when(f1.maximoConsultasPorCorrida()).thenReturn(1);
        when(f1.buscar(any(), any())).thenReturn(ResultadoBusqueda.de(List.of(
                new OfertaCruda(crearVacante("l-1", "LINKEDIN", "Bilingual Tech Support", "Barranquilla", "Barranquilla, Atlántico", "English required B2"), "Sutherland")
        )));

        var f2 = mock(FuenteDeVacantes.class);
        when(f2.nombre()).thenReturn("JSEARCH");
        when(f2.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(f2.estaHabilitada()).thenReturn(false); // Esperando API key
        when(f2.filtraPorCiudad()).thenReturn(true);
        when(f2.maximoConsultasPorCorrida()).thenReturn(1);

        when(controlDeCuota.restantes("JSEARCH", 200)).thenReturn(180);

        var ejecucionPasada = new ScrapingEjecucion();
        ejecucionPasada.setInicio(LocalDateTime.now().minusHours(2));
        ejecucionPasada.setFin(LocalDateTime.now().minusHours(2).plusMinutes(1));
        ejecucionPasada.setPortales("LINKEDIN,JSEARCH");
        ejecucionPasada.setOfertasPorPortal("LINKEDIN=15;JSEARCH=0");
        when(ejecucionRepository.findTop20ByOrderByInicioDesc()).thenReturn(List.of(ejecucionPasada));

        when(vacanteRepository.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.findByHashContenido(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.save(any(Vacante.class))).thenAnswer(inv -> inv.getArgument(0));

        var servicio = new ScrapingService(
                List.of(f1, f2),
                estudianteRepository,
                vacanteRepository,
                ejecucionRepository,
                registroDeVacante,
                controlDeCuota
        );

        // A. Listar estado conectores
        List<EstadoConectorDto> estados = servicio.listarEstadoConectores();
        assertThat(estados).hasSize(2);

        var estadoLk = estados.stream().filter(e -> e.nombre().equals("LINKEDIN")).findFirst().orElseThrow();
        assertThat(estadoLk.estado()).isEqualTo("ACTIVO");
        assertThat(estadoLk.habilitado()).isTrue();
        assertThat(estadoLk.ultimoConteo()).isEqualTo(15);

        var estadoJs = estados.stream().filter(e -> e.nombre().equals("JSEARCH")).findFirst().orElseThrow();
        assertThat(estadoJs.estado()).isEqualTo("ESPERA_CONFIGURACION");
        assertThat(estadoJs.habilitado()).isFalse();
        assertThat(estadoJs.cuotaRestante()).isEqualTo(180);
        assertThat(estadoJs.cuotaLimite()).isEqualTo(200);

        // B. Probar fuente individual (dry-run)
        ResultadoPruebaFuenteDto pruebaLk = servicio.probarFuente("LINKEDIN");
        assertThat(pruebaLk.exito()).isTrue();
        assertThat(pruebaLk.estado()).isEqualTo("OK");
        assertThat(pruebaLk.ofertasEncontradas()).isEqualTo(1);
        assertThat(pruebaLk.latenciaMs()).isGreaterThanOrEqualTo(0);

        ResultadoPruebaFuenteDto pruebaJs = servicio.probarFuente("JSEARCH");
        assertThat(pruebaJs.exito()).isFalse();
        assertThat(pruebaJs.estado()).isEqualTo("DESHABILITADO");

        // C. Sincronizar fuente individual
        ResultadoActualizacion syncRes = servicio.sincronizarFuente("LINKEDIN");
        assertThat(syncRes.vacantesNuevas()).isEqualTo(1);
        verify(vacanteRepository).save(any(Vacante.class));
    }

    @Test
    @DisplayName("6. soloFrescas descarta ofertas con fecha mayor a 7 días o sin fecha")
    void filtradoFrescuraDescartaVacantesConFechaViejaOSinFecha() {
        var fuente = mock(FuenteDeVacantes.class);
        when(fuente.nombre()).thenReturn("TEST_PORTAL");
        when(fuente.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
        when(fuente.estaHabilitada()).thenReturn(true);
        when(fuente.maximoConsultasPorCorrida()).thenReturn(1);

        // 1. Fresca: 2 días de antigüedad
        var vFresca = crearVacante("v-fresca", "TEST_PORTAL", "Bilingual Support Agent", "Barranquilla", "Barranquilla, Atlántico", "English required");
        vFresca.setFechaPublicacion(LocalDateTime.now().minusDays(2));

        // 2. Vieja: 10 días de antigüedad
        var vVieja = crearVacante("v-vieja", "TEST_PORTAL", "Bilingual Support Agent", "Barranquilla", "Barranquilla, Atlántico", "English required");
        vVieja.setFechaPublicacion(LocalDateTime.now().minusDays(10));

        // 3. Sin fecha: null
        var vSinFecha = crearVacante("v-sin-fecha", "TEST_PORTAL", "Bilingual Support Agent", "Barranquilla", "Barranquilla, Atlántico", "English required");
        vSinFecha.setFechaPublicacion(null);

        when(fuente.buscar(any(), any())).thenReturn(ResultadoBusqueda.de(List.of(
                new OfertaCruda(vFresca, "Empresa 1"),
                new OfertaCruda(vVieja, "Empresa 2"),
                new OfertaCruda(vSinFecha, "Empresa 3")
        )));

        when(vacanteRepository.findByHashDedup(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.findByHashContenido(anyString())).thenReturn(Optional.empty());
        when(vacanteRepository.save(any(Vacante.class))).thenAnswer(inv -> inv.getArgument(0));

        var servicio = new ScrapingService(
                List.of(fuente),
                estudianteRepository,
                vacanteRepository,
                ejecucionRepository,
                registroDeVacante,
                controlDeCuota
        );

        ResultadoActualizacion res = servicio.actualizar(ScrapingEjecucion.Origen.MANUAL);

        // Solo vFresca debe ser guardada (1 de 3)
        assertThat(res.vacantesNuevas()).isEqualTo(1);
        verify(vacanteRepository, times(1)).save(any(Vacante.class));
    }
}
