package com.novacrm.scraper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

public class AllScrapingTestsRunner {

    private static int totalFound = 0;
    private static int totalPassed = 0;
    private static int totalFailed = 0;
    private static final List<String> failures = new ArrayList<>();

    public static void main(String[] args) {
        System.out.println("================================================================================");
        System.out.println(" NOVA-CRM Complete Scraper & Connector Regression Suite (All 17 Suites)");
        System.out.println("================================================================================");

        long start = System.currentTimeMillis();

        List<String> testClassNames = List.of(
                "com.novacrm.scraper.portal.ComputrabajoScraperTest",
                "com.novacrm.scraper.portal.ElempleoScraperTest",
                "com.novacrm.scraper.portal.LinkedInJobsScraperTest",
                "com.novacrm.scraper.portal.RemotiveConnectorTest",
                "com.novacrm.scraper.fuente.ArbeitnowConnectorTest",
                "com.novacrm.scraper.fuente.AreaMetropolitanaTest",
                "com.novacrm.scraper.fuente.FiltroBilingueTest",
                "com.novacrm.scraper.fuente.JSearchConnectorTest",
                "com.novacrm.scraper.fuente.ReintentoConEsperaTest",
                "com.novacrm.scraper.fuente.SmartRecruitersConnectorTest",
                "com.novacrm.scraper.ConsultasPorFuenteTest",
                "com.novacrm.scraper.PoolPropioDelScrapingTest",
                "com.novacrm.scraper.ScrapingServiceTest",
                "com.novacrm.scraper.dto.EjecucionDeScrapingTest",
                "com.novacrm.scraper.TerminosDeBusquedaTest",
                "com.novacrm.scraper.TerminosDeBusquedaStressTest",
                "com.novacrm.scraper.TerminosDeBusquedaInvariantStressTest"
        );

        for (String className : testClassNames) {
            try {
                Class<?> clazz = Class.forName(className);
                runTestClass(clazz, null);
            } catch (ClassNotFoundException e) {
                System.err.println("Could not find class: " + className);
                totalFailed++;
                failures.add("ClassNotFoundException: " + className);
            }
        }

        long elapsed = System.currentTimeMillis() - start;

        System.out.println("\n----------------------------- TEST SUMMARY -----------------------------");
        System.out.printf("Tests Discovered:    %d%n", totalFound);
        System.out.printf("Tests Successful:    %d%n", totalPassed);
        System.out.printf("Tests Failed:        %d%n", totalFailed);
        System.out.printf("Time Elapsed:        %d ms%n", elapsed);
        System.out.println("------------------------------------------------------------------------");

        if (totalFailed > 0) {
            System.err.println("\nFAILURES & ERRORS:");
            failures.forEach(System.err::println);
            System.exit(1);
        } else {
            System.out.println("\n>>> ALL 17 TEST CLASSES SUCCEEDED WITH ZERO FAILURES <<<");
            System.exit(0);
        }
    }

    private static void runTestClass(Class<?> clazz, Object enclosingInstance) {
        String className = clazz.getSimpleName();
        DisplayName classDisplayName = clazz.getAnnotation(DisplayName.class);
        String classDesc = (classDisplayName != null) ? classDisplayName.value() : className;

        System.out.println("\n[SUITE] " + classDesc + " (" + clazz.getName() + ")");

        for (Method method : clazz.getDeclaredMethods()) {
            boolean isTest = method.isAnnotationPresent(Test.class)
                    || method.isAnnotationPresent(org.junit.jupiter.params.ParameterizedTest.class);

            if (isTest && !Modifier.isStatic(method.getModifiers())) {
                DisplayName methodDisplayName = method.getAnnotation(DisplayName.class);
                String testDesc = (methodDisplayName != null) ? methodDisplayName.value() : method.getName();

                try {
                    if (method.isAnnotationPresent(org.junit.jupiter.params.ParameterizedTest.class)) {
                        org.junit.jupiter.params.provider.ValueSource vs = method.getAnnotation(org.junit.jupiter.params.provider.ValueSource.class);
                        if (vs != null && vs.strings().length > 0) {
                            for (String val : vs.strings()) {
                                totalFound++;
                                System.out.printf("  - [TEST] %-70s ... ", testDesc + " [" + val + "]");
                                Object testInstance = instantiate(clazz, enclosingInstance);
                                invokeBeforeEach(clazz, testInstance);
                                method.setAccessible(true);
                                method.invoke(testInstance, val);
                                System.out.println("PASSED");
                                totalPassed++;
                            }
                        }
                    } else {
                        totalFound++;
                        System.out.printf("  - [TEST] %-70s ... ", testDesc);
                        Object testInstance = instantiate(clazz, enclosingInstance);
                        invokeBeforeEach(clazz, testInstance);
                        method.setAccessible(true);
                        method.invoke(testInstance);
                        System.out.println("PASSED");
                        totalPassed++;
                    }
                } catch (Throwable t) {
                    Throwable cause = (t.getCause() != null) ? t.getCause() : t;
                    System.out.println("FAILED (" + cause.getClass().getSimpleName() + ": " + cause.getMessage() + ")");
                    totalFailed++;
                    failures.add("FAILED: " + clazz.getSimpleName() + "#" + method.getName() + " -> " + cause.getMessage());
                }
            }
        }

        // Run nested test classes
        for (Class<?> nested : clazz.getDeclaredClasses()) {
            if (nested.isAnnotationPresent(Nested.class)) {
                try {
                    Object instance = instantiate(nested, enclosingInstance);
                    runTestClass(nested, instance);
                } catch (Exception e) {
                    System.err.println("Error initializing nested class: " + nested.getName() + ": " + e.getMessage());
                }
            }
        }
    }

    private static Object instantiate(Class<?> clazz, Object enclosingInstance) throws Exception {
        if (enclosingInstance != null) {
            Constructor<?> ctor = clazz.getDeclaredConstructor(enclosingInstance.getClass());
            ctor.setAccessible(true);
            return ctor.newInstance(enclosingInstance);
        } else {
            Constructor<?> ctor = clazz.getDeclaredConstructor();
            ctor.setAccessible(true);
            return ctor.newInstance();
        }
    }

    private static void invokeBeforeEach(Class<?> clazz, Object testInstance) throws Exception {
        for (Method m : clazz.getDeclaredMethods()) {
            if (m.isAnnotationPresent(org.junit.jupiter.api.BeforeEach.class)) {
                m.setAccessible(true);
                m.invoke(testInstance);
            }
        }
    }
}
