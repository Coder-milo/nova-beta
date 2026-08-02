package com.novacrm.scraper.fuente;

/**
 * A que tipo de empleo apunta una fuente, y por tanto a quien le sirve.
 *
 * <p>Hasta ahora la unica fuente activa era Remotive: empleo remoto, en ingles
 * y sesgado a tecnologia. Se le recomendaba a los 107 participantes por igual,
 * incluyendo a quien no tiene computador propio ni mide mas de A1 oral. El
 * segmento existe para que cada oferta llegue solo a quien realmente puede
 * tomarla, usando datos que la ficha del estudiante ya guarda y nadie leia.
 */
public enum Segmento {

    /** Plaza en Colombia, presencial o hibrida. Le sirve a cualquiera. */
    LOCAL_COLOMBIA,

    /**
     * Empleo remoto para empresas de fuera, con el trabajo en ingles. Exige
     * ingles medido, computador y conexion: sin las tres cosas la
     * recomendacion es humo.
     */
    REMOTO_INGLES,

    /** Plaza en el exterior, con patrocinio de visa. Solo a quien lo busca. */
    MIGRACION
}
