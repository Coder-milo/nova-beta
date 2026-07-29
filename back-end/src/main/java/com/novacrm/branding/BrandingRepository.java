package com.novacrm.branding;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface BrandingRepository extends JpaRepository<ProgramaBranding, UUID> {
}
