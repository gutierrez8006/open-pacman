// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Power pellets (SPEC 03): 4 esquinas que activan frightened 7 s.
const FRIGHTENED_DURATION = 7; // segundos
const PELLET_SCORE = 50;
const GHOST_FRIGHT_SPEED = 0.05; // mitad de GHOST_SPEED -> alinea cada 20 frames

// Rectangulo interior de la pen (sin la puerta): cols 11-16, filas 13-15.
// Mientras un fantasma este dentro, apunta a la puerta (13,12) para salir sola.
const PEN = { x0: 11, x1: 16, y0: 13, y1: 15, doorX: 13, doorY: 12 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  let pellets = 0;
  for ( const row of grid ) for ( const v of row ) {
    if ( v === 2 ) dots++;
    if ( v === 4 ) pellets++;
  }

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    pelletsRemaining: pellets,
    frightened: { active: false, timer: 0, chain: 0 },
    elapsed: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      type: g.type,
      release: g.release,
      inPen: true,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  // Puerta de un solo sentido: un fantasma fuera de la pen no puede volver
  // a entrar ni a las celdas de la puerta.
  if ( actor === 'ghost' && !inPenRect( x, y ) ) {
    if ( isDoorCell( tx, ty ) || inPenRect( tx, ty ) ) return false;
  }
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet: 50 puntos y activa (o reinicia) frightened 7 s.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += PELLET_SCORE;
      game.pelletsRemaining--;
      game.frightened.active = true;
      game.frightened.timer = FRIGHTENED_DURATION;
      game.frightened.chain = 0;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Esta la celda dentro del rectangulo interior de la pen?
function inPenRect( x, y ) {
  return x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 && y <= PEN.y1;
}

// Sigue dentro del rectangulo interior de la pen?
function inPen( g ) {
  return inPenRect( Math.round( g.x ), Math.round( g.y ) );
}

// Es una celda de puerta del laberinto? (fila PEN.doorY, cols PEN.doorX y PEN.doorX + 1)
function isDoorCell( x, y ) {
  return y === PEN.doorY && ( x === PEN.doorX || x === PEN.doorX + 1 );
}

// Celda objetivo del fantasma segun su tipo.
function targetFor( game, g ) {
  const p = game.pacman;
  const grid = game.grid;
  const W = grid[ 0 ].length;
  const H = grid.length;

  // Salida de la pen: mientras este dentro, apunta a la puerta.
  if ( inPen( g ) ) return { x: PEN.doorX, y: PEN.doorY };

  // Asustado: vaga en aleatorio (sin objetivo).
  if ( game.frightened && game.frightened.active ) return null;

  if ( g.type === 'agresor' ) {
    return { x: Math.round( p.x ), y: Math.round( p.y ) };
  }
  if ( g.type === 'emboscador' ) {
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    const x = Math.max( 0, Math.min( W - 1, Math.round( p.x ) + d.x * 4 ) );
    const y = Math.max( 0, Math.min( H - 1, Math.round( p.y ) + d.y * 4 ) );
    return { x, y };
  }
  if ( g.type === 'flanqueador' ) {
    const agresor = game.ghosts.find( ( o ) => o.type === 'agresor' );
    const agresorStart = GHOST_STARTS.find( ( s ) => s.type === 'agresor' );
    // Si el agresor sigue en la pen se usa su celda de inicio como referencia.
    const refX = agresor && !agresor.inPen ? Math.round( agresor.x ) : agresorStart.x;
    const refY = agresor && !agresor.inPen ? Math.round( agresor.y ) : agresorStart.y;
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    const targetX = 2 * ( Math.round( p.x ) + d.x * 2 ) - refX;
    const targetY = 2 * ( Math.round( p.y ) + d.y * 2 ) - refY;
    return {
      x: Math.max( 0, Math.min( W - 1, targetX ) ),
      y: Math.max( 0, Math.min( H - 1, targetY ) ),
    };
  }
  if ( g.type === 'timido' ) {
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    // Persigue directo solo si esta lejos de pacman; si no, vaga (random).
    if ( Math.sqrt( dx * dx + dy * dy ) > 8 ) {
      return { x: Math.round( p.x ), y: Math.round( p.y ) };
    }
    return null;
  }
  return null; // vaga (random) — sin tipo reconocido
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  const target = targetFor( game, g );
  if ( !target ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Liberacion escalonada: quieto en la pen hasta que pase su release.
    if ( g.inPen ) {
      if ( game.elapsed >= g.release ) g.inPen = false;
      else return;
    }
    // Celda de puerta: forzar la salida hacia arriba (unica salida valida),
    // ignorando el greedy.
    if ( isDoorCell( g.x, g.y ) ) {
      g.dir = 'up';
    } else {
      decideGhost( game, g );
    }
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  // Asustado: mitad de velocidad para dar ventaja a Pac-Man.
  const speed = ( game.frightened && game.frightened.active ) ? GHOST_FRIGHT_SPEED : g.speed;
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // El ciclo de liberacion se reinicia al perder una vida.
  game.elapsed = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.inPen = true;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game, dt ) {
  game.elapsed += dt;
  // Timer de frightened: al agotarse vuelve a IA y velocidad normales.
  if ( game.frightened && game.frightened.active ) {
    game.frightened.timer -= dt;
    if ( game.frightened.timer <= 0 ) {
      game.frightened.timer = 0;
      game.frightened.active = false;
    }
  }
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
