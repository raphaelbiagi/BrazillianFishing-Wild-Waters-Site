/* Brazilian Fishing: Wild Waters — animações do site */
(function () {
  'use strict';

  // ----- dados dos peixes (iguais aos do jogo, data/fish/*.tres) -----
  var PEIXES = [
    { img: 'dourado', nome: 'Dourado', kg: '2 a 12 kg', forca: 4,
      txt: 'O rei do rio. O grande ataca de uma vez; o pequeno às vezes belisca antes. Dá corridas longas e salta para soltar o anzol.' },
    { img: 'surubim', nome: 'Surubim-pintado', kg: '2 a 40 kg', forca: 5,
      txt: 'Peixe de couro dos poços fundos. Pega firme e leva para o fundo: corridas pesadas, toma muita linha e não cansa fácil.' },
    { img: 'piapara', nome: 'Piapara', kg: '1 a 4 kg', forca: 3,
      txt: 'Desconfiada: a beliscada é leve e quase não aparece na ponta da vara. Briga forte no fundo.' },
    { img: 'piau_tres_pintas', nome: 'Piau três pintas', kg: '0,3 a 1,5 kg', forca: 2,
      txt: 'Às vezes leva direto, às vezes dá umas beliscadas antes. A puxada final é bem clara.' },
    { img: 'mandi', nome: 'Mandi', kg: '0,1 a 0,6 kg', forca: 2,
      txt: 'Bagre de fundo, cuidado com o ferrão. Mexe devagar, vai esticando a linha e só depois leva firme.' },
    { img: 'lambari', nome: 'Lambari', kg: '20 a 80 g', forca: 1,
      txt: 'Pequeno e ligeiro, vive no raso perto do barranco. Belisca sem parar e rouba a isca.' }
  ];
  var ISCAS = [['minhoca', 'Minhoca'], ['milho', 'Milho'], ['massa', 'Massa'], ['soja', 'Soja'],
               ['figado', 'Fígado'], ['lambari', 'Lambari'], ['tuvira', 'Tuvira'], ['piau', 'Piau']];

  var $ = function (id) { return document.getElementById(id); };

  // ----- cartões de peixe -----
  var grade = $('peixesGrade');
  PEIXES.forEach(function (p) {
    var el = document.createElement('article');
    el.className = 'peixe reveal';
    var bolinhas = '';
    for (var i = 0; i < 5; i++) bolinhas += '<i class="' + (i < p.forca ? 'on' : '') + '"></i>';
    el.innerHTML =
      '<div class="peixe-arte"><img src="img/fish/' + p.img + '.png" alt="' + p.nome + '"></div>' +
      '<h3>' + p.nome + '</h3><span class="peso">' + p.kg + '</span>' +
      '<p>' + p.txt + '</p>' +
      '<div class="forca">Briga <span>' + bolinhas + '</span></div>';
    grade.appendChild(el);
  });

  // ----- iscas -----
  var linhaIscas = $('iscasLinha');
  ISCAS.forEach(function (b, i) {
    var f = document.createElement('figure');
    f.style.animationDelay = (i * 0.25) + 's';
    f.innerHTML = '<img src="img/bait/' + b[0] + '.png" alt="' + b[1] + '"><figcaption>' + b[1] + '</figcaption>';
    linhaIscas.appendChild(f);
  });

  // ----- cardume: faixa de peixes nadando (duas cópias para dar a volta sem emenda) -----
  var trilho = $('cardume'), html = '';
  for (var c = 0; c < 2; c++) {
    PEIXES.concat(PEIXES).forEach(function (p, i) {
      html += '<img class="px" src="img/fish/' + p.img + '.png" alt="" style="animation-delay:' + (i * -0.37) + 's">';
    });
  }
  trilho.innerHTML = html;

  // ----- logo: letras caindo uma a uma -----
  document.querySelectorAll('#logoTexto span').forEach(function (linha, n) {
    var txt = linha.textContent;
    linha.textContent = '';
    linha.setAttribute('aria-label', txt);
    txt.split('').forEach(function (ch, i) {
      var s = document.createElement('em');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.setAttribute('data-t', s.textContent);
      s.style.animationDelay = (0.15 + n * 0.35 + i * 0.05) + 's';
      linha.appendChild(s);
    });
  });

  // ----- revelar ao rolar a página -----
  var revelaveis = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (itens) {
      itens.forEach(function (it) {
        if (it.isIntersecting) { it.target.classList.add('visivel'); obs.unobserve(it.target); }
      });
    }, { threshold: 0.12 });
    revelaveis.forEach(function (el, i) {
      el.style.transitionDelay = (i % 3) * 90 + 'ms';
      obs.observe(el);
    });
  } else {
    revelaveis.forEach(function (el) { el.classList.add('visivel'); });
  }

  // ----- números contando quando aparecem -----
  document.querySelectorAll('[data-conta]').forEach(function (el) {
    var fim = +el.getAttribute('data-conta'), feito = false;
    new IntersectionObserver(function (it) {
      if (!it[0].isIntersecting || feito) return;
      feito = true;
      var ini = performance.now();
      (function passo(ms) {
        var t = Math.min(1, (ms - ini) / 1200);
        el.textContent = Math.round(fim * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(passo);
      })(ini);
    }, { threshold: 0.5 }).observe(el);
  });

  // ----- menu sólido, parallax do topo e linha de pesca da rolagem -----
  var nav = $('nav'), heroAgua = $('heroAgua'), linha = $('linhaRolagem'), anzol = $('anzolRolagem');
  // Tudo aqui mexe só em transform (não obriga o navegador a refazer o layout da página),
  // e no máximo uma vez por quadro.
  var pedido = false, totalRolagem = 0;
  function medirRolagem() { totalRolagem = document.documentElement.scrollHeight - window.innerHeight; }
  function aoRolar() {
    pedido = false;
    var y = window.scrollY;
    nav.classList.toggle('solido', y > 60);
    if (y < window.innerHeight) heroAgua.style.transform = 'translate3d(0,' + (y * 0.3) + 'px,0) scale(1.08)';
    var f = totalRolagem > 0 ? Math.min(1, y / totalRolagem) : 0;
    linha.style.transform = 'scaleY(' + f + ')';
    anzol.style.transform = 'translate3d(0,' + (f * window.innerHeight) + 'px,0)';
  }
  window.addEventListener('scroll', function () {
    if (!pedido) { pedido = true; requestAnimationFrame(aoRolar); }
  }, { passive: true });
  window.addEventListener('resize', function () { medirRolagem(); aoRolar(); });
  window.addEventListener('load', medirRolagem);
  medirRolagem();
  aoRolar();

  // ----- cartões que inclinam seguindo o mouse -----
  document.querySelectorAll('.peixe, .recurso, .spot, .vista').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = 'perspective(700px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg) translateY(-4px)';
      el.style.setProperty('--mx', (x + 0.5) * 100 + '%');
      el.style.setProperty('--my', (y + 0.5) * 100 + '%');
    });
    el.addEventListener('mouseleave', function () { el.style.transform = ''; });
  });

  // ----- cenas da briga, com a arte do jogo (js/briga.js) -----
  if (window.Briga) {
    // Topo: o rio visto de cima, com peixes passando.
    new window.Briga(heroAgua, { enfeites: 7 }).iniciar();
    // Logo: o salto do dourado da briga.
    window.SaltoLogo($('saltoLogo'));
    // Cartão 3 das vistas.
    new window.Briga($('brigaCard'), { briga: true, enfeites: 2 }).iniciar();
    // Palco grande com o HUD.
    var nomes = { corre: 'CORRENDO! TOMANDO LINHA', sacode: 'SE SACUDINDO!', descansa: 'RECOLHENDO...',
                  cansado: 'CANSOU! TRAZ PRO BARRANCO', salto: 'SALTOU!', pego: 'NO PASSAGUÁ!' };
    var hudEstado = $('hudEstado'), hudTensao = $('hudTensao'), hudDist = $('hudDist'), hudPeixe = $('hudPeixe');
    var ultimoModo = '', ultimaDist = '', ultimoPeixe = '', ultimoPerigo = false;
    new window.Briga($('brigaGrande'), {
      briga: true, enfeites: 4,
      aoMudar: function (e) {
        if (e.modo !== ultimoModo) {
          ultimoModo = e.modo;
          hudEstado.textContent = nomes[e.modo] || '';
          hudEstado.className = 'hud-estado ' + e.modo;
          hudEstado.classList.remove('pop'); void hudEstado.offsetWidth; hudEstado.classList.add('pop');
        }
        var t = Math.min(1, e.tensao);
        hudTensao.style.transform = 'scaleY(' + t.toFixed(3) + ')';
        var perigo = t > 0.85;
        if (perigo !== ultimoPerigo) { ultimoPerigo = perigo; hudTensao.parentNode.classList.toggle('perigo', perigo); }
        // Texto só muda quando o número muda (trocar texto a cada quadro pesa).
        var dist = Math.max(0, e.dist).toFixed(0) + ' m';
        if (dist !== ultimaDist) { ultimaDist = dist; hudDist.textContent = dist; }
        var peixe = 'Dourado ' + e.kg.toFixed(1).replace('.', ',') + ' kg';
        if (peixe !== ultimoPeixe) { ultimoPeixe = peixe; hudPeixe.textContent = peixe; }
      }
    }).iniciar();
  }

  // ----- partículas: vaga-lumes dourados e pólen subindo -----
  var cv = $('particulas'), cx = cv.getContext('2d'), pts = [];
  function medir() {
    var r = cv.getBoundingClientRect();
    cv.width = r.width; cv.height = r.height;
  }
  medir(); window.addEventListener('resize', medir);
  for (var i = 0; i < 46; i++) {
    pts.push({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05,
               f: Math.random() * 6, t: Math.random() < 0.7 ? 3 : 5,
               c: Math.random() < 0.6 ? '#ffe27a' : '#b6f06a' });
  }
  var ult = 0;
  function particulas(ms) {
    var dt = Math.min((ms - ult) / 1000, 0.1); ult = ms;
    cx.clearRect(0, 0, cv.width, cv.height);
    pts.forEach(function (p) {
      p.y -= p.v * dt; p.f += dt * 2;
      if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      cx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(p.f));
      cx.fillStyle = p.c;
      var s = p.t * (cv.width > 700 ? 1.4 : 1);
      // posição presa à grade de 4 px para parecer pixel de verdade
      var px = Math.round((p.x * cv.width + Math.sin(p.f * .6) * 20) / 4) * 4;
      var py = Math.round(p.y * cv.height / 4) * 4;
      cx.fillRect(px, py, s, s);
    });
    if (particulasLigadas) requestAnimationFrame(particulas);
  }
  var particulasLigadas = false;
  new IntersectionObserver(function (it) {
    var ver = it[0].isIntersecting;
    if (ver && !particulasLigadas) { particulasLigadas = true; ult = performance.now(); requestAnimationFrame(particulas); }
    if (!ver) particulasLigadas = false;
  }).observe(cv);
})();
