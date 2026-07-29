package com.novacrm.busqueda;

import com.novacrm.busqueda.dto.BusquedaResponse;
import com.novacrm.busqueda.dto.ResultadoBusqueda;
import com.novacrm.documento.Documento;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.programa.Programa;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class BusquedaService {

    private static final int MAX_RESULTADOS = 5;

    private final EntityManager entityManager;

    public BusquedaService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public BusquedaResponse buscar(String q) {
        String like = "%" + q.toLowerCase() + "%";
        String likeRaw = "%" + q + "%";
        return new BusquedaResponse(
            buscarEstudiantes(like, likeRaw),
            buscarProgramas(like),
            buscarDocumentos(like)
        );
    }

    private List<ResultadoBusqueda> buscarEstudiantes(String like, String likeRaw) {
        List<Estudiante> estudiantes = entityManager.createQuery(
                "SELECT e FROM Estudiante e WHERE e.activo = true AND (" +
                "LOWER(e.nombre) LIKE :q OR LOWER(e.apellido) LIKE :q " +
                "OR LOWER(e.email) LIKE :q OR e.numeroDocumento LIKE :qRaw)",
                Estudiante.class)
            .setParameter("q", like)
            .setParameter("qRaw", likeRaw)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return estudiantes.stream()
            .map(e -> new ResultadoBusqueda(
                e.getId(),
                (e.getNombre() != null ? e.getNombre() : "") + " " + (e.getApellido() != null ? e.getApellido() : ""),
                e.getEmail(),
                "ESTUDIANTE"))
            .collect(Collectors.toList());
    }

    private List<ResultadoBusqueda> buscarProgramas(String like) {
        List<Programa> programas = entityManager.createQuery(
                "SELECT p FROM Programa p WHERE LOWER(p.nombre) LIKE :q OR LOWER(p.cliente) LIKE :q",
                Programa.class)
            .setParameter("q", like)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return programas.stream()
            .map(p -> new ResultadoBusqueda(p.getId(), p.getNombre(), p.getCliente(), "PROGRAMA"))
            .collect(Collectors.toList());
    }

    private List<ResultadoBusqueda> buscarDocumentos(String like) {
        List<Documento> documentos = entityManager.createQuery(
                "SELECT d FROM Documento d WHERE d.actual = true AND LOWER(d.nombre) LIKE :q",
                Documento.class)
            .setParameter("q", like)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return documentos.stream()
            .map(d -> new ResultadoBusqueda(d.getId(), d.getNombre(), d.getTipo(), "DOCUMENTO"))
            .collect(Collectors.toList());
    }
}
