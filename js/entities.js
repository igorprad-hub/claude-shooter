"use strict";

/* ───────────────────────── helpers e paleta ───────────────────────── */

const COLORS = {
  orange: "#d97757",
  text: "#faf9f5",
  dim: "#8f8d86",
  green: "#7fbf7f",
  red: "#e05252",
  purple: "#9b7ede",
  yellow: "#e0b252",
  cyan: "#6cb8c4",
};

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* O logo starburst do Claude, pulsando enquanto trabalha. */
function drawClaude(ctx, x, y, t) {
  const pulse = 1 + Math.sin(t * 3) * 0.07;
  ctx.save();
  // halo em dupla camada
  const halo = ctx.createRadialGradient(x, y, 4, x, y, 58);
  halo.addColorStop(0, "rgba(217, 119, 87, 0.26)");
  halo.addColorStop(0.55, "rgba(217, 119, 87, 0.09)");
  halo.addColorStop(1, "rgba(217, 119, 87, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 58, 0, Math.PI * 2);
  ctx.fill();
  // pontinhos orbitando: processando…
  for (let i = 0; i < 3; i++) {
    const a = t * 2.2 + (i * Math.PI * 2) / 3;
    ctx.globalAlpha = 0.45 + Math.sin(t * 4 + i * 2) * 0.3;
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(x + Math.cos(a) * 36 - 2, y + Math.sin(a) * 13 - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.7) * 0.18);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.shadowColor = COLORS.orange;
  ctx.shadowBlur = 18;
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const len = i % 2 ? 15 : 22;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/* ───────────────────────── jogador ───────────────────────── */

class Player {
  constructor(W, H) {
    this.w = 46;
    this.h = 26;
    this.x = W / 2;
    this.y = H - 130;
    this.vx = 0;
    this.vy = 0;
    this.speed = 340;
    this.cooldown = 0;
    this.tilt = 0;
    this.moving = false;
    this.muzzle = 0;
  }

  update(dt, input, game) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    this.moving = !!(dx || dy);
    this.tilt += (dx * 0.13 - this.tilt) * 10 * dt;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    const speed = this.speed * (1 + 0.15 * (game.upgrades.ultrawide || 0));
    const px = this.x, py = this.y;
    this.x = clamp(this.x + dx * speed * dt, 30, game.W - 30);
    this.y = clamp(this.y + dy * speed * dt, game.H * 0.45, game.H - 105);
    // velocidade efetiva (pós-clamp): encostado na parede é 0, não a intenção do input
    this.vx = dt > 0 ? (this.x - px) / dt : 0;
    this.vy = dt > 0 ? (this.y - py) / dt : 0;

    this.cooldown -= dt;
    this.muzzle -= dt;
    if (input.fire && this.cooldown <= 0) {
      const pair = game.upgrades.pair || 0;
      const offsets = pair === 0 ? [0] : pair === 1 ? [-7, 7] : [-12, 0, 12];
      for (const off of offsets) game.bullets.push(new Bullet(this.x + off, this.y - 20));
      const base = game.power.coffee > 0 ? 0.1 : 0.21;
      this.cooldown = base / (1 + 0.15 * (game.upgrades.cicd || 0));
      this.muzzle = 0.06;
      AudioSys.play("shoot");
    }
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    // chama do propulsor (2 frames)
    if (this.moving) {
      drawSprite(ctx, Math.floor(t * 18) % 2 ? SPRITES.flame0 : SPRITES.flame1, 0, 19);
    }
    drawSprite(ctx, SPRITES.satellite, 0, 0);
    // luz de status piscando
    if (Math.sin(t * 9) > 0) {
      ctx.fillStyle = COLORS.orange;
      ctx.fillRect(-2, 9, 4, 4);
    }
    // muzzle flash
    if (this.muzzle > 0) {
      ctx.fillStyle = COLORS.text;
      ctx.fillRect(-2, -26, 4, 4);
      ctx.fillStyle = COLORS.orange;
      ctx.fillRect(-6, -25, 3, 3);
      ctx.fillRect(3, -25, 3, 3);
    }
    ctx.restore();
  }
}

/* ───────────────────────── projéteis ───────────────────────── */

class Bullet {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 4; this.h = 14;
    this.vy = -580;
    this.dead = false;
  }
  update(dt) {
    this.y += this.vy * dt;
    if (this.y < -20) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    // rastro
    const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + 26);
    grad.addColorStop(0, "rgba(217, 119, 87, 0.45)");
    grad.addColorStop(1, "rgba(217, 119, 87, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(this.x - 1.5, this.y, 3, 26);
    // bala
    ctx.fillStyle = COLORS.orange;
    ctx.shadowColor = COLORS.orange;
    ctx.shadowBlur = 8;
    ctx.fillRect(this.x - 2, this.y - 7, 4, 14);
    ctx.restore();
  }
}

class EnemyBullet {
  constructor(x, y, vx, vy, dmg = 6) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.w = 10; this.h = 10;
    this.dmg = dmg;
    this.dead = false;
  }
  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -20 || this.x > game.W + 20 || this.y < -30 || this.y > game.H + 20) {
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.red;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ───────────────────────── inimigos ───────────────────────── */

const ENEMY_TYPES = {
  teams: {
    label: "Teams", w: 80, h: 30, hp: 1, speed: 85, dmg: 6, tokens: 100,
    color: COLORS.purple, move: "zigzag", shape: "card",
  },
  meeting: {
    label: "URGENTE", w: 94, h: 30, hp: 2, speed: 165, dmg: 12, tokens: 180,
    color: COLORS.red, move: "dive", shape: "card",
  },
  quick: {
    label: "?", w: 34, h: 34, hp: 1, speed: 100, dmg: 5, tokens: 80,
    color: COLORS.orange, move: "sine", shape: "bubble", splits: true,
  },
  feedback: {
    label: "feedback", w: 100, h: 34, hp: 6, speed: 42, dmg: 15, tokens: 320,
    color: COLORS.yellow, move: "straight", shape: "card",
  },
  scope: {
    label: "scope changed", w: 132, h: 30, hp: 2, speed: 90, dmg: 8, tokens: 220,
    color: COLORS.cyan, move: "erratic", shape: "card",
  },
  // cuspido pelo build: ocupa o espaço pra onde você ia fugir da stack trace
  error: {
    label: "TypeError", w: 130, h: 30, hp: 3, speed: 75, dmg: 7, tokens: 90,
    color: COLORS.red, move: "straight", shape: "card",
  },
};

class Enemy {
  constructor(type, x, y, level, opts = {}) {
    const cfg = ENEMY_TYPES[type];
    this.type = type;
    this.cfg = cfg;
    this.mini = !!opts.mini;
    this.w = this.mini ? 22 : cfg.w;
    this.h = this.mini ? 22 : cfg.h;
    this.hp = this.mini ? 1 : cfg.hp;
    this.maxHp = this.hp;
    const mult = 1 + (level - 1) * 0.1;
    this.speed = cfg.speed * mult * (this.mini ? 1.5 : 1);
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.t = Math.random() * 10;
    this.vx = 0;
    this.vy = this.speed;
    this.dirTimer = 0;
    this.dirSign = Math.random() < 0.5 ? -1 : 1;
    this.flash = 0;
    this.dead = false;
    if (cfg.move === "dive" && opts.aim) {
      const dx = opts.aim.x - x, dy = opts.aim.y - y;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = (dx / d) * this.speed;
      this.vy = (dy / d) * this.speed;
    }
  }

  update(dt, game) {
    this.t += dt;
    this.flash -= dt;
    switch (this.cfg.move) {
      case "zigzag":
        this.dirTimer -= dt;
        if (this.dirTimer <= 0) { this.dirTimer = 0.7; this.dirSign *= -1; }
        this.vx = this.dirSign * this.speed * 0.9;
        this.vy = this.speed * 0.8;
        break;
      case "dive":
        break; // segue reto rumo ao Claude, como toda reunião urgente
      case "sine":
        this.vx = Math.cos(this.t * 3.2) * 70 * this.dirSign;
        this.vy = this.speed;
        break;
      case "straight":
        this.vx = 0;
        this.vy = this.speed;
        break;
      case "erratic":
        this.dirTimer -= dt;
        if (this.dirTimer <= 0) {
          this.dirTimer = rand(0.5, 1.3);
          this.vx = rand(-1, 1) * this.speed * 1.4;
        }
        this.vy = this.speed;
        break;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // quica nas paredes
    const hw = this.w / 2;
    if (this.x < hw) { this.x = hw; this.vx = Math.abs(this.vx); this.dirSign = 1; }
    if (this.x > game.W - hw) { this.x = game.W - hw; this.vx = -Math.abs(this.vx); this.dirSign = -1; }
  }

  hit(dmg) {
    this.hp -= dmg;
    this.flash = 0.08;
    return this.hp <= 0;
  }

  draw(ctx) {
    ctx.save();
    const { x, y, w, h } = this;
    const color = this.flash > 0 ? COLORS.text : this.cfg.color;
    if (this.cfg.shape === "bubble" || this.mini) {
      // bolha pixel-art do "quick question", pulsando
      const pulse = 1 + Math.sin(this.t * 6) * 0.07;
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      drawSprite(ctx, this.mini ? SPRITES.quickMini : SPRITES.quick, 0, 0);
      if (this.flash > 0) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = COLORS.text;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, w / 2 + 2, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      // cartão de notificação com ícone pixel-art
      ctx.fillStyle = "rgba(30, 29, 26, 0.94)";
      roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawSprite(ctx, SPRITES[this.type], x - w / 2 + 16, y);
      ctx.fillStyle = this.flash > 0 ? COLORS.text : "rgba(250, 249, 245, 0.92)";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.cfg.label, x - w / 2 + 31, y + 1);
      // barra de HP nos tanques
      if (this.maxHp > 2 && this.hp < this.maxHp) {
        ctx.fillStyle = "#3a3833";
        ctx.fillRect(x - w / 2, y + h / 2 + 3, w, 3);
        ctx.fillStyle = this.cfg.color;
        ctx.fillRect(x - w / 2, y + h / 2 + 3, w * (this.hp / this.maxHp), 3);
      }
    }
    ctx.restore();
  }
}

/* ───────────────────────── power-ups ───────────────────────── */

const POWERUP_TYPES = {
  coffee: { emoji: "☕", label: "coffee", color: COLORS.yellow, dur: 10 },
  focus:  { emoji: "🎧", label: "focus mode", color: COLORS.purple, dur: 8 },
  dnd:    { emoji: "🌙", label: "do not disturb", color: COLORS.cyan, dur: 10 },
  pizza:  { emoji: "🍕", label: "pizza do time", color: COLORS.green, heal: 20 },
};

class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.cfg = POWERUP_TYPES[type];
    this.x = x; this.y = y;
    this.w = 30; this.h = 30;
    this.t = Math.random() * 5;
    this.dead = false;
  }
  update(dt, game) {
    this.t += dt;
    this.y += 65 * dt;
    this.x += Math.sin(this.t * 2.5) * 30 * dt;
    if (this.y > game.H + 20) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    const glow = 0.5 + Math.sin(this.t * 5) * 0.3;
    ctx.strokeStyle = this.cfg.color;
    ctx.globalAlpha = glow;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    drawSprite(ctx, SPRITES[this.type], this.x, this.y);
    ctx.restore();
  }
}

/* ───────────────────────── bosses ───────────────────────── */

const BOSS_TYPES = [
  {
    id: "pm",
    name: 'PM: "Só uma coisinha…"',
    barName: "stakeholders/pm",
    emoji: "🧑‍💼",
    sub: "product manager",
    w: 130, h: 90,
    color: COLORS.purple,
    phrases: [
      "só uma coisinha rapidinho",
      "cabe na sprint?",
      "não precisa ficar perfeito",
      "é só mudar um botãozinho",
      "te mando o figma amanhã",
    ],
  },
  {
    id: "client",
    name: "Cliente mudando tudo",
    barName: "clients/aquele-cliente",
    emoji: "🤵",
    sub: "o cliente",
    w: 130, h: 90,
    color: COLORS.cyan,
    phrases: [
      "na verdade eu queria diferente",
      "faz igual o do concorrente",
      "achei que era outra coisa",
      "dá pra deixar mais clean?",
      "e se fosse um app?",
    ],
  },
  {
    id: "build",
    name: "Build quebrado",
    barName: "ci/build — FAILED",
    emoji: "⛔",
    sub: "exit code 1",
    w: 220, h: 90,
    color: COLORS.red,
    phrases: [
      "Error: cannot find module 'motivação'",
      "FATAL: expected ';' got deadline",
      "tests: 0 passed, 47 failed",
      "works on my machine ¯\\_(ツ)_/¯",
    ],
  },
];

class Boss {
  constructor(index, level) {
    this.cfg = BOSS_TYPES[index];
    this.maxHp = 30 + level * 12;
    this.hp = this.maxHp;
    this.level = level;
    this.x = 450;
    this.y = -90;
    this.targetY = 110;
    this.entering = true;
    this.t = 0;
    this.atkTimer = 1.8;
    this.atkTimer2 = 5;
    this.phraseTimer = 0.2;
    this.phraseIdx = -1;
    this.phrase = "";
    this.moveTarget = this.x;
    this.thresholds = [0.75, 0.5, 0.25]; // cliente: pontos de "mudança de escopo"
    this.volley = null;                  // cliente: segundo leque do double-tap pendente
    this.telegraph = null;               // build: coluna telegrafada { x, x2, t, fired }
    this.opened = false;                 // build: abertura já cuspida?
    this.flash = 0;
    this.dead = false;
  }

  update(dt, game) {
    this.t += dt;
    this.flash -= dt;
    if (this.entering) {
      this.y += 130 * dt;
      if (this.y >= this.targetY) {
        this.y = this.targetY;
        this.entering = false;
        this.t = 0; // t é fase, não tempo de vida: sem zerar, x salta ao fim da descida
      }
      return;
    }

    this.phraseTimer -= dt;
    if (this.phraseTimer <= 0) {
      this.phraseTimer = 3.4;
      this.phraseIdx = (this.phraseIdx + 1) % this.cfg.phrases.length;
      this.phrase = this.cfg.phrases[this.phraseIdx];
    }

    switch (this.cfg.id) {
      case "pm": this.updatePM(dt, game); break;
      case "client": this.updateClient(dt, game); break;
      case "build": this.updateBuild(dt, game); break;
    }
  }

  updatePM(dt, game) {
    this.x = game.W / 2 + Math.sin(this.t * 0.9) * (game.W / 2 - 120);
    // coisinhas infinitas
    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.atkTimer = Math.max(1.4, 2.6 - this.level * 0.08);
      for (const off of [-30, 30]) {
        game.enemies.push(new Enemy("quick", this.x + off, this.y + 40, this.level, { mini: true }));
      }
      AudioSys.play("split");
    }
    this.atkTimer2 -= dt;
    if (this.atkTimer2 <= 0) {
      this.atkTimer2 = 6;
      game.enemies.push(new Enemy("quick", this.x, this.y + 45, this.level));
    }
  }

  // leque mirado com antecipação; o lead nunca chega a 1, então mudar de direção sempre desvia
  fireFan(game, rage, stage) {
    const count = stage === 0 ? 3 : 5;
    const speed = 260 + rage * 110;
    const lead = 0.25 + rage * 0.35;
    const p = game.player;
    const oy = this.y + 30;
    const t = Math.hypot(p.x - this.x, p.y - oy) / speed; // tempo de voo estimado
    const aimX = p.x + p.vx * t * lead;
    const base = Math.atan2(p.y - oy, aimX - this.x);
    for (let i = 0; i < count; i++) {
      // passo 0.20: ~66px entre balas na altura do jogador, mais que o hitbox de 56
      const a = base + (i - (count - 1) / 2) * 0.2;
      game.enemyBullets.push(new EnemyBullet(this.x, oy, Math.cos(a) * speed, Math.sin(a) * speed));
    }
  }

  updateClient(dt, game) {
    // vaga sem rumo, como os requisitos
    this.atkTimer2 -= dt;
    if (this.atkTimer2 <= 0) {
      this.atkTimer2 = 2.2;
      this.moveTarget = rand(110, game.W - 110);
    }
    this.x += (this.moveTarget - this.x) * 2.2 * dt;

    // rajadas miradas no jogador; quanto menos HP, mais raiva
    const rage = 1 - this.hp / this.maxHp;   // 0..1
    const stage = 3 - this.thresholds.length; // 0..3, sobe a cada mudança de escopo
    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.atkTimer = Math.max(0.85, 1.9 - Math.min(this.level, 12) * 0.05 - rage * 0.75);
      this.fireFan(game, rage, stage);
      if (stage >= 3) this.volley = 0.25; // último escopo: ele repete a cobrança
    }

    if (this.volley !== null) {
      this.volley -= dt;
      if (this.volley <= 0) {
        this.volley = null;
        this.fireFan(game, rage, stage); // mira refeita: desviar uma vez não basta
      }
    }

    // a cada 25% de HP perdido: "mudança de escopo"
    if (this.thresholds.length && this.hp / this.maxHp <= this.thresholds[0]) {
      this.thresholds.shift();
      game.scopeChange(this);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        game.enemyBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a) * 150, Math.abs(Math.sin(a)) * 150 + 60));
      }
    }
  }

  // o build cospe erros no log; eles ocupam o espaço pra onde se foge da coluna
  spawnError(game, x) {
    let alive = 0;
    for (const e of game.enemies) if (e.type === "error" && !e.dead) alive++;
    if (alive >= 5) return;
    game.enemies.push(new Enemy("error", clamp(x, 65, game.W - 65), this.y + 30, this.level));
    AudioSys.play("split");
  }

  updateBuild(dt, game) {
    this.x = game.W / 2 + Math.sin(this.t * 0.5) * 150;

    // abertura: o boss levava 4s pra fazer qualquer coisa. as sobras da task contam.
    if (!this.opened) {
      this.opened = true;
      const n = Math.max(0, 3 - game.enemies.length);
      for (let i = 0; i < n; i++) this.spawnError(game, rand(120, game.W - 120));
    }

    this.atkTimer -= dt;
    if (this.atkTimer <= 0 && !this.telegraph) {
      this.atkTimer = Math.max(1.6, 2.7 - this.level * 0.08);
      const stage = 3 - this.thresholds.length;
      const px = game.player.x;
      // no fim, uma 2ª coluna rumo ao centro: encostar na parede deixa de salvar
      const x2 = stage >= 3 ? px + (px > game.W / 2 ? -140 : 140) : null;
      this.telegraph = { x: px, x2, t: 0.75, fired: false };
    }
    if (this.telegraph) {
      this.telegraph.t -= dt;
      if (this.telegraph.t <= 0 && !this.telegraph.fired) {
        this.telegraph.fired = true;
        // despeja a stack trace na(s) coluna(s) marcada(s)
        for (const cx of [this.telegraph.x, this.telegraph.x2]) {
          if (cx === null) continue;
          for (let i = 0; i < 5; i++) {
            game.enemyBullets.push(new EnemyBullet(cx, this.y + 30 - i * 34, 0, 340));
          }
        }
        this.spawnError(game, this.telegraph.x); // o crash deixa o erro no log
      }
      if (this.telegraph.t <= -0.3) this.telegraph = null; // cicatriz: some 0.3s depois
    }

    // a cada 25% de HP perdido o build quebra mais fundo
    if (this.thresholds.length && this.hp / this.maxHp <= this.thresholds[0]) {
      this.thresholds.shift();
      game.buildBreak(this);
      this.spawnError(game, this.x - 70);
      this.spawnError(game, this.x + 70);
    }
  }

  hit(dmg) {
    this.hp -= dmg;
    this.flash = 0.06;
    return this.hp <= 0;
  }

  draw(ctx) {
    const { x, y } = this;
    const w = this.cfg.w, h = this.cfg.h;
    ctx.save();

    // telegraph do build: coluna vermelha de aviso
    if (this.telegraph) {
      const tg = this.telegraph;
      const fade = tg.t > 0 ? 1 : Math.max(0, 1 + tg.t / 0.3);
      const a = (0.1 + Math.sin(this.t * 25) * 0.06) * fade;
      for (const cx of [tg.x, tg.x2]) {
        if (cx === null) continue;
        // banda: onde o CENTRO do jogador não pode estar (46 do sprite + 10 da bala)
        ctx.fillStyle = `rgba(224, 82, 82, ${a})`;
        ctx.fillRect(cx - 28, 0, 56, 600);
        // núcleo: onde as balas nascem de fato
        ctx.fillStyle = `rgba(224, 82, 82, ${a * 2.5})`;
        ctx.fillRect(cx - 5, 0, 10, 600);
      }
    }

    // nave do boss (só o contorno): cúpula de vidro + disco
    const bob = Math.sin(this.t * 2) * 3;
    const cy = y + bob;
    const strokeColor = this.flash > 0 ? COLORS.text : this.cfg.color;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.cfg.color;
    ctx.shadowBlur = 12;
    // cúpula com leve preenchimento de "vidro"
    ctx.fillStyle = "rgba(38, 38, 36, 0.72)";
    ctx.beginPath();
    ctx.arc(x, cy - 8, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // disco/casco
    ctx.beginPath();
    ctx.ellipse(x, cy + 28, w / 2, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // luzes do casco piscando em sequência
    for (let i = -2; i <= 2; i++) {
      const lx = x + i * (w / 5.4);
      ctx.fillStyle =
        (Math.floor(this.t * 5) % 5 + 5) % 5 === i + 2
          ? COLORS.text
          : this.cfg.color;
      ctx.fillRect(lx - 2, cy + 26, 4, 4);
    }

    // avatar dentro da cúpula
    drawSprite(ctx, SPRITES[this.cfg.id], x, cy - 8);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "10px monospace";
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(this.cfg.sub, x, cy + 54);

    // balão de fala
    if (this.phrase && !this.entering) {
      ctx.font = "12px monospace";
      const tw = ctx.measureText(this.phrase).width + 20;
      const bx = clamp(x, tw / 2 + 8, 900 - tw / 2 - 8);
      const by = y - h / 2 - 26;
      ctx.fillStyle = "rgba(250, 249, 245, 0.95)";
      roundRectPath(ctx, bx - tw / 2, by - 12, tw, 24, 11);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(clamp(x, bx - tw / 2 + 14, bx + tw / 2 - 14) - 6, by + 11);
      ctx.lineTo(clamp(x, bx - tw / 2 + 14, bx + tw / 2 - 14) + 6, by + 11);
      ctx.lineTo(clamp(x, bx - tw / 2 + 14, bx + tw / 2 - 14), by + 19);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a1915";
      ctx.fillText(this.phrase, bx, by + 1);
    }
    ctx.restore();
  }
}

/* ───────────────────────── efeitos ───────────────────────── */

class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    const a = rand(0, Math.PI * 2);
    const s = rand(40, 190);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.life = rand(0.3, 0.7);
    this.maxLife = this.life;
    this.size = rand(2, 5);
    this.color = color;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

class Ring {
  constructor(x, y, color, maxR = 28) {
    this.x = x; this.y = y;
    this.color = color;
    this.r = 4;
    this.maxR = maxR;
    this.life = 1;
    this.dead = false;
  }
  update(dt) {
    this.r += (this.maxR - this.r) * 9 * dt;
    this.life -= dt * 2.4;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life) * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class Confetti {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = rand(-90, 90);
    this.vy = rand(-260, -140);
    this.rot = rand(0, Math.PI * 2);
    this.spin = rand(-8, 8);
    this.size = rand(3, 5.5);
    this.color = pick([COLORS.orange, COLORS.green, COLORS.purple, COLORS.cyan, COLORS.yellow, COLORS.red]);
    this.life = rand(1.6, 2.4);
    this.dead = false;
  }
  update(dt) {
    this.vy += 300 * dt; // gravidade
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life / 0.5, 0, 1);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
    ctx.restore();
  }
}

/* Cores por tier de streak: quanto maior a sequência, mais quente o número. */
const TIER_COLORS = [COLORS.dim, COLORS.orange, COLORS.yellow, "#ffffff"];

class FloatText {
  constructor(x, y, text, color = COLORS.dim, { size = 12, tier = 0, drift = false, bold = false } = {}) {
    this.x = x; this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.tier = tier;
    this.bold = bold;
    // espalha os números empilhados em vez de sobrepor (estilo Vampire Survivors)
    this.vx = drift ? rand(-26, 26) : 0;
    this.vy = drift ? rand(-58, -34) : -34;
    this.gravity = drift ? 44 : 0;
    this.life = 1.1;
    this.maxLife = 1.1;
    this.dead = false;
  }
  update(dt) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  // mola: estoura acima de 1 e assenta — mesma sensação do popIn do CSS
  scale() {
    const age = this.maxLife - this.life;
    const POP = 0.12;
    if (age >= POP) return 1;
    const p = age / POP;
    return 0.4 + 0.85 * p + Math.sin(p * Math.PI) * 0.35;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life, 0, 1);
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale(), this.scale());
    ctx.font = `${this.bold ? "bold " : ""}${this.size}px monospace`;
    ctx.textAlign = "center";
    // contorno para o número ler por cima da nebulosa e das partículas
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineJoin = "round";
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

/* Ficha de token: sai do inimigo num arco e voa até o contador do HUD.
   Puramente decorativa — game.tokens já foi creditado no kill. */
class TokenChip {
  constructor(x, y, target, delay = 0) {
    this.x = x; this.y = y;
    this.sx = x; this.sy = y; // origem do voo, fixada ao fim do arco
    this.target = target;
    const a = rand(0, Math.PI * 2);
    const s = rand(70, 160);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.delay = delay;
    this.t = 0;
    this.rot = rand(0, Math.PI * 2);
    this.spin = rand(-10, 10);
    this.arrived = false;
    this.dead = false;
    this.ARC = 0.12;            // arco livre: espalha antes de voar
    this.FLY = rand(0.3, 0.42); // duração do voo (varia: pops em rajada, não em bloco)
  }
  update(dt) {
    this.t += dt;
    this.rot += this.spin * dt;
    if (this.t < this.delay) return;
    const age = this.t - this.delay;

    if (age < this.ARC) {
      this.vy += 220 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.sx = this.x; this.sy = this.y;
      return;
    }
    /* Interpolação de duração fixa em vez de perseguição física: física com
       arrasto dá velocidade terminal, e uma ficha do canto oposto levava 3,5s —
       tarde demais pra casar com o contador, que rola em ~0,4s. Assim a chegada
       é constante (~0,45s) venha ela de onde vier. */
    const p = clamp((age - this.ARC) / this.FLY, 0, 1);
    const e = p * p; // ease-in: acelera rumo ao contador
    this.x = this.sx + (this.target.x - this.sx) * e;
    this.y = this.sy + (this.target.y - this.sy) * e;
    if (p >= 1) {
      this.arrived = true;
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = COLORS.orange;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-2.5, -2.5, 5, 5);
    ctx.restore();
  }
}
