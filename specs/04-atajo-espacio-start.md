# SPEC 04 — Atajo de barra espaciadora para Start y Reiniciar

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-26
> **Objective:** Permitir iniciar y reiniciar la partida con la barra espaciadora, con el mismo efecto que pulsar el botón del overlay.

## Scope

**In:**

- La barra espaciadora activa el botón del overlay en los estados `start`, `won` y `lost` (Start y Reiniciar).
- Con la partida en marcha (`playing`) el espacio no hace nada, pero se llama a `e.preventDefault()`.
- Se ignora la repetición automática de tecla (`e.repeat`).
- Pista visual del atajo en el overlay, en los tres estados.

**Out of scope (para futuras specs):**

- Cualquier otro atajo de teclado (Enter, Escape, pausa).
- Estado `paused` / pausa con Escape.
- Quitar el botón del overlay o hacerlo accesible solo por teclado.
- Foco visible en el botón, navegación por tabulador o ARIA.
- Refactor de `showOverlay` para no reescribir el `innerHTML`.

## Data model

No se introducen estructuras de datos nuevas. Se reutiliza el estado existente (`game.state` de `game.js`, valores `start`, `playing`, `won`, `lost`) y la función `startGame()` de `main.js`.

Único dato nuevo, una constante de mapeo junto a `KEY_DIR`:

```js
// main.js — se añade junto a KEY_DIR
const START_KEYS = [ ' ', 'Spacebar' ]; // e.key del espacio
```

- Sin cambios en `window`, en `game.js`, en `maze.js` ni en `render.js`.

## Implementation plan

1. **Detectar el espacio en el `keydown` existente** (`main.js`): antes de la línea `if ( !dir ) return;`, comprobar `START_KEYS.includes( e.key ) || e.code === 'Space'`. *Verificar:* con la consola abierto, `keydown` de espacio no llega a la rama de flechas.
2. **Conectar la acción**: si `game.state !== 'playing'` y `!e.repeat`, llamar a `startGame()`. *Verificar:* desde la pantalla inicial, espacio arranca la partida; el overlay se oculta.
3. **Prevenir el default**: llamar a `e.preventDefault()` en toda pulsación de espacio, incluso con la partida en marcha. *Verificar:* con la partida en marcha, espacio no hace scroll y no reinicia.
4. **Pista visual**: añadir `<p class="hint">Pulsa Espacio para empezar</p>` en `index.html` y en el `innerHTML` de `showOverlay`, con la etiqueta parametrizada por estado. *Verificar:* la pista aparece en Start, GANASTE y PERDISTE.
5. **Verificación final**: partida manual completa con arranque por espacio, pérdida de vida hasta PERDISTE y reinicio por espacio; clic de ratón en ambos botones sigue funcionando.

## Acceptance criteria

- [ ] Con la pantalla inicial visible, pulsar espacio inicia la partida y oculta el overlay.
- [ ] Con `game.state === 'won'` o `'lost'`, pulsar espacio reinicia la partida con dots, vidas y fantasmas restablecidos.
- [ ] Con la partida en marcha, pulsar espacio no reinicia la partida ni cambia el estado.
- [ ] Con la partida en marcha, pulsar espacio no hace scroll en la página.
- [ ] Tras hacer clic en Start con el ratón, pulsar espacio durante la partida no reinicia la partida.
- [ ] Mantener el espacio pulsado genera una sola acción (la repetición no reinicia).
- [ ] El texto `Pulsa Espacio para empezar` es visible en los tres estados del overlay.
- [ ] El clic de ratón en Start y en Reiniciar sigue funcionando igual que antes.
- [ ] Las flechas siguen moviendo a Pac-Man y el resto del juego (dots, pellets, fantasmas, túnel, puerta) no cambia.
- [ ] La consola no muestra errores.

## Decisions

- **Yes:** el espacio solo actúa con el overlay visible (`game.state !== 'playing'`). El atajo replica el botón, y el botón no existe mientras se juega.
- **Yes:** `e.preventDefault()` siempre en el espacio, incluso sin efecto. Es la única forma de anular el scroll y la activación nativa del botón oculto que conserva el foco tras un clic de ratón.
- **Yes:** llamar a `startGame()` directamente en lugar de `actionBtn.click()`. `showOverlay` reescribe el `innerHTML`, así que la const `actionBtn` de `main.js:7` queda obsoleta y su `.click()` sería un no-op tras GANASTE o PERDISTE.
- **Yes:** extender el `keydown` existente en lugar de añadir uno nuevo. Un solo listener, misma convención que las flechas, sin duplicar `preventDefault` ni orden de ejecución.
- **Yes:** `e.key === ' '` como detección principal, con `e.code === 'Space'` como respaldo. `e.key` es el carácter real y no depende del layout físico; `'Spacebar'` es el nombre antiguo de navegadores ya fuera de soporte.
- **Yes:** ignorar `e.repeat`. Una pulsación, una acción; mantener pulsado el espacio no debe reiniciar la partida en bucle.
- **Yes:** pista visual en el overlay. Un atajo invisible es un atajo que nadie descubre.
- **No:** el espacio reinicia en cualquier estado. Un reinicio accidental a media partida se pierde sin aviso.
- **No:** pausa con Escape ni estado `paused`. AGENTS.md lo menciona, pero el código no lo tiene; mezclar ambos aquí ampliaría el alcance.
- **No:** refactor de `showOverlay` para conservar el nodo del botón. Resuelve un problema real pero ortogonal; merece su propia spec si molesta.

## Risks

| Risk | Mitigation |
| --- | --- |
| El botón conserva el foco tras un clic de ratón y el espacio dispara un `click` nativo, reiniciando la partida | `e.preventDefault()` en la tecla anula esa activación; verificado en el criterio "tras hacer clic en Start" |
| `e.key` con barra espaciadora no se normaliza igual entre navegadores | Doble detección por `e.key` y `e.code`; el valor de `e.key` para espacio es `' '` en todos los navegadores actuales |
| La pista visual duplicada entre `index.html` y `showOverlay` puede desincronizarse | Ambas se editan en el mismo paso y el texto es parametrizado por estado para que solo cambie la parte variable |

## What is **not** in this spec

- Otros atajos: Enter, Escape, pausa.
- Estado `paused`.
- Accesibilidad: foco visible, tabulación, ARIA.
- Quitar el botón o hacerlo inaccesible por ratón.
- Refactor de `showOverlay` o del overlay en general.

Cada uno de esos, si llega, va en su propia spec.
