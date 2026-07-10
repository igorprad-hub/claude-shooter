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
    this.x = clamp(this.x + dx * this.speed * dt, 30, game.W - 30);
    this.y = clamp(this.y + dy * this.speed * dt, game.H * 0.45, game.H - 105);

    this.cooldown -= dt;
    this.muzzle -= dt;
    if (input.fire && this.cooldown <= 0) {
      game.bullets.push(new Bullet(this.x, this.y - 20));
      this.cooldown = game.power.coffee > 0 ? 0.1 : 0.21;
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
    if (this.x < -20 || this.x > game.W + 20 || this.y < -30) this.dead = true;
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
    w: 130, h: 78,
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
    w: 130, h: 78,
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
    w: 250, h: 60,
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
    this.telegraph = null;               // build: coluna telegrafada { x, t }
    this.flash = 0;
    this.dead = false;
  }

  update(dt, game) {
    this.t += dt;
    this.flash -= dt;
    if (this.entering) {
      this.y += 130 * dt;
      if (this.y >= this.targetY) { this.y = this.targetY; this.entering = false; }
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

  updateClient(dt, game) {
    // vaga sem rumo, como os requisitos
    this.atkTimer2 -= dt;
    if (this.atkTimer2 <= 0) {
      this.atkTimer2 = 2.2;
      this.moveTarget = rand(110, game.W - 110);
    }
    this.x += (this.moveTarget - this.x) * 2.2 * dt;

    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.atkTimer = Math.max(1.2, 2.1 - this.level * 0.07);
      for (const a of [-0.35, 0, 0.35]) {
        game.enemyBullets.push(new EnemyBullet(this.x, this.y + 35, Math.sin(a) * 170, Math.cos(a) * 190));
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

  updateBuild(dt, game) {
    this.x = game.W / 2 + Math.sin(this.t * 0.5) * 150;
    this.atkTimer -= dt;
    if (this.atkTimer <= 0 && !this.telegraph) {
      this.atkTimer = Math.max(1.6, 2.7 - this.level * 0.08);
      this.telegraph = { x: game.player.x, t: 0.75 };
    }
    if (this.telegraph) {
      this.telegraph.t -= dt;
      if (this.telegraph.t <= 0) {
        // despeja a stack trace na coluna marcada
        for (let i = 0; i < 5; i++) {
          game.enemyBullets.push(new EnemyBullet(this.telegraph.x, this.y + 30 - i * 34, 0, 340));
        }
        this.telegraph = null;
      }
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
      ctx.fillStyle = `rgba(224, 82, 82, ${0.1 + Math.sin(this.t * 25) * 0.06})`;
      ctx.fillRect(this.telegraph.x - 16, y, 32, 600);
    }

    // cartão do boss
    ctx.fillStyle = "rgba(38, 38, 36, 0.95)";
    roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = this.flash > 0 ? COLORS.text : this.cfg.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = this.cfg.color;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // sprite pixel-art com flutuação
    const bob = Math.sin(this.t * 2) * 3;
    drawSprite(ctx, SPRITES[this.cfg.id], x, y - 7 + bob);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "10px monospace";
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(this.cfg.sub, x, y + h / 2 - 9);

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

class FloatText {
  constructor(x, y, text, color = COLORS.dim) {
    this.x = x; this.y = y;
    this.text = text;
    this.color = color;
    this.life = 1.1;
    this.dead = false;
  }
  update(dt) {
    this.y -= 34 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life, 0, 1);
    ctx.fillStyle = this.color;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
