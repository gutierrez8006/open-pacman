# SPEC 03 — Power Pellets y fantasmas comestibles

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-25
> **Objective:** Añadir 4 Power Pellets en las esquinas que activan 7 s de modo frightened durante los cuales Pac-Man come fantasmas por puntos en cadena.

## Scope

**In:**

- 4 Power Pellets en las esquinas arcade: `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` sobre dots existentes.
- Nuevo tile `o` en `MAZE_STR` → valor `4` en `MAZE`; `createGame` los copia a `game.grid` y cuenta `pelletsRemaining`.
- Comer pellet da 50 puntos, activa `frightened` por 7 s (reinicia timer y cadena si se come otro pellet durante el efecto).
- Durante `frightened`: fantasmas huyen en aleatorio a mitad de velocidad y son comestibles; comer en cadena da 200/400/800/1600.
- Fantasma comido vuelve por teleporte a la pen y re-sale en ~1-2 s (no espera su `release` original 2/5/10/15 s).
- Chocar con un fantasma no-asustado quita vida igual (solo los asustados son seguros).
- Render: pellet grande parpadeante + fantasma azul (`#2121ff`) con parpadeo blanco al final.

**Out of scope (para futuras specs):**

- Fruta bonus / niveles extra / más de 4 pellets.
- Comer fantasmas fuera del frightened.
- Cambiar IA base de los 4 tipos, tiempos de liberación inicial o geometría del laberinto.
- Persistencia de puntuación.

## Data model

```js
// maze.js — MAZE_STR usa 'o' para pellet (valor 4)
const MAZE_STR = [ /* (1,3),(26,3),(1,23),(26,23) con 'o' en vez de '.' */ ];
// parseTile: 'o' → 4

// game.js — estado nuevo en game
const FRIGHTENED_DURATION = 7; // segundos
const PELLET_SCORE = 50;
const GHOST_CHAIN = [ 200, 400, 800, 1600 ];
const GHOST_FRIGHT_SPEED = 0.05; // mitad de GHOST_SPEED
const EATEN_RELEASE_DELAY = 1.5; // re-salida rápida tras ser comido

game.frightened = { active: false, timer: 0, chain: 0 };
// fantasma comido: g.inPen = true + g.release = game.elapsed + EATEN_RELEASE_DELAY (teleporte a su celda de inicio)
```

- Convenciones: celdas `(x,y)` origen arriba-izquierda; velocidades en celdas/frame divisores de 1 (`0.05` alinea cada 20 frames); estilo con espacios dentro de parens y comillas simples.

## Implementation plan

1. **Marcar pellets en `maze.js`**: cambiar 4 `.` por `o` en las esquinas y `parseTile` → `4`. *Verificar:* `MAZE[3][1] === 4` etc.
2. **Contar y comer pellets en `game.js`**: `createGame` cuenta pellets; `movePacman` al pisar `4` pone `0`, suma 50, activa `frightened = { active:true, timer:7, chain:0 }`. *Verificar:* comer esquina activa 7 s.
3. **Timer y movimiento asustado**: `update(game, dt)` decrementa `timer`; a 0 desactiva. `targetFor` devuelve `null` (vagar) si `frightened.active`; `moveGhost` usa `GHOST_FRIGHT_SPEED`. Parpadeo final 2 s. *Verificar:* 7 s en aleatorio lento, luego IA normal.
4. **Comer fantasmas y cadena**: en `update`, si `collides` y `frightened.active` → sumar `GHOST_CHAIN[chain]`, `chain++`, teleporte del fantasma a su inicio con `inPen=true` y `release = elapsed + 1.5`. Si no hay frightened → perder vida como antes. *Verificar:* 200/400/800/1600 en un mismo frightened.
5. **Render en `render.js`**: `drawPellets` (círculo grande r≈6 parpadeante con `frame`) + `drawGhost` azul si frightened (blanco los últimos 2 s). *Verificar:* visual arcade sin errores de consola.
6. **Verificación final**: partida manual 60 s + simulación: pellets se agotan, re-salida sin atasco en puerta (respeta SPEC 02).

## Acceptance criteria

- [ ] Hay exactamente 4 pellets en `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`, grandes y visibles.
- [ ] Comer un pellet suma 50 y activa 7 s de frightened (fantasmas azules, aleatorios, lentos).
- [ ] Comer 4 fantasmas en un frightened suma 200+400+800+1600 en ese orden.
- [ ] Un segundo pellet reinicia timer a 7 s y cadena a 200.
- [ ] Fantasma comido reaparece en la pen y sale en ≤2 s sin atascarse en la puerta.
- [ ] Chocar con fantasma durante frightened sin estar asustado (imposible salvo bug de timer) o tras expirar quita vida.
- [ ] Al expirar el timer los supervivientes vuelven a su IA (agresor/emboscador/flanqueador/tímido) y velocidad normal.
- [ ] Últimos 2 s los fantasmas parpadean (azul/blanco).
- [ ] La consola no muestra errores y dots, vidas, túnel y puerta unidireccional siguen funcionando.

## Decisions

- **Yes:** 4 esquinas arcade — elección del usuario, fiel al original.
- **Yes:** 7 s — duración clásica.
- **Yes:** cadena 200/400/800/1600 reiniciada por pellet — arcade, premia cazar varios.
- **Yes:** comido → pen + re-salida ~1.5 s por teleporte — respeta puerta unidireccional de SPEC 02 sin romperla; el `release` original (hasta 15 s) sería castigo excesivo al cazador.
- **Yes:** asustados a mitad de velocidad + aleatorio — arcade y da ventaja real a Pac-Man.
- **Yes:** pellet 50 puntos — clásico frente a dot 10.
- **Yes:** timer reiniciado (no sumado) con segundo pellet — simple y predecible.
- **No:** eliminar fantasma del nivel ni respawn fuera de la pen — rompería el ciclo arcade.
- **No:** frightened seguro total — solo los asustados son comestibles; el peligro parcial mantiene tensión.

## Risks

| Risk | Mitigation |
| --- | --- |
| Teleporte a la pen choca con puerta unidireccional (SPEC 02 bloquea reentrada) | Se usa teleporte directo como `resetPositions`, no cruce de puerta; `inPen=true` + `release` corto lo libera por la puerta con el forzado `up` existente |
| `dt` sin acotar salta el timer si la pestaña pierde foco (heredado SPEC 01/02) | Documentado; futura spec acota `dt` a ~0.1 s |
| Fantasma comido 2 veces en el mismo frightened cuenta cadena dos veces | `chain` solo avanza al comer; si ya fue comido y re-sale sigue contando — comportamiento arcade aceptado |

## What is **not** in this spec

- Frutas, niveles, más pellets o pellets móviles.
- Comer fantasmas fuera del frightened.
- Cambios en IA base, releases iniciales o geometría.
- Persistencia / highscores.

Cada uno de esos, si llega, va en su propia spec.
