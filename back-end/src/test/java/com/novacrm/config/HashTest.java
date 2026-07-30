package com.novacrm.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class HashTest {
    @Test
    void generarHash() {
        String pass = "Estudiante2026*";
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String hash = encoder.encode(pass);
        System.out.println(">>> HASH_GENERADO: " + hash + " <<<");
    }
}
