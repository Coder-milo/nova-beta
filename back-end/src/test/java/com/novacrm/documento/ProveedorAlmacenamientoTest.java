package com.novacrm.documento;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProveedorAlmacenamientoTest {

    @Test
    @DisplayName("Debe permitir guardar, descargar y eliminar archivos localmente")
    void debeGuardarYDescargarLocalmente(@TempDir Path tempDir) {
        var local = new LocalProveedorAlmacenamiento(tempDir.toString());
        var service = new StorageService(local);

        byte[] contenido = "Contenido de prueba".getBytes();
        String key = service.subir("hvs", "mi_hv.pdf", contenido, "application/pdf");

        assertThat(key).startsWith("hvs/");
        assertThat(service.descargar(key)).isEqualTo(contenido);

        service.eliminar(key);
    }

    @Test
    @DisplayName("Debe seleccionar el proveedor de almacenamiento configurado")
    void debeSeleccionarProveedorConfigurado(@TempDir Path tempDir) {
        var local = new LocalProveedorAlmacenamiento(tempDir.toString());
        var minio = new MinioProveedorAlmacenamiento(null, "bucket", "");
        var config = new ConfiguracionAlmacenamiento();

        var seleccionado = config.proveedorAlmacenamientoActivo(List.of(local, minio), "local");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("local");
    }
}
