/* ==========================================================================
   O POUSO — o pássaro chega voando e assenta na marca
   Mesmo desenho da Vila Botané, servido como módulo para quem quiser ver o voo
   sobre uma marca qualquer. Quem chama diz onde é a marca; nada aqui procura
   elementos na página sozinho.
   ========================================================================== */
export function criaVoo(o) {
  var marca = o.marca, linha = o.linha, cor = o.cor, ave = o.ave;
  var paradaLinha = o.paradaLinha != null ? o.paradaLinha : 1;
  if (!marca || !linha || !cor || !ave) return null;


    /* os 71 recortes do vídeo, quadros 37 a 107, tocados uma única vez, na ordem,
       do primeiro ao último — sem laço nenhum. Do 87 em diante são os quadros 21 a 1
       ao contrário: o disco volta a se fechar em torno do pássaro pousado. */
    var DE = 37, TOTAL = 71, FPS = 9, POUSADO = TOTAL - 1, DISCO = 87;
    var SRC = './img/voo-video/ciclo2/';
    /* os 71 quadros vivem empilhados dentro do pássaro, um por camada: trocar de
       quadro é só acender uma e apagar a outra. Trocar a imagem de fundo fazia o
       navegador decodificar na hora e o bicho sumia entre um quadro e outro. */
    var qAtual = 0, camadas = [];
    for (var pk = 0; pk < TOTAL; pk++) {
      var im = document.createElement('img');
      im.src = SRC + 'f' + (DE + pk) + '.png';
      im.alt = ''; im.decoding = 'sync';
      im.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;pointer-events:none';
      if (im.decode) im.decode().catch(function () {});
      ave.appendChild(im);
      camadas.push(im);
    }
    function quadro(n) {
      if (camadas[qAtual]) camadas[qAtual].style.opacity = '0';
      qAtual = n;
      if (camadas[n]) camadas[n].style.opacity = '1';
    }

    function amostra(A, B, C, D) {
      var p = [[2*A[0]-B[0], 2*A[1]-B[1]], A, B, C, D, [2*D[0]-C[0], 2*D[1]-C[1]]];
      var out = [], N = 200, s, i;
      for (s = 1; s < p.length - 2; s++) {
        var p0 = p[s-1], p1 = p[s], p2 = p[s+1], p3 = p[s+2];
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
        acc[i] = acc[i-1] + Math.hypot(out[i][0]-out[i-1][0], out[i][1]-out[i-1][1]);
      return { pts: out, acc: acc, total: acc[acc.length-1] || 1 };
    }
    function no(cam, frac) {
      var alvo = frac * cam.total, lo = 0, hi = cam.acc.length - 1, mid;
      while (lo < hi - 1) { mid = (lo + hi) >> 1; if (cam.acc[mid] < alvo) lo = mid; else hi = mid; }
      var seg = (cam.acc[hi] - cam.acc[lo]) || 1, u = (alvo - cam.acc[lo]) / seg;
      var a = cam.pts[lo], b = cam.pts[hi];
      return { x: a[0] + (b[0]-a[0])*u, y: a[1] + (b[1]-a[1])*u,
               ang: Math.atan2(b[1]-a[1], b[0]-a[0]) * 180 / Math.PI };
    }

    /* 37 a 50 vêm da travessia (o bicho no ar, âncora quase parada); do 51 em
       diante são as medidas do pouso. */
    var ANC = [[0.7174,0.4080],[0.7169,0.4055],[0.7156,0.4056],[0.7184,0.4074],[0.7185,0.4073],
      [0.7164,0.4062],[0.7182,0.4036],[0.7166,0.4061],[0.7161,0.4057],[0.7171,0.4070],
      [0.7178,0.4074],[0.7157,0.4056],[0.7184,0.4060],[0.7189,0.4068],
      [0.6773,0.4250],[0.6933,0.4154],[0.6584,0.4308],[0.6599,0.3673],[0.6570,0.3462],
      [0.6512,0.3269],[0.6279,0.2981],[0.6948,0.2673],[0.7253,0.2635],[0.7180,0.2635],[0.6977,0.2654],
      [0.6802,0.2635],[0.6744,0.2654],[0.6890,0.2654],[0.7180,0.2827],[0.7195,0.2846],[0.7311,0.2615],
      [0.7238,0.2615],[0.7282,0.2673],[0.7209,0.2769],[0.7093,0.2731],[0.7529,0.2808],[0.7558,0.3077],
      [0.7587,0.3115],[0.7587,0.3654],[0.7544,0.3692],[0.7456,0.4077],[0.7413,0.4269],[0.7442,0.4423],
      [0.7529,0.4404],[0.7558,0.4385],[0.7544,0.4365],[0.7544,0.4404],[0.7544,0.4442],[0.7544,0.4442],
      [0.7544,0.4442],
      [0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],
      [0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],
      [0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5],[0.5,0.5]];
    var MARCA_AQ = { fx: 0.4362, fy: 0.5447 };

    /* nas células do disco (87 a 107) o desenho está registrado pelo centro do
       disco, não pelo corpo: então a marca é encostada pelo próprio centro. */
    function medida(disco) {
      var r = linha.getBoundingClientRect();
      var h = r.height * 1.46;
      return { w: h * 344 / 260, h: h,
               x: r.left + r.width * (disco ? 0.5 : MARCA_AQ.fx),
               y: r.top + r.height * (disco ? 0.5 : MARCA_AQ.fy) };
    }

    /* o acerto de centro e tamanho dos quadros 37 a 50, medido contra o 51 na
       segunda dobra. Fica aqui gravado; o navegador só sobrepõe se houver
       ajuste novo em curso. */
    var AJU_PADRAO = {
      37: { dx: -57.42, dy:  38.55, s: 1.557 }, 38: { dx: -88.06, dy:  -5.92, s: 1.557 },
      39: { dx: -74.23, dy:   0.43, s: 1.557 }, 40: { dx: -75.35, dy:  34.06, s: 1.557 },
      41: { dx: -70.13, dy:   5.29, s: 1.557 }, 42: { dx: -79.10, dy: -10.41, s: 1.557 },
      43: { dx: -69.01, dy:  16.87, s: 1.557 }, 44: { dx: -66.40, dy:  22.83, s: 1.537 },
      45: { dx: -79.86, dy:   3.39, s: 1.527 }, 46: { dx: -66.79, dy:  18.70, s: 1.503 },
      47: { dx: -63.44, dy:   6.37, s: 1.485 }, 48: { dx: -70.54, dy: -14.19, s: 1.469 },
      49: { dx: -47.00, dy:   2.62, s: 1.469 }, 50: { dx: -44.39, dy: -18.68, s: 1.463 }
    };
    var AJU = AJU_PADRAO;

    var CHEGA = (60 - DE) / FPS;             /* encosta na marca no quadro 60 */
    var DUR = TOTAL / FPS, POUSAR = DUR - CHEGA;

    /* ---------- respingos de aquarela, os mesmos da landpage ----------
       Recortes de verdade da folha de tinta (img/tinta/): a cada batida de asa a
       ave larga duas ou três manchas em rumos diferentes — um sopro para sudoeste
       e noroeste, o seguinte para norte e nordeste, e assim por diante. Cada
       mancha nasce pequena, abre como tinta molhada no papel, escorre um pouco
       para baixo e seca. Nenhuma delas é o pássaro. */
    var TINTAS_ARQ = [16,17,18,19,20,21,22,23,24,25,34,35,36,37,38,39].map(function (n) {
      return './img/tinta/tinta-' + n + '.png';
    });
    var RUMOS = { N: -90, NE: -45, E: 0, SE: 45, S: 90, SO: 135, O: 180, NO: -135 };
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
    var cena = document.createElement('div');
    cena.setAttribute('aria-hidden', 'true');
    cena.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden';
    document.body.appendChild(cena);
    TINTAS_ARQ.forEach(function (u) { var im = new Image(); im.src = u; });
    var vivos = [], batida = 0, ultimoQ = -1;
    function solta(x, y, forca, raio) {
      if (typeof gsap === 'undefined') return;
      var grupo = SOPROS[batida++ % SOPROS.length];
      for (var i = 0; i < grupo.length; i++) {
        var rad = (RUMOS[grupo[i]] + (Math.random() - 0.5) * 26) * Math.PI / 180;
        var dist = raio * (0.62 + Math.random() * 0.8);
        var lado = raio * (0.16 + Math.random() * 0.5);
        var im = document.createElement('img');
        im.src = TINTAS_ARQ[(Math.random() * TINTAS_ARQ.length) | 0];
        im.style.cssText = 'position:absolute;left:0;top:0;will-change:transform,opacity';
        im.style.width = (raio * (0.17 + Math.random() * 0.31) * (0.7 + forca * 0.5)) + 'px';
        cena.appendChild(im);
        vivos.push(im);
        var px = x + Math.cos(rad) * dist, py = y + Math.sin(rad) * dist;
        gsap.set(im, { x: px, y: py, xPercent: -50, yPercent: -50,
                       rotation: Math.random() * 360, scale: 0.34, opacity: 0 });
        (function (el, rd, ld) {
          /* a tinta não seca: a mancha abre, escorre e fica no papel até a
             página virar — quem apaga tudo é o limpaRastro() */
          gsap.timeline()
            .to(el, { opacity: 0.62 + Math.random() * 0.3, scale: 1,
                      duration: 0.16 + Math.random() * 0.12, ease: 'power2.out' })
            .to(el, { x: px + Math.cos(rd) * ld, y: py + Math.sin(rd) * ld + raio * (0.22 + Math.random() * 0.3),
                      scale: 1.12 + Math.random() * 0.22,
                      duration: 0.95 + Math.random() * 0.75, ease: 'power1.in' }, '>-0.04');
        })(im, rad, lado);
      }
    }
    function limpaRastro() {
      vivos.forEach(function (im) {
        if (typeof gsap !== 'undefined') gsap.killTweensOf(im);
        if (im.parentNode) im.parentNode.removeChild(im);
      });
      vivos.length = 0; batida = 0; ultimoQ = -1;
      if (typeof gsap !== 'undefined') gsap.set(cena, { opacity: 1 });
      else cena.style.opacity = '';
    }
    /* acabado o pouso, a tinta que ficou no papel some junto com o pássaro */
    function secaRastro() {
      if (!vivos.length) return;
      if (typeof gsap === 'undefined') { limpaRastro(); return; }
      gsap.to(cena, { opacity: 0, duration: 1.1, ease: 'power1.in', onComplete: limpaRastro });
    }

    /* ---------- o relógio, agora nas mãos do painel ---------- */
    var tt = 0, tocando = false, vel = 1, raf = 0, marcaT = 0;
    var cam = null, base = null, feito = false;
    var travado = false, qFixo = 0, comRastro = true, comDesfecho = true;

    function prepara() {
      var m = medida(), W = window.innerWidth, H = window.innerHeight;
      base = { x: m.x, y: m.y };
      ave.style.width = m.w + 'px'; ave.style.height = m.h + 'px';
      var ix = -m.w * 0.62;
      var iy = Math.min(H * 0.72, H - m.h / 2);
      var subida = iy - m.y;
      cam = amostra([ix,                           iy],
                    [ix + W * 0.26,                iy - subida * 0.40],
                    [Math.max(m.x - W * 0.17, ix), m.y + subida * 0.26],
                    [m.x,                          m.y]);
    }
    prepara();
    window.addEventListener('resize', function () { prepara(); pinta(); });

    function termina() {
      if (feito) return;
      feito = true;
      secaRastro();
      if (!travado) quadro(POUSADO);
      var descorou = false;
      cor.style.transition = 'opacity .5s var(--ease), filter .5s var(--ease)';
      ave.style.transition = 'opacity .4s var(--ease), filter .4s var(--ease)';
      cor.style.filter = 'blur(7px)';
      cor.style.opacity = 1;
      requestAnimationFrame(function () {
        if (descorou) return;
        cor.style.filter = 'blur(0px)';
        ave.style.filter = 'blur(7px)'; ave.style.opacity = 0;
      });
      marcaT = setTimeout(function () {
        descorou = true;
        linha.style.transition = 'opacity .9s var(--ease)';
        cor.style.transition   = 'opacity .9s var(--ease)';
        linha.style.opacity = paradaLinha;
        cor.style.opacity = 0;
        cor.style.filter = 'blur(0px)';
        ave.style.opacity = 0;
        marca.classList.add('is-pousado');
      }, 1000);
    }

    /* um instante inteiro do pouso, desenhado a partir de tt */
    function pinta() {
      if (!cam || !base) prepara();
      var p = Math.min(1, tt / DUR), resta = DUR - tt, fase;
      if (travado) { quadro(qFixo); fase = 'parado na marca'; }
      else {
        quadro(Math.min(POUSADO, Math.floor(tt * FPS)));      /* em sequência, sem laço */
        fase = resta > POUSAR ? 'travessia' : 'pouso';
      }

      var f = Math.min(1, (1 - Math.pow(1 - p, 3)) / (1 - Math.pow(POUSAR / DUR, 3)));
      var pos = no(cam, f), d = medida(DE + qAtual >= DISCO);
      var dx = d.x - base.x, dy = d.y - base.y;
      var chega = Math.min(1, Math.max(0, (tt - (DUR - POUSAR)) / POUSAR));
      var bal = Math.sin(tt * 2 * Math.PI * FPS / 18) * 6 * (1 - chega);
      var esc = 0.84 + 0.16 * f;
      /* do 37 ao 50 o encaixe é o acerto manual, medido contra o 51: por isso eles
         herdam a âncora do 51 e recebem por cima o deslocamento e o tamanho salvos. */
      var iRef = 51 - DE;
      var a = (qAtual < iRef ? ANC[iRef] : ANC[qAtual]) || ANC[POUSADO];
      var aj = (qAtual < iRef && AJU[DE + qAtual]) || { dx: 0, dy: 0, s: 1 };
      var dxp = aj.dx / 344 * d.w, dyp = aj.dy / 260 * d.h;
      var cx, cy, ang;
      /* o desenho já nasce um pouco caído para a frente: 10° no sentido horário
         endireitam o bicho sem mexer no caminho */
      var INCLINA = 10;
      if (travado) {                        /* o sprite encaixado na marca, sem voo */
        cx = d.x; cy = d.y; esc = 1; ang = INCLINA;
      } else {
        cx = Math.min(Math.max(pos.x + dx, -d.w * 0.72), window.innerWidth - d.w/2);
        cy = Math.min(Math.max(pos.y + dy + bal, d.h/2), window.innerHeight - d.h/2);
        ang = pos.ang * 0.5 * (1 - chega) + INCLINA;
      }
      ave.style.transform =
        'translate(' + (cx - d.w/2 + (d.w * (0.5 - a[0]) * aj.s - dxp) * esc) + 'px,' +
                       (cy - d.h/2 + (d.h * (0.5 - a[1]) * aj.s - dyp) * esc) + 'px)' +
        ' rotate(' + ang + 'deg) scale(' + esc + ')' +
        ' translate(' + dxp + 'px,' + dyp + 'px) scale(' + aj.s + ')';
      /* uma batida de asa a cada dois quadros: é aí que a tinta se solta.
         Do quadro 67 em diante o bicho já está freando — a tinta cai pela metade;
         do 80 em diante ele já está pousando e não solta mais nada. */
      if (tocando && comRastro && !travado && chega < 0.92 && qAtual !== ultimoQ) {
        ultimoQ = qAtual;
        var cadaN = (DE + qAtual) >= 67 ? 4 : 2;
        if ((DE + qAtual) < 80 && qAtual % cadaN === 0)
          solta(cx, cy, (1 - chega) * (0.5 + 0.5 * f), d.w * esc * 0.36);
      }

    }

    function laco(ts) {
      raf = 0;
      if (!tocando) return;
      var dt = Math.min(0.05, (ts - laco.ultimo) / 1000);
      laco.ultimo = ts;
      tt = Math.min(DUR, tt + dt * vel);
      pinta();
      if (tt >= DUR) { tocando = false; if (comDesfecho) termina(); pinta(); return; }
      raf = requestAnimationFrame(laco);
    }

    function acorda() { ave.style.transition = ''; ave.style.filter = ''; ave.style.opacity = 1; }


  quadro(0);
  ave.style.opacity = 0;

  function comeca() {
    prepara(); acorda();
    tt = 0; feito = false; tocando = true;
    laco.ultimo = performance.now();
    raf = requestAnimationFrame(laco);
  }
  function desmonta() {
    tocando = false;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(marcaT);
    limpaRastro();
    if (cena.parentNode) cena.parentNode.removeChild(cena);
  }
  return { toca: comeca, termina: termina, limpa: limpaRastro, desmonta: desmonta, dur: DUR };
}
