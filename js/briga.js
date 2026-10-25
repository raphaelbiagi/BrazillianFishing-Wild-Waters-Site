/* Brazilian Fishing: Wild Waters — a briga do jogo, vista de cima, rodando no site.
   Usa a MESMA arte do jogo (img/briga/) e as mesmas regras de montagem dos scripts
   fight_view.gd, fight_fisher.gd, fight_jump.gd e fish_shadow.gd:
   pescador de costas com a vara média, sombra do dourado nadando, saltos em arco e reto,
   linha branca até a boca e os efeitos de água. Tudo numa tela de 1280 x 720. */
(function () {
  'use strict';

  var D = window.BRIGA_DADOS;
  var W = 1280, H = 720;
  var SHORE = H - 92;      // faixa do nosso barranco na base
  var FAR = 44;            // faixa da outra margem no topo
  var FEET = { x: W / 2, y: SHORE + 44 };
  var DIR = 'img/briga/';

  // ---------- utilidades ----------
  var cache = {};
  function img(nome) {
    if (!cache[nome]) { var i = new Image(); i.src = DIR + nome; cache[nome] = i; }
    return cache[nome];
  }
  function pronta(i) { return i.complete && i.naturalWidth > 0; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function difAng(a, b) {
    var d = (b - a) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function bezier(a, c, b, t) {
    var u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }
  // Distância (m) → altura na tela, igual ao jogo (comprime as distâncias grandes).
  function distY(m) { var f = m / (m + 22); return SHORE - (SHORE - FAR) * f; }
  function persp(m) { var f = m / (m + 22); return lerp(1, 0.55, f); }

  // Pré-carrega a arte usada em qualquer cena.
  function precarregar() {
    img('agua.png'); img('margens.png');
    Object.keys(D.fx).forEach(function (f) { img(f + '.png'); });
    Object.keys(D.sombras).forEach(function (p) {
      var a = D.sombras[p].animacoes;
      Object.keys(a).forEach(function (k) { img(a[k].arquivo); });
    });
  }

  // ---------- efeitos de água (folhas em tira, com centro) ----------
  function desenharFx(ctx, nome, quadro, x, y, espelho) {
    var m = D.fx[nome], i = img(nome + '.png');
    if (!pronta(i)) return;
    var fw = m.quadro[0], fh = m.quadro[1];
    quadro = clamp(quadro, 0, m.quadros - 1);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (espelho) ctx.scale(-1, 1);
    ctx.drawImage(i, quadro * fw, 0, fw, fh, -m.centro[0], -m.centro[1], fw, fh);
    ctx.restore();
  }

  // ---------- sombra animada de um peixe ----------
  function desenharSombra(ctx, especie, anim, fase, x, y, ang, comp, alfa) {
    var m = D.sombras[especie], a = m.animacoes[anim], i = img(a.arquivo);
    if (!pronta(i)) return;
    var fw = m.quadro[0], fh = m.quadro[1];
    var q = ((Math.floor(fase) % a.quadros) + a.quadros) % a.quadros;
    var s = comp / m.comprimento;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(s, s);
    ctx.drawImage(i, q * fw, 0, fw, fh, -m.centro[0], -m.centro[1], fw, fh);
    ctx.restore();
  }
  // Boca da sombra (a linha prende aqui).
  function bocaSombra(especie, x, y, ang, comp) {
    var m = D.sombras[especie], s = comp / m.comprimento;
    var dx = (m.focinho[0] - m.centro[0]) * s, dy = (m.focinho[1] - m.centro[1]) * s;
    return { x: x + dx * Math.cos(ang) - dy * Math.sin(ang), y: y + dx * Math.sin(ang) + dy * Math.cos(ang) };
  }

  // ---------- salto do dourado (folha com arco, sombra e água já desenhados) ----------
  function Salto(tipo, comp, origem, espelho) {
    this.m = D.saltos[tipo];
    var best = null, t = this.m.tamanhos;
    Object.keys(t).forEach(function (k) {
      if (!best || Math.abs(t[k].comprimento - comp) < Math.abs(best.comprimento - comp)) best = t[k];
    });
    this.tam = best;
    this.img = img(best.arquivo);
    this.escala = comp / best.comprimento;
    this.origem = origem;
    this.espelho = espelho;
    this.tempo = 0;
  }
  Salto.prototype.quadro = function () { return Math.floor(this.tempo * this.m.fps); };
  Salto.prototype.fimNoAr = function () { return this.tam.quadro_entrada + 4; };
  Salto.prototype.acabou = function () { return this.quadro() >= this.m.quadros; };
  Salto.prototype.naTela = function (p) {
    var lx = (p[0] - this.tam.saida[0]) * this.escala, ly = (p[1] - this.tam.saida[1]) * this.escala;
    return { x: this.origem.x + (this.espelho ? -lx : lx), y: this.origem.y + ly };
  };
  Salto.prototype.entrada = function () { return this.naTela(this.tam.entrada); };
  Salto.prototype.bocaFora = function (q) { var b = this.tam.boca; return q >= 0 && q < b.length && b[q] !== null; };
  // Boca no quadro atual; embaixo d'água ela desliza entre o último e o próximo ponto conhecido.
  Salto.prototype.boca = function (inicio, fim) {
    var q = this.quadro(), b = this.tam.boca, fps = this.m.fps;
    if (this.bocaFora(q)) return this.naTela(b[q]);
    var de = inicio, deS = 0, ate = fim, ateS = this.fimNoAr() / fps, i;
    for (i = Math.min(q, b.length) - 1; i >= 0; i--) if (this.bocaFora(i)) { de = this.naTela(b[i]); deS = i / fps; break; }
    for (i = Math.max(q + 1, 0); i < Math.min(this.fimNoAr(), b.length); i++) if (this.bocaFora(i)) { ate = this.naTela(b[i]); ateS = i / fps; break; }
    if (ateS <= deS) return ate;
    var t = clamp((this.tempo - deS) / (ateS - deS), 0, 1);
    return { x: lerp(de.x, ate.x, t), y: lerp(de.y, ate.y, t) };
  };
  Salto.prototype.desenhar = function (ctx) {
    if (!pronta(this.img)) return;
    var fw = this.tam.quadro[0], fh = this.tam.quadro[1], col = this.m.colunas;
    var q = clamp(this.quadro(), 0, this.m.quadros - 1);
    ctx.save();
    ctx.translate(Math.round(this.origem.x), Math.round(this.origem.y));
    ctx.scale(this.espelho ? -this.escala : this.escala, this.escala);
    ctx.drawImage(this.img, (q % col) * fw, Math.floor(q / col) * fh, fw, fh, -this.tam.saida[0], -this.tam.saida[1], fw, fh);
    ctx.restore();
  };

  // ---------- pescador de costas com a vara ----------
  function Pescador() {
    this.m = D.pescador;
    this.canto = { x: Math.round(FEET.x - this.m.pes[0]), y: Math.round(FEET.y - this.m.pes[1]) };
    this.maos = { x: this.canto.x + this.m.mao[0], y: this.canto.y + this.m.mao[1] };
    this.chave = 'e04';
    this.cabeca = 2;
    this.dobra = 0;
    this.ponta = { x: this.maos.x, y: this.maos.y - 100 };
  }
  Pescador.prototype.atualizar = function (peixe, dobra) {
    var ang = Math.atan2(-(peixe.y - this.maos.y), peixe.x - this.maos.x) * 180 / Math.PI;
    var self = this, perto = function (a) {
      var best = null;
      Object.keys(D.vara).forEach(function (k) {
        if (!best || Math.abs(D.vara[k].angulo_peixe - a) < Math.abs(D.vara[best].angulo_peixe - a)) best = k;
      });
      return best;
    };
    // Folga para não ficar piscando entre duas direções.
    if (perto(ang - 2.5) === perto(ang + 2.5)) self.chave = perto(ang);
    this.dobra = clamp(Math.round(dobra * (D.varaQuadros - 1)), 0, D.varaQuadros - 1);
    var v = D.vara[this.chave];
    this.ponta = { x: this.maos.x - v.mao[0] + v.ponta[this.dobra][0], y: this.maos.y - v.mao[1] + v.ponta[this.dobra][1] };
    var lim = this.m.cabeca.limites_angulo, c = lim.length;
    for (var i = 0; i < lim.length; i++) if (ang > lim[i]) { c = i; break; }
    this.cabeca = c;
  };
  Pescador.prototype.desenhar = function (ctx, enrolando, t) {
    var fw = this.m.quadro[0], fh = this.m.quadro[1], cx = this.canto.x, cy = this.canto.y;
    var parte = function (nome, q) { var i = img(nome); if (pronta(i)) ctx.drawImage(i, q * fw, 0, fw, fh, cx, cy, fw, fh); };
    parte('pescador_braco_dir_' + this.chave + '.png', 0);
    var v = D.vara[this.chave], vi = img(v.arquivo);
    if (pronta(vi)) {
      ctx.drawImage(vi, this.dobra * v.quadro[0], 0, v.quadro[0], v.quadro[1],
        this.maos.x - v.mao[0], this.maos.y - v.mao[1], v.quadro[0], v.quadro[1]);
    }
    parte('pescador_braco_esq_' + this.chave + '.png', enrolando ? 1 + Math.floor(t * 12) % 4 : 0);
    parte('pescador_costas.png', Math.floor(t * 2) % 2);
    parte('pescador_cabeca.png', Math.min(this.cabeca, 4));
  };
  function precarregarPescador() {
    img('pescador_costas.png'); img('pescador_cabeca.png');
    Object.keys(D.vara).forEach(function (k) {
      img(D.vara[k].arquivo); img('pescador_braco_dir_' + k + '.png'); img('pescador_braco_esq_' + k + '.png');
    });
    Object.keys(D.saltos).forEach(function (s) {
      var t = D.saltos[s].tamanhos;
      Object.keys(t).forEach(function (k) { img(t[k].arquivo); });
    });
  }

  // ================= a cena =================
  // opts: { briga: true/false (pescador + dourado fisgado), enfeites: nº de peixes de enfeite,
  //         aoMudar: function(estado) chamado com {modo, tensao, kg, dist} }
  function Briga(canvas, opts) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = W; canvas.height = H;
    this.ctx.imageSmoothingEnabled = false;
    this.opts = opts || {};
    this.t = 0;
    this.fx = [];
    this.rodando = false;
    precarregar();
    if (this.opts.briga) { precarregarPescador(); this.pescador = new Pescador(); this.novaBriga(); }
    // peixes de enfeite passando ao longe
    var especies = ['lambari', 'piau_tres_pintas', 'mandi', 'piapara', 'surubim'];
    this.enfeites = [];
    for (var i = 0; i < (this.opts.enfeites || 0); i++) {
      this.enfeites.push({
        esp: especies[i % especies.length], x: rnd(0, W), y: rnd(FAR + 70, SHORE - 70),
        v: rnd(14, 34) * (Math.random() < 0.5 ? -1 : 1), fase: rnd(0, 8), comp: rnd(28, 60), onda: rnd(0, 6)
      });
    }
    this.brilhos = [];
    for (i = 0; i < 46; i++) this.brilhos.push({ x: rnd(0, W), y: rnd(FAR, SHORE), f: rnd(0, 6) });
  }

  // Peixe novo fisgado lá longe.
  Briga.prototype.novaBriga = function () {
    var kg = rnd(4, 11);
    this.p = {
      kg: kg, dist: rnd(24, 30), x: rnd(460, 820), y: 0, h: Math.PI, v: 0,
      alvo: 0, alvoT: 0, modo: 'sacode', modoT: 0.9, folego: 1, fase: 0, alfa: 0,
      proxSalto: rnd(3, 6), salto: null, pousou: 99, saidaBoca: null, sumindo: 0
    };
    this.p.y = distY(this.p.dist);
    this.p.alvo = this.p.x;
    this.linhaFora = 0;
    this.tensao = 0.6;
    this.entradaAnt = null;
    this.riscoT = 0;
    this.ondaT = 0;
    this.solta(this.p.x, this.p.y, 'briga_respingo');
    this.solta(this.p.x, this.p.y, 'briga_estrelas');
  };

  Briga.prototype.solta = function (x, y, nome, embaixo, deriva) {
    this.fx.push({ nome: nome, x: x, y: y, t: 0, embaixo: !!embaixo, dx: deriva || 0 });
  };

  Briga.prototype.comprimento = function () {
    var perto = clamp(14 + Math.sqrt(this.p.kg) * 14.7, 14, 110);
    return perto * persp(this.p.dist);
  };

  // Escolhe o próximo comportamento do peixe.
  Briga.prototype.proximoModo = function () {
    var p = this.p, centro = W / 2, lim = this.limite();
    if (p.folego < 0.25) { p.modo = 'cansado'; p.modoT = 99; return; }
    var r = Math.random();
    // Com o fôlego acabando, ele corre menos.
    if (r < 0.12 + 0.3 * p.folego) {
      p.modo = 'corre'; p.modoT = rnd(1.6, 3) * (0.5 + 0.5 * p.folego);
      var lado = Math.cos(p.h) > 0 ? 1 : -1;
      if (Math.random() < 0.3) lado = -lado;
      p.alvo = centro + lado * lim * rnd(0.6, 1);
    } else if (r < 0.55) {
      p.modo = 'sacode'; p.modoT = rnd(1, 1.8);
    } else {
      p.modo = 'descansa'; p.modoT = rnd(2, 3.5);
    }
  };
  Briga.prototype.limite = function () { return W * 0.26 * this.p.dist / (this.p.dist + 6); };

  Briga.prototype.comecarSalto = function () {
    var p = this.p, comp = this.comprimento();
    var tipo = Math.random() < 0.5 ? 'arco' : 'reto';
    // A folha tem a cabeça para a esquerda; saltando para a direita, espelha.
    p.salto = new Salto(tipo, comp, { x: p.x, y: p.y }, Math.cos(p.h) > 0);
    p.saidaBoca = bocaSombra('dourado', p.x, p.y, p.h + Math.PI, comp);
    p.pousou = 99; // ainda não voltou para a água
    p.modo = 'salto';
  };

  Briga.prototype.atualizarPeixe = function (dt) {
    var p = this.p;
    if (p.sumindo > 0) {
      p.sumindo += dt;
      p.alfa = Math.max(0, 1 - p.sumindo / 1.2);
      if (p.sumindo > 3) this.novaBriga();
      return;
    }
    p.alfa = Math.min(1, p.alfa + dt * 3);
    p.pousou += dt;

    // ---- salto ----
    if (p.salto) {
      var s = p.salto;
      s.tempo += dt;
      if (s.quadro() >= s.fimNoAr() && p.pousou > 50) {
        var e = s.entrada();
        p.x = e.x; p.y = e.y;
        p.h = s.espelho ? 0 : Math.PI; // cabeça para o lado do salto, com embalo
        p.v = 70 * persp(p.dist);
        p.pousou = 0;
      }
      if (s.acabou()) {
        this.solta(s.entrada().x, s.entrada().y, 'briga_espuma', false, 8);
        p.salto = null; p.pousou = 0;
        this.proximoModo();
      }
      return;
    }

    // ---- fôlego, distância e tempo de cada comportamento ----
    var correndo = p.modo === 'corre';
    p.folego = Math.max(0, p.folego - dt / 38);
    if (correndo) p.dist = Math.min(32, p.dist + dt * (0.6 + 1.8 * p.folego));
    else if (p.modo === 'cansado') p.dist = Math.max(2.4, p.dist - dt * 2.4);
    else p.dist = Math.max(4, p.dist - dt * (p.modo === 'sacode' ? 0.5 : 1.9));

    p.modoT -= dt;
    if (p.modoT <= 0) this.proximoModo();
    p.proxSalto -= dt;
    if (p.proxSalto <= 0 && p.modo !== 'cansado' && p.dist > 7) {
      p.proxSalto = rnd(7, 12);
      this.comecarSalto();
      return;
    }
    // Cansado e colado no barranco: o pescador embarca o peixe e começa outra briga.
    if (p.modo === 'cansado' && p.dist <= 2.5) {
      p.sumindo = 0.001;
      this.solta(p.x, p.y, 'briga_respingo');
      this.solta(p.x, p.y, 'briga_ondas');
      return;
    }

    // ---- nado: sempre para onde a cabeça aponta, virando em curva ----
    var lim = this.limite(), centro = W / 2;
    if (p.modo === 'descansa' || p.modo === 'cansado') {
      p.alvoT -= dt;
      if (p.alvoT <= 0 || Math.abs(p.alvo - p.x) < 14) {
        p.alvo = clamp(p.x + rnd(-120, 120), centro - lim, centro + lim);
        p.alvoT = rnd(1.5, 3);
      }
    } else if (correndo && Math.abs(p.alvo - p.x) < 14 * persp(p.dist)) {
      p.alvo = centro + (p.x > centro ? -1 : 1) * lim * rnd(0.6, 1);
    }
    var alturaAlvo = distY(p.dist);
    var desejo = Math.atan2((alturaAlvo - p.y) * 0.6, p.alvo - p.x);
    var giro = clamp(difAng(p.h, desejo) * 4, -2.8, 2.8);
    if (p.modo === 'sacode') giro = Math.sin(this.t * 20) * 3;
    p.h += giro * dt;
    var ritmo = persp(p.dist) * (0.5 + 0.5 * p.folego);
    var vAlvo = (correndo ? 150 : p.modo === 'sacode' ? 6 : 30) * ritmo;
    if (Math.abs(difAng(p.h, desejo)) > Math.PI / 2) vAlvo *= 0.3;
    var acel = correndo ? 140 : 45;
    p.v += clamp(vAlvo - p.v, -acel * dt, acel * dt);
    p.x += Math.cos(p.h) * p.v * dt;
    p.y += Math.sin(p.h) * p.v * dt * 0.5;
    p.y += (alturaAlvo - p.y) * Math.min(1, 2.5 * dt);

    var anim = p.modo === 'cansado' ? 'cansado' : p.modo === 'sacode' ? 'sacudindo' : 'nadando';
    var a = D.sombras.dourado.animacoes[anim];
    p.fase += dt * a.fps * (anim === 'nadando' ? 0.6 + p.v / 80 : 1);
    p.anim = anim;
  };

  Briga.prototype.atualizar = function (dt) {
    this.t += dt;
    var i;
    for (i = 0; i < this.enfeites.length; i++) {
      var e = this.enfeites[i];
      e.x += e.v * dt; e.fase += dt * 8;
      if (e.x < -80) e.x = W + 80; if (e.x > W + 80) e.x = -80;
    }
    for (i = this.fx.length - 1; i >= 0; i--) {
      var f = this.fx[i], m = D.fx[f.nome];
      f.t += dt; f.x += f.dx * dt;
      if (f.t * m.fps >= m.quadros) this.fx.splice(i, 1);
    }
    if (!this.opts.briga) return;

    this.atualizarPeixe(dt);
    var p = this.p;
    // Tensão e dobra da vara pelo que o peixe está fazendo.
    var alvoT = { corre: 0.92, sacode: 0.75, descansa: 0.5, cansado: 0.35, salto: 0.15 }[p.modo] || 0.4;
    if (p.sumindo) alvoT = 0;
    this.tensao += (alvoT - this.tensao) * Math.min(1, dt * 3);
    var dobra = this.tensao + (p.modo === 'sacode' ? Math.sin(this.t * 22) * 0.14 : 0);

    // Boca do peixe (onde a linha prende).
    var comp = this.comprimento();
    if (p.salto) {
      var fim = bocaSombra('dourado', p.salto.entrada().x, p.salto.entrada().y, p.salto.espelho ? Math.PI : 0, comp);
      this.boca = p.salto.boca(p.saidaBoca, fim);
      var q = p.salto.quadro();
      this.linhaFora = Math.min(1, Math.max(0, this.linhaFora + (p.salto.bocaFora(q) ? dt : -dt) / 0.25));
    } else {
      this.boca = bocaSombra('dourado', p.x, p.y, p.h + Math.PI, comp);
      this.linhaFora = Math.max(0, this.linhaFora - dt / 0.25);
    }
    this.pescador.atualizar(this.boca, dobra);

    // Curva da linha: frouxa faz barriga; com a boca no ar fica reta.
    var ponta = this.pescador.ponta, folga = 1 - clamp(this.tensao, 0, 1);
    var meio = { x: (ponta.x + this.boca.x) / 2, y: (ponta.y + this.boca.y) / 2 };
    var dx = this.boca.x - ponta.x, dy = this.boca.y - ponta.y, len = Math.hypot(dx, dy) || 1;
    var curva = { x: meio.x - dy / len * 50 * folga, y: meio.y + dx / len * 50 * folga };
    this.controle = { x: lerp(curva.x, meio.x, this.linhaFora), y: lerp(curva.y, meio.y, this.linhaFora) };
    this.entradaT = lerp(lerp(0.7, 0.5, folga), 1, this.linhaFora);
    var entrada = bezier(ponta, this.controle, this.boca, this.entradaT);

    // Rastros da linha cortando a água.
    if (!p.salto && !p.sumindo) {
      this.riscoT -= dt;
      var vel = this.entradaAnt ? Math.hypot(entrada.x - this.entradaAnt.x, entrada.y - this.entradaAnt.y) / dt : 0;
      if (this.riscoT <= 0) {
        if (p.modo === 'corre') { this.solta(entrada.x, entrada.y, 'briga_linha_risco', true); this.riscoT = 0.08; }
        else if (vel > 6) { this.solta(entrada.x, entrada.y, 'briga_linha_risco_leve', true); this.riscoT = 0.1; }
      }
      if (p.modo === 'sacode') {
        this.ondaT -= dt;
        if (this.ondaT <= 0) { this.solta(p.x, p.y, 'briga_ondas'); this.ondaT = 0.5; }
      }
      if (entrada && this.entradaAnt) this.corteEsq = entrada.x < this.entradaAnt.x;
    }
    this.entrada = entrada;
    this.entradaAnt = entrada;

    if (this.opts.aoMudar) this.opts.aoMudar({ modo: p.sumindo ? 'pego' : p.modo, tensao: this.tensao, kg: p.kg, dist: p.dist });
  };

  // ---------- desenho, na ordem do jogo ----------
  Briga.prototype.desenhar = function () {
    var ctx = this.ctx, t = this.t, i;
    ctx.clearRect(0, 0, W, H);
    var agua = img('agua.png');
    if (pronta(agua)) ctx.drawImage(agua, 0, 0);
    else { ctx.fillStyle = '#65563A'; ctx.fillRect(0, 0, W, H); }

    // Faixas de luz andando devagar.
    ctx.fillStyle = 'rgba(255,235,178,0.05)';
    for (i = 0; i < 5; i++) {
      var x = ((i * 263 + t * (6 + i * 2)) % (W + 240)) - 120, larg = 40 + i * 9;
      ctx.beginPath();
      ctx.moveTo(x, FAR); ctx.lineTo(x + larg, FAR); ctx.lineTo(x + larg + 60, SHORE); ctx.lineTo(x + 60, SHORE);
      ctx.fill();
    }
    // Brilhos.
    for (i = 0; i < this.brilhos.length; i++) {
      var b = this.brilhos[i];
      ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2 + b.f))) + ')';
      ctx.fillRect(Math.round(b.x / 2) * 2, Math.round(b.y / 2) * 2, 2, 2);
    }
    // Peixes de enfeite.
    for (i = 0; i < this.enfeites.length; i++) {
      var e = this.enfeites[i];
      var yy = e.y + Math.sin(t * 0.7 + e.onda) * 6;
      desenharSombra(ctx, e.esp, 'nadando', e.fase, e.x, yy, e.v > 0 ? Math.PI : 0, e.comp, 0.35);
    }

    // Efeitos embaixo do peixe (riscos da linha).
    this.desenharFxSoltos(true);

    var p = this.p;
    if (this.opts.briga) {
      var comp = this.comprimento();
      if (p.salto) {
        if (p.salto.quadro() >= p.salto.fimNoAr()) desenharSombra(ctx, 'dourado', 'nadando', p.fase, p.x, p.y, p.h + Math.PI, comp, 0.75 * Math.min(1, 0.25 + p.pousou / 0.3));
        p.salto.desenhar(ctx);
      } else {
        var alfa = 0.75 * p.alfa * Math.min(1, 0.25 + p.pousou / 0.3);
        desenharSombra(ctx, 'dourado', p.anim || 'nadando', p.fase, p.x, p.y, p.h + Math.PI, comp, alfa);
      }
      // Parte da linha embaixo da água barrenta.
      if (!p.sumindo && this.entradaT < 0.999) this.desenharLinha(this.entradaT, 1, '#B9A57A', 1.6);
    }

    this.desenharFxSoltos(false);
    if (this.opts.briga && !p.salto && !p.sumindo) {
      if (p.modo === 'sacode') {
        desenharFx(ctx, 'briga_agitado', Math.floor(t * D.fx.briga_agitado.fps) % D.fx.briga_agitado.quadros, p.x, p.y);
        desenharFx(ctx, 'briga_bolhas', Math.floor(t * D.fx.briga_bolhas.fps) % D.fx.briga_bolhas.quadros, p.x, p.y);
      }
      if (p.modo === 'corre' && this.entrada) {
        var c = D.fx.briga_linha_corte;
        desenharFx(ctx, 'briga_linha_corte', Math.floor(t * c.fps * 1.5) % c.quadros, this.entrada.x, this.entrada.y, this.corteEsq);
      }
    }

    var margens = img('margens.png');
    if (pronta(margens)) ctx.drawImage(margens, 0, 0);

    if (this.opts.briga) {
      var enrolando = p.modo !== 'corre' && p.modo !== 'salto' && !p.sumindo;
      this.pescador.desenhar(ctx, enrolando, t);
      if (!p.sumindo) this.desenharLinha(0, this.entradaT, '#F2F4EE', 2.2);
    }
  };

  Briga.prototype.desenharFxSoltos = function (embaixo) {
    for (var i = 0; i < this.fx.length; i++) {
      var f = this.fx[i];
      if (f.embaixo === embaixo) desenharFx(this.ctx, f.nome, Math.floor(f.t * D.fx[f.nome].fps), f.x, f.y);
    }
  };

  Briga.prototype.desenharLinha = function (de, ate, cor, larg) {
    var ctx = this.ctx, a = this.pescador.ponta, c = this.controle, b = this.boca;
    // A linha fica com a mesma grossura na tela, seja qual for o tamanho do quadro.
    var escala = W / Math.max(1, this.cv.clientWidth);
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(larg, larg * escala * 0.6);
    ctx.beginPath();
    for (var i = 0; i <= 24; i++) {
      var pt = bezier(a, c, b, lerp(de, ate, i / 24));
      if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  };

  // ---------- laço: só roda enquanto a cena está na tela ----------
  Briga.prototype.iniciar = function () {
    var self = this, ultimo = 0;
    function quadro(ms) {
      if (!self.rodando) return;
      var dt = ultimo ? Math.min((ms - ultimo) / 1000, 0.05) : 0.016;
      ultimo = ms;
      self.atualizar(dt);
      self.desenhar();
      requestAnimationFrame(quadro);
    }
    var ligar = function (sim) {
      if (sim && !self.rodando) { self.rodando = true; ultimo = 0; requestAnimationFrame(quadro); }
      if (!sim) self.rodando = false;
    };
    // Antes de rodar, decodifica toda a arte (fora da linha principal do navegador) e
    // desenha um quadro, para não travar a rolagem quando a cena aparece na tela.
    var imgs = Object.keys(cache).map(function (k) { return cache[k]; });
    // (Se o navegador demorar a decodificar, começa assim mesmo depois de 1,5 s.)
    var limite = new Promise(function (ok) { setTimeout(ok, 1500); });
    var tudo = Promise.all(imgs.map(function (i) { return i.decode ? i.decode().catch(function () {}) : null; }));
    Promise.race([tudo, limite]).then(function () {
      self.atualizar(0.016);
      self.desenhar();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (it) { ligar(it[0].isIntersecting); }, { rootMargin: '400px 0px' }).observe(self.cv);
      } else ligar(true);
    });
  };

  // ================= salto do logo (o salto da briga, sozinho, em loop) =================
  // Desenha os dois saltos do dourado (arco e reto) espelhados, indo em direção ao título.
  function SaltoLogo(canvas, escala) {
    var ctx = canvas.getContext('2d');
    // Origem comum: cabe o salto em arco (espelhado) e o reto na mesma tela.
    var OX = 112, OY = 150;
    canvas.width = 330; canvas.height = 194;
    ctx.imageSmoothingEnabled = false;
    precarregarPescador();
    var tipo = 'arco', salto = null, espera = 0.6, ultimo = 0;
    function novo() {
      var m = D.saltos[tipo];
      salto = new Salto(tipo, m.tamanhos.g.comprimento, { x: OX, y: OY }, true);
      tipo = tipo === 'arco' ? 'reto' : 'arco';
    }
    function quadro(ms) {
      var dt = ultimo ? Math.min((ms - ultimo) / 1000, 0.05) : 0.016;
      ultimo = ms;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (salto) {
        salto.tempo += dt * 0.75; // um pouco mais lento que no jogo, para ver o peixe no ar
        salto.desenhar(ctx);
        if (salto.acabou()) { salto = null; espera = rnd(0.2, 0.6); }
      } else {
        espera -= dt;
        if (espera <= 0) novo();
      }
      if (ligado) requestAnimationFrame(quadro);
    }
    // Só anima com o logo na tela.
    var ligado = false;
    new IntersectionObserver(function (it) {
      var ver = it[0].isIntersecting;
      if (ver && !ligado) { ligado = true; ultimo = 0; requestAnimationFrame(quadro); }
      if (!ver) ligado = false;
    }).observe(canvas);
  }

  window.Briga = Briga;
  window.SaltoLogo = SaltoLogo;
})();
