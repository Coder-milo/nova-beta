package com.novacrm.whatsapp;

import com.novacrm.exception.BusinessException;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifrado simetrico del token de WhatsApp (AES-GCM).
 *
 * <p>La clave de 32 bytes se deriva con SHA-256 de la variable de entorno
 * {@code WHATSAPP_TOKEN_KEY}: asi la clave puede tener cualquier longitud y no
 * hace falta gestionar un binario de 32 bytes exactos en el despliegue.
 *
 * <p>Formato almacenado: {@code base64( iv(12 bytes) || ciphertext )}. El IV
 * viaja junto al cifrado porque es parte del mensaje, no un secreto.
 */
public final class WhatsappCrypto {

    private static final String ENV_CLAVE = "WHATSAPP_TOKEN_KEY";
    private static final int IV_BYTES = 12;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private WhatsappCrypto() {}

    public static String cifrar(String token) {
        try {
            byte[] iv = new byte[IV_BYTES];
            ALEATORIO.nextBytes(iv);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, clave(), new GCMParameterSpec(128, iv));
            byte[] cifrado = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            byte[] juntos = new byte[iv.length + cifrado.length];
            System.arraycopy(iv, 0, juntos, 0, iv.length);
            System.arraycopy(cifrado, 0, juntos, iv.length, cifrado.length);
            return Base64.getEncoder().encodeToString(juntos);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo cifrar el token de WhatsApp", e);
        }
    }

    /** @throws BusinessException si la clave de entorno no esta definida */
    public static String descifrar(String tokenCifrado) {
        try {
            byte[] juntos = Base64.getDecoder().decode(tokenCifrado);
            if (juntos.length <= IV_BYTES) {
                throw new IllegalArgumentException("Token cifrado truncado");
            }
            byte[] iv = java.util.Arrays.copyOfRange(juntos, 0, IV_BYTES);
            byte[] cifrado = java.util.Arrays.copyOfRange(juntos, IV_BYTES, juntos.length);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, clave(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(cifrado), StandardCharsets.UTF_8);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Token de WhatsApp ilegible o clave WHATSAPP_TOKEN_KEY cambiada", e);
        }
    }

    private static SecretKeySpec clave() {
        // Propiedad primero para que las pruebas puedan inyectarla; en
        // producción solo existe la variable de entorno.
        String valor = System.getProperty(ENV_CLAVE,
                System.getenv(ENV_CLAVE) == null ? "" : System.getenv(ENV_CLAVE));
        if (valor == null || valor.isBlank()) {
            throw new BusinessException(
                    "El servidor no tiene la variable de entorno WHATSAPP_TOKEN_KEY definida; "
                            + "sin ella no se puede guardar ni usar el token de WhatsApp");
        }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(valor.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(hash, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo derivar la clave de cifrado", e);
        }
    }
}
