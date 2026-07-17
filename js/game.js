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
    upgrade: $("screen-upgrade"),
    upgradeCards: $("upgrade-cards"),
    victory: $("screen-victory"),
    victoryCommit: $("victory-commit"),
    victoryTokens: $("victory-tokens"),
    victorySkip: $("victory-skip"),
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

  /* ── upgrades roguelite ("code review" entre tasks) ── */

  const UPGRADES = [
    { id: "pair", name: "pair programming", desc: "+1 tiro paralelo. Duas cabeças, o dobro de rajadas.", max: 2 },
    { id: "cicd", name: "pipeline CI/CD", desc: "Cadência de tiro +15%. Deploy contínuo de projéteis.", max: 3 },
    { id: "ultrawide", name: "monitor ultrawide", desc: "Velocidade do satélite +15%. Você vê tudo chegando.", max: 2 },
    { id: "types", name: "type safety", desc: "+20 de focus máximo (e cura 20). Menos surpresas em runtime.", max: 2 },
    { id: "tests", name: "unit tests", desc: "15% de chance de crítico (dano x2). Cobertura subindo.", max: 2 },
    { id: "duck", name: "rubber duck", desc: "Patinho orbital destrói projéteis inimigos. Explique o bug pra ele.", max: 1 },
    { id: "intern", name: "estagiário motivado", desc: "+4% de chance de drop de power-up. Ele traz café pra todos.", max: 2 },
    { id: "anc", name: "noise cancelling", desc: "Inimigos 8% mais lentos. O open office desaparece.", max: 2 },
    { id: "backlog", name: "backlog limpo", desc: "Quick questions param de se dividir. Priorização impecável.", max: 1 },
    { id: "pizza", name: "pizza call", desc: "+30 de focus agora. Reunião boa é reunião com pizza.", max: Infinity },
  ];

  /* ── estado ── */

  const game = {
    W, H,
    mode: "menu", // menu | play | pause | over | upgrade | victory
    victory: null,
    level: 1,
    tokens: 0,
    focus: 100,
    maxFocus: 100,
    upgrades: {},
    offer: [],
    t: 0,
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
    chips: [],          // fichas de token voando pro HUD
    streak: 0,          // kills encadeados (cosmético — não altera tokens)
    streakT: 0,         // segundos até a corrente quebrar
    tokensDisplay: 0,   // valor suavizado do contador
    tokenPop: 0,        // 0..1, impulso do slam
    freeze: 0,          // hit-stop, em segundos reais
    milestone: 0,       // índice do último marco cruzado
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

  game.buildBreak = function (boss) {
    boss.phraseTimer = 3.4;
    boss.phrase = pick(boss.cfg.phrases);
    game.shake = Math.max(game.shake, 0.3);
    showBanner("⛔ o build quebrou de novo!", 2, true);
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
    if (game.mode === "upgrade") {
      const m = e.code.match(/^(?:Digit|Numpad)([1-3])$/);
      if (m) chooseUpgrade(+m[1] - 1);
    }
    if (game.mode === "victory" && game.victory && game.victory.t > 1.6 &&
        !e.repeat && (e.code === "Enter" || e.code === "Space")) {
      endVictory();
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
    game.maxFocus = 100;
    game.upgrades = {};
    game.offer = [];
    game.t = 0;
    game.victory = null;
    ui.victory.classList.add("hidden");
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
    game.chips = [];
    game.streak = 0;
    game.streakT = 0;
    game.tokensDisplay = 0;
    game.tokenPop = 0;
    game.freeze = 0;
    game.milestone = 0;
    game.player = new Player(W, H);
    measureTokenTarget(); // fontes/layout já assentaram: alvo das fichas confiável
    startTask();
    ui.menu.classList.add("hidden");
    ui.over.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.upgrade.classList.add("hidden");
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
    for (let i = 0; i < 25; i++) game.particles.push(new Particle(b.x, b.y, b.cfg.color));
    const gained = 1000 + game.level * 250;
    gainTokens(gained);
    spawnChips(b.x, b.y, 10);
    game.freeze = Math.max(game.freeze, 0.08);
    game.tasksDone++;
    game.level++;
    game.focus = Math.min(game.maxFocus, game.focus + 15); // café da vitória

    // onda de choque: limpa a tela (½ tokens por inimigo, sem drops)
    let extra = 0;
    for (const e of game.enemies) {
      e.dead = true;
      extra += Math.floor(e.cfg.tokens / 2);
      for (let i = 0; i < 6; i++) game.particles.push(new Particle(e.x, e.y, e.cfg.color));
      game.particles.push(new Ring(e.x, e.y, e.cfg.color, 20));
      spawnChips(e.x, e.y, 2);
    }
    gainTokens(extra);
    game.enemies = [];
    game.enemyBullets = [];
    game.shake = Math.max(game.shake, 0.4);

    game.victory = {
      t: 0,
      x: b.x,
      y: b.y,
      cfg: b.cfg,
      gained: gained + extra,
      commit: `$ git commit -m "${game.taskName}"`,
      boomed: false,
      nextBurst: 0,
    };
    game.boss = null;
    game.mode = "victory";
    ui.bossBar.classList.add("hidden");
    ui.victoryCommit.textContent = "";
    ui.victoryTokens.textContent = "";
    ui.victorySkip.classList.add("hidden");
    AudioSys.play("bossDown");
  }

  /* ── sequência de celebração ── */

  function victoryUpdate(dt) {
    const v = game.victory;
    if (!v) return;
    v.t += dt;
    game.t += dt;

    // só os efeitos continuam vivos; o jogo fica congelado
    for (const pt of game.particles) pt.update(dt);
    for (const f of game.floats) f.update(dt);
    game.particles = game.particles.filter((o) => !o.dead);
    game.floats = game.floats.filter((o) => !o.dead);
    game.shake = Math.max(0, game.shake - dt * 1.6);
    game.dmgFlash = Math.max(0, game.dmgFlash - dt);
    if (game.bannerT > 0) {
      game.bannerT -= dt;
      if (game.bannerT <= 0) ui.banner.classList.remove("show");
    }

    // fase 1: explosões encadeadas no boss agonizante
    if (!v.boomed && v.t < 1.0) {
      v.nextBurst -= dt;
      if (v.nextBurst <= 0) {
        v.nextBurst = 0.12;
        const ox = rand(-40, 40);
        const oy = rand(-30, 30);
        for (let i = 0; i < 8; i++) game.particles.push(new Particle(v.x + ox, v.y + oy, v.cfg.color));
        game.particles.push(new Ring(v.x + ox, v.y + oy, v.cfg.color, rand(14, 26)));
        game.shake = Math.max(game.shake, 0.15);
        if (Math.random() < 0.5) AudioSys.play("explode");
      }
    }

    // fase 2: boom final, confete e fanfarra
    if (!v.boomed && v.t >= 1.0) {
      v.boomed = true;
      game.particles.push(new Ring(v.x, v.y, v.cfg.color, 110));
      game.particles.push(new Ring(v.x, v.y, COLORS.text, 70));
      game.particles.push(new Ring(v.x, v.y, COLORS.green, 40));
      for (let i = 0; i < 30; i++) game.particles.push(new Particle(v.x, v.y, v.cfg.color));
      for (let i = 0; i < 70; i++) {
        game.particles.push(new Confetti(rand(60, W - 60), rand(H * 0.25, H * 0.6)));
      }
      game.shake = 0.7;
      AudioSys.play("fanfare");
      setTimeout(() => AudioSys.play("taskDone"), 350);
      ui.victory.classList.remove("hidden");
    }

    // fase 3: commit digitado + contador de tokens
    if (v.boomed) {
      const tt = v.t - 1.2;
      if (tt > 0) {
        ui.victoryCommit.textContent = v.commit.slice(0, Math.floor(tt * 30));
        const frac = clamp(tt / 1.6, 0, 1);
        ui.victoryTokens.textContent = `+${fmt(Math.floor(v.gained * frac))} tokens`;
      }
      if (v.t > 2.2) ui.victorySkip.classList.remove("hidden");
      if (v.t >= 4) endVictory();
    }
  }

  function endVictory() {
    if (!game.victory) return;
    game.victory = null;
    ui.victory.classList.add("hidden");
    openUpgrades();
  }

  ui.victory.addEventListener("click", () => {
    if (game.mode === "victory" && game.victory && game.victory.t > 1.6) endVictory();
  });

  /* ── menu de upgrades (code review) ── */

  function openUpgrades() {
    const pool = UPGRADES.filter((u) => (game.upgrades[u.id] || 0) < u.max);
    const offer = [];
    while (offer.length < 3 && pool.length) {
      offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    if (!offer.length) {
      startTask();
      return;
    }
    game.offer = offer;
    ui.upgradeCards.innerHTML = offer
      .map((u, i) => {
        const lvl = game.upgrades[u.id] || 0;
        const lvlTxt = u.max === Infinity ? "repetível" : lvl > 0 ? `lvl ${lvl} → ${lvl + 1}` : "NOVO";
        return (
          `<button class="upgrade-card" data-i="${i}" style="animation-delay:${i * 0.12}s">` +
          `<span class="key">[${i + 1}]</span>` +
          `<span class="uname">${u.name}</span>` +
          `<span class="udesc">${u.desc}</span>` +
          `<span class="ulvl">${lvlTxt}</span>` +
          `</button>`
        );
      })
      .join("");
    game.mode = "upgrade";
    ui.bossBar.classList.add("hidden");
    ui.upgrade.classList.remove("hidden");
  }

  function chooseUpgrade(i) {
    if (game.mode !== "upgrade") return;
    const u = game.offer[i];
    if (!u) return;
    game.upgrades[u.id] = (game.upgrades[u.id] || 0) + 1;
    if (u.id === "types") {
      game.maxFocus += 20;
      game.focus = Math.min(game.maxFocus, game.focus + 20);
    }
    if (u.id === "pizza") {
      game.focus = Math.min(game.maxFocus, game.focus + 30);
    }
    ui.upgrade.classList.add("hidden");
    AudioSys.play("power");
    game.mode = "play";
    startTask();
    showBanner(`✓ merged: ${u.name}`, 2);
  }

  ui.upgradeCards.addEventListener("click", (e) => {
    const btn = e.target.closest(".upgrade-card");
    if (btn) chooseUpgrade(+btn.dataset.i);
  });

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
    const ups =
      Object.entries(game.upgrades)
        .map(([id, lv]) => {
          const u = UPGRADES.find((x) => x.id === id);
          return `${u ? u.name : id} ×${lv}`;
        })
        .join(", ") || "nenhuma";
    ui.overStats.textContent =
      `tokens processados ....... ${fmt(game.tokens)}\n` +
      `tasks completadas ........ ${game.tasksDone}\n` +
      `melhorias mergeadas ...... ${ups}\n` +
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

  // dígitos cheios pro HUD: o contador só "sobe" se os dígitos se mexerem
  function fmtFull(n) {
    return n.toLocaleString("pt-BR");
  }

  /* ── juice do contador de tokens ── */

  const MILESTONES = [1000, 2500, 5000, 10000, 25000, 50000];

  /* O HUD é DOM acima de um canvas escalado por CSS, então o contador vira uma
     coordenada de canvas com y negativo — as fichas saem pelo topo até ele.
     Mutado no lugar (nunca substituído): as fichas em voo seguram a referência,
     então um resize reaponta todas. getBoundingClientRect força layout: cacheie. */
  const tokenTarget = { x: 60, y: -20 };
  function measureTokenTarget() {
    const c = canvas.getBoundingClientRect();
    const t = ui.tokens.getBoundingClientRect();
    if (!c.width) return; // ainda não renderizou
    const s = W / c.width; // px de canvas por px de CSS
    tokenTarget.x = (t.left + t.width / 2 - c.left) * s;
    tokenTarget.y = (t.top + t.height / 2 - c.top) * s;
  }
  measureTokenTarget();
  window.addEventListener("resize", measureTokenTarget);

  /* Limiares medidos, não chutados: inimigos nascem a cada ~1–1,8s, então
     tier a cada 4 kills deixava tier 2 e 3 inalcançáveis (0% numa partida
     inteira). 3/6/10 com janela de 2,5s torna tier 1 comum, tier 2 uma boa
     sequência e tier 3 um momento raro de tela cheia. */
  const STREAK_WINDOW = 2.5;
  function tierOf(streak) {
    return streak >= 10 ? 3 : streak >= 6 ? 2 : streak >= 3 ? 1 : 0;
  }

  // Crédito imediato: game.tokens é a fonte da verdade (hiscore/stats sempre
  // corretos). As fichas são decorativas — só empurram o pop na chegada.
  function gainTokens(n) {
    game.tokens += n;
    while (
      game.milestone < MILESTONES.length &&
      game.tokens >= MILESTONES[game.milestone]
    ) {
      const mark = MILESTONES[game.milestone];
      game.milestone++;
      showBanner(`✳ ${fmtFull(mark)} tokens processados`, 2);
      for (let i = 0; i < 40; i++) {
        game.particles.push(new Confetti(rand(W * 0.2, W * 0.8), H * 0.45));
      }
      game.tokenPop = 1;
      game.shake = Math.max(game.shake, 0.35);
      game.freeze = Math.max(game.freeze, 0.06);
      AudioSys.play("fanfare");
    }
  }

  function spawnChips(x, y, count) {
    for (let i = 0; i < count; i++) {
      game.chips.push(new TokenChip(x, y, tokenTarget, i * 0.04));
    }
  }

  /* Fichas voam em QUALQUER modo, com dt real. Se andassem só em "play", as 10
     do bossDefeated congelariam no ar durante toda a vitória (o modo troca no
     mesmo frame em que elas nascem) — e pra sempre no game over. */
  let chipSfxCd = 0;
  function updateChips(dt) {
    chipSfxCd -= dt;
    for (const c of game.chips) {
      c.update(dt);
      if (c.arrived) {
        /* Impulso alto + decaimento rápido: as fichas chegam espaçadas ~50ms,
           então cada uma re-chuta o contador (flutter) em vez de somar num
           slam só. Uma ficha já é visível; a rajada da streak satura. */
        game.tokenPop = Math.min(1, game.tokenPop + 0.45);
        // as fichas chegam em rajada — sem trava viram papa sonora
        if (chipSfxCd <= 0) {
          AudioSys.play("chip");
          chipSfxCd = 0.05;
        }
      }
    }
    game.chips = game.chips.filter((o) => !o.dead);
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

    // corrente de kills: cosmética, não mexe em quantos tokens caem
    const prevTier = tierOf(game.streak);
    game.streak++;
    game.streakT = STREAK_WINDOW;
    const tier = tierOf(game.streak);

    gainTokens(gained);

    for (let i = 0; i < (e.mini ? 5 : 10) + tier * 3; i++) {
      game.particles.push(new Particle(e.x, e.y, e.cfg.color));
    }
    game.particles.push(new Ring(e.x, e.y, e.cfg.color, (e.mini ? 18 : 30) + tier * 6));

    // o +N aparece SEMPRE — é o número mais importante da tela
    game.floats.push(
      new FloatText(e.x, e.y - 10, `+${gained}`, TIER_COLORS[tier], {
        size: 13 + tier * 4 + (gained >= 300 ? 2 : 0),
        tier,
        bold: tier > 0,
        drift: true,
      })
    );
    // a piada continua, mas ao lado do número, nunca no lugar dele
    if (Math.random() < 0.2) {
      game.floats.push(
        new FloatText(e.x, e.y + 8, pick(KILL_QUIPS), COLORS.dim, { size: 10 })
      );
    }

    spawnChips(e.x, e.y, e.mini ? 2 : 3 + tier);
    game.shake = Math.max(game.shake, 0.08 + tier * 0.05);
    AudioSys.play("explode");
    AudioSys.play("token", { step: game.streak - 1 });

    // hit-stop só nos kills grandes: pontua sem virar travamento
    if (gained >= 300 || tier > prevTier) {
      game.freeze = Math.max(game.freeze, 0.05);
    }

    // "quick question" se divide: only takes 5 min… (backlog limpo previne)
    if (e.cfg.splits && !e.mini && !byShield && !game.upgrades.backlog) {
      for (const off of [-16, 16]) {
        game.enemies.push(new Enemy("quick", e.x + off, e.y, game.level, { mini: true }));
      }
      AudioSys.play("split");
    }
    // drop de power-up (com focus baixo, a pizza fica mais provável)
    if (!e.mini && Math.random() < 0.08 + 0.04 * (game.upgrades.intern || 0)) {
      let type = pick(Object.keys(POWERUP_TYPES));
      if (game.focus <= 40 && Math.random() < 0.5) type = "pizza";
      game.powerups.push(new PowerUp(type, e.x, e.y));
    }
  }

  function collide() {
    const p = game.player;

    // dano da bala, com chance de crítico dos unit tests
    const critChance = 0.15 * (game.upgrades.tests || 0);
    const rollDmg = (b) => {
      if (critChance && Math.random() < critChance) {
        game.floats.push(new FloatText(b.x, b.y - 8, "LGTM! x2", COLORS.orange));
        return 2;
      }
      return 1;
    };

    // balas do jogador × inimigos
    for (const b of game.bullets) {
      if (b.dead) continue;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (aabb(b, e)) {
          b.dead = true;
          if (e.hit(rollDmg(b))) {
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
        if (boss.hit(rollDmg(b))) {
          bossDefeated();
        } else {
          AudioSys.play("hit");
          for (let i = 0; i < 3; i++) game.particles.push(new Particle(b.x, b.y, COLORS.text));
        }
      }
    }

    // rubber duck orbital: bloqueia projéteis inimigos
    if (game.upgrades.duck) {
      const a = game.t * 2.5;
      const dx = p.x + Math.cos(a) * 44;
      const dy = p.y + Math.sin(a) * 44;
      for (const b of game.enemyBullets) {
        if (!b.dead && Math.hypot(b.x - dx, b.y - dy) < 17) {
          b.dead = true;
          for (let i = 0; i < 3; i++) game.particles.push(new Particle(b.x, b.y, COLORS.yellow));
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
      }
      // projéteis que passam direto somem no fundo sem dano (esquiva pura)
    }

    // power-ups × jogador
    for (const pu of game.powerups) {
      if (pu.dead) continue;
      if (aabb(pu, p)) {
        pu.dead = true;
        if (pu.cfg.heal) {
          game.focus = Math.min(game.maxFocus, game.focus + pu.cfg.heal);
          game.floats.push(new FloatText(p.x, p.y - 28, `+${pu.cfg.heal} focus`, COLORS.green));
        } else {
          game.power[pu.type] = pu.cfg.dur;
          game.floats.push(new FloatText(p.x, p.y - 28, `${pu.cfg.emoji} ${pu.cfg.label}!`, pu.cfg.color));
        }
        AudioSys.play("power");
      }
    }
  }

  /* ── update ── */

  function update(dt) {
    game.t += dt;
    const slowmo = game.power.focus > 0 ? 0.4 : 1; // focus mode: o mundo desacelera
    const edt = dt * slowmo;
    const eSlow = 1 - 0.08 * (game.upgrades.anc || 0); // noise cancelling

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
    for (const e of game.enemies) e.update(edt * eSlow, game);
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

    // a corrente quebra se você parar de acertar
    if (game.streakT > 0) {
      game.streakT -= dt;
      if (game.streakT <= 0) game.streak = 0;
    }

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
    // boss agonizante durante a celebração (pisca e treme até o boom)
    if (game.victory && !game.victory.boomed) {
      if (Math.sin(game.victory.t * 40) > -0.3) {
        drawSprite(ctx, SPRITES[game.victory.cfg.id], game.victory.x + rand(-3, 3), game.victory.y - 8 + rand(-3, 3));
      }
    }
    for (const b of game.bullets) b.draw(ctx);
    for (const b of game.enemyBullets) b.draw(ctx);
    if (game.player) {
      game.player.draw(ctx, time);
      // rubber duck orbital
      if (game.upgrades.duck) {
        const a = game.t * 2.5;
        drawSprite(ctx, SPRITES.duck, game.player.x + Math.cos(a) * 44, game.player.y + Math.sin(a) * 44);
      }
    }
    for (const pt of game.particles) pt.draw(ctx);
    for (const c of game.chips) c.draw(ctx);
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

  function updateHud(time, dt) {
    /* O contador vive aqui, não em update(): update() só roda em mode "play",
       e a animação precisa continuar na vitória e no game over. dt é real. */
    const diff = game.tokens - game.tokensDisplay;
    if (Math.abs(diff) < 1) {
      game.tokensDisplay = game.tokens;
    } else {
      /* Aproximação exponencial + piso, pra ganho pequeno também tiquetaquear.
         Taxa 8 ≈ 0,4s de rolagem, casando com o voo das fichas (~0,45s).
         O passo é limitado pela distância: sem isso, num frame lento (dt=0,05,
         o teto do jogo) o piso de 60/s pula o alvo e o contador oscila em volta. */
      const rate = Math.max(Math.abs(diff) * 8, 60);
      const step = Math.min(Math.abs(diff), rate * dt);
      game.tokensDisplay += Math.sign(diff) * step;
    }
    game.tokenPop = Math.max(0, game.tokenPop - dt * 6);

    const tier = tierOf(game.streak);
    ui.tokens.textContent = fmtFull(Math.floor(game.tokensDisplay));
    ui.tokens.style.transform = `scale(${1 + game.tokenPop * 0.3})`;
    for (let i = 1; i <= 3; i++) ui.tokens.classList.toggle(`heat${i}`, tier === i);

    ui.level.textContent = String(game.level);

    if (game.mode === "victory") {
      ui.taskName.textContent = `✓ ${game.taskName}`;
      ui.taskFill.style.width = "100%";
    } else if (game.phase === "task") {
      ui.taskName.textContent = `${game.taskName}`;
      ui.taskFill.style.width = `${(game.taskT / game.taskDur) * 100}%`;
    } else if (game.boss) {
      ui.taskName.textContent = `⚠ bloqueado por: ${game.boss.cfg.name}`;
      ui.taskFill.style.width = "100%";
      const pct = Math.max(0, (game.boss.hp / game.boss.maxHp) * 100);
      ui.bossFill.style.width = `${pct}%`;
      ui.bossName.textContent = `${game.boss.cfg.barName} — ${Math.ceil(pct)}%`;
    }

    const fr = game.focus / game.maxFocus;
    ui.focusFill.style.width = `${fr * 100}%`;
    ui.focusFill.classList.toggle("warn", fr <= 0.5 && fr > 0.25);
    ui.focusFill.classList.toggle("danger", fr <= 0.25);

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
    } else if (game.mode === "victory") {
      status = `<span class="spark" style="color:${COLORS.green}">✓</span> build verde — merge aprovado!`;
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

    if (game.mode === "play") {
      if (game.freeze > 0) {
        game.freeze = Math.max(0, game.freeze - dt); // dt real, senão nunca acaba
        update(dt * 0.08);
      } else {
        update(dt);
      }
    } else if (game.mode === "victory") victoryUpdate(dt);
    updateChips(dt); // decoração pura: voa em todos os modos, com dt real
    render(dt, time); // fundo continua vivo no menu/pausa (ambiente)
    updateHud(time, dt); // dt real: o contador rola até durante o hit-stop

    requestAnimationFrame(frame);
  }

  ui.taskFill.style.width = "0%";
  ui.focusFill.style.width = "100%";
  requestAnimationFrame(frame);
})();
