package com.novacrm.scraper.fuente;

import org.jsoup.Connection;
import org.jsoup.HttpStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;

/**
 * Reintenta una descarga cuando el portal dice «ahora no».
 *
 * <p>Los scrapers de HTML pedían la página una vez y, ante un 429 o un 403,
 * daban la consulta por fallida. Eso convertía un límite de ritmo —que se pasa
 * esperando unos segundos— en una corrida perdida, y como las cuatro fuentes se
 * consultaban a la vez el propio scraper era quien provocaba el 429.
 *
 * <p>El 403 se reintenta igual que el 429 aunque parezca definitivo: el que
 * devuelven Computrabajo y Elempleo cuando les llegan varias peticiones
 * seguidas es del cortafuegos, y se levanta solo. Un 403 de verdad permanente
 * —el agente bloqueado— cuesta dos esperas y acaba fallando igual, que es lo
 * correcto: nada que hacer en caliente.
 *
 * <p>Se respeta {@code Retry-After} cuando el portal lo manda. Es él quien sabe
 * cuánto dura su ventana; adivinarlo con la progresión propia es ignorar la
 * única cifra fiable que hay.
 */
public final class ReintentoConEspera {

    private static final Logger log = LoggerFactory.getLogger(ReintentoConEspera.class);

    /**
     * Tres intentos: el original y dos más.
     *
     * <p>Con la progresión de abajo son como mucho ~6 s de espera por consulta.
     * Un cuarto intento añadiría 8 s a cada consulta de una corrida que ya va en
     * paralelo contra cuatro portales, y si dos esperas no bastaron es que no es
     * un límite de ritmo.
     */
    static final int INTENTOS = 3;

    static final long ESPERA_BASE_MS = 1_500;

    /**
     * Tope de una espera, {@code Retry-After} incluido.
     *
     * <p>Un portal puede contestar {@code Retry-After: 3600}. Dormir una hora
     * dentro de la corrida diaria la deja colgada; mejor fallar esa fuente y que
     * el registro lo diga.
     */
    static final long ESPERA_MAXIMA_MS = 20_000;

    private ReintentoConEspera() {
    }

    /** Códigos que significan «vuelve luego» y no «esto no existe». */
    static boolean mereceOtroIntento(int codigo) {
        return codigo == 403      // cortafuegos por ritmo
                || codigo == 408  // el servidor se cansó de esperar
                || codigo == 429  // límite de peticiones
                || codigo == 502
                || codigo == 503
                || codigo == 504;
    }

    /**
     * Descarga y parsea, reintentando lo que se pueda reintentar.
     *
     * @param fuente          nombre del portal, solo para el registro
     * @param nuevaConexion   fábrica de conexiones. Es un {@link Supplier} y no
     *                        una {@code Connection} porque Jsoup no permite
     *                        reejecutar la misma: hay que armarla otra vez
     * @throws HttpStatusException si el portal responde algo que no es 200 y no
     *                             tiene sentido insistir, o si se acabaron los
     *                             intentos. Se conserva el tipo para no romper a
     *                             quien ya distingue «página 2 que no existe» de
     *                             «portal caído»
     */
    public static org.jsoup.nodes.Document documento(String fuente,
                                                     Supplier<Connection> nuevaConexion) throws IOException {
        IOException ultimoFallo = null;

        for (int intento = 1; intento <= INTENTOS; intento++) {
            int codigo;
            String reintentarTras = null;
            try {
                // `ignoreHttpErrors` para poder mirar el código y las cabeceras
                // en vez de recibir la excepción ya construida: `Retry-After`
                // solo se lee desde la respuesta.
                Connection.Response respuesta = nuevaConexion.get().ignoreHttpErrors(true).execute();
                codigo = respuesta.statusCode();
                if (codigo == 200) {
                    return respuesta.parse();
                }
                reintentarTras = respuesta.header("Retry-After");
                ultimoFallo = new HttpStatusException(
                        "El portal respondió " + codigo, codigo, respuesta.url().toString());
            } catch (IOException e) {
                // Tiempo agotado o conexión cortada. Se reintenta por lo mismo
                // que un 503: casi siempre es la red, no la página.
                codigo = 0;
                ultimoFallo = e;
            }

            boolean insistible = codigo == 0 || mereceOtroIntento(codigo);
            if (!insistible || intento == INTENTOS) {
                throw ultimoFallo;
            }

            long espera = esperaEnMilis(intento, reintentarTras);
            log.info("[{}] respuesta {} en el intento {}/{}; se reintenta en {} ms",
                    fuente, codigo == 0 ? "sin conexion" : codigo, intento, INTENTOS, espera);
            dormir(espera);
        }

        throw ultimoFallo;
    }

    /**
     * Cuánto esperar antes del siguiente intento.
     *
     * <p>Progresión al doble más un desajuste aleatorio. El desajuste importa
     * más de lo que parece: las fuentes corren en paralelo y sin él las que
     * reciben el mismo 429 vuelven a llamar exactamente a la vez, que es la
     * forma de que el portal las vuelva a rechazar a las dos.
     */
    static long esperaEnMilis(int intento, String reintentarTras) {
        Long delPortal = segundosDe(reintentarTras);
        if (delPortal != null) {
            return Math.min(delPortal * 1000, ESPERA_MAXIMA_MS);
        }
        long base = ESPERA_BASE_MS * (1L << (intento - 1));
        long desajuste = ThreadLocalRandom.current().nextLong(0, ESPERA_BASE_MS / 2 + 1);
        return Math.min(base + desajuste, ESPERA_MAXIMA_MS);
    }

    /** {@code Retry-After} en segundos. Se ignora la forma con fecha HTTP. */
    private static Long segundosDe(String cabecera) {
        if (cabecera == null || cabecera.isBlank()) {
            return null;
        }
        try {
            long segundos = Long.parseLong(cabecera.trim());
            return segundos >= 0 ? segundos : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static void dormir(long milis) throws InterruptedIOException {
        try {
            Thread.sleep(milis);
        } catch (InterruptedException e) {
            // Restaurar la bandera no basta: hay que cortar de verdad, o la
            // corrida sigue consultando portales despues de que la cancelaran.
            Thread.currentThread().interrupt();
            throw new InterruptedIOException("Espera entre intentos interrumpida");
        }
    }
}
