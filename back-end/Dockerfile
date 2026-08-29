FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# Render Free limita el contenedor a 512 MB. SerialGC, pilas mas pequenas y un
# code cache acotado dejan memoria nativa para Tomcat y Apache POI sin permitir
# que la JVM fuerce al host a terminar el proceso con status 137.
ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -XX:MaxRAMPercentage=32.0 -XX:InitialRAMPercentage=10.0 -Xss512k -XX:ReservedCodeCacheSize=64m -XX:MaxDirectMemorySize=32m"
RUN addgroup -S novacrm && adduser -S novacrm -G novacrm
COPY --from=build /app/target/*.jar app.jar
# La imagen se ejecuta sin privilegios. Crear y entregar la carpeta antes de
# cambiar de usuario evita AccessDeniedException al subir branding/documentos.
RUN mkdir -p /app/storage && chown -R novacrm:novacrm /app/storage
USER novacrm
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
