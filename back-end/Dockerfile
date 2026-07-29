FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S novacrm && adduser -S novacrm -G novacrm
COPY --from=build /app/target/*.jar app.jar
USER novacrm
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
