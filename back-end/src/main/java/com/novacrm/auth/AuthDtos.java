package com.novacrm.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record RefreshRequest(@NotBlank String refreshToken) {}

record ForgotPasswordRequest(@Email @NotBlank String email) {}

record ResetPasswordRequest(@NotBlank String token, @NotBlank @Size(min = 8) String password) {}
