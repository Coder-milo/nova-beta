-- BaseEntity (auditoria + optimistic lock) exige las tres columnas de toda la
-- tabla del proyecto; V26 solo llevaba created_at.

ALTER TABLE mensaje_whatsapp
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now(),
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
