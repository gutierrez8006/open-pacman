# SPEC 05 — Corregir la desincronización de los fantasmas al cambiar de velocidad

> **Status:** Aprobado
> **Depends on:** SPEC 02, SPEC 03
> **Date:** 2026-09-26
> **Objective:** Evitar que los fantasmas pierdan la retícula de celdas al terminar el frightened y desaparezcan del laberinto atravesando las paredes.

## Por qué existe esta spec

`moveGhost` elige la velocidad en cada frame: `GHOST_FRIGHT_SPEED` (0.05) con
frightened activo y `GHOST_SPEED` (0.1) sin él. El movimiento se aplica en tramos
fijos y `aligned()` solo se cumple en los centros de celda.

Durante el frightened las posiciones son múltiplos de `0.05` respecto al último
centro. Al expirar el timer, si el resto es impar (`y = 12.05`), la retícula de
`0.1` no vuelve a contener un entero: `12.05 - 0.1n` acaba siempre en `.05`. El
fantasma queda desincronizado para siempre, deja de pasar por la comprobación de
muros de `canMove` y se desliza hasta salirse por arriba (`y = -13`) o por el
borde lateral (`x = 28`). En pantalla desaparece.

Medido con simulación de 600 s: hasta 4 fantasmas perdidos y 137 927 frames
(≈38 min) de tiempo-fantasma fuera del laberinto. Con el arreglo de esta spec:
0 desincronías y 0 fantasmas perdidos.

## Scope

**In:**

- Los fantasmas se pegan al centro de su celda en el frame exacto en que cambia
  el estado `frightened` (en ambas direcciones), para que la velocidad nueva
  siempre arranque desde la retícula.
- `resetPositions` restaura el `release` original de cada fantasma (2/5/10/15 s),
  para que un fantasma comido no espere su `release` absoluto tras perder una vida.
- Verificación con una simulación de Node sobre `maze.js` + `game.js` en memoria,
  sin commitear y sin añadir infraestructura al repo.
- Cambios únicamente en `src/js/game.js`.

**Out of scope (para futuras specs):**

- Cambiar `GHOST_FRIGHT_SPEED`, `FRIGHTENED_DURATION` o los valores arcade.
- Acotar `dt` (nota heredada de SPEC 01/02: salta el reloj al cambiar de pestaña).
- Red de seguridad tipo "si un fantasma se sale del laberinto, teletranspórtalo".
- El artefacto de coma flotante de 1 frame en el borde del túnel (`x = 27.999…`).
- Cambios en `maze.js`, `render.js`, `main.js` o en la reaparición de SPEC 03.
- Tests o `package.json` en el repo.

## Data model

No se introducen estructuras nuevas. Se reutiliza `game.frightened` y se le añade
un campo, que muere con la partida:

```js
// game.js — createGame()
frightened: { active: false, timer: 0, chain: 0, wasActive: false },

// game.js — helper nuevo
function snapToCell( g, width );

// game.js — resetPositions(): campo existente que se restaura
g.release = GHOST_STARTS[ i ].release;
```

`wasActive` (no un `let` a nivel de módulo) para que un `createGame()` nuevo
empiece siempre sincronizado.

Convenciones: celdas `(x,y)` origen arriba-izquierda; velocidades en
celdas/frame divisores de 1; espacios dentro de paréntesis y comillas simples.

## Implementation plan

1. **Reproducir con simulación de Node** (puntual, sin commitear): cargar
   `maze.js` y `game.js` con un shim de `window`, bot de Pac-Man con BFS hacia el
   dot más cercano y hacia los fantasmas asustados, 600 s. Medir dos contadores:
   frames con `x < 0 || x >= 28 || y < 0 || y >= 31` y frames seguidos sin
   alinear (>20 = desincronizado, porque `0.05` tarda 19 pasos en alinear).
   *Verificar:* los dos contadores son distintos de cero.
2. **Helper `snapToCell( g, width )`** en `game.js`: `Math.round` en `x` solo si
   la celda redondeada cae dentro del grid, `Math.round` en `y` siempre, y
   `wrapTunnel` al final. *Verificar:* en Node, un fantasma en `(12.05, 14)` acaba
   en `(12, 14)`; uno en `(27.5, 14)` conserva la `x` fraccionaria y no aparece en
   `x = 28`.
3. **Detectar la conmutación en `update()`**: inicializar `wasActive: false` en
   `createGame` y colocar el bloque de pegado **entre `movePacman()` y el bucle de
   `moveGhost()`** (así se capturan las dos aristas: fin de timer en el mismo frame
   y pellet comido en el mismo frame). *Verificar:* la simulación del paso 1 deja
   de reportar desincronías.
4. **Restaurar `release` en `resetPositions()`**: `g.release = GHOST_STARTS[ i ].release`.
   *Verificar:* comer un fantasma en `t = 30`, perder una vida, y los 4 vuelven a
   salir de la pen en 2/5/10/15 s y no en 31.5 s.
5. **Verificación final**: 2 × 600 s de simulación con 0 desincronías y 0
   fantasmas fuera del laberinto durante más de 1 frame; partida manual completa
   (comer pellet, comer fantasmas, esperar a que expire el frightened, perder una
   vida, reiniciar).

## Acceptance criteria

- [ ] Ningún fantasma pasa más de 20 frames seguidos fuera de la retícula de celdas.
- [ ] Ningún fantasma permanece fuera del laberinto más de 1 frame seguido (tolerancia por el `x = 27.999…` del túnel).
- [ ] En 600 s de simulación hay 0 desincronías y 0 fantasmas perdidos.
- [ ] Los 4 fantasmas siguen saliendo de la pen y no la reingresan (SPEC 02 intacto).
- [ ] Un fantasma comido reaparece en la pen y sale ~1.5 s después (SPEC 03 intacto).
- [ ] La cadena 200/400/800/1600 sigue sumando igual.
- [ ] Al expirar los 7 s de frightened los fantasmas recuperan su IA y su velocidad normal.
- [ ] Los fantasmas no atraviesan paredes en ningún momento tras comer un fantasma.
- [ ] Tras perder una vida, los 4 fantasmas se liberan de nuevo en 2/5/10/15 s.
- [ ] La consola no muestra errores y la partida se puede ganar y perder con normalidad.

## Decisions

- **Sí:** pegar a la celda en el frame del cambio de velocidad. El desplazamiento
  es menor de 0.05 celdas y siempre va a una celda que `canMove` ya validó, porque
  el fantasma solo puede estar a media celda si la celda de delante era transitable.
- **Sí:** el bloque va entre `movePacman()` y `moveGhost()`. Colocado antes de
  `movePacman()` no detectaría la entrada de frightened, porque el pellet se come
  dentro de `movePacman`.
- **Sí:** `wasActive` dentro de `game.frightened` en vez de un `let` de módulo.
  Una variable de módulo sobrevive a `createGame()` y empezaría la partida
  desincronizada; el campo muere con la partida.
- **Sí:** guardar la `x` fraccionaria cuando el redondeo cae fuera del grid. Sin
  ese guard, `Math.round(27.5) = 28` metería al fantasma fuera del laberinto en el
  borde del túnel.
- **Sí:** restaurar `release` en `resetPositions`. `resetPositions` ya pone
  `game.elapsed = 0`; sin restaurar el `release`, un fantasma comido espera su
  fecha absoluta (hasta 31.5 s) y parece desaparecido dentro de la pen.
- **Sí:** verificación con simulación de Node no committeada, precedente de
  SPEC 02. El repo no tiene `package.json` ni tests y no es el momento de
  introducirlos.
- **No:** aplazar el cambio de velocidad hasta el siguiente centro de celda.
  Evita el teletransporte, pero retrasa el cambio hasta 20 frames (0.33 s) y añade
  un campo por fantasma; el pegado es local y verificable.
- **No:** cambiar `GHOST_FRIGHT_SPEED` o `GHOST_SPEED` para que las velocidades
  sean múltiplos entre sí. Alteraría la sensación de juego y los valores arcade.
- **No:** red de seguridad que teletransporte al fantasma si se sale del mapa.
  Enmascararía regresiones futuras; SPEC 02 ya estableció corregir la raíz.
- **No:** redondear la posición en `moveGhost` incondicionalmente. Cambia el
  movimiento y puede empujar a un fantasma contra un muro.
- **No:** acotar `dt`. Es la nota heredada de SPEC 01/02 y merece su propia spec.

## Risks

| Risk | Mitigation |
| --- | --- |
| El pegado mueve al fantasma hasta 0.05 celdas en un frame | Solo ocurre en el frame del cambio de velocidad y la celda destino ya fue validada por `canMove`; el desplazamiento es invisible a 20 px/celda |
| `Math.round` en el borde del túnel sacaría al fantasma del laberinto | El pegado solo aplica si la celda redondeada está dentro del grid; si no, conserva la posición fraccionaria y `wrapTunnel` resuelve |
| Otra vía muta `frightened.active` y `wasActive` queda obsoleta | Solo se muta en dos sitios (comer pellet y fin de timer), ambos dentro de `update`, justo donde vive la comparación |
| La simulación usa `dt = 1/60` fijo y no el reloj real del navegador | El arreglo depende de la relación entre velocidades, no de `dt`; la partida manual del paso 5 cubre el `dt` real |
| El artefacto de coma flotante del túnel persiste | Es de 1 frame, se autocorrige y existe también sin el arreglo; documentado como fuera de alcance |

## What is **not** in this spec

- Cambiar duraciones, velocidades o puntuación de frightened.
- Acotar `dt` al perder el foco la pestaña.
- Rescate de fantasmas que se salgan del laberinto.
- El artefacto de 1 frame del borde del túnel.
- Cambios en `maze.js`, `render.js`, `main.js` o en la reaparición de SPEC 03.
- Tests, `package.json` o cualquier infraestructura en el repo.

Cada uno de esos, si llega, va en su propia spec.
