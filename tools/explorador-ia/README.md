# Explorador con IA

Claude se pone en la piel de un tipo de usuario y navega Mirudoku en un navegador
real (Playwright), **sin guion**: recibe quién es y qué quiere lograr, decide qué
tocar, y anota lo que le molesta, no entiende o se rompe. Al final deja un informe
con los hallazgos ordenados por gravedad, una captura de cada uno y el recorrido
completo.

Complementa a `tests/e2e/personas/` (recorridos fijos que corren en cada push):
aquellos verifican lo que ya sabemos que tiene que andar; este busca lo que no
se nos ocurrió probar. **Sus hallazgos son pistas para verificar a mano, no bugs
confirmados.**

## Uso

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # o `ant auth login`
npm run explorar -- --persona novato     # una persona
npm run explorar -- --persona todas --pasos 20
npm run explorar -- --simulacro --persona todas   # sin API: prueba el circuito
npm run explorar -- --help               # personas y opciones
```

El informe queda en `reportes-explorador/<fecha>/informe.md` (con `capturas/` y
`resultados.json`). Esa carpeta no se commitea.

Si la URL es local y no hay nada escuchando, levanta `tools/serve.cjs` solo.

| Opción | Default | Qué hace |
|---|---|---|
| `--persona` | — | id de la persona, o `todas` |
| `--pasos` | 25 | acciones máximas por persona |
| `--url` | `http://localhost:8123` | sitio a explorar (puede ser el publicado) |
| `--red` | `simulada` | `simulada`: AniList con datos falsos y el resto de la red cortada. `real`: APIs de verdad |
| `--esfuerzo` | `medium` | `low` / `medium` / `high`: cuánto piensa el modelo por paso |
| `--salida` | `reportes-explorador` | carpeta de informes |

Modelo: `claude-opus-5-5` (cambiable con `EXPLORADOR_MODELO`). Si el modelo se
niega a un pedido, la API reintenta con otro automáticamente (`fallbacks: "default"`).

## Costo

Cada paso manda la conversación entera; con caché de prompts, una persona a 25
pasos suele costar del orden de US$ 0,30–1,50 según cuántas capturas pida. El
informe muestra el costo estimado real de cada persona. Para gastar menos:
`--pasos 12` o `--esfuerzo low`.

## Personas

Están en `personas.mjs`: visitante nuevo, fan experto, celular apurado, solo
teclado (no tiene la herramienta de clic), no habla castellano (navegador en
inglés) y lector de novelas. Para sumar una, agregá un objeto con quién es, qué
quiere, dónde arranca y su dispositivo.

## Cómo funciona

- `navegador.mjs`: abre Chromium con el dispositivo, idioma y tema de la persona;
  describe la página en texto (encabezados, foco, elementos interactivos numerados,
  texto visible, errores de JS) y ejecuta las acciones. No depende de la API.
- `explorador.mjs`: el bucle con Claude. Herramientas: `ver_pagina`, `mirar`
  (captura), `clic`, `escribir`, `tecla`, `desplazar`, `ir_a`, `volver`,
  `reportar_hallazgo` y `terminar`.

Límites a propósito: el agente no crea cuentas ni escribe contraseñas, solo
navega dentro del sitio, y el texto de la página se le presenta como contenido a
evaluar, no como instrucciones.

## En GitHub

El workflow **Explorador con IA** (Actions → Run workflow) lo corre a pedido y
sube el informe como artefacto. Necesita el secreto `ANTHROPIC_API_KEY` en el
repo. No corre solo en cada push porque cuesta plata.
