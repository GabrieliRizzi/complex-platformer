// Platformer completo — roda direto em GitHub Pages (arquivo estático).
// Controles: ← → (setas) ou A/D, pular: ↑ / W / Espaço
// Mobile: botões na tela

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ajustar resolução do canvas para ficar nítido em telas HiDPI
  function fitCanvas() {
    const styleW = canvas.clientWidth;
    const styleH = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(styleW * dpr);
    canvas.height = Math.round(styleH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  // UI elements
  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('startBtn');
  const pausedMenu = document.getElementById('paused');
  const resumeBtn = document.getElementById('resumeBtn');
  const restartBtn = document.getElementById('restartBtn');
  const gameover = document.getElementById('gameover');
  const tryAgainBtn = document.getElementById('tryAgainBtn');
  const finalScore = document.getElementById('finalScore');
  const hudScore = document.getElementById('score');
  const hudLives = document.getElementById('lives');
  const hudLevel = document.getElementById('level');
  const winMenu = document.getElementById('win');
  const nextLevelBtn = document.getElementById('nextLevelBtn');

  // mobile controls
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const upBtn = document.getElementById('upBtn');

  // game state
  let state = 'menu'; // 'menu', 'playing', 'paused', 'gameover', 'win'
  let lastTime = 0;
  let keys = {};
  let touchControls = { left: false, right:false, up:false };

  // world scale (virtual coords)
  const W = 960, H = 540;

  // player config
  const player = {
    x: 60, y: 0, w: 40, h: 48,
    vx: 0, vy: 0, speed: 240, jump: 480, grounded: false,
    lives: 3
  };

  let levelIndex = 0;
  let score = 0;

  // levels: each level defines platforms, stars (collectibles) and enemies
  // platform {x,y,w,h}, star {x,y}, flag {x,y}
  const levels = [
    {
      platforms: [
        {x:0,y:500,w:960,h:40},
        {x:180,y:420,w:140,h:18},
        {x:360,y:340,w:140,h:18},
        {x:580,y:420,w:200,h:18},
        {x:780,y:300,w:120,h:18}
      ],
      stars: [{x:220,y:380},{x:400,y:300},{x:820,y:260}],
      enemies: [{x:480,y:460,w:36,h:36,dir:-1,range:140},{x:700,y:380,w:36,h:36,dir:1,range:80}],
      flag: {x:900,y:456,w:28,h:44},
      gravity: 1400
    },
    {
      platforms: [
        {x:0,y:500,w:960,h:40},
        {x:120,y:420,w:120,h:18},
        {x:260,y:340,w:120,h:18},
        {x:420,y:260,w:120,h:18},
        {x:580,y:180,w:120,h:18},
        {x:760,y:300,w:160,h:18}
      ],
      stars: [{x:160,y:380},{x:420,y:220},{x:820,y:260},{x:620,y:140}],
      enemies: [{x:320,y:300,w:36,h:36,dir:1,range:160},{x:650,y:270,w:36,h:36,dir:-1,range:120}],
      flag: {x:880,y:116,w:28,h:44},
      gravity: 1500
    },
    {
      platforms: [
        {x:0,y:500,w:960,h:40},
        {x:120,y:420,w:120,h:18},
        {x:260,y:340,w:120,h:18},
        {x:430,y:420,w:120,h:18},
        {x:600,y:320,w:120,h:18},
        {x:760,y:240,w:120,h:18}
      ],
      stars: [{x:150,y:380},{x:280,y:300},{x:480,y:380},{x:630,y:280},{x:820,y:200}],
      enemies: [{x:360,y:300,w:36,h:36,dir:1,range:200},{x:520,y:380,w:36,h:36,dir:-1,range:100},{x:740,y:200,w:36,h:36,dir:1,range:120}],
      flag: {x:900,y:196,w:28,h:44},
      gravity: 1600
    }
  ];

  let world = null; // will hold current level state

  // helpers
  function rectsOverlap(a,b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function startLevel(idx){
    levelIndex = idx;
    const template = levels[idx];
    world = {
      platforms: template.platforms.map(p=>({...p})),
      stars: template.stars.map(s=>({...s, collected:false})),
      enemies: template.enemies.map((e)=>({
        x:e.x, y:e.y, w:e.w, h:e.h, dir:e.dir, range:e.range, startX:e.x, speed:80
      })),
      flag: {...template.flag},
      gravity: template.gravity
    };
    // place player at start
    player.x = 60; player.y = 420; player.vx = 0; player.vy = 0; player.grounded=false;
    hudLevel.textContent = `Nível: ${levelIndex+1}`;
    updateHUD();
  }

  function updateHUD(){
    hudScore.textContent = `Score: ${score}`;
    hudLives.textContent = `Vidas: ${player.lives}`;
  }

  // input handling
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp',' ','w','a','s','d','W','A','D'].includes(e.key)) {
      e.preventDefault();
    }
    keys[e.key] = true;

    if (state === 'playing' && e.key === 'Escape') {
      togglePause();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  // mobile button handlers
  leftBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); touchControls.left=true; });
  leftBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); touchControls.left=false; });
  rightBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); touchControls.right=true; });
  rightBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); touchControls.right=false; });
  upBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); touchControls.up=true; setTimeout(()=>touchControls.up=false,150); });

  // buttons
  startBtn.addEventListener('click', ()=> {
    menu.classList.add('hidden');
    state = 'playing';
    score = 0;
    player.lives = 3;
    startLevel(0);
    lastTime = performance.now();
    loop(lastTime);
  });

  resumeBtn.addEventListener('click', ()=> { pausedMenu.classList.add('hidden'); state='playing'; lastTime = performance.now(); loop(lastTime); });
  restartBtn.addEventListener('click', ()=> { pausedMenu.classList.add('hidden'); state='playing'; score=0; player.lives=3; startLevel(0); lastTime = performance.now(); loop(lastTime); });
  tryAgainBtn.addEventListener('click', ()=> {
    gameover.classList.add('hidden'); menu.classList.add('hidden');
    state='playing'; score=0; player.lives=3; startLevel(0); lastTime=performance.now(); loop(lastTime);
  });
  nextLevelBtn.addEventListener('click', ()=> {
    winMenu.classList.add('hidden');
    if (levelIndex +1 < levels.length) {
      startLevel(levelIndex+1);
      state='playing';
      lastTime = performance.now();
      loop(lastTime);
    } else {
      // victory across all levels
      gameover.classList.remove('hidden');
      document.getElementById('finalScore').textContent = `Parabéns! Pontuação final: ${score}`;
      state='gameover';
    }
  });

  function togglePause(){
    if (state === 'playing') {
      state='paused';
      pausedMenu.classList.remove('hidden');
    } else if (state === 'paused'){
      pausedMenu.classList.add('hidden');
      state='playing';
      lastTime = performance.now();
      loop(lastTime);
    }
  }

  // main loop
  function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min(1/30, (now - lastTime)/1000);
    lastTime = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // update physics, enemies, collisions
  function update(dt) {
    // input resolved
    const left = keys['ArrowLeft'] || keys['a'] || keys['A'] || touchControls.left;
    const right = keys['ArrowRight'] || keys['d'] || keys['D'] || touchControls.right;
    const jumpKey = keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' '] || touchControls.up;

    // horizontal movement
    if (left && !right) player.vx = -player.speed;
    else if (right && !left) player.vx = player.speed;
    else player.vx = 0;

    // gravity
    player.vy += world.gravity * dt;

    // jump (only if grounded)
    if (jumpKey && player.grounded) {
      player.vy = -player.jump;
      player.grounded = false;
    }

    // integrate
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // world collisions (platforms)
    player.grounded = false;
    for (let p of world.platforms) {
      // simple AABB collision resolve
      const px = p.x, py = p.y, pw = p.w, ph = p.h;
      // horizontal overlap?
      if (player.x < px + pw && player.x + player.w > px && player.y < py + ph && player.y + player.h > py) {
        // find smallest penetration
        const overlapX = (player.vx >=0) ? (player.x + player.w - px) : (px + pw - player.x);
        const overlapY = (player.vy >=0) ? (player.y + player.h - py) : (py + ph - player.y);

        if (overlapY < overlapX) {
          // vertical collision
          if (player.vy > 0) {
            player.y = py - player.h;
            player.vy = 0;
            player.grounded = true;
          } else {
            player.y = py + ph;
            player.vy = 0;
          }
        } else {
          // horizontal collision
          if (player.vx > 0) player.x = px - player.w;
          else if (player.vx < 0) player.x = px + pw;
        }
      }
    }

    // keep inside world horizontally
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > W) player.x = W - player.w;

    // falling below screen = loose life
    if (player.y > H + 200) {
      loseLife();
    }

    // collect stars
    for (let s of world.stars) {
      if (!s.collected && rectsOverlap(player, {x:s.x-10,y:s.y-10,w:20,h:20})) {
        s.collected = true;
        score += 100;
        updateHUD();
      }
    }

    // enemies movement and collision
    for (let e of world.enemies) {
      e.x += e.dir * e.speed * dt;
      if (Math.abs(e.x - e.startX) > e.range) e.dir *= -1;
      // collision with player
      if (rectsOverlap(player, e)) {
        // if player is falling and hits enemy from top => kill enemy
        if (player.vy > 200 && (player.y + player.h - e.y) < 30) {
          // stomp
          // bounce player a bit
          player.vy = -player.jump * 0.5;
          // remove enemy from array (mark off-screen)
          e.dead = true;
          score += 200;
          updateHUD();
        } else {
          // hurt player
          loseLife();
        }
      }
    }
    // remove dead enemies
    world.enemies = world.enemies.filter(e=>!e.dead);

    // reach flag?
    if (rectsOverlap(player, world.flag)) {
      // if all stars collected => win level
      const all = world.stars.every(s=>s.collected);
      if (all) {
        // win level
        state='win';
        winMenu.classList.remove('hidden');
      } else {
        // hint - do nothing or push back
        // small bounce
        player.vx = 0;
        player.vy = -200;
      }
    }

    // if all stars collected, show small effect (score over time)
    // nothing more for now
  }

  function loseLife() {
    player.lives -= 1;
    updateHUD();
    if (player.lives <= 0) {
      // game over
      state = 'gameover';
      gameover.classList.remove('hidden');
      finalScore.textContent = `Pontuação: ${score}`;
    } else {
      // respawn at start of level after short blink
      player.x = 60; player.y = 0; player.vx = 0; player.vy = 0;
    }
  }

  // rendering
  function render() {
    // clear background sky
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // scale virtual coordinate to canvas
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    // draw world scaled to canvas
    ctx.save();
    const sx = cw / W, sy = ch / H;
    ctx.scale(sx, sy);

    // background gradient
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#87ceeb'); g.addColorStop(1,'#bfe9ff');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // draw platforms
    for (let p of world.platforms) {
      roundedRect(ctx, p.x, p.y, p.w, p.h, 4, '#8B5A2B', '#6b4019');
    }

    // draw stars
    for (let s of world.stars) {
      if (!s.collected) drawStar(ctx, s.x, s.y, 6, 10, 5, '#ffd166');
    }

    // draw enemies
    for (let e of world.enemies) {
      drawEnemy(ctx, e.x, e.y, e.w, e.h);
    }

    // draw flag
    drawFlag(ctx, world.flag.x, world.flag.y, world.flag.w, world.flag.h);

    // draw player (rectangle with face)
    drawPlayer(ctx, player.x, player.y, player.w, player.h);

    // small ground shadow
    ctx.restore();
  }

  // draw helpers
  function roundedRect(ctx,x,y,w,h,r,fill,stroke){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    if (fill){ ctx.fillStyle = fill; ctx.fill(); }
    if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius)
    for(let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x,y)
      rot += step

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x,y)
      rot += step
    }
    ctx.lineTo(cx, cy - outerRadius)
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#c78f19';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawEnemy(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    // body
    ctx.fillStyle = '#b00020';
    ctx.fillRect(-w/2, -h/2, w, h);
    // eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-w/4, -h/4, w/5, h/5);
    ctx.fillRect(w/8, -h/4, w/5, h/5);
    // pupils
    ctx.fillStyle = '#000';
    ctx.fillRect(-w/4 + 2, -h/4 + 2, 4, 4);
    ctx.fillRect(w/8 + 2, -h/4 + 2, 4, 4);
    ctx.restore();
  }

  function drawFlag(ctx, x, y, w, h) {
    ctx.save();
    // pole
    ctx.fillStyle = '#333';
    ctx.fillRect(x-4, y - h, 4, h+8);
    // flag
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    ctx.moveTo(x, y - h + 8);
    ctx.lineTo(x + w, y - h/2);
    ctx.lineTo(x, y - h/4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(ctx, x,y,w,h) {
    ctx.save();
    // body
    ctx.fillStyle = '#0066ff';
    ctx.fillRect(x, y, w, h);
    // eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w*0.15, y + h*0.2, w*0.18, h*0.18);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + w*0.18, y + h*0.23, w*0.06, h*0.06);
    // mouth
    ctx.fillStyle = '#000';
    ctx.fillRect(x + w*0.25, y + h*0.65, w*0.5, h*0.08);
    ctx.restore();
  }

  // initial show
  menu.classList.remove('hidden');
  hudLevel.textContent = `Nível: -`;
  hudScore.textContent = `Score: 0`;
  hudLives.textContent = `Vidas: ${player.lives}`;

  // keyboard soft pause (P)
  window.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') {
      if (state === 'playing') { state='paused'; pausedMenu.classList.remove('hidden'); }
      else if (state === 'paused') { pausedMenu.classList.add('hidden'); state='playing'; lastTime = performance.now(); loop(lastTime); }
    }
  });

  // if user clicks canvas while in menu, start (small convenience)
  canvas.addEventListener('click', () => {
    if (state === 'menu') startBtn.click();
  });

  // draw a simple initial "splash" while waiting
  function drawSplash(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    ctx.save();
    const sx = cw / W, sy = ch / H;
    ctx.scale(sx, sy);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#87ceeb'); g.addColorStop(1,'#bfe9ff');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#fff'; ctx.font = '28px sans-serif';
    ctx.fillText('Clique em Iniciar para jogar', 300, 280);
    ctx.restore();
  }
  drawSplash();

})();
