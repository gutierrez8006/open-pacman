// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

let game = createGame();
let frame = 0;
let last = performance.now();

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

// e.key de la barra espaciadora (' ' y el nombre antiguo de navegadores viejos)
const START_KEYS = [ ' ', 'Spacebar' ];

document.addEventListener( 'keydown', ( e ) => {
  const isStartKey = START_KEYS.includes( e.key ) || e.code === 'Space';
  if ( isStartKey ) e.preventDefault();
  if ( isStartKey && !e.repeat && game.state !== 'playing' ) startGame();
  if ( isStartKey ) return;
  const dir = KEY_DIR[ e.key ];
  if ( !dir ) return;
  e.preventDefault();
  if ( game.state === 'playing' ) game.pacman.nextDir = dir;
} );

function showOverlay( title, cls, btnLabel ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>' +
    '<p class="hint">Pulsa Espacio para empezar</p>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', startGame );
}

function startGame() {
  game = createGame();
  game.state = 'playing';
  overlay.classList.remove( 'show' );
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

function loop() {
  const now = performance.now();
  const dt = ( now - last ) / 1000; // segundos
  last = now;
  frame++;
  if ( game.state === 'playing' ) {
    update( game, dt );
    if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Reiniciar' );
    else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
  }
  draw( ctx, game, frame );
  requestAnimationFrame( loop );
}

loop();
