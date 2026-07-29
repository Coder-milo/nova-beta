package com.novacrm.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Resolucion de la IP del cliente detras de un proxy.
 *
 * <p>El limite por IP solo sirve si la IP no la elige quien hace la peticion.
 * Estos casos fijan las dos garantias: se cree la cabecera cuando viene de un
 * proxy declarado, y se ignora cuando no.
 */
class ClientIpResolverTest {

    private static final String PROXIES = "127.0.0.1/32,10.0.0.0/8";

    private MockHttpServletRequest peticion(String remoteAddr, String forwardedFor) {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        return request;
    }

    @Test
    void ignoraLaCabeceraCuandoLaPeticionNoVieneDeUnProxyDeConfianza() {
        var resolver = new ClientIpResolver(PROXIES);

        var request = peticion("203.0.113.9", "1.2.3.4");

        assertEquals("203.0.113.9", resolver.resolver(request),
                "un cliente directo no puede elegir su propia IP");
    }

    @Test
    void usaLaCabeceraCuandoLaPeticionVieneDeUnProxyDeConfianza() {
        var resolver = new ClientIpResolver(PROXIES);

        var request = peticion("127.0.0.1", "203.0.113.9");

        assertEquals("203.0.113.9", resolver.resolver(request));
    }

    /**
     * El atacante puede anteponer entradas falsas, pero no puede evitar que el
     * proxy de confianza anada la suya al final. Por eso se recorre de derecha
     * a izquierda.
     */
    @Test
    void descartaLasEntradasFalsificadasQueElClienteAntepone() {
        var resolver = new ClientIpResolver(PROXIES);

        var request = peticion("127.0.0.1", "9.9.9.9, 203.0.113.9");

        assertEquals("203.0.113.9", resolver.resolver(request),
                "la ultima entrada no falsificable es la que vale");
    }

    @Test
    void saltaLosProxiesEncadenadosHastaDarConElCliente() {
        var resolver = new ClientIpResolver(PROXIES);

        var request = peticion("127.0.0.1", "203.0.113.9, 10.1.2.3");

        assertEquals("203.0.113.9", resolver.resolver(request),
                "10.1.2.3 es un proxy declarado, no el cliente");
    }

    @Test
    void caeAlParInmediatoSiLaCabeceraVieneVacia() {
        var resolver = new ClientIpResolver(PROXIES);

        assertEquals("127.0.0.1", resolver.resolver(peticion("127.0.0.1", "")));
        assertEquals("127.0.0.1", resolver.resolver(peticion("127.0.0.1", null)));
    }

    @Test
    void sinProxiesDeConfianzaNuncaSeCreeLaCabecera() {
        var resolver = new ClientIpResolver("");

        var request = peticion("127.0.0.1", "203.0.113.9");

        assertEquals("127.0.0.1", resolver.resolver(request),
                "con la lista vacia la cabecera no debe influir");
    }

    @Test
    void reconoceRangosIpv6() {
        var resolver = new ClientIpResolver("::1/128");

        assertEquals("203.0.113.9", resolver.resolver(peticion("0:0:0:0:0:0:0:1", "203.0.113.9")));
    }

    /** Una IPv4 no debe considerarse dentro de un rango IPv6 ni al reves. */
    @Test
    void noMezclaFamiliasDeDirecciones() {
        var resolver = new ClientIpResolver("::1/128");

        assertEquals("127.0.0.1", resolver.resolver(peticion("127.0.0.1", "203.0.113.9")),
                "loopback IPv4 no esta en ::1/128");
    }

    @Test
    void toleraValoresBasuraEnLaCabecera() {
        var resolver = new ClientIpResolver(PROXIES);

        var request = peticion("127.0.0.1", "no-es-una-ip");

        assertEquals("no-es-una-ip", resolver.resolver(request),
                "un valor no parseable no es de confianza, luego se toma como cliente");
    }

    @Test
    void aplicaLaMascaraDeBitsSueltos() {
        var resolver = new ClientIpResolver("192.168.1.0/24");

        assertTrue(resolver.esDeConfianza("192.168.1.255"));
        assertFalse(resolver.esDeConfianza("192.168.2.1"));
    }
}
