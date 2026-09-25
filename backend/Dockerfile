# Build
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B -DskipTests package

# Runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --create-home lure && mkdir -p /data/uploads && chown -R lure /data
COPY --from=build /src/target/growth.jar app.jar
USER lure
ENV SPRING_PROFILES_ACTIVE=prod \
    STORAGE_DIR=/data/uploads \
    PORT=8085
EXPOSE 8085
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
