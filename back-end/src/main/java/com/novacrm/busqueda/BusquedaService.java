package com.novacrm.busqueda;

import com.novacrm.busqueda.dto.BusquedaResponse;
import com.novacrm.busqueda.dto.ResultadoBusqueda;
import com.novacrm.colocacion.Colocacion;
import com.novacrm.documento.Documento;
import com.novacrm.empresa.Empresa;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.programa.Programa;
import com.novacrm.vacante.Vacante;
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
            buscarEmpresas(like, likeRaw),
            buscarVacantes(like),
            buscarProgramas(like),
            buscarDocumentos(like),
            buscarColocaciones(like)
        );
    }

    private List<ResultadoBusqueda> buscarEstudiantes(String like, String likeRaw) {
        List<Estudiante> estudiantes = entityManager.createQuery(
                "SELECT e FROM Estudiante e WHERE e.activo = true AND (" +
                "LOWER(e.nombre) LIKE :q OR LOWER(e.apellido) LIKE :q " +
                "OR LOWER(e.email) LIKE :q OR e.numeroDocumento LIKE :qRaw OR LOWER(e.telefono) LIKE :q)",
                Estudiante.class)
            .setParameter("q", like)
            .setParameter("qRaw", likeRaw)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return estudiantes.stream()
            .map(e -> new ResultadoBusqueda(
                e.getId(),
                (e.getNombre() != null ? e.getNombre() : "") + " " + (e.getApellido() != null ? e.getApellido() : "").trim(),
                e.getEmail() != null ? e.getEmail() : (e.getNumeroDocumento() != null ? "Doc: " + e.getNumeroDocumento() : null),
                "ESTUDIANTE"))
            .collect(Collectors.toList());
    }

    private List<ResultadoBusqueda> buscarEmpresas(String like, String likeRaw) {
        List<Empresa> empresas = entityManager.createQuery(
                "SELECT em FROM Empresa em WHERE em.activo = true AND (" +
                "LOWER(em.nombre) LIKE :q OR LOWER(em.sector) LIKE :q " +
                "OR LOWER(em.ciudad) LIKE :q OR LOWER(em.contactoEmail) LIKE :q OR LOWER(em.email) LIKE :q)",
                Empresa.class)
            .setParameter("q", like)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return empresas.stream()
            .map(em -> new ResultadoBusqueda(
                em.getId(),
                em.getNombre(),
                em.getSector() != null ? em.getSector() + (em.getCiudad() != null ? " · " + em.getCiudad() : "") : em.getCiudad(),
                "EMPRESA"))
            .collect(Collectors.toList());
    }

    private List<ResultadoBusqueda> buscarVacantes(String like) {
        List<Vacante> vacantes = entityManager.createQuery(
                "SELECT v FROM Vacante v LEFT JOIN v.empresa em WHERE v.activo = true AND (" +
                "LOWER(v.titulo) LIKE :q OR LOWER(em.nombre) LIKE :q OR LOWER(v.empresaDeclarada) LIKE :q " +
                "OR LOWER(v.ubicacion) LIKE :q OR LOWER(v.jornada) LIKE :q)",
                Vacante.class)
            .setParameter("q", like)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return vacantes.stream()
            .map(v -> {
                String emp = v.getEmpresa() != null && v.getEmpresa().getNombre() != null
                        ? v.getEmpresa().getNombre()
                        : (v.getEmpresaDeclarada() != null ? v.getEmpresaDeclarada() : "Empresa aliada");
                return new ResultadoBusqueda(
                    v.getId(),
                    v.getTitulo(),
                    emp + (v.getUbicacion() != null ? " · " + v.getUbicacion() : "") +
                    (v.getModalidadTrabajo() != null ? " (" + v.getModalidadTrabajo() + ")" : ""),
                    "VACANTE");
            })
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
                "SELECT d FROM Documento d LEFT JOIN d.estudiante e WHERE d.actual = true AND (" +
                "LOWER(d.nombre) LIKE :q OR LOWER(d.tipo) LIKE :q " +
                "OR LOWER(e.nombre) LIKE :q OR LOWER(e.apellido) LIKE :q)",
                Documento.class)
            .setParameter("q", like)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return documentos.stream()
            .map(d -> new ResultadoBusqueda(
                d.getId(),
                d.getNombre(),
                d.getEstudiante() != null ? d.getTipo() + " · " + d.getEstudiante().getNombre() + " " + d.getEstudiante().getApellido() : d.getTipo(),
                "DOCUMENTO"))
            .collect(Collectors.toList());
    }

    private List<ResultadoBusqueda> buscarColocaciones(String like) {
        List<Colocacion> colocaciones = entityManager.createQuery(
                "SELECT c FROM Colocacion c LEFT JOIN c.estudiante e WHERE c.activa = true AND (" +
                "LOWER(c.cargo) LIKE :q OR LOWER(c.empresaNombre) LIKE :q " +
                "OR LOWER(e.nombre) LIKE :q OR LOWER(e.apellido) LIKE :q)",
                Colocacion.class)
            .setParameter("q", like)
            .setMaxResults(MAX_RESULTADOS)
            .getResultList();

        return colocaciones.stream()
            .map(c -> new ResultadoBusqueda(
                c.getId(),
                (c.getCargo() != null ? c.getCargo() : "Colocación") + " en " + c.getEmpresaNombre(),
                c.getEstudiante() != null ? "Estudiante: " + c.getEstudiante().getNombre() + " " + c.getEstudiante().getApellido() : c.getEmpresaNombre(),
                "COLOCACION"))
            .collect(Collectors.toList());
    }
}

