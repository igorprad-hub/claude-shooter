"use strict";

/* Sprites pixel-art procedurais: 1 char = 1 pixel, "." = transparente.
   Cada sprite é renderizado uma única vez num canvas offscreen, já no
   scale final — pixels perfeitamente nítidos, sem smoothing. */

const PIXEL_PAL = {
  O: "#d97757", // laranja Claude
  o: "#a35a42", // laranja escuro
  W: "#faf9f5", // branco
  w: "#c9c7c0", // cinza claro
  G: "#8f8d86", // cinza
  g: "#55534e", // cinza escuro
  P: "#9b7ede", // roxo
  p: "#6f58a8", // roxo escuro
  R: "#e05252", // vermelho
  r: "#a13a3a", // vermelho escuro
  Y: "#e0b252", // amarelo
  y: "#a8823a", // amarelo escuro
  C: "#6cb8c4", // ciano
  c: "#4a8791", // ciano escuro
  K: "#14130f", // quase preto
  k: "#26241f", // fundo escuro
  S: "#e8b88a", // pele
  N: "#5a3d2b", // café
};

function makeSprite(rows, scale = 3) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement("canvas");
  cv.width = w * scale;
  cv.height = h * scale;
  const c = cv.getContext("2d");
  for (let ry = 0; ry < h; ry++) {
    for (let rx = 0; rx < rows[ry].length; rx++) {
      const ch = rows[ry][rx];
      if (ch === "." || ch === " ") continue;
      c.fillStyle = PIXEL_PAL[ch] || "#ff00ff";
      c.fillRect(rx * scale, ry * scale, scale, scale);
    }
  }
  return cv;
}

function drawSprite(ctx, spr, x, y) {
  ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height / 2));
}

/* ── artes ── */

const SPRITE_ROWS = {
  // satélite do jogador (corpo; luz e chama são desenhadas à parte)
  satellite: [
    "......www......",
    "......w.w......",
    ".......w.......",
    "CCCC..www..CCCC",
    "CcCc.wwWww.cCcC",
    "CCCC.wWWWw.CCCC",
    "CcCc.wwWww.cCcC",
    "CCCC..www..CCCC",
  ],
  flame0: [
    "..W..",
    ".OOO.",
    ".oYo.",
    "..o..",
  ],
  flame1: [
    "..W..",
    ".OYO.",
    "..o..",
  ],

  // balão do Teams
  teams: [
    ".PPPPPPPP.",
    "PPppppppPP",
    "PpWpWpWppP",
    "PPppppppPP",
    ".PPPPPPPP.",
    "...PPP....",
    "..PP......",
    ".P........",
  ],

  // calendário da reunião urgente
  meeting: [
    "..w....w..",
    "rRRRRRRRRr",
    "rRRRRRRRRr",
    "WWWWWWWWWW",
    "WWgWgWgWWW",
    "WWWWWWWWWW",
    "WWgWgWgWWW",
    "WWWWWWWWWW",
  ],

  // bolha do "quick question"
  quick: [
    "...OOOOO...",
    "..OkkkkkO..",
    ".OkkWWWkkO.",
    ".OkWkkkWkO.",
    ".OkkkkkWkO.",
    ".OkkkkWkkO.",
    ".OkkkWkkkO.",
    ".OkkkkkkkO.",
    "..OkkWkkO..",
    "...OOOOO...",
    "....OO.....",
    "...O.......",
  ],

  // prancheta do last-minute feedback
  feedback: [
    "...wWWw...",
    ".YYWWWWYY.",
    ".YWWWWWWY.",
    ".YWggggWY.",
    ".YWWWWWWY.",
    ".YWgggWWY.",
    ".YWWWWWWY.",
    ".YWggggWY.",
    ".YWWWWWWY.",
    ".YYYYYYYY.",
  ],

  // triângulo de alerta do TypeError que o build cospe
  error: [
    "....RR....",
    "...RrrR...",
    "...RrrR...",
    "..RrWWrR..",
    "..RrWWrR..",
    ".RrrWWrrR.",
    ".RrrWWrrR.",
    "RrrrrrrrrR",
    "RrrrWWrrrR",
    "RRRRRRRRRR",
  ],

  // setas circulares do scope changed
  scope: [
    "...CCCCC...",
    "..CC...CC..",
    ".C.......C.",
    ".C.......CC",
    ".C......CCC",
    "...........",
    "CCC......C.",
    "CC.......C.",
    ".C.......C.",
    "..CC...CC..",
    "...CCCCC...",
  ],

  // power-ups
  coffee: [
    "..w...w...",
    "...w..w...",
    "..........",
    ".WWWWWWW..",
    ".WNNNNNWW.",
    ".WNNNNNW.W",
    ".WNNNNNWW.",
    ".WWWWWWW..",
    "..WWWWW...",
    ".wwwwwwww.",
  ],
  focus: [
    "..PPPPPP..",
    ".PP....PP.",
    ".P......P.",
    "PP......PP",
    "PP......PP",
    "PPP....PPP",
    "pPP....PPp",
    "PPP....PPP",
  ],
  dnd: [
    "...CCCC...",
    "..CCCC....",
    ".CCCC.....",
    ".CCC......",
    "CCCC......",
    "CCCC......",
    ".CCC......",
    ".CCCC.....",
    "..CCCC....",
    "...CCCC...",
  ],
  pizza: [
    "yyyyyyyyyy",
    "YYYYYYYYYY",
    ".YYRYYRYY.",
    ".YYYYYYYY.",
    "..YYYYYY..",
    "..YYRYYY..",
    "...YYYY...",
    "...YYY....",
    "....YY....",
    "....Y.....",
  ],
  duck: [
    "....YYY...",
    "...YYYYY..",
    "...YKYYY..",
    "...YYYYOO.",
    "Y..YYYY...",
    "YYYYYYYY..",
    ".YYYYYYY..",
    "..YYYYY...",
  ],

  // bosses
  pm: [
    "....gggggggg....",
    "...gggggggggg...",
    "...ggSSSSSSgg...",
    "...gSSSSSSSSg...",
    "...gSKSSSSKSg...",
    "...gSSSSSSSSg...",
    "....SSSkkSSS....",
    ".....SSSSSS.....",
    "...PPPWWWWPPP...",
    "..PPPPWRRWPPPP..",
    ".PPPPPWRRWPPPPP.",
    ".PPPPPWRRWPPPPP.",
    ".PPPPPPWWPPPPPP.",
    ".PPPPPPPPPPPPPP.",
  ],
  client: [
    "....wwwwwwww....",
    "...wwwwwwwwww...",
    "...wwSSSSSSww...",
    "..KKKKKKKKKKKK..",
    "..KKKKKKKKKKKK..",
    "...SSSSSSSSSS...",
    "....SSSkkSSS....",
    ".....SSSSSS.....",
    "...gggWWWWggg...",
    "..ggggWCCWgggg..",
    ".gggggWCCWggggg.",
    ".gggggWCCWggggg.",
    ".ggggggWWgggggg.",
    ".gggggggggggggg.",
  ],
  build: [
    ".RRRRRRRRRRRRRR.",
    "RRrrrrrrrrrrrrRR",
    "RRrWW......WWrRR",
    "RRr.WW....WW.rRR",
    "RRr..WW..WW..rRR",
    "RRr...WWWW...rRR",
    "RRr...WWWW...rRR",
    "RRr..WW..WW..rRR",
    "RRr.WW....WW.rRR",
    "RRrWW......WWrRR",
    "RRrrrrrrrrrrrrRR",
    ".RRRRRRRRRRRRRR.",
  ],
};

const SPRITES = {
  satellite: makeSprite(SPRITE_ROWS.satellite, 3),
  flame0: makeSprite(SPRITE_ROWS.flame0, 3),
  flame1: makeSprite(SPRITE_ROWS.flame1, 3),
  teams: makeSprite(SPRITE_ROWS.teams, 2),
  meeting: makeSprite(SPRITE_ROWS.meeting, 2),
  quick: makeSprite(SPRITE_ROWS.quick, 3),
  quickMini: makeSprite(SPRITE_ROWS.quick, 2),
  feedback: makeSprite(SPRITE_ROWS.feedback, 2),
  scope: makeSprite(SPRITE_ROWS.scope, 2),
  error: makeSprite(SPRITE_ROWS.error, 2),
  coffee: makeSprite(SPRITE_ROWS.coffee, 2),
  focus: makeSprite(SPRITE_ROWS.focus, 2),
  dnd: makeSprite(SPRITE_ROWS.dnd, 2),
  pizza: makeSprite(SPRITE_ROWS.pizza, 2),
  duck: makeSprite(SPRITE_ROWS.duck, 2),
  pm: makeSprite(SPRITE_ROWS.pm, 4),
  client: makeSprite(SPRITE_ROWS.client, 4),
  build: makeSprite(SPRITE_ROWS.build, 4),
};
