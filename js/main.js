/* ==========================================================
   VASSOURAS — LANDING PORTAL · main.js
   1. contexto        2. rótulos (Splitting)   3. loader
   4. hover desktop   5. cursor                6. saída
   7. teclado / Esc
   ========================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. CONTEXTO
     ---------------------------------------------------------- */
  var body      = document.body;
  var loader    = document.getElementById('loader');
  var folhas    = loader.querySelectorAll('.loader__folha');
  var selo      = document.getElementById('selo');
  var portas    = Array.prototype.slice.call(document.querySelectorAll('.porta'));
  var saida     = document.getElementById('saida');
  var cursor    = document.getElementById('cursor');
  var raiz      = document.documentElement;

  var reduzido  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqDesktop = window.matchMedia('(min-width: 861px) and (hover: hover) and (pointer: fine)');
  var isDesktop = function () { return mqDesktop.matches; };

  var SEAM_BASE  = 50;   /* repouso  */
  var SEAM_ATIVO = 64;   /* metade sob o cursor */

  var seam = { v: SEAM_BASE };

  function aplicaSeam() {
    raiz.style.setProperty('--seam', seam.v + '%');
    if (isDesktop()) {
      portas[0].style.flexBasis = seam.v + '%';
      portas[1].style.flexBasis = (100 - seam.v) + '%';
    }
  }

  function limpaFlex() {
    portas[0].style.flexBasis = '';
    portas[1].style.flexBasis = '';
    seam.v = SEAM_BASE;
    raiz.style.setProperty('--seam', SEAM_BASE + '%');
  }
  mqDesktop.addEventListener('change', function () {
    gsap.killTweensOf(seam);
    limpaFlex();
    portaAtiva = undefined;   /* força a reaplicação do estado de repouso */
    repouso();
  });

  /* ----------------------------------------------------------
     2. RÓTULOS — máscara de letras
     ---------------------------------------------------------- */
  if (window.Splitting) { Splitting({ target: '[data-splitting]', by: 'chars' }); }

  var chars = document.querySelectorAll('.rotulo .char');

  /* ----------------------------------------------------------
     3. LOADER — cortina preta abre em ~1,7s (sem texto)
     ---------------------------------------------------------- */
  function revelaCena() {
    var tl = gsap.timeline();
    tl.to(chars, {
        yPercent: 0, duration: 1.1, ease: 'power3.out', stagger: 0.024
      }, 0)
      .to(selo, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0.15)
      .to('.porta__media', { scale: 1, duration: 1.8, ease: 'power2.out' }, 0);
    return tl;
  }

  function iniciar() {
    body.classList.remove('is-loading');

    if (reduzido) {                       /* sem loader, apenas um fade */
      loader.classList.add('is-done');
      gsap.set(chars, { yPercent: 0 });
      gsap.set('.porta__media', { scale: 1 });
      gsap.fromTo('.portal, .selo', { opacity: 0 }, { opacity: 1, duration: .5, ease: 'none' });
      gsap.set(selo, { opacity: 1 });
      return;
    }

    gsap.set(chars, { yPercent: 118 });

    var tl = gsap.timeline({
      onComplete: function () { loader.classList.add('is-done'); }
    });

    /* tela preta em repouso, depois a cortina se abre — sem texto algum */
    tl.to(folhas[0], { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, .45)
      .to(folhas[1], { yPercent:  100, duration: 1.2, ease: 'expo.inOut' }, .45)
      .add(revelaCena(), .8);
  }

  /* ----------------------------------------------------------
     4. HOVER DESKTOP — a metade sob o cursor se expande
     ---------------------------------------------------------- */
  /* Um único estado da cena: setEstado(porta) expande essa metade,
     setEstado(null) devolve tudo ao repouso. Todos os tweens usam
     overwrite:'auto', então um novo estado sempre mata o anterior. */
  var portaAtiva = null;

  function setEstado(porta) {
    if (reduzido) return;
    if (porta && !isDesktop()) return;
    if (porta === portaAtiva) return;
    portaAtiva = porta;

    var dur   = porta ? .7 : .8;
    var alvo  = !porta ? SEAM_BASE
              : (porta === portas[0] ? SEAM_ATIVO : (100 - SEAM_ATIVO));

    gsap.killTweensOf(seam);
    gsap.to(seam, { v: alvo, duration: dur, ease: 'power3.out',
      overwrite: 'auto', onUpdate: aplicaSeam });

    portas.forEach(function (p) {
      var ativo   = (p === porta);
      var inativo = (porta && !ativo);

      gsap.to(p.querySelector('.porta__media'), {
        scale: ativo ? 1.05 : 1,
        filter: ativo ? 'brightness(1.1)' : 'brightness(1)',
        duration: dur, ease: 'power3.out', overwrite: 'auto'
      });
      gsap.to(p.querySelector('.porta__sombra'), {
        opacity: inativo ? .34 : 0,
        duration: dur, ease: 'power3.out', overwrite: 'auto'
      });
      /* a metade que recua reduz o rótulo, para nunca ser cortada */
      gsap.to(p.querySelector('.rotulo'), {
        scale: ativo ? 1.06 : (inativo ? .82 : 1),
        duration: dur, ease: 'power3.out', overwrite: 'auto'
      });
      gsap.to([p.querySelector('.submarca'), p.querySelector('.deixa')], {
        opacity: ativo ? 1 : 0,
        y: ativo ? 0 : 6,
        duration: ativo ? .6 : .45,
        ease: ativo ? 'power3.out' : 'power2.out',
        stagger: ativo ? .06 : 0,
        overwrite: 'auto'
      });
    });

    if (cursor) {
      gsap.to(cursor, {
        scale: porta ? 2.1 : 1, opacity: porta ? .9 : .55,
        duration: .5, ease: 'power3.out', overwrite: 'auto'
      });
    }
  }

  function ativa(porta)   { setEstado(porta); }  function repouso()      { setEstado(null); }

  portas.forEach(function (porta) {
    porta.addEventListener('mouseenter', function () { ativa(porta); });
    porta.addEventListener('focus',      function () { ativa(porta); });
    porta.addEventListener('blur',       function () { repouso(); });
    porta.addEventListener('click',      function (e) { sair(e, porta); });
  });
  document.getElementById('portal').addEventListener('mouseleave', function () { repouso(); });

  /* ----------------------------------------------------------
     5. CURSOR CUSTOMIZADO — só desktop, cursor real preservado
     ---------------------------------------------------------- */
  if (cursor && !reduzido) {
    var setX = gsap.quickTo(cursor, 'x', { duration: .35, ease: 'power3.out' });
    var setY = gsap.quickTo(cursor, 'y', { duration: .35, ease: 'power3.out' });
    window.addEventListener('mousemove', function (e) {
      if (!isDesktop()) return;
      setX(e.clientX); setY(e.clientY);
      if (gsap.getProperty(cursor, 'opacity') === 0) {
        gsap.to(cursor, { opacity: .55, duration: .4 });
      }
    }, { passive: true });
    window.addEventListener('mouseleave', function () {
      gsap.to(cursor, { opacity: 0, duration: .3 });
    });
  }

  /* ----------------------------------------------------------
     6a. VOO — caminho suave (Catmull-Rom) + ritmo de batidas
     ---------------------------------------------------------- */
  var sprite = document.getElementById('voo');

  function amostraCaminho(A, B, C, D) {
    var pts = [[2*A[0]-B[0], 2*A[1]-B[1]], A, B, C, D, [2*D[0]-C[0], 2*D[1]-C[1]]];
    var out = [], N = 220, s, i;
    for (s = 1; s < pts.length - 2; s++) {
      var p0 = pts[s-1], p1 = pts[s], p2 = pts[s+1], p3 = pts[s+2];
      for (i = 0; i < N; i++) {
        var u = i/N, u2 = u*u, u3 = u2*u;
        out.push([
          0.5*((2*p1[0]) + (-p0[0]+p2[0])*u + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),
          0.5*((2*p1[1]) + (-p0[1]+p2[1])*u + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3)
        ]);
      }
    }
    out.push([D[0], D[1]]);
    var acc = [0];
    for (i = 1; i < out.length; i++)
      acc[i] = acc[i-1] + Math.sqrt(Math.pow(out[i][0]-out[i-1][0],2) + Math.pow(out[i][1]-out[i-1][1],2));
    return { pts: out, acc: acc, total: acc[acc.length-1] || 1 };
  }

  function noCaminho(cam, frac) {
    var alvo = frac * cam.total, lo = 0, hi = cam.acc.length - 1, mid;
    while (lo < hi - 1) { mid = (lo + hi) >> 1; if (cam.acc[mid] < alvo) lo = mid; else hi = mid; }
    var seg = (cam.acc[hi] - cam.acc[lo]) || 1, u = (alvo - cam.acc[lo]) / seg;
    var a = cam.pts[lo], b = cam.pts[hi];
    return { x: a[0] + (b[0]-a[0])*u, y: a[1] + (b[1]-a[1])*u,
             ang: Math.atan2(b[1]-a[1], b[0]-a[0]) * 180 / Math.PI };
  }

  /* o voo em aquarela: 50 recortes numa folha 8 x 7 — os quadros 1 a 50 da
     página "Voo em Aquarela Teste". Os índices 0 a 19 são a volta (ele toma vida
     no galho), 20 a 32 o arranque (o disco se desfaz), e do 33 em diante o voo,
     dezessete quadros que repetem no ar. */
  var QCOLS = 8, QLINHAS = 7, QTOTAL = 50, QFPS = 9, QCICLO = [33, 49], QINICIO = 0;
  /* onde mora o pássaro dentro de cada célula, em fração da célula: x pelo eixo
     do corpo, y pelo miolo escuro. É por esse ponto — e não pelo centro da
     célula — que o sprite encosta na marca, senão a emenda salta.
     Nos índices 20 a 32 a medição crua treme (enquanto o disco existe, a massa
     grossa é o disco), então ali a série é uma rampa suave que termina
     exatamente no valor do ciclo. */
  var QANC = [
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.4236,0.5146],[0.4410,0.5081],[0.4643,0.4995],[0.4952,0.4881],[0.5306,0.4749],
    [0.5674,0.4613],[0.6042,0.4477],[0.6396,0.4345],[0.6705,0.4231],[0.6938,0.4145],[0.7112,0.4080],
    [0.7174,0.4057],
    [0.7174,0.4057],[0.7171,0.4033],[0.7179,0.4082],[0.7174,0.4080],[0.7169,0.4055],[0.7156,0.4056],
    [0.7184,0.4074],[0.7185,0.4073],[0.7164,0.4062],[0.7182,0.4036],[0.7166,0.4061],[0.7161,0.4057],
    [0.7171,0.4070],[0.7178,0.4074],[0.7157,0.4056],[0.7184,0.4060],[0.7189,0.4068]];
  var QMARCA = { fx: 0.4362, fy: 0.5447 };   /* o mesmo ponto em passaro-aquarela.png */
  /* nos quadros 1 a 21 o disco está desenhado na célula, já registrado no centro
     dela: esses encostam pelo CENTRO do disco fixo da marca, não pelo pássaro. */
  var QDISCO = 20;
  var qAtual = 0;
  function quadro(n) {
    if (n > QTOTAL - 1) n = QCICLO[0] + ((n - QCICLO[0]) % (QCICLO[1] - QCICLO[0] + 1));
    qAtual = n;
    var c = n % QCOLS, l = Math.floor(n / QCOLS);
    sprite.style.backgroundPosition = (c * 100 / (QCOLS - 1)) + '% ' + (l * 100 / (QLINHAS - 1)) + '%';
  }

  /* ---------- respingos de aquarela ----------
     Recortes de verdade da folha de tinta (img/tinta/, a página "padroestinta"):
     a cada batida de asa a ave larga duas ou três manchas em rumos diferentes —
     um sopro para sudoeste e noroeste, o seguinte para norte e nordeste, e assim
     por diante. Cada mancha nasce pequena, abre como tinta molhada no papel,
     escorre um pouco para baixo e seca. Nenhuma delas é o pássaro. */
  /* só o azul de água e o verde de folha — nada de ocre nem sépia */
  var TINTAS_ARQ = [16,17,18,19,20,21,22,23,24,25,34,35,36,37,38,39].map(function (n) {
    return 'img/tinta/tinta-' + n + '.png';
  });
  /* os rumos, em graus de tela (y cresce para baixo) */
  var RUMOS = { N: -90, NE: -45, E: 0, SE: 45, S: 90, SO: 135, O: 180, NO: -135 };
  /* cada batida solta um conjunto diferente — o laço dá sete batidas antes de repetir */
  var SOPROS = [
    ['SO', 'NO', 'O'],
    ['N', 'NE', 'E'],
    ['S', 'SE', 'O', 'SO'],
    ['NE', 'SE', 'N'],
    ['NO', 'N', 'SO', 'O'],
    ['S', 'SO', 'SE'],
    ['NE', 'E', 'S'],
    ['NO', 'O', 'S', 'N'],
    ['E', 'SE', 'NE'],
    ['SO', 'S', 'NO']
  ];
  function criaRespingos(z) {
    var cena = document.createElement('div');
    cena.setAttribute('aria-hidden', 'true');
    cena.style.cssText = 'position:fixed;inset:0;z-index:' + z + ';pointer-events:none;overflow:hidden';
    document.body.appendChild(cena);
    TINTAS_ARQ.forEach(function (u) { var im = new Image(); im.src = u; });
    var vivos = [];
    function solta(x, y, forca, raio, batida) {
      var grupo = SOPROS[batida % SOPROS.length];
      for (var i = 0; i < grupo.length; i++) {
        var rad = (RUMOS[grupo[i]] + (Math.random() - 0.5) * 26) * Math.PI / 180;
        var dist = raio * (0.62 + Math.random() * 0.8);
        var lado = raio * (0.16 + Math.random() * 0.5);      /* o quanto ainda voa para fora */
        var im = document.createElement('img');
        im.src = TINTAS_ARQ[(Math.random() * TINTAS_ARQ.length) | 0];
        im.style.cssText = 'position:absolute;left:0;top:0;will-change:transform,opacity';
        var tam = raio * (0.17 + Math.random() * 0.31) * (0.7 + forca * 0.5);   /* metade do que era */
        im.style.width = tam + 'px';
        cena.appendChild(im);
        vivos.push(im);
        var px = x + Math.cos(rad) * dist, py = y + Math.sin(rad) * dist;
        gsap.set(im, { x: px, y: py, xPercent: -50, yPercent: -50,
                       rotation: Math.random() * 360, scale: 0.34, opacity: 0 });
        /* a tinta não seca: a mancha abre, escorre e fica no papel até a página
           virar — quem apaga tudo é o limpa() da troca de página */
        var alvo = 0.62 + Math.random() * 0.3;
        gsap.timeline()
          .to(im, { opacity: alvo, scale: 1, duration: 0.16 + Math.random() * 0.12, ease: 'power2.out' })
          .to(im, { x: px + Math.cos(rad) * lado, y: py + Math.sin(rad) * lado + raio * (0.22 + Math.random() * 0.3),
                    scale: 1.12 + Math.random() * 0.22,
                    duration: 0.95 + Math.random() * 0.75, ease: 'power1.in' }, '>-0.04');
      }
    }
    return { solta: solta, limpa: function () {
      vivos.forEach(function (im) { gsap.killTweensOf(im); if (im.parentNode) im.parentNode.removeChild(im); });
      vivos.length = 0;
    } };
  }
  var respingos = null;

  /* mede a marca na decolagem, larga o galho e solta o pássaro na cena */
  function voar(tl, marca, marcaCor, marcaLinha, quando) {
    if (!sprite || !marca) return 0;
    var galho = marca.querySelector('.marca__galho');
    /* fica parado do quadro 01 ao 22 — 22/QFPS segundos — e do 23 em diante
       é que o voo desloca para a direita */
    var cam = null, dur = 5.30, ESPERA = 22 / 9;
    var larguraEl = 0, alturaEl = 0;                    /* medidos na decolagem */
    var dxD = 0, dyD = 0;                               /* âncora pelo disco da marca */

    tl.add(function () {
      var r = marca.getBoundingClientRect();
      /* o pássaro ocupa 0,685 da altura do quadro (medido nos quadros do voo);
         na marca ele preenche a caixa inteira — daí o quadro ser maior que a marca */
      alturaEl = r.height * 1.46;
      larguraEl = alturaEl * 344 / 260;
      var cx = r.left + r.width  * QMARCA.fx;           /* o pássaro dentro da marca */
      var cy = r.top  + r.height * QMARCA.fy;
      /* enquanto o disco está na célula, a âncora é o centro da marca */
      dxD = r.width  * (0.5 - QMARCA.fx);
      dyD = r.height * (0.5 - QMARCA.fy);
      var W = window.innerWidth, H = window.innerHeight;
      /* o caminho segue a direção em que o bicho está DESENHADO: cima-e-direita,
         sem mergulho inicial. Assim ele voa para onde o corpo aponta. */
      cam = amostraCaminho([cx, cy],
                           [cx + W*0.13, cy - H*0.055],
                           [cx + W*0.42, cy - H*0.145],
                           [W + larguraEl*0.8, H*0.16]);
      sprite.style.width  = larguraEl + 'px';
      sprite.style.height = alturaEl + 'px';
      quadro(QINICIO);
      var a0 = QANC[QINICIO];
      gsap.set(sprite, { opacity: 1, x: cx + dxD + larguraEl * (0.5 - a0[0]), y: cy + dyD + alturaEl * (0.5 - a0[1]),
                         xPercent: -50, yPercent: -50, rotation: 0, scale: 1 });
      if (galho) gsap.set(galho, { opacity: 0 });
      /* o disco fica fora da cena: nunca aparece */
      marca.closest('.porta').classList.add('is-voando');
      var discoFixo = marca.querySelector('.marca__disco');
      if (discoFixo) {
        discoFixo.style.transition = 'none';
        gsap.set(discoFixo, { opacity: 0 });
      }
      gsap.set([marcaCor, marcaLinha], { opacity: 0 });
      /* o voo não larga mais tinta: a cena de respingos fica desligada */
      if (respingos) respingos.limpa();
      /* o laço começa AQUI, no mesmo callback que mediu o caminho: em dois
         callbacks separados o GSAP não garante a ordem, e o primeiro quadro
         podia rodar com o caminho ainda nulo — e aí o rAF morria. */
      dispara();
    }, quando);

    if (galho) {
      tl.set(galho, { opacity: 0 }, quando);
    }

    function dispara() {
      var t0 = performance.now(), qAnt = -1, batida = 0;
      function passo(ts) {
        var tt = (ts - t0) / 1000;
        if (!cam) { requestAnimationFrame(passo); return; }
        var q = QINICIO + Math.floor(tt * QFPS);
        quadro(q);
        var v = Math.max(0, (tt - ESPERA) / (dur - ESPERA));
        if (v > 1) v = 1;
        var f = v * v * (3 - 2 * v);
        var pos = noCaminho(cam, f);
        var k = Math.min(1, v / 0.16); k = k * k * (3 - 2 * k);
        var ciclo = (q - QCICLO[0]) % (QCICLO[1] - QCICLO[0] + 1);
        var sobe = -Math.cos(2 * Math.PI * ciclo / 17) * 7 * k * (1 - 0.5 * f);
        var esc = 1 - 0.28 * f, a = QANC[qAtual] || QANC[QCICLO[0]];
        var eD = qAtual <= QDISCO ? 1 : 0;   /* o disco manda enquanto está na célula */
        gsap.set(sprite, {
          x: pos.x + eD * dxD + larguraEl * (0.5 - a[0]) * esc,
          y: pos.y + sobe + eD * dyD + alturaEl * (0.5 - a[1]) * esc,
          rotation: 0,   /* nada de inclinar: o desenho já aponta para o rumo */
          scale: esc
        });
        /* uma batida de asa a cada quatro ou cinco quadros do ciclo: é aí que
           a tinta se solta, e o rumo muda a cada batida */
        if (q !== qAnt) {
          qAnt = q;
          var cb = (((q - QCICLO[0]) % 17) + 17) % 17;
          if (respingos && v > 0.015 && (cb === 0 || cb === 2 || cb === 4 || cb === 6 || cb === 8 || cb === 10 || cb === 12 || cb === 15))
            respingos.solta(pos.x, pos.y + sobe, k * (1 - 0.35 * f), larguraEl * esc * 0.36, batida++);
        }
        if (tt < dur) requestAnimationFrame(passo);
      }
      requestAnimationFrame(passo);
    }

    return quando + dur;
  }

  /* ----------------------------------------------------------
     6. SAÍDA — cortina na cor dominante da porta, depois navega
     ---------------------------------------------------------- */
  var saindo = false;

  function sair(e, porta) {
    var href = porta.getAttribute('href');
    if (reduzido || saindo) return;            /* movimento reduzido: navegação direta */
    e.preventDefault();
    saindo = true;

    /* a marca da porta ganha cor antes de a cortina fechar */
    var marca      = porta.querySelector('.marca');
    var marcaCor   = marca && marca.querySelector('.marca__cor');
    var marcaLinha = marca && marca.querySelector('.marca__linha');
    var marcaDisco2 = marca && marca.querySelector('.marca__disco');
    var camAgua    = marca && marca.querySelector('.camada--agua');
    var camTopo    = marca && marca.querySelector('.camada--topo');
    var espalha    = !!(camAgua && camTopo);          /* Casa do Lago */
    var pinta      = !espalha && !!marcaCor;          /* Vila Botané  */
    var voa        = pinta && !!sprite;
    var t0         = espalha ? 3.55 : (voa ? 6.60 : (pinta ? .95 : 0));

    var cor = getComputedStyle(raiz)
      .getPropertyValue('--saida-' + porta.dataset.porta).trim() || 'var(--tinta)';
    saida.style.background = cor;
    saida.style.transformOrigin = porta.dataset.porta === 'vinicola' ? 'left' : 'right';

    var tl = gsap.timeline({
      onComplete: function () { window.location.href = href; saindo = false; }
    });

    tl.set(saida, { scaleY: 1, scaleX: 0 });

    if (espalha) {
      /* a cor entra pela base do lago e sobe levada pelas ondas — o filtro de
         ondulação continua rodando, então a frente de cor chega ondulada */
      tl.fromTo(marca.querySelector('.marca__cor-agua'),
                { opacity: .5 }, { opacity: 1, duration: 1.25, ease: 'power1.in' }, .13)
        .fromTo(camAgua, { '--nivel': '0%' },
                { '--nivel': '120%', duration: 1.81, ease: 'none' }, .13)
        /* ao alcançar a parte estática, a cor se abre em raio */
        /* mesma velocidade de avanço da frente de cor que no lago */
        .set(camTopo, { filter: 'url(#aquarela)' }, 0)
        .fromTo(camTopo, { '--raio': '0%' },
                { '--raio': '122%', duration: 2.07, ease: 'none' }, 1.31)
        .to(marca, { scale: 1.04, duration: 3.2, ease: 'power2.out' }, 0)
        .fromTo(marca, { filter: 'drop-shadow(0 2px 9px rgba(18,16,13,.7))' },
                       { filter: 'drop-shadow(0 3px 18px rgba(18,16,13,.72))', duration: 1.5, ease: 'power2.out' }, .75);

      /* a foto vira aquarela na mesma subida: a tinta molha de baixo para cima */
      var aquarelaLago = porta.querySelector('.porta__aquarela');
      if (aquarelaLago) {
        tl.set(aquarelaLago, { '--nivel': '0%' }, 0)
          .to(aquarelaLago, { opacity: 1, duration: .6, ease: 'power1.out' }, .13)
          .to(aquarelaLago, { '--nivel': '132%', duration: 2.5, ease: 'none' }, .13);
      }
    }

    if (pinta) {
      /* o traço se desfaz em desfoque e a aquarela assenta no lugar dele —
         nunca dois desenhos nítidos ao mesmo tempo */
      /* nem disco nem pássaro em aquarela: o traço sai e o voo assume */
      tl.to(marcaLinha, { opacity: 0, filter: 'blur(7px)', duration: .40, ease: 'power2.in' }, 0)
        .fromTo(marca, { filter: 'drop-shadow(0 1px 5px rgba(18,16,13,.55))' },
                       { filter: 'drop-shadow(0 3px 18px rgba(18,16,13,.7))', duration: .7, ease: 'power2.out' }, .2);
      if (voa) voar(tl, marca, marcaCor, marcaLinha, 0);   /* o voo começa no clique */

      /* a foto vira aquarela na mesma subida da irmã: a tinta molha de baixo
         para cima, começando quando o traço vira cor */
      var aquarela = porta.querySelector('.porta__aquarela');
      if (aquarela) {
        tl.set(aquarela, { '--nivel': '0%' }, 0)
          .to(aquarela, { opacity: 1, duration: .6, ease: 'power1.out' }, .26)
          .to(aquarela, { '--nivel': '132%', duration: 2.5, ease: 'none' }, .26);
      }
    }

    tl.to(saida, { scaleX: 1, duration: .85, ease: 'expo.inOut' }, t0)
      .to([porta.querySelector('.rotulo'), porta.querySelector('.submarca'), porta.querySelector('.deixa')],
        { opacity: 0, duration: .4, ease: 'power2.in' }, t0)
      .to(selo, { opacity: 0, duration: .4, ease: 'power2.in' }, t0);
  }

  /* ----------------------------------------------------------
     7. TECLADO — Esc devolve a cena ao repouso
     ---------------------------------------------------------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    repouso();
  });

  /* ---------------------------------------------------------- */
  if (document.readyState === 'complete') { iniciar(); }
  else { window.addEventListener('load', iniciar); }
})();
