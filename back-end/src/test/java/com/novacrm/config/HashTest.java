package com.novacrm.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class HashTest {
    @Test
    void generarHash() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        System.out.println(">>> HASH_ADMIN: " + encoder.encode("admin123") + " <<<");
        System.out.println(">>> HASH_COORD: " + encoder.encode("coord123") + " <<<");
        System.out.println(">>> HASH_EMPRESA: " + encoder.encode("empresa123") + " <<<");
        System.out.println(">>> HASH_ESTUDIANTE: " + encoder.encode("estudiante123") + " <<<");
    }
}
