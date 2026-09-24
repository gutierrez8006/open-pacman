# SPEC 02 — Salida de los fantasmas desde la pen

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-24
> **Objective:** Arreglar la salida de los fantasmas de la pen para que, al ser liberados, salgan directo al mapa sin dar vueltas en la jaula y no puedan volver a entrar (puerta de un solo sentido).

## Scope

**In:**

- Los fantasmas salen de la pen por la puerta en cuanto se liberan, sin quedar atrapados en un bucle alrededor de la puerta.
- Puerta de un solo sentido: un fantasma ya liberado no puede volver a entrar a la pen ni a las celdas de la puerta.
- Se mantienen la liberación escalonada por tiempo (2/5/10/15 s), los 4 tipos de IA y sus colores.
- Cambios únicamente en `game.js`.

**Out of scope (para futuras specs):**

- Reaparición de un fantasma tras ser comido (volver a la pen y salir de nuevo).
- Modo *frightened* (fantasmas azules/comestibles, cápsulas).
- Cambiar los tiempos de liberación, los tipos de IA o la geometría del laberinto.

## Data model

No se introducen estructuras nuevas; se reutiliza la existente:

```js
// game.js — la pen ya define puerta en (13,12), con celdas de puerta cols 13-14, fila 12
const PEN = { x0: 11, x1: 16, y0: 13, y1: 15, doorX: 13, doorY: 12 };
```

- Se añade un helper `isDoorCell( x, y )` → true para las celdas de puerta del laberinto (fila `PEN.doorY`, columnas `PEN.doorX` y `PEN.doorX + 1`, ambas `-` en `MAZE_STR`).
- Sin cambios en `window` ni en `maze.js`.

## Implementation plan

1. **Reproducir la causa raíz** (ya hecho en la definición de esta spec): simulación en Node de `maze.js` + `game.js` durante 30 s. Los 4 fantasmas quedan oscilando en el ciclo `(13,12) → (14,12) → (14,13) → (13,13)` y nunca pisan la fila 11. Causa: al llegar a una celda de puerta, `inPen()` pasa a false → el objetivo deja de ser la puerta y pasa a ser Pac-Man; como Pac-Man suele estar más abajo, por distancia Manhattan el greedy prefiere bajar a la pen antes que subir. Al bajar, `inPen()` vuelve a true y el objetivo vuelve a la puerta → bucle infinito. *Verificar:* los 4 quedan atrapados antes del cambio.
2. **Forzar la salida por la puerta**: en `moveGhost`, cuando la celda redondeada del fantasma es `isDoorCell`, forzar `g.dir = 'up'` (la única salida válida), ignorando el greedy. *Verificar:* el fantasma cruza la puerta en un solo tramo hacia la fila 11.
3. **Puerta de un solo sentido (no reentrada)**: en `decideGhost`/`canMove`, para actor `'ghost'` cuya celda actual NO está dentro del rectángulo de la pen (`inPen( g )`), tratar las celdas de la puerta y el interior de la pen como bloqueadas. *Verificar:* los fantasmas liberados no regresan a la pen en ≥30 s de partida.
4. **Verificación final**: simulación de 30 s sin oscilaciones + partida manual.

## Acceptance criteria

- [ ] Tras su `release`, cada fantasma sale de la pen y aparece en el mapa (fila 11 o superior) sin dar vueltas en la jaula.
- [ ] Durante ≥30 s de partida ningún fantasma liberado reingresa a la pen ni a las celdas de la puerta.
- [ ] Los 4 tipos conservan su tiempo de liberación (2/5/10/15 s), su IA y su color.
- [ ] Pac-Man sigue sin poder cruzar la puerta (`isWall` intacta para pacman).
- [ ] Al perder una vida, `resetPositions` devuelve los 4 a la pen y el ciclo de liberación recomienza.
- [ ] La simulación de 30 s no muestra oscilaciones entre celdas de puerta y pen.
- [ ] La consola no muestra errores.

## Decisions

- **Yes:** puerta de un solo sentido (comportamiento arcade) — elección del usuario; elimina el rebote de raíz.
- **Yes:** salida natural por la puerta, sin teleporte.
- **Yes:** forzar `dir='up'` en la celda de la puerta antes que el greedy — el greedy por sí solo no puede resolver la salida porque la distancia a Pac-Man empuja hacia la pen; una regla dirigida es más simple y robusta.
- **Yes:** mantener liberación escalonada 2/5/10/15 s y tipos de IA.
- **No:** teleporte de liberación.
- **No:** reaparición tras ser comido (spec futura).
- **No:** cambios de tiempos, IA o geometría.

## Risks

| Risk | Mitigation |
| --- | --- |
| Un mecanismo futuro de "comido → volver a la pen" chocaría con la puerta unidireccional | La spec futura de reaparición lo resuelve con teletransporte (como `resetPositions`) o un flag temporal; `resetPositions` ya coloca a los fantasmas dentro de la pen sin usar la puerta |
| Si cambia la geometría del laberinto (puerta más ancha o reubicada), `isDoorCell` y el forzado de `'up'` quedan desalineados | Las constantes viven en `PEN`; el helper se deriva de `PEN` para minimizar puntos de cambio |

## What is **not** in this spec

- Reaparición tras ser comido / camino de vuelta a la pen.
- Modo *frightened* y cápsulas fabulosas.
- Cambios en la liberación (tiempos, condición) ni en la IA de los 4 tipos.
- Cambios en la geometría del laberinto.

Cada uno de esos, si llega, va en su propia spec.

## Nota para futuras specs

- **`dt` sin acotar:** `update( game, dt )` acumula tiempo real sin limitar `dt`. Si la pestaña queda en segundo plano varios segundos, al volver se liberan varios fantasmas a la vez (heredado de SPEC 01). Con la salida forzada por la puerta no se atascan igual, pero convendría acotar `dt` (p. ej. máximo ~0.1 s) para evitar saltos de reloj.