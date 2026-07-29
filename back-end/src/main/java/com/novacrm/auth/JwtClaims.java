package com.novacrm.auth;

/**
 * Nombres y valores de los claims propios de NOVA CRM dentro del JWT.
 *
 * <p>El claim {@link #TYPE} distingue el access token del refresh token. Sin el,
 * un refresh token (vigencia de dias) serviria como credencial de acceso en
 * cualquier endpoint que solo exija estar autenticado.
 */
public final class JwtClaims {

    /** Nombre del claim que indica para que sirve el token. */
    public static final String TYPE = "type";

    /** Token de acceso: el unico valido en el header Authorization. */
    public static final String TYPE_ACCESS = "access";

    /** Token de renovacion: solo valido en POST /api/v1/auth/refresh. */
    public static final String TYPE_REFRESH = "refresh";

    private JwtClaims() {
    }
}
