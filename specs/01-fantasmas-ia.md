# SPEC 01 — Cuatro fantasmas con IA propia

> **Status:** Draft
> **Depends on:** —
> **Date:** 2026-09-22
> **Objective:** Sustituir los 2 fantasmas actuales por 4 con IA distinta (agresor, emboscador, flanqueador y tímido) y liberación escalonada desde la pen.

## Scope

**In:**

- 4 fantasmas simultáneos, cada uno con tipo de IA propio.
- Comportamientos: **agresor** (persigue directo), **emboscador** (apunta 4 celdas delante de Pac-Man), **flanqueador** (combina su objetivo con la posición del agresor), **tímido** (persigue solo si está lejos de Pac-Man).
- Liberación escalonada por tiempo real: cada fantasma permanece inmóvil en la pen hasta su `release`.
- Color propio por tipo (rojo, rosa, cian, naranja) en `render.js`.

**Out of scope (para futuras specs):**

- Modo *frightened* (fantasmas azules/comestibles, cápsulas).
- Liberación por puntos comidos o combinación de condiciones.
- Inteligencia avanzada (pathfinding A\*, pre-exits de bloqueo).

## Data model

No hay cambios de estructura de juego, solo se amplía la existente:

```js
// maze.js — pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 12, y: 14, type: 'emboscador',  release: 2 },
  { x: 13, y: 14, type: 'agresor',     release: 5  },
  { x: 14, y: 14, type: 'flanqueador', release: 10 },
  { x: 15, y: 14, type: 'timido',      release: 15 },
];
```

- Se elimina `kind` (`'hunter'`/`'random'`); cada ghost gana `type` + `release` (segundos) + `inPen` (booleano).
- `game` gana `elapsed` (segundos jugados). `update()` recibe `dt` desde `main.js`.
- `render.js`: `GHOST_COLORS` pasa de array por índice a mapa por tipo: `agresor:'#ff0000'`, `emboscador:'#ffb8ff'`, `flanqueador:'#00ffff'`, `timido:'#ffb852'`.

Variables globales exportadas en `window` no cambian de nombre.

## Implementation plan

1. **Expandir `GHOST_STARTS`** a 4 entradas con `type`/`release` (manteniendo `kind` provisionalmente). Render con colores por tipo. *Verificar:* 4 fantasmas visibles, cada uno de un color.
2. **Refactor de `decideGhost`** en `game.js`: extraer `targetFor(game, g)` que devuelve la celda objetivo según `type`, y un único bucle greedy de mínima distancia Manhattan (el del `hunter` actual). Implementar **agresor** y **emboscador** (clamp de objetivo dentro del grid).
3. **Añadir flanqueador y tímido**: flanqueador = `2 × (pacman + 2·dir) − agresor` (si el agresor está en pen, se usa su celda de inicio); tímido persigue directo si distancia euclídea a Pac-Man > 8, si no vaga (random).
4. **Liberación escalonada + reloj**: `main.js` calcula `dt` con `performance.now()` y lo pasa a `update(game, dt)`. `game.elapsed` acumula. En `moveGhost`, si `inPen` y `elapsed >= release`, se libera (`inPen=false`) y entra en juego la IA (sale sola por la puerta). En `resetPositions`, todos vuelven a la pen e `inPen=true`, y `elapsed=0` (ciclo de liberación se reinicia al perder vida).
5. **Limpiar el `kind`** residual de los pasos 1-2.

## Acceptance criteria

- [ ] Al iniciar partida hay exactamente 4 fantasmas dentro de la pen, inmóviles.
- [ ] El emboscador es el primero en salir (~2s) y el tímido el último (~15s); salen por la puerta de la pen.
- [ ] Cada fantasma tiene el color de su tipo (rojo, rosa, cian, naranja).
- [ ] El agresor reduce siempre la distancia a Pac-Man en cada intersección (nunca vaga).
- [ ] El emboscador apunta a una celda 4 posiciones por delante de Pac-Man según su dirección.
- [ ] El flanqueador no coincide con el objetivo del agresor: su punto de destino se aleja del agresor.
- [ ] El tímido, con Pac-Man a ≤8 celdas, a veces elige direcciones que no acercan; con >8, persigue.
- [ ] Al perder una vida, los 4 vuelven a la pen y el ciclo de liberación recomienza.
- [ ] La consola no muestra errores y dots, colisión y túnel siguen funcionando.

## Decisions

- **Yes:** tipos en español (`agresor/emboscador/flanqueador/timido`) — coherencia con los textos del repo.
- **Yes:** liberación por **tiempo real** (`performance.now()`), no por frames — el juego no depende del FPS del navegador.
- **Yes:** todos los fantasmas con retraso propio; el agresor no sale primero (decisión del usuario).
- **Yes:** quietos en la pen, sin el "flotar" del arcade — mínimo código, sin bloqueos.
- **Yes:** timings por defecto 2/5/10/15s. Constantes ajustables sin tocar lógica.
- **No:** el giro original del emboscador (si el objetivo sale del mapa se usa una esquina fija) — aquí se *clampa* al borde del grid. Más simple y suficiente.
- **No:** flotar dentro de la pen.
- **No:** frightened mode, liberación por dots, pathfinding con pre-exits — specs futuras.

## Risks

| Risk | Mitigation |
| --- | --- |
| Los 4 fantasmas en el interior de la pen (cols 12–15) se bloquean entre sí al salir | Están inmóviles hasta su liberación y salen en momentos distintos; la fila del túnel permite que el siguiente ya pueda moverse |
| El flanqueador depende del agresor, que a veces se aleja | Si el agresor no sale o muere, se usa su celda de inicio como referencia; el flanqueador nunca queda sin objetivo |

## What is **not** in this spec

- Fantasmas comestibles / *frightened mode* y cápsulas fabulosas.
- Liberación por puntos comidos.
- A\* o rompecabezas de pre-exit.
- Cambios en la geometría del laberinto.

Cada uno de esos, si llega, va en su propia spec.