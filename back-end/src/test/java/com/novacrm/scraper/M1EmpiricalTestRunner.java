package com.novacrm.scraper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

public class M1EmpiricalTestRunner {

    private static int totalFound = 0;
    private static int totalPassed = 0;
    private static int totalFailed = 0;
    private static final List<String> failures = new ArrayList<>();

    public static void main(String[] args) {
        System.out.println("========================================================================");
        System.out.println(" NOVA-CRM Empirical Challenger 1 - Milestone 1 Full Verification Suite");
        System.out.println(" Target: com.novacrm.scraper.TerminosDeBusqueda.java");
        System.out.println("========================================================================");

        long start = System.currentTimeMillis();

        runTestClass(TerminosDeBusquedaTest.class, null);
        runTestClass(TerminosDeBusquedaStressTest.class, null);
        runTestClass(TerminosDeBusquedaInvariantStressTest.class, null);

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
            System.out.println("\n>>> ALL TESTS SUCCEEDED WITH ZERO FAILURES <<<");
            System.exit(0);
        }
    }

    private static void runTestClass(Class<?> clazz, Object enclosingInstance) {
        String className = clazz.getSimpleName();
        DisplayName classDisplayName = clazz.getAnnotation(DisplayName.class);
        String classDesc = (classDisplayName != null) ? classDisplayName.value() : className;

        System.out.println("\n[SUITE] " + classDesc + " (" + clazz.getName() + ")");

        // Run tests in current class
        for (Method method : clazz.getDeclaredMethods()) {
            if (method.isAnnotationPresent(Test.class) && !Modifier.isStatic(method.getModifiers())) {
                totalFound++;
                DisplayName methodDisplayName = method.getAnnotation(DisplayName.class);
                String testDesc = (methodDisplayName != null) ? methodDisplayName.value() : method.getName();
                System.out.printf("  - [TEST] %-70s ... ", testDesc);

                try {
                    Object testInstance;
                    if (enclosingInstance != null) {
                        Constructor<?> ctor = clazz.getDeclaredConstructor(enclosingInstance.getClass());
                        ctor.setAccessible(true);
                        testInstance = ctor.newInstance(enclosingInstance);
                    } else {
                        Constructor<?> ctor = clazz.getDeclaredConstructor();
                        ctor.setAccessible(true);
                        testInstance = ctor.newInstance();
                    }

                    method.setAccessible(true);
                    method.invoke(testInstance);
                    System.out.println("PASSED");
                    totalPassed++;
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
                    Object instance;
                    if (enclosingInstance != null) {
                        Constructor<?> ctor = clazz.getDeclaredConstructor(enclosingInstance.getClass());
                        ctor.setAccessible(true);
                        instance = ctor.newInstance(enclosingInstance);
                    } else {
                        Constructor<?> ctor = clazz.getDeclaredConstructor();
                        ctor.setAccessible(true);
                        instance = ctor.newInstance();
                    }
                    runTestClass(nested, instance);
                } catch (Exception e) {
                    System.err.println("Error initializing nested class: " + nested.getName() + ": " + e.getMessage());
                }
            }
        }
    }
}
