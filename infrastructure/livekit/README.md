# LiveKit para llamadas grupales

## Local

Desde la raíz del repositorio, con el `.env` habitual del backend:

```sh
docker compose up -d livekit
docker compose logs -f livekit
```

Conecta desde el mismo equipo a `ws://127.0.0.1:7880`. La clave de desarrollo es `devkey` y el secreto es `secret`. El backend crea las salas antes de entregar tokens. Para una prueba completa, ejecuta la migración y arranca ambos servicios:

```sh
docker compose run --rm api pnpm cli:dev migration run
docker compose up -d api livekit
```

Compose configura el backend con `http://livekit:7880` para la API interna y anuncia `ws://127.0.0.1:7880` a los clientes. Si ejecutas la API en el host, configura `LIVEKIT_API_URL=http://127.0.0.1:7880`, `LIVEKIT_WS_URL=ws://127.0.0.1:7880`, `LIVEKIT_API_KEY=devkey` y `LIVEKIT_API_SECRET=secret` en su entorno. Para recibir webhooks nativos en ese modo, cambia la URL del webhook en el bloque de LiveKit para apuntar a la API del host.

Con la sesión de un miembro activo de un grupo, usa estas rutas bajo `/api/V1/conversation/:conversationId/group-calls`.

| Método y ruta relativa                                 | Resultado                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `POST /` con `{"media":"audio"}` o `{"media":"video"}` | Crea una llamada o devuelve la activa con `result: { call, url, token, expiresIn }`.                       |
| `GET /active`                                          | Devuelve `result` con la llamada activa o `null`.                                                          |
| `POST /:callId/join`                                   | Devuelve las credenciales de un miembro para esa llamada.                                                  |
| `POST /:callId/leave`                                  | Desconecta al usuario de LiveKit, con respuesta 204.                                                       |
| `DELETE /:callId`                                      | Finaliza la llamada para todos. Disponible para quien la inició o el propietario del grupo. Respuesta 204. |

La llamada permite hasta 30 participantes, incluida la persona que la inicia. Para probar audio y video, dos miembros pueden usar los tokens distintos devueltos por inicio y unión en la [app de ejemplo de LiveKit](https://example.livekit.io). Las notificaciones WebSocket `GROUP_CALL_STARTED` y `GROUP_CALL_ENDED` incluyen `call` y `conversationEvent`. En el historial de conversación quedan registrados ambos eventos. LiveKit notifica al backend por `/api/V1/group-calls/livekit-webhook` cuando cierra una sala o entra un participante.

Las credenciales de usuario emitidas por el backend duran dos minutos y solo autorizan una sala. LiveKit autohospedado puede aceptar temporalmente un token existente después de una expulsión. El backend deniega tokens nuevos a exmiembros y los vuelve a desconectar si LiveKit notifica un reingreso. [Revocación en LiveKit autohospedado](https://docs.livekit.io/frontends/reference/tokens-grants/#token-revocation)

Para probar en un teléfono conectado a la misma red, pon la IPv4 de tu equipo en `LIVEKIT_LOCAL_IP` en el `.env`, vuelve a ejecutar `docker compose up -d api livekit` y usa `ws://<IP-del-equipo>:7880`. Compose publica los puertos sobre esa IP y LiveKit la anuncia para el tráfico multimedia. Usa la IPv4 de la red local también para probar con Firefox en el mismo equipo. LiveKit anuncia esta dirección como candidato ICE para audio y video. Con `127.0.0.1` la señalización puede abrirse aunque el navegador descarte los candidatos multimedia de loopback.

Compose local utiliza el coturn existente en el puerto 3478 como respaldo para ICE por UDP y TCP. LiveKit emite credenciales TURN temporales con el mismo `TURN_SECRET`.

## Staging

1. En el `.env` del VPS agrega `LIVEKIT_KEYS='messinger: <secreto>'`. Genera el secreto con `openssl rand -hex 32`. Solo el servidor multimedia y el backend que firme tokens necesitan estas credenciales.
2. Usa el mismo `TURN_PUBLIC_IP`, `TURN_HOST` y `TURN_SECRET` del coturn de staging. Esta configuración supone que coturn y LiveKit comparten la IP pública del VPS y que `TURN_HOST` resuelve hacia coturn. LiveKit anuncia coturn en `3478` sobre UDP y TCP con credenciales temporales. Si Nginx y LiveKit corren en el mismo VPS, Nginx llega a LiveKit por `127.0.0.1:7880`.
3. Crea el registro DNS del dominio de LiveKit, instala su certificado TLS en Nginx y adapta [nginx.staging.conf.example](./nginx.staging.conf.example) al dominio y rutas de tu VPS. Inclúyelo en el contexto `http`, valida con `sudo nginx -t` y recarga Nginx.
4. Permite `443/TCP` hacia Nginx y `7881/TCP`, `7882/UDP` directamente hacia LiveKit. Conserva `3478/TCP`, `3478/UDP` y `49160–49200/UDP` para coturn. Si habilitas o renuevas certificados con HTTP-01, Nginx también debe recibir `80/TCP`.
5. Desde la raíz del proyecto en el VPS, con las variables habituales de staging y `LIVEKIT_KEYS` ya configuradas, ejecuta:

   ```sh
   docker compose -f docker-compose.staging.yml up -d livekit
   docker compose -f docker-compose.staging.yml logs -f livekit
   ```

El perfil `livekit` permite arrancar el servicio explícitamente una vez configurado el VPS. El endpoint de los clientes es `wss://<dominio-livekit>`. La integración de staging requiere configurar los cuatro valores de LiveKit en la API, desactivar la creación automática de salas y habilitar el webhook para el backend desplegado.

[Puertos de LiveKit](https://docs.livekit.io/transport/self-hosting/ports-firewall/) · [WebSocket en Nginx](https://nginx.org/en/docs/http/websocket.html)
