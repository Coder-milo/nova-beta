package com.novacrm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NovaCrmApplication {

    public static void main(String[] args) {
        SpringApplication.run(NovaCrmApplication.class, args);
    }
}
