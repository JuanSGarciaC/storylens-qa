# ADR-004 — Cuenta de dueño y sesión por cookie firmada

- **Estado:** aceptada
- **Fecha:** 2026-10-24

## Contexto
La app se publicará en internet con costo cero. Debe mostrar una demo de solo lectura a cualquiera
y permitir que una sola persona (el dueño) cree proyectos reales y use la IA. No hay equipos ni
registro abierto: un registro abierto permitiría abusar de la cuota de IA gratuita.

## Decisión
- Una única cuenta, creada o actualizada al arrancar desde `OWNER_EMAIL` y `OWNER_PASSWORD`.
  Si faltan (o falta `SESSION_SECRET`), no hay dueño: la app arranca solo con la demo.
- Clave guardada con `hashlib.scrypt` y sal aleatoria; verificación en tiempo constante.
- Sesión en una cookie `HttpOnly`, `SameSite=Lax` (`Secure` con `COOKIE_SECURE=true`) que lleva el
  usuario y la expiración firmados con HMAC-SHA256. Dura `SESSION_TTL_HOURS` (12 por defecto).
- Cinco intentos fallidos por correo en 15 minutos bloquean temporalmente ese correo (en memoria).
  La respuesta es idéntica para correo inexistente y clave errónea.
- Una única dependencia global (`enforce_access`) decide el acceso: escribir exige ser el dueño y
  que el proyecto no sea la demo; leer exige que el proyecto sea la demo o del dueño, y si no, 404.

## Alternativas consideradas
- JWT en `localStorage` — más superficie de robo por XSS y sin ventaja con un solo usuario.
- Biblioteca de autenticación externa — dependencia innecesaria para una cuenta.
- Registro abierto — riesgo de abuso de la cuota gratuita de IA.

## Consecuencias
- Sin dependencias nuevas y con un punto único de control de acceso, fácil de auditar con pruebas.
- Una cookie `SameSite=Lax` no viaja entre dominios distintos: al desplegar, el frontend debe
  llamar al backend por el mismo origen (proxy/rewrite) o se pasará a `SameSite=None; Secure`.
- Con varios procesos el bloqueo por intentos fallidos (en memoria) no se comparte.
