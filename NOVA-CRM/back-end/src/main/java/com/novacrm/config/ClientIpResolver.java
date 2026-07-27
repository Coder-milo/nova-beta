package com.novacrm.config;

import jakarta.servlet.http.HttpServletRequest;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Resuelve la IP real del cliente a partir de {@code X-Forwarded-For}.
 *
 * <p>La cabecera la escribe quien haga la peticion, asi que solo puede creerse
 * cuando el par inmediato es un proxy de confianza. Aceptarla siempre convierte
 * cualquier limite por IP en decorativo: basta enviar un valor distinto en cada
 * peticion para estrenar contador.
 *
 * <p>Cuando el par es de confianza se recorre la cadena de derecha a izquierda
 * descartando proxies conocidos: la primera direccion que no lo sea es el
 * cliente. Las entradas que un atacante haya podido anteponer quedan a la
 * izquierda de esa y no se tienen en cuenta.
 */
public class ClientIpResolver {

    private final List<Cidr> proxiesDeConfianza;

    public ClientIpResolver(String proxiesDeConfianzaCsv) {
        this.proxiesDeConfianza = parsearCidrs(proxiesDeConfianzaCsv);
    }

    public String resolver(HttpServletRequest request) {
        String parInmediato = request.getRemoteAddr();

        if (!esDeConfianza(parInmediato)) {
            return normalizar(parInmediato);
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank()) {
            return normalizar(parInmediato);
        }

        String[] cadena = forwarded.split(",");
        for (int i = cadena.length - 1; i >= 0; i--) {
            String candidato = normalizar(cadena[i]);
            if (candidato.isEmpty()) {
                continue;
            }
            if (!esDeConfianza(candidato)) {
                return candidato;
            }
        }

        // Toda la cadena eran proxies conocidos: no hay mas informacion util.
        return normalizar(parInmediato);
    }

    boolean esDeConfianza(String ip) {
        byte[] direccion = aBytes(ip);
        if (direccion == null) {
            return false;
        }
        return proxiesDeConfianza.stream().anyMatch(c -> c.contiene(direccion));
    }

    private static String normalizar(String valor) {
        if (valor == null) return "";
        String v = valor.trim();
        // Formato "[::1]:54321" o "1.2.3.4:5678" que anaden algunos proxies.
        if (v.startsWith("[")) {
            int cierre = v.indexOf(']');
            if (cierre > 0) return v.substring(1, cierre);
        }
        return v;
    }

    private static byte[] aBytes(String ip) {
        if (ip == null || ip.isBlank()) return null;
        try {
            // getByName resolveria nombres DNS; se exige que ya sea una IP.
            return InetAddress.getByName(normalizar(ip)).getAddress();
        } catch (UnknownHostException | SecurityException e) {
            return null;
        }
    }

    private static List<Cidr> parsearCidrs(String csv) {
        var resultado = new ArrayList<Cidr>();
        if (csv == null || csv.isBlank()) {
            return List.copyOf(resultado);
        }
        for (String entrada : csv.split(",")) {
            String texto = entrada.trim();
            if (texto.isEmpty()) continue;
            Cidr cidr = Cidr.parsear(texto);
            if (cidr != null) resultado.add(cidr);
        }
        return List.copyOf(resultado);
    }

    /** Rango de direcciones en notacion CIDR. Admite IPv4 e IPv6. */
    private record Cidr(byte[] red, int bitsPrefijo) {

        static Cidr parsear(String texto) {
            String[] partes = texto.split("/");
            byte[] red = aBytes(partes[0]);
            if (red == null) return null;

            int bits = red.length * 8;
            if (partes.length > 1) {
                try {
                    bits = Integer.parseInt(partes[1].trim());
                } catch (NumberFormatException e) {
                    return null;
                }
                if (bits < 0 || bits > red.length * 8) return null;
            }
            return new Cidr(red, bits);
        }

        boolean contiene(byte[] direccion) {
            // Una direccion IPv4 nunca cae dentro de un rango IPv6 ni al reves.
            if (direccion.length != red.length) return false;

            int bytesCompletos = bitsPrefijo / 8;
            for (int i = 0; i < bytesCompletos; i++) {
                if (direccion[i] != red[i]) return false;
            }

            int bitsSueltos = bitsPrefijo % 8;
            if (bitsSueltos == 0) return true;

            int mascara = 0xFF << (8 - bitsSueltos);
            return (direccion[bytesCompletos] & mascara) == (red[bytesCompletos] & mascara);
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Cidr c && bitsPrefijo == c.bitsPrefijo && Arrays.equals(red, c.red);
        }

        @Override
        public int hashCode() {
            return 31 * Arrays.hashCode(red) + bitsPrefijo;
        }

        @Override
        public String toString() {
            return Arrays.toString(red) + "/" + bitsPrefijo;
        }
    }
}
