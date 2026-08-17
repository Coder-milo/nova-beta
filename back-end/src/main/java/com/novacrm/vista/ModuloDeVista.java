package com.novacrm.vista;

/**
 * Sobre que lista se guarda la vista.
 *
 * <p>Es enumerado y no texto libre porque las vistas se listan filtrando por
 * el: con una cadena, un «Estudiantes» y un «estudiantes» guardados desde dos
 * sitios distintos serian dos modulos, y cada pantalla veria la mitad de sus
 * propias vistas sin ningun error visible.
 */
public enum ModuloDeVista {
    ESTUDIANTES,
    VACANTES,
    EMPRESAS,
    POSTULACIONES,
    SEGUIMIENTO
}
