"use strict";

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const $ = (id) => document.getElementById(id);
  const ui = {
    tokens: $("hud-tokens"),
    level: $("hud-level"),
    taskName: $("hud-task-name"),
    taskFill: $("hud-task-fill"),
    focusFill: $("hud-focus-fill"),
    bossBar: $("boss-bar"),
    bossName: $("boss-name"),
    bossFill: $("boss-fill"),
    chips: $("powerup-chips"),
    menu: $("screen-menu"),
    pause: $("screen-pause"),
    over: $("screen-gameover"),
    overQuip: $("gameover-quip"),
    overStats: $("gameover-stats"),
    banner: $("banner"),
    status: $("claude-status"),
    menuHi: $("menu-hiscore"),
    muteBtn: $("mute-btn"),
  };

  /* ── textos ── */

  const TASKS = [
    "implementar a feature",
    "corrigir bug em produção",
    "escrever a documentação",
    "migrar o banco (de novo)",
    "revisar o PR de 4.000 linhas",
    "atualizar dependências sem quebrar nada",
    "fazer o deploy de sexta-feira",
    "entender o código legado",
    "otimizar a query lendária",
    "responder os comentários do QA",
    "renomear todas as variáveis 'temp'",
    "remover o TODO de 2019",
  ];

  const STATUS_MSGS = [
    "Lendo 500 arquivos…",
    "Refatorando o legado…",
    "Convencendo o TypeScript…",
    "Rodando os testes (de novo)…",
    "Ultrathinking…",
    "Compactando contexto…",
    "Culpando o cache…",
    "Escrevendo commit message honesta…",
    "Removendo console.log…",
    "Aguardando o npm install…",
    "Fingindo que leu o Jira…",
    "Grep-ando o inexplicável…",
  ];

  const KILL_QUIPS = [
    "marcado como lido",
    "resolvido no assíncrono",
    "per minha última mensagem…",
    "vou verificar e retorno",
    "isso é pauta pra outra call",
    "manda por e-mail",
    "adicionado ao backlog",
    "não era pra hoje",
  ];

  const OVER_QUIPS = [
    "O deadline venceu desta vez.",
    "A reunião podia ter sido um e-mail. Mas não foi.",
    "Focus esgotado. Recomenda-se café.",
    "O escopo mudou. Você não.",
    "Ninguém protege um dev pra sempre.",
  ];

  const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  /* ── estado ── */

  const game = {
    W, H,
    mode: "menu", // menu | play | pause | over
    level: 1,
    tokens: 0,
    focus: 100,
    taskT: 0,
    taskDur: 40,
    phase: "task", // task | boss
    taskName: "",
    tasksDone: 0,
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    powerups: [],
    particles: [],
    floats: [],
    boss: null,
    power: { coffee: 0, focus: 0, dnd: 0 },
    spawnTimer: 1.2,
    shake: 0,
    dmgFlash: 0,
    statusTimer: 0,
    statusMsg: STATUS_MSGS[0],
    bannerT: 0,
    claude: { x: W / 2, y: H - 44 },
    hiscore: +(localStorage.getItem("cvd_hiscore") || 0),
  };

  const LEAK_Y = H - 78; // linha da zona de foco: passou daqui, distraiu o Claude

  /* ── métodos que as entidades usam ── */

  game.scopeChange = function (boss) {
    for (const e of game.enemies) {
      e.vx *= -1;
      e.dirSign *= -1;
    }
    boss.phraseTimer = 3.4;
    boss.phrase = pick(boss.cfg.phrases);
    game.shake = Math.max(game.shake, 0.35);
    showBanner("🔄 o cliente mudou o escopo!", 2, true);
    AudioSys.play("scopeChange");
  };

  /* ── input ── */

  const input = { left: false, right: false, up: false, down: false, fire: false };

  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    Space: "fire",
  };

  window.addEventListener("keydown", (e) => {
    AudioSys.unlock();
    if (KEYMAP[e.code]) {
      input[KEYMAP[e.code]] = true;
      e.preventDefault();
    }
    if (e.code === "Enter" && (game.mode === "menu" || game.mode === "over")) {
      startGame();
    }
    if ((e.code === "KeyP" || e.code === "Escape") && (game.mode === "play" || game.mode === "pause")) {
      togglePause();
    }
    if (e.code === "KeyM") toggleMute();
  });

  window.addEventListener("keyup", (e) => {
    if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false;
  });

  window.addEventListener("blur", () => {
    if (game.mode === "play") togglePause();
  });

  ui.muteBtn.addEventListener("click", () => {
    AudioSys.unlock();
    toggleMute();
    ui.muteBtn.blur(); // senão o Enter de "start" reativa o botão
  });

  function toggleMute() {
    ui.muteBtn.textContent = AudioSys.toggleMute() ? "🔇" : "🔊";
  }

  /* ── fluxo de jogo ── */

  function startGame() {
    game.mode = "play";
    game.level = 1;
    game.tokens = 0;
    game.focus = 100;
    game.tasksDone = 0;
    game.bullets = [];
    game.enemyBullets = [];
    game.enemies = [];
    game.powerups = [];
    game.particles = [];
    game.floats = [];
    game.boss = null;
    game.power = { coffee: 0, focus: 0, dnd: 0 };
    game.shake = 0;
    game.dmgFlash = 0;
    game.player = new Player(W, H);
    startTask();
    ui.menu.classList.add("hidden");
    ui.over.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.bossBar.classList.add("hidden");
  }

  function startTask() {
    game.phase = "task";
    game.taskT = 0;
    game.taskDur = 40 + Math.min(game.level - 1, 4) * 5;
    game.taskName = pick(TASKS);
    game.spawnTimer = 1.2;
    ui.bossBar.classList.add("hidden");
    showBanner(`> nova task: ${game.taskName}`, 2.5);
  }

  function startBoss() {
    game.phase = "boss";
    game.boss = new Boss((game.level - 1) % BOSS_TYPES.length, game.level);
    ui.bossName.textContent = game.boss.cfg.barName;
    ui.bossBar.classList.remove("hidden");
    showBanner(`⚠ merge bloqueado: ${game.boss.cfg.name}`, 2.5, true);
    game.shake = Math.max(game.shake, 0.3);
    AudioSys.play("boss");
  }

  function bossDefeated() {
    const b = game.boss;
    for (let i = 0; i < 40; i++) game.particles.push(new Particle(b.x, b.y, b.cfg.color));
    game.particles.push(new Ring(b.x, b.y, b.cfg.color, 95));
    game.particles.push(new Ring(b.x, b.y, COLORS.text, 55));
    game.tokens += 1000 + game.level * 250;
    game.tasksDone++;
    game.level++;
    game.focus = Math.min(100, game.focus + 15); // café da vitória
    game.boss = null;
    game.enemyBullets = [];
    game.shake = Math.max(game.shake, 0.5);
    showBanner(`✓ Task completed — git commit -m "${game.taskName}"`, 3);
    AudioSys.play("bossDown");
    setTimeout(() => AudioSys.play("taskDone"), 400);
    startTask();
  }

  function togglePause() {
    if (game.mode === "play") {
      game.mode = "pause";
      ui.pause.classList.remove("hidden");
    } else if (game.mode === "pause") {
      game.mode = "play";
      ui.pause.classList.add("hidden");
    }
  }

  function gameOver() {
    game.mode = "over";
    AudioSys.play("gameover");
    if (game.tokens > game.hiscore) {
      game.hiscore = game.tokens;
      localStorage.setItem("cvd_hiscore", String(game.hiscore));
    }
    ui.overQuip.textContent = pick(OVER_QUIPS);
    ui.overStats.textContent =
      `tokens processados ....... ${fmt(game.tokens)}\n` +
      `tasks completadas ........ ${game.tasksDone}\n` +
      `high score ............... ${fmt(game.hiscore)}`;
    ui.over.classList.remove("hidden");
    ui.bossBar.classList.add("hidden");
  }

  function showBanner(text, dur = 2.5, alert = false) {
    ui.banner.textContent = text;
    ui.banner.classList.toggle("alert", alert);
    ui.banner.classList.add("show");
    game.bannerT = dur;
  }

  function fmt(n) {
    return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
  }

  /* ── dano no foco do Claude ── */

  function hitFocus(dmg) {
    if (game.mode !== "play") return;
    game.focus -= dmg;
    game.shake = Math.max(game.shake, 0.25);
    game.dmgFlash = 0.3;
    AudioSys.play("focusHit");
    if (game.focus <= 0) {
      game.focus = 0;
      gameOver();
    }
  }

  /* ── spawn de inimigos ── */

  function pickEnemyType() {
    const progress = game.taskT / game.taskDur;
    const pool = [
      ["teams", 34],
      ["quick", 24],
      ["meeting", 16],
      ["scope", 16],
    ];
    if (progress > 0.7) pool.push(["feedback", 16]); // o feedback sempre chega no final
    let total = 0;
    for (const [, wgt] of pool) total += wgt;
    let r = Math.random() * total;
    for (const [type, wgt] of pool) {
      r -= wgt;
      if (r <= 0) return type;
    }
    return "teams";
  }

  function spawnEnemies(dt) {
    game.spawnTimer -= dt;
    if (game.spawnTimer > 0) return;
    const base = Math.max(0.45, 1.5 - game.level * 0.09);
    game.spawnTimer = base * rand(0.7, 1.3);
    const count = game.level >= 3 && Math.random() < 0.35 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const type = pickEnemyType();
      const x = rand(50, W - 50);
      game.enemies.push(new Enemy(type, x, -30, game.level, { aim: game.claude }));
    }
  }

  /* ── colisões ── */

  function aabb(a, b) {
    return (
      Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
      Math.abs(a.y - b.y) < (a.h + b.h) / 2
    );
  }

  function killEnemy(e, byShield = false) {
    e.dead = true;
    const gained = byShield ? Math.floor(e.cfg.tokens / 2) : e.cfg.tokens;
    game.tokens += gained;
    for (let i = 0; i < (e.mini ? 5 : 10); i++) {
      game.particles.push(new Particle(e.x, e.y, e.cfg.color));
    }
    game.particles.push(new Ring(e.x, e.y, e.cfg.color, e.mini ? 18 : 30));
    if (Math.random() < 0.3) {
      game.floats.push(new FloatText(e.x, e.y - 10, pick(KILL_QUIPS), COLORS.orange));
    } else {
      game.floats.push(new FloatText(e.x, e.y - 10, `+${gained}`, COLORS.dim));
    }
    AudioSys.play("explode");

    // "quick question" se divide: only takes 5 min…
    if (e.cfg.splits && !e.mini && !byShield) {
      for (const off of [-16, 16]) {
        game.enemies.push(new Enemy("quick", e.x + off, e.y, game.level, { mini: true }));
      }
      AudioSys.play("split");
    }
    // drop de power-up
    if (!e.mini && Math.random() < 0.08) {
      const type = pick(Object.keys(POWERUP_TYPES));
      game.powerups.push(new PowerUp(type, e.x, e.y));
    }
  }

  function collide() {
    const p = game.player;

    // balas do jogador × inimigos
    for (const b of game.bullets) {
      if (b.dead) continue;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (aabb(b, e)) {
          b.dead = true;
          if (e.hit(1)) {
            killEnemy(e);
          } else {
            AudioSys.play("hit");
            for (let i = 0; i < 3; i++) game.particles.push(new Particle(b.x, b.y, COLORS.text));
          }
          break;
        }
      }
      // balas × boss
      const boss = game.boss;
      if (!b.dead && boss && !boss.entering && aabb(b, { x: boss.x, y: boss.y, w: boss.cfg.w, h: boss.cfg.h })) {
        b.dead = true;
        if (boss.hit(1)) {
          bossDefeated();
        } else {
          AudioSys.play("hit");
          for (let i = 0; i < 3; i++) game.particles.push(new Particle(b.x, b.y, COLORS.text));
        }
      }
    }

    // inimigos × jogador / escudo DND / zona do Claude
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (game.power.dnd > 0 && Math.hypot(e.x - game.claude.x, e.y - game.claude.y) < 115) {
        killEnemy(e, true);
        continue;
      }
      if (aabb(e, p)) {
        e.dead = true;
        for (let i = 0; i < 8; i++) game.particles.push(new Particle(e.x, e.y, e.cfg.color));
        game.floats.push(new FloatText(p.x, p.y - 24, "distração!", COLORS.red));
        hitFocus(e.cfg.dmg);
        continue;
      }
      if (e.y > LEAK_Y) {
        e.dead = true;
        game.floats.push(new FloatText(e.x, LEAK_Y - 8, `-${e.cfg.dmg} focus`, COLORS.red));
        hitFocus(e.cfg.dmg);
      }
    }

    // projéteis inimigos
    for (const b of game.enemyBullets) {
      if (b.dead) continue;
      if (game.power.dnd > 0 && Math.hypot(b.x - game.claude.x, b.y - game.claude.y) < 115) {
        b.dead = true;
        continue;
      }
      if (aabb(b, p)) {
        b.dead = true;
        game.floats.push(new FloatText(p.x, p.y - 24, "distração!", COLORS.red));
        hitFocus(5);
        continue;
      }
      if (b.y > LEAK_Y) {
        b.dead = true;
        hitFocus(b.dmg);
      }
    }

    // power-ups × jogador
    for (const pu of game.powerups) {
      if (pu.dead) continue;
      if (aabb(pu, p)) {
        pu.dead = true;
        game.power[pu.type] = pu.cfg.dur;
        game.floats.push(new FloatText(p.x, p.y - 28, `${pu.cfg.emoji} ${pu.cfg.label}!`, pu.cfg.color));
        AudioSys.play("power");
      }
    }
  }

  /* ── update ── */

  function update(dt) {
    const slowmo = game.power.focus > 0 ? 0.4 : 1; // focus mode: o mundo desacelera
    const edt = dt * slowmo;

    for (const k of Object.keys(game.power)) {
      game.power[k] = Math.max(0, game.power[k] - dt);
    }

    game.player.update(dt, input, game);

    if (game.phase === "task") {
      game.taskT += dt;
      spawnEnemies(dt);
      if (game.taskT >= game.taskDur) {
        game.taskT = game.taskDur;
        startBoss();
      }
    } else if (game.boss) {
      game.boss.update(edt, game);
    }

    for (const b of game.bullets) b.update(dt);
    for (const b of game.enemyBullets) b.update(edt, game);
    for (const e of game.enemies) e.update(edt, game);
    for (const pu of game.powerups) pu.update(edt, game);
    for (const pt of game.particles) pt.update(dt);
    for (const f of game.floats) f.update(dt);

    collide();

    game.bullets = game.bullets.filter((o) => !o.dead);
    game.enemyBullets = game.enemyBullets.filter((o) => !o.dead);
    game.enemies = game.enemies.filter((o) => !o.dead);
    game.powerups = game.powerups.filter((o) => !o.dead);
    game.particles = game.particles.filter((o) => !o.dead);
    game.floats = game.floats.filter((o) => !o.dead);

    game.shake = Math.max(0, game.shake - dt * 1.6);
    game.dmgFlash = Math.max(0, game.dmgFlash - dt);

    if (game.bannerT > 0) {
      game.bannerT -= dt;
      if (game.bannerT <= 0) ui.banner.classList.remove("show");
    }

    game.statusTimer -= dt;
    if (game.statusTimer <= 0) {
      game.statusTimer = 4;
      game.statusMsg = pick(STATUS_MSGS);
    }
  }

  /* ── render ── */

  const mkStars = (n) =>
    Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      ph: Math.random() * Math.PI * 2,
    }));

  // 3 camadas de parallax: fundo lento e apagado, frente rápida e brilhante
  const starLayers = [
    { v: 8, alpha: 0.16, size: 1, stars: mkStars(42) },
    { v: 22, alpha: 0.32, size: 1.5, stars: mkStars(30) },
    { v: 46, alpha: 0.55, size: 2, stars: mkStars(16) },
  ];

  // nébula pré-renderizada (blobs de gradiente, deriva lenta)
  const nebula = document.createElement("canvas");
  nebula.width = W;
  nebula.height = H;
  {
    const nctx = nebula.getContext("2d");
    const blobs = [
      [W * 0.2, H * 0.3, 260, "217, 119, 87"],
      [W * 0.75, H * 0.2, 220, "155, 126, 222"],
      [W * 0.55, H * 0.72, 300, "108, 184, 196"],
      [W * 0.92, H * 0.8, 200, "217, 119, 87"],
    ];
    for (const [bx, by, r, rgb] of blobs) {
      const g = nctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, `rgba(${rgb}, 0.07)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      nctx.fillStyle = g;
      nctx.fillRect(0, 0, W, H);
    }
  }

  const meteor = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, next: rand(6, 12) };

  function render(dt, time) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#1e1d1a";
    ctx.fillRect(0, 0, W, H);

    // nébula com deriva lenta
    ctx.drawImage(
      nebula,
      Math.sin(time * 0.05) * 26 - 40,
      Math.cos(time * 0.04) * 18 - 40,
      W + 80,
      H + 80
    );

    // estrelas em parallax, com twinkle
    for (const layer of starLayers) {
      for (const s of layer.stars) {
        s.y += layer.v * dt;
        if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
        const tw = 0.7 + Math.sin(time * 2 + s.ph) * 0.3;
        ctx.fillStyle = `rgba(250, 249, 245, ${layer.alpha * tw})`;
        ctx.fillRect(s.x, s.y, layer.size, layer.size);
      }
    }

    // estrela cadente ocasional
    meteor.next -= dt;
    if (meteor.next <= 0 && !meteor.active) {
      meteor.active = true;
      meteor.life = 0.7;
      meteor.x = rand(W * 0.25, W * 0.95);
      meteor.y = rand(0, H * 0.3);
      meteor.vx = -rand(260, 380);
      meteor.vy = rand(130, 190);
    }
    if (meteor.active) {
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.life -= dt;
      const tx = meteor.x - meteor.vx * 0.1;
      const ty = meteor.y - meteor.vy * 0.1;
      const mg = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
      mg.addColorStop(0, `rgba(250, 249, 245, ${Math.max(0, meteor.life)})`);
      mg.addColorStop(1, "rgba(250, 249, 245, 0)");
      ctx.strokeStyle = mg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (meteor.life <= 0) {
        meteor.active = false;
        meteor.next = rand(8, 15);
      }
    }

    ctx.save();
    if (game.shake > 0) {
      ctx.translate(rand(-1, 1) * game.shake * 14, rand(-1, 1) * game.shake * 14);
    }

    // zona de foco do Claude
    ctx.strokeStyle = "rgba(143, 141, 134, 0.35)";
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(0, LEAK_Y);
    ctx.lineTo(W, LEAK_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(143, 141, 134, 0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("── zona de foco ──", 12, LEAK_Y + 14);

    // Claude trabalhando
    drawClaude(ctx, game.claude.x, game.claude.y, time);

    // escudo do Do Not Disturb
    if (game.power.dnd > 0) {
      ctx.strokeStyle = COLORS.cyan;
      ctx.globalAlpha = 0.4 + Math.sin(time * 6) * 0.2 + (game.power.dnd < 2 ? Math.sin(time * 20) * 0.2 : 0);
      ctx.setLineDash([10, 7]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(game.claude.x, game.claude.y, 115, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    for (const pu of game.powerups) pu.draw(ctx);
    for (const e of game.enemies) e.draw(ctx);
    if (game.boss) game.boss.draw(ctx);
    for (const b of game.bullets) b.draw(ctx);
    for (const b of game.enemyBullets) b.draw(ctx);
    if (game.player) game.player.draw(ctx, time);
    for (const pt of game.particles) pt.draw(ctx);
    for (const f of game.floats) f.draw(ctx);

    ctx.restore();

    // tintura do focus mode
    if (game.power.focus > 0) {
      ctx.fillStyle = "rgba(155, 126, 222, 0.06)";
      ctx.fillRect(0, 0, W, H);
    }
    // flash vermelho ao perder focus
    if (game.dmgFlash > 0) {
      ctx.fillStyle = `rgba(224, 82, 82, ${game.dmgFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ── HUD (DOM) ── */

  function updateHud(time) {
    ui.tokens.textContent = fmt(game.tokens);
    ui.level.textContent = String(game.level);

    if (game.phase === "task") {
      ui.taskName.textContent = `${game.taskName}`;
      ui.taskFill.style.width = `${(game.taskT / game.taskDur) * 100}%`;
    } else if (game.boss) {
      ui.taskName.textContent = `⚠ bloqueado por: ${game.boss.cfg.name}`;
      ui.taskFill.style.width = "100%";
      const pct = Math.max(0, (game.boss.hp / game.boss.maxHp) * 100);
      ui.bossFill.style.width = `${pct}%`;
      ui.bossName.textContent = `${game.boss.cfg.barName} — ${Math.ceil(pct)}%`;
    }

    ui.focusFill.style.width = `${game.focus}%`;
    ui.focusFill.classList.toggle("warn", game.focus <= 50 && game.focus > 25);
    ui.focusFill.classList.toggle("danger", game.focus <= 25);

    // chips de power-up ativos
    let chips = "";
    for (const [type, left] of Object.entries(game.power)) {
      if (left > 0) {
        const cfg = POWERUP_TYPES[type];
        chips += `<span class="chip" style="--c:${cfg.color}">${cfg.emoji} ${cfg.label} ${Math.ceil(left)}s</span>`;
      }
    }
    if (ui.chips.innerHTML !== chips) ui.chips.innerHTML = chips;

    // linha de status do Claude
    const spin = SPINNER[Math.floor(time * 12) % SPINNER.length];
    let status;
    if (game.mode === "menu") {
      status = `<span class="spark">✳</span> aguardando prompt…`;
    } else if (game.mode === "over") {
      status = `<span class="spark" style="color:${COLORS.red}">✗</span> sessão encerrada`;
    } else if (game.phase === "boss" && game.boss) {
      status = `<span class="spark">${spin}</span> ${game.boss.cfg.name} bloqueando o merge…`;
    } else {
      status = `<span class="spark">${spin}</span> ${game.statusMsg}`;
    }
    if (ui.status.innerHTML !== status) ui.status.innerHTML = status;

    if (game.mode === "menu") {
      ui.menuHi.textContent = game.hiscore > 0 ? `high score: ${fmt(game.hiscore)} tokens` : "";
    }
  }

  /* ── loop principal ── */

  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;

    if (game.mode === "play") update(dt);
    render(dt, time); // fundo continua vivo no menu/pausa (ambiente)
    updateHud(time);

    requestAnimationFrame(frame);
  }

  ui.taskFill.style.width = "0%";
  ui.focusFill.style.width = "100%";
  requestAnimationFrame(frame);
})();
