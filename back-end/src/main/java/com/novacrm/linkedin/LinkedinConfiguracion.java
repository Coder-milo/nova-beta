package com.novacrm.linkedin;

import jakarta.persistence.*;

@Entity
@Table(name = "linkedin_configuracion")
public class LinkedinConfiguracion {

    @Id
    private java.util.UUID id;

    @Column(name = "access_token", columnDefinition = "TEXT")
    private String accessToken;

    @Column(name = "refresh_token", columnDefinition = "TEXT")
    private String refreshToken;

    @Column(name = "token_expira_en")
    private java.time.LocalDateTime tokenExpiraEn;

    @Column(name = "linkedin_user_id")
    private String linkedinUserId;

    @Column(name = "linkedin_urn")
    private String linkedinUrn;

    public java.util.UUID getId() { return id; }
    public void setId(java.util.UUID id) { this.id = id; }
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    public java.time.LocalDateTime getTokenExpiraEn() { return tokenExpiraEn; }
    public void setTokenExpiraEn(java.time.LocalDateTime tokenExpiraEn) { this.tokenExpiraEn = tokenExpiraEn; }
    public String getLinkedinUserId() { return linkedinUserId; }
    public void setLinkedinUserId(String linkedinUserId) { this.linkedinUserId = linkedinUserId; }
    public String getLinkedinUrn() { return linkedinUrn; }
    public void setLinkedinUrn(String linkedinUrn) { this.linkedinUrn = linkedinUrn; }
}
