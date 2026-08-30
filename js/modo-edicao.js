/* ==========================================================================
   modo-edicao.js — editar a página olhando para a própria página.

   Fica inerte até alguém chegar com ?editar=1. Aí pede o token do GitHub,
   confere se ele tem permissão de gravar no repositório, e só então liga:
   todo texto vira editável no lugar onde ele vive, e toda fotografia e todo
   vídeo passam a aceitar um arquivo novo por cima.

   Nada é gravado enquanto não se aperta Salvar. O que sai daqui é um commit
   no repositório — o conteudo.json com os textos, e os arquivos de mídia em
   img/enviadas. O site relê isso sozinho pelo conteudo.js.

   Não guardamos senha nenhuma: quem autentica é o GitHub, e o token fica
   apenas no navegador de quem entrou.
   ========================================================================== */
(function () {
  'use strict';

  var CHAVE_TOKEN = 'modo-edicao:token';
  var CHAVE_QUANDO = 'modo-edicao:quando';
  /* A senha fica guardada no navegador para não pedir a cada página. Guardada
     para sempre, porém, um computador emprestado continua podendo publicar
     meses depois. Meio dia parado e ela é esquecida. */
  var VALIDADE_H = 12;
  var LIGADO = 'modo-edicao:ligado';
  var PASTA_ENVIADAS = 'img/enviadas';   /* onde a mídia enviada é guardada */
  var LIMITE_MB = 24;          /* acima disso a API do GitHub fica instável */

  if (!window.fetch || !window.localStorage) return;

  /* na prévia a barra muda de cara e o rascunho é a fonte da verdade */
  var naPrevia = /[?&]previa=1/.test(location.search);
  var ARQUIVO_RASCUNHO = 'conteudo-previa.json';

  var querEditar = /[?&]editar=1/.test(location.search) ||
                   sessionStorage.getItem(LIGADO) === '1';
  if (!querEditar) { atalhoDeEntrada(); return; }

  /* quem entrou continua dentro ao navegar entre as páginas do site */
  sessionStorage.setItem(LIGADO, '1');

  var repo = null, ramo = 'main';
  var mudancas = {};           /* caminho -> texto */
  var arquivos = [];           /* { caminho, nome, arquivo, url } */
  var apagados = [];           /* caminhos de vídeo que saem da página */
  var conteudo = null;         /* o conteudo.json inteiro, como está no ar */
  var barra = null, aviso = null;

  /* A bandeira vem antes das duas chamadas. Declarada depois, o `var` era
     içado para cá como undefined, a chamada imediata a punha de pé, e a
     linha `= false` logo abaixo a derrubava outra vez — o DOMContentLoaded
     achava o caminho livre e montava uma segunda tela de login por cima da
     primeira. */
  var jaComecou = false;
  document.addEventListener('DOMContentLoaded', comeca);
  if (document.readyState !== 'loading') comeca();

  function comeca() {
    if (jaComecou) return;
    jaComecou = true;
    estilo();
    lerConfiguracao()
      .then(function () {
        var token = localStorage.getItem(CHAVE_TOKEN);
        if (token && !guardadaAindaVale()) {
          esqueceGuardada();
          return pedeToken('Faz um tempo desde o último acesso. Entre outra vez.');
        }
        if (!token) return pedeToken();
        /* a senha guardada deixou de valer — expirou, ou foi revogada */
        return confere(token).then(function (ok) { return ok ? liga() : pedeToken('Sua sessão expirou. Entre outra vez.'); });
      })
      .catch(function () { pedeToken('Não foi possível entrar agora. Tente de novo em instantes.'); });
  }

  /* ------------------------------------------------------------------
     de onde vem o repositório: do próprio config.yml do painel, para não
     haver dois lugares dizendo a mesma coisa e discordando um dia
     ------------------------------------------------------------------ */
  function lerConfiguracao() {
    return fetch('./admin/config.yml', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('config.yml não respondeu'); return r.text(); })
      .then(function (t) {
        var mr = t.match(/^\s*repo:\s*(\S+)/m);
        var mb = t.match(/^\s*branch:\s*(\S+)/m);
        if (!mr) throw new Error('não achei o repo no config.yml');
        repo = mr[1]; if (mb) ramo = mb[1];
      });
  }

  function api(caminho, opcoes) {
    opcoes = opcoes || {};
    opcoes.headers = Object.assign({
      Authorization: 'Bearer ' + localStorage.getItem(CHAVE_TOKEN),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, opcoes.headers || {});
    marcaUso();
    /* a API responde de cache e já devolveu versão anterior a uma gravação
       feita segundos antes: aqui nenhuma leitura pode vir de prateleira */
    opcoes.cache = 'no-store';
    return fetch('https://api.github.com' + caminho, opcoes);
  }

  function confere(token) {
    localStorage.setItem(CHAVE_TOKEN, token);
    marcaUso();
    return api('/repos/' + repo)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return !!(d && d.permissions && d.permissions.push); })
      .catch(function () { return false; });
  }

  function marcaUso() {
    try { localStorage.setItem(CHAVE_QUANDO, String(Date.now())); } catch (e) {}
  }

  /* A senha guardada vale enquanto estiver em uso. Parada meio dia, é
     esquecida — um computador emprestado deixa de poder publicar sozinho. */
  function guardadaAindaVale() {
    var quando = parseInt(localStorage.getItem(CHAVE_QUANDO) || '0', 10);
    if (!quando) return false;
    return (Date.now() - quando) < VALIDADE_H * 3600 * 1000;
  }

  function esqueceGuardada() {
    try {
      localStorage.removeItem(CHAVE_TOKEN);
      localStorage.removeItem(CHAVE_QUANDO);
    } catch (e) {}
  }

  /* ==================================================================
     a porta

     Uma tela de login comum: nome e senha, e nada na tela que conte de onde
     vem a autorização. Quem trabalha aqui não precisa saber o que é um
     repositório para trocar a foto de um prato.

     O nome é conferido no navegador e por isso não é uma tranca: qualquer um
     lê o código desta página. A tranca é a senha, que o GitHub confere do
     outro lado e sem a qual nada se grava. O nome está aqui para que a porta
     pareça uma porta.
     ================================================================== */
  var DONA = 'rachel_porto';

  function pedeToken(recado) {
    var fundo = document.createElement('div');
    fundo.className = 'me-porta';
    fundo.innerHTML =
      '<form class="me-porta__carta">' +
        '<button class="me-porta__x" type="button" aria-label="Fechar">✕</button>' +
        '<h2>Faça login na sua conta.</h2>' +
        '<p class="me-porta__erro" hidden></p>' +
        '<label class="me-campo"><span>Login</span>' +
          '<input name="login" type="text" autocomplete="username" spellcheck="false" autocapitalize="off"></label>' +
        '<label class="me-campo"><span>Senha</span>' +
          '<input name="senha" type="password" autocomplete="current-password" spellcheck="false"></label>' +
        '<div class="me-porta__pe">' +
          '<button class="me-bt me-bt--forte" type="submit">Entrar</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(fundo);

    var erro = fundo.querySelector('.me-porta__erro');
    var login = fundo.querySelector('[name=login]');
    var senha = fundo.querySelector('[name=senha]');
    if (recado) { erro.textContent = recado; erro.hidden = false; }
    login.focus();

    function recusa(texto) {
      erro.textContent = texto || 'Login ou senha incorretos.';
      erro.hidden = false;
      login.disabled = senha.disabled = false;
      senha.value = '';
      senha.focus();
    }

    fundo.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var nome = (login.value || '').trim().toLowerCase();
      var chave = (senha.value || '').trim();
      if (!nome || !chave) return;
      if (nome !== DONA) { recusa(); return; }
      login.disabled = senha.disabled = true;
      erro.hidden = true;
      confere(chave).then(function (ok) {
        if (!ok) { recusa(); return; }
        fundo.remove();
        liga();
      });
    });

    function sai() {
      sessionStorage.removeItem(LIGADO);
      esqueceGuardada();
      location.href = location.pathname;
    }
    fundo.querySelector('.me-porta__x').addEventListener('click', sai);
    document.addEventListener('keydown', function fecha(e) {
      if (e.key !== 'Escape' || !fundo.parentNode) return;
      document.removeEventListener('keydown', fecha);
      sai();
    });
  }

  /* ==================================================================
     ligar
     ================================================================== */
  /* Na prévia não se edita: olha-se. A página fica exatamente como ficará no
     ar — sem contorno tracejado, sem cursor de texto, sem alça de foto — e a
     única coisa a mais são os dois botões da decisão. Ligar o editor aqui
     seria mostrar a página vestida de canteiro de obras justamente na hora
     de julgar como ela ficou. */
  function liga() {
    if (naPrevia) return baixaConteudo().then(montaBarraDaPrevia);

    document.documentElement.classList.add('me-editando');
    try { document.dispatchEvent(new CustomEvent('modo-edicao:ligado')); } catch (e) {}
    return baixaConteudo().then(function () {
      abreTextos();
      abreMidia();
      abreCarta();
      abreSecoes();
      montaBarra();
      /* o que chega depois — fichas que abrem, listas que o JS monta */
      var relogio = setInterval(function () { abreTextos(); abreMidia(); abreCarta(); abreSecoes(); }, 1200);
      window.addEventListener('beforeunload', function (e) {
        if (!temMudanca()) return;
        e.preventDefault(); e.returnValue = '';
      });
      window.addEventListener('unload', function () { clearInterval(relogio); });
    });
  }

  /* ==================================================================
     A prévia: duas escolhas e nada mais
     ================================================================== */
  function montaBarraDaPrevia() {
    barra = document.createElement('div');
    barra.className = 'me-barra me-barra--decisao me-fora';
    barra.innerHTML =
      '<span class="me-barra__conta">É assim que a página vai ficar.</span>' +
      '<span class="me-barra__acoes">' +
        '<button class="me-bt me-bt--fino" type="button" id="me-volta">Não gostei, voltar</button>' +
        '<button class="me-bt me-bt--forte" type="button" id="me-publica">Confirmar e publicar</button>' +
      '</span>';
    document.body.appendChild(barra);
    aviso = document.createElement('div');
    aviso.className = 'me-fala me-fora';
    document.body.appendChild(aviso);

    barra.querySelector('#me-publica').addEventListener('click', publicaDefinitivo);
    barra.querySelector('#me-volta').addEventListener('click', function () {
      location.href = location.pathname + '?editar=1';
    });
  }

  /* ------------------------------------------------------------------
     O rascunho viaja pela sessão, não pelo site.

     Gravar no repositório não muda o site na mesma hora: o GitHub leva cerca
     de um minuto para republicar. A prévia, aberta um segundo depois de
     salvar, buscava o arquivo servido e recebia a versão anterior — mostrava
     o passado e dizia que era o futuro.

     Por isso o que foi salvo fica também guardado na sessão do navegador e é
     ele que a prévia usa. Instantâneo e exato. Quem abrir o endereço noutro
     aparelho não tem essa cópia e lê o arquivo servido — que a essa altura já
     terá sido republicado.
     ------------------------------------------------------------------ */
  var CHAVE_RASCUNHO = 'modo-edicao:rascunho';

  function guardaNaSessao() {
    try { sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(conteudo)); } catch (e) {}
  }

  function pegaDaSessao() {
    try {
      var t = sessionStorage.getItem(CHAVE_RASCUNHO);
      return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  }

  function baixaConteudo() {
    if (naPrevia) {
      var daSessao = pegaDaSessao();
      if (daSessao) {
        conteudo = daSessao;
        /* a página foi desenhada com o arquivo servido, que pode estar velho:
           reaplica o que acabou de ser salvo, por cima */
        if (window.__aplicaConteudo) window.__aplicaConteudo(conteudo);
        return Promise.resolve();
      }
    }
    return fetch(naPrevia ? './' + ARQUIVO_RASCUNHO : './conteudo.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { conteudo = d || {}; })
      .catch(function () { conteudo = {}; });
  }

  /* a mesma conta que o conteudo.js faz para procurar — vem de lá, para não
     haver duas versões dela discordando um dia */
  function pagina() {
    return window.__paginaAtual ? window.__paginaAtual()
                                : (location.pathname.split('/').pop() || 'index.html');
  }

  /* ------------------------------------------------------------------
     que trechos são texto de verdade

     Folha: elemento cujo miolo é só texto e marcação em linha. Pego o de
     fora, não o de dentro — editar o parágrafo inteiro, e não cada span
     solto que vive nele.
     ------------------------------------------------------------------ */
  var PROIBIDOS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, SVG:1, PATH:1, IMG:1, VIDEO:1, SOURCE:1,
                    CANVAS:1, INPUT:1, TEXTAREA:1, SELECT:1, OPTION:1, BR:1, HR:1, IFRAME:1 };

  /* Uma quebra de linha não parte o texto em dois textos: ela é o texto.
     `<br>` está na lista dos que nunca se abrem — não há o que escrever
     dentro de um — mas como filho ele é bem-vindo, e um parágrafo de três
     linhas continua sendo um parágrafo. O `<hr>`, esse sim, separa. */
  var PASSAM = { BR: 1, WBR: 1 };

  function ehFolha(el) {
    for (var i = 0; i < el.children.length; i++) {
      var f = el.children[i];
      if (PASSAM[f.tagName]) continue;
      if (PROIBIDOS[f.tagName]) return false;
      var d = getComputedStyle(f).display;
      if (d.indexOf('inline') === 0 || d === 'none' || d === 'contents') continue;
      /* O texto que só o leitor de tela ouve — .sr-only — é um span de um
         pixel, fora de fluxo, que o navegador chama de bloco. Ele não parte
         o parágrafo em dois: a frase continua sendo uma frase. */
      var caixa = f.getBoundingClientRect();
      if (caixa.width <= 2 && caixa.height <= 2) continue;
      return false;
    }
    return true;
  }

  function abreTextos() {
    var todos = document.querySelectorAll('body *:not(.me-fora *):not(.me-fora)');
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i];
      if (el.hasAttribute('data-me')) continue;
      if (PROIBIDOS[el.tagName]) continue;
      if (el.closest('svg, .me-fora, [data-nao-editar]')) continue;
      /* O que está fechado não se mede: numa ficha escondida todo filho é
         display:none, e o cartão inteiro passaria por uma frase só. A
         varredura volta a cada segundo — quando abrir, ele entra certo. */
      if (!el.getClientRects().length) continue;
      if (!ehFolha(el)) continue;
      var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      if (txt.length < 3 && !/[0-9a-zà-ú]/i.test(txt)) continue;   /* separadores: ·  —  + */
      /* o de fora manda: se algum ancestral já é editável, este fica quieto —
         edita-se o parágrafo, não cada palavra grifada dentro dele */
      if (el.parentNode && el.parentNode.closest && el.parentNode.closest('[data-me]')) continue;
      abreUm(el);
    }
  }

  /* Só se abre o que se sabe endereçar. As galerias duplicam os seus itens
     para rodar sem emenda, e a cópia carrega o mesmo id do original: o
     endereço das duas é o mesmo e aponta para a primeira. Editar a cópia
     seria escrever num papel que ninguém vai ler. */
  function enderecavel(el, caminho) {
    return !!caminho && (!window.__porCaminho || window.__porCaminho(caminho) === el);
  }

  function abreUm(el) {
    var caminho = window.__caminhoDe ? window.__caminhoDe(el) : '';
    if (!enderecavel(el, caminho)) return;
    el.setAttribute('data-me', caminho);
    el.setAttribute('contenteditable', 'plaintext-only');
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    var comoEstava = el.innerHTML;

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
      if (e.key === 'Escape') { el.innerHTML = comoEstava; delete mudancas[caminho]; el.blur(); pinta(); }
      e.stopPropagation();                      /* o site tem atalhos de teclado próprios */
    });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, t);
    });
    el.addEventListener('input', function () {
      var agora = el.innerHTML;
      if (agora === comoEstava) delete mudancas[caminho]; else mudancas[caminho] = agora;
      pinta();
    });
    /* clicar para escrever, não para navegar */
    el.addEventListener('click', function (e) { if (el.tagName === 'A' || el.closest('a')) e.preventDefault(); });
  }

  /* ------------------------------------------------------------------
     fotografias e vídeos
     ------------------------------------------------------------------ */
  function abreMidia() {
    var midia = document.querySelectorAll('img, video');
    for (var i = 0; i < midia.length; i++) {
      var el = midia[i];
      if (el.hasAttribute('data-me-midia')) continue;
      if (el.closest('.me-fora, [data-nao-editar]')) continue;
      var fonte = el.tagName === 'VIDEO'
        ? ((el.querySelector('source') || el).getAttribute('src') || '')
        : (el.getAttribute('src') || '');
      /* o voo do pássaro são 71 quadros de uma animação só, não 71 fotos */
      if (fonte.indexOf('voo-video') !== -1) continue;
      /* medir pelo que está na tela: <video> costuma não trazer width nem
         height escritos, e pelo atributo todos eles pareceriam do tamanho
         de um alfinete e ficariam de fora */
      var tam = el.getBoundingClientRect();
      if (el.tagName === 'IMG' && tam.width < 40 && tam.height < 40) continue;
      var caminho = window.__caminhoDe ? window.__caminhoDe(el) : '';
      if (!enderecavel(el, caminho)) continue;
      el.setAttribute('data-me-midia', caminho);
    }
  }

  /* ------------------------------------------------------------------
     Os controles da mídia flutuam por cima, presos ao corpo da página.

     Antes eles eram enfiados dentro da moldura de cada foto, e a moldura
     que não fosse posicionada tinha de virar `position:relative` para
     segurá-los — mexer nisso é mexer no layout de quem mora ali dentro.
     Um vídeo de fundo não pode sair do lugar porque alguém entrou no modo
     de edição. Agora nada é inserido na página: o painel é um só, mora no
     fim do corpo e se coloca sobre o que estiver sob o cursor.
     ------------------------------------------------------------------ */
  var painel = null, sobQuem = null, somem = 0;

  function controles() {
    if (painel) return painel;
    painel = document.createElement('div');
    painel.className = 'me-controles me-fora';
    document.body.appendChild(painel);
    painel.addEventListener('pointerenter', function () { clearTimeout(somem); });
    painel.addEventListener('pointerleave', agendaSumico);
    addEventListener('scroll', function () { if (sobQuem) coloca(sobQuem); }, { passive: true });
    addEventListener('resize', function () { if (sobQuem) coloca(sobQuem); });
    return painel;
  }

  function agendaSumico() {
    clearTimeout(somem);
    somem = setTimeout(function () {
      if (painel) painel.classList.remove('is-viva');
      sobQuem = null;
    }, 260);
  }

  /* No meio da moldura, quando o ponteiro caiu na própria mídia. Junto ao
     alto dela, quando a mídia estava enterrada sob um véu e um texto: ali o
     texto ocupa o centro, e o painel no meio taparia justamente o que a
     pessoa talvez queira escrever. */
  function coloca(el, enterrada) {
    var r = el.getBoundingClientRect();
    var alto = window.innerHeight || 800, largo = window.innerWidth || 1200;
    var meio = enterrada ? Math.max(r.top, 0) + 46 : r.top + r.height / 2;
    var y = Math.min(Math.max(meio, 60), alto - 60);
    var x = Math.min(Math.max(r.left + r.width / 2, 110), largo - 110);
    painel.style.left = Math.round(x) + 'px';
    painel.style.top = Math.round(y) + 'px';
  }

  function mostraControles(el, enterrada) {
    clearTimeout(somem);
    var p = controles();
    if (sobQuem !== el) {
      sobQuem = el;
      p.innerHTML = '';
      var video = el.tagName === 'VIDEO';
      var apagado = el.classList.contains('me-apagada');
      if (!apagado) p.appendChild(botao(video ? 'Trocar vídeo' : 'Trocar foto', function () { escolhe(el); }));
      if (video) {
        p.appendChild(botao(apagado ? 'Manter vídeo' : 'Excluir vídeo', function () { apagaVideo(el); }, !apagado));
      }
    }
    coloca(el, enterrada);
    p.classList.add('is-viva');
  }

  function botao(texto, aoClicar, perigo) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'me-bt me-bt--mini' + (perigo ? ' me-bt--perigo' : '');
    b.textContent = texto;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); aoClicar(); });
    return b;
  }

  /* O painel segue o ponteiro sem que nada precise ser ligado elemento a
     elemento: quem chega depois já está coberto.

     Nem toda fotografia recebe o ponteiro, porém. As duas do convite, no pé
     do cardápio, vivem sob um véu e sob o próprio texto — o ponteiro para
     quatro camadas antes de chegar nelas, e o painel nunca saberia que há
     uma foto ali. Quando o alvo direto não é mídia, olhamos a pilha inteira
     daquele ponto e pegamos a primeira que for. */
  var ultimaVarredura = 0;

  function midiaSob(x, y) {
    if (!document.elementsFromPoint) return null;
    var pilha = document.elementsFromPoint(x, y);
    for (var i = 0; i < pilha.length; i++) {
      var e = pilha[i];
      if (!e || !e.closest) continue;
      if (e.closest('.me-fora')) continue;          /* o próprio painel não conta */
      if (e.hasAttribute && e.hasAttribute('data-me-midia')) return e;
    }
    return null;
  }

  document.addEventListener('pointerover', function (e) {
    if (!document.documentElement.classList.contains('me-editando')) return;
    var alvo = e.target && e.target.closest ? e.target.closest('[data-me-midia]') : null;
    if (alvo) { mostraControles(alvo, false); return; }
    if (e.target && e.target.closest && e.target.closest('.me-controles')) return;

    /* a varredura da pilha é mais cara que um closest: uma a cada 120 ms basta
       para a mão humana, e não pesa ao atravessar a página */
    var agora = (window.performance && performance.now) ? performance.now() : 0;
    if (agora - ultimaVarredura > 120) {
      ultimaVarredura = agora;
      var enterrada = midiaSob(e.clientX, e.clientY);
      if (enterrada) { mostraControles(enterrada, true); return; }
    } else if (sobQuem) {
      return;                                       /* segura o painel entre varreduras */
    }
    agendaSumico();
  });

  function escolhe(el) {
    var caminho = el.getAttribute('data-me-midia');
    var campo = document.createElement('input');
    campo.type = 'file';
    campo.accept = el.tagName === 'VIDEO' ? 'video/mp4,video/*' : 'image/*';
    campo.addEventListener('change', function () {
      var arq = campo.files && campo.files[0];
      if (!arq) return;
      if (!arquivoAceito(arq)) { recusaArquivo(arq); return; }
      if (arq.size > LIMITE_MB * 1048576) {
        fala('Esse arquivo tem ' + (arq.size / 1048576).toFixed(1) + ' MB. O limite aqui é ' +
             LIMITE_MB + ' MB — acima disso o envio falha. Comprima antes.', true);
        return;
      }
      var url = URL.createObjectURL(arq);
      if (el.tagName === 'VIDEO') {
        var f = el.querySelector('source');
        if (f) f.setAttribute('src', url); else el.setAttribute('src', url);
        el.load(); var t = el.play(); if (t && t.catch) t.catch(function () {});
      } else {
        el.setAttribute('src', url);
        el.removeAttribute('srcset');
      }
      el.classList.remove('me-apagada');
      apagados = apagados.filter(function (c) { return c !== caminho; });
      arquivos = arquivos.filter(function (a) { return a.caminho !== caminho; });
      arquivos.push({ caminho: caminho, nome: nomeLimpo(arq.name), arquivo: arq, url: url });
      el.classList.add('me-trocada');
      sobQuem = null;
      pinta();
    });
    campo.click();
  }

  /* Excluir aqui é marcar, não arrancar: enquanto não se salva, dá para
     voltar atrás no mesmo botão. Quem arranca de verdade é o conteudo.js,
     na página publicada. */
  function apagaVideo(el) {
    var caminho = el.getAttribute('data-me-midia');
    if (el.classList.contains('me-apagada')) {
      el.classList.remove('me-apagada');
      apagados = apagados.filter(function (c) { return c !== caminho; });
    } else {
      el.classList.add('me-apagada');
      el.classList.remove('me-trocada');
      arquivos = arquivos.filter(function (a) { return a.caminho !== caminho; });
      if (apagados.indexOf(caminho) === -1) apagados.push(caminho);
    }
    sobQuem = null;
    mostraControles(el);
    pinta();
  }

  /* ==================================================================
     a carta: acrescentar e tirar pratos

     Os pratos vivem no HTML, e o conteudo.json é a camada por cima. Tirar
     um prato é deixar um recado dizendo que ele não vai mais à mesa;
     acrescentar é guardar a receita inteira nesse recado. Assim a carta
     muda sem que ninguém precise abrir o código, e a montagem do site não
     desfaz o que foi decidido aqui.
     ================================================================== */
  var CATEGORIAS = [
    { chave: 'entradas',    nome: 'Entrada' },
    { chave: 'principais',  nome: 'Principal' },
    { chave: 'doces',       nome: 'Sobremesa' },
  ];
  var removidos = [];          /* ids de pratos que saem da carta */
  var novos = [];              /* receitas acrescentadas nesta sessão */
  var chefFora = [];           /* ids de menus do chef que saem */
  var chefNovos = [];          /* menus do chef acrescentados */

  /* Duas espécies de cartão moram na mesma grade e obedecem ao mesmo filtro.
     O que muda entre elas é o atributo que as identifica, a lista onde as
     decisões são guardadas e o formulário que as cria. O resto — o botão de
     excluir, o tijolo de acrescentar, o desfazer antes de salvar — é igual,
     e por isso é escrito uma vez só. */
  var ESPECIES = {
    prato: {
      atributo: 'data-prato-id', seletor: '.cartao[data-prato-id]:not(.cartao--chef)',
      rotulo: 'Novo prato', cats: ['entradas', 'principais', 'doces'],
      pergunta: 'prato', guardados: 'pratosNovos',
      sessao: function () { return novos; }, poeSessao: function (v) { novos = v; },
      saem: function () { return removidos; },
      formulario: function () { formularioDePrato(); },
    },
    chef: {
      atributo: 'data-chef-id', seletor: '.cartao--chef[data-chef-id]',
      rotulo: 'Novo menu do chef', cats: ['chef'],
      pergunta: 'menu do chef', guardados: 'chefNovos',
      sessao: function () { return chefNovos; }, poeSessao: function (v) { chefNovos = v; },
      saem: function () { return chefFora; },
      formulario: function () { formularioDeChef(); },
    },
  };

  function grade() { return document.querySelector('.pratos'); }

  function abreCarta() {
    var g = grade();
    if (!g) return;
    for (var chave in ESPECIES) {
      if (!Object.prototype.hasOwnProperty.call(ESPECIES, chave)) continue;
      var e = ESPECIES[chave];
      var cartoes = g.querySelectorAll(e.seletor);
      for (var i = 0; i < cartoes.length; i++) {
        if (cartoes[i].querySelector('.me-excluir')) continue;
        poeExcluir(cartoes[i], e);
      }
      if (!g.querySelector('.me-novo[data-especie="' + chave + '"]')) poeNovo(g, chave, e);
    }
    arrumaTijolos();
  }

  function poeExcluir(cartao, especie) {
    var bt = document.createElement('button');
    bt.type = 'button';
    bt.className = 'me-excluir me-fora';
    bt.textContent = 'Excluir';
    bt.title = 'Tirar este ' + especie.pergunta + ' da carta';
    if (getComputedStyle(cartao).position === 'static') cartao.classList.add('me-relativo');
    cartao.appendChild(bt);
    bt.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var id = cartao.getAttribute(especie.atributo);
      var nome = (cartao.querySelector('h3') || {}).textContent || 'este ' + especie.pergunta;
      if (!confirm('Tirar “' + nome.trim() + '” da carta?\n\nSome do site quando você salvar. Para voltar atrás depois, é preciso me chamar.')) return;
      /* se foi acrescentado aqui, some sem deixar recado */
      var eraNovo = false;
      especie.poeSessao(especie.sessao().filter(function (p) {
        if (p.id === id) { eraNovo = true; return false; }
        return true;
      }));
      var guardados = (conteudo[especie.guardados] || []).filter(function (p) { return p.id === id; }).length > 0;
      if (guardados) {
        conteudo[especie.guardados] = (conteudo[especie.guardados] || []).filter(function (p) { return p.id !== id; });
        eraNovo = true;
      }
      var saem = especie.saem();
      if (!eraNovo && saem.indexOf(id) === -1) saem.push(id);
      cartao.remove();
      pinta();
    });
  }

  function poeNovo(g, chave, especie) {
    var tijolo = document.createElement('button');
    tijolo.type = 'button';
    tijolo.className = 'me-novo me-fora';
    tijolo.setAttribute('data-especie', chave);
    tijolo.innerHTML = '<span class="me-novo__mais" aria-hidden="true">+</span><span>' + especie.rotulo + '</span>';
    g.appendChild(tijolo);
    tijolo.addEventListener('click', function (e) { e.preventDefault(); especie.formulario(); });
  }

  /* cada tijolo só aparece na aba a que ele pertence: não faz sentido
     oferecer "novo prato" enquanto se olha o menu do chef */
  function arrumaTijolos() {
    var cat = catChave();
    var tijolos = document.querySelectorAll('.me-novo[data-especie]');
    for (var i = 0; i < tijolos.length; i++) {
      var e = ESPECIES[tijolos[i].getAttribute('data-especie')];
      tijolos[i].hidden = !e || e.cats.indexOf(cat) === -1;
    }
  }

  function catChave() {
    var apertado = document.querySelector('.filtros button[aria-pressed="true"]');
    return apertado ? apertado.getAttribute('data-cat') : 'entradas';
  }

  function catAtual() {
    var chave = catChave();
    for (var i = 0; i < CATEGORIAS.length; i++) if (CATEGORIAS[i].chave === chave) return CATEGORIAS[i];
    return CATEGORIAS[0];
  }

  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('.filtros button')) setTimeout(arrumaTijolos, 0);
  });
  document.addEventListener('carta:mudou', arrumaTijolos);

  function formularioDePrato() {
    var atual = catAtual();
    var fundo = document.createElement('div');
    fundo.className = 'me-porta me-fora';
    fundo.innerHTML =
      '<form class="me-porta__carta me-porta__carta--larga">' +
        '<p class="me-porta__olho">Carta</p>' +
        '<h2>Novo prato</h2>' +
        '<label class="me-campo"><span>Nome</span><input name="nome" required maxlength="90"></label>' +
        '<label class="me-campo"><span>Categoria</span><select name="cat">' +
          CATEGORIAS.map(function (c) {
            return '<option value="' + c.chave + '"' + (c.chave === atual.chave ? ' selected' : '') + '>' + c.nome + '</option>';
          }).join('') +
        '</select></label>' +
        '<label class="me-campo"><span>Subtítulo <em>opcional</em></span><input name="sub" maxlength="60" placeholder="2 unidades"></label>' +
        '<label class="me-campo"><span>Descrição</span><textarea name="desc" rows="4" maxlength="600"></textarea></label>' +
        '<label class="me-campo"><span>Notas <em>uma por linha</em></span><textarea name="notas" rows="3" maxlength="300"></textarea></label>' +
        '<div class="me-campo me-campo--par">' +
          '<label><span>Preço <em>opcional</em></span><input name="preco" maxlength="20" placeholder="R$ 48"></label>' +
          '<label><span>Quantidade <em>opcional</em></span><input name="qtd" maxlength="20"></label>' +
        '</div>' +
        '<label class="me-campo"><span>Fotografia</span><input name="foto" type="file" accept="image/*"></label>' +
        '<div class="me-porta__pe">' +
          '<button class="me-bt me-bt--forte" type="submit">Pôr na carta</button>' +
          '<button class="me-bt me-bt--fino" type="button" data-fecha>Cancelar</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(fundo);
    var form = fundo.querySelector('form');
    form.querySelector('[name=nome]').focus();
    fundo.querySelector('[data-fecha]').addEventListener('click', function () { fundo.remove(); });
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fundo.remove(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { return (form.querySelector('[name=' + n + ']').value || '').trim(); };
      var nome = v('nome');
      if (!nome) return;
      var arq = form.querySelector('[name=foto]').files[0] || null;
      if (arq && !arquivoAceito(arq)) { recusaArquivo(arq); return; }
      if (arq && arq.size > LIMITE_MB * 1048576) {
        fala('A fotografia tem ' + (arq.size / 1048576).toFixed(1) + ' MB. O limite é ' + LIMITE_MB + ' MB.', true);
        return;
      }
      var cat = v('cat');
      var catNome = (CATEGORIAS.filter(function (c) { return c.chave === cat; })[0] || CATEGORIAS[0]).nome;
      var prato = {
        id: 'prato-' + chapa(nome) + '-' + Date.now().toString(36),
        cat: cat, catNome: catNome, nome: nome,
        subtitulo: v('sub'), descricao: v('desc'),
        notas: v('notas').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).join('|'),
        preco: v('preco'), quantidade: v('qtd'),
        foto: ''
      };
      if (arq) {
        prato.foto = PASTA_ENVIADAS + '/' + nomeLimpo(arq.name);
        arquivos.push({ caminho: 'prato:' + prato.id, nome: prato.foto.split('/').pop(), arquivo: arq, url: URL.createObjectURL(arq) });
        prato.fotoLocal = arquivos[arquivos.length - 1].url;
      }
      novos.push(prato);
      poeNaGrade(prato);
      fundo.remove();
      pinta();
      fala('“' + nome + '” entrou na carta. Salve para publicar.');
    });
  }

  function chapa(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'prato';
  }

  /* ------------------------------------------------------------------
     o menu do chef

     Um menu do chef não é um prato: é uma sequência. Tem nome, um numeral
     romano na lombada, uma apresentação, as etapas em ordem e um punhado
     de fotografias que passam sozinhas enquanto se lê. O formulário pede
     isso e nada mais — o "quatro etapas" que aparece no cartão sai da
     contagem das próprias etapas, para nunca discordar delas.
     ------------------------------------------------------------------ */
  var POREXTENSO = ['nenhuma', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis',
                    'sete', 'oito', 'nove', 'dez', 'onze', 'doze'];
  var ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function proximoRomano() {
    var quantos = document.querySelectorAll('.pratos .cartao--chef').length + 1;
    return ROMANOS[quantos] || String(quantos);
  }

  function formularioDeChef() {
    var fundo = document.createElement('div');
    fundo.className = 'me-porta me-fora';
    fundo.innerHTML =
      '<form class="me-porta__carta me-porta__carta--larga">' +
        '<p class="me-porta__olho">Carta</p>' +
        '<h2>Novo menu do chef</h2>' +
        '<label class="me-campo"><span>Nome do menu</span><input name="titulo" required maxlength="80" placeholder="Fogo lento"></label>' +
        '<label class="me-campo"><span>Numeral <em>na lombada do cartão</em></span>' +
          '<input name="numeral" maxlength="8" value="' + proximoRomano() + '"></label>' +
        '<label class="me-campo"><span>Resumo <em>a linha que aparece no cartão</em></span>' +
          '<textarea name="resumo" rows="2" maxlength="300"></textarea></label>' +
        '<label class="me-campo"><span>Apresentação <em>o texto de abertura da sequência</em></span>' +
          '<textarea name="linha" rows="4" maxlength="700"></textarea></label>' +
        '<label class="me-campo"><span>Etapas <em>uma por linha, no formato Nome ~ descrição</em></span>' +
          '<textarea name="etapas" rows="6" maxlength="2000" placeholder="Burrata ~ Tomate assado, rúcula selvagem e pesto de manjericão."></textarea></label>' +
        '<label class="me-campo"><span>Harmonização <em>opcional</em></span><input name="harmonia" maxlength="200"></label>' +
        '<label class="me-campo"><span>Rodapé <em>opcional</em></span><input name="pe" maxlength="200"></label>' +
        '<label class="me-campo"><span>Fotografias <em>uma por etapa, na ordem</em></span>' +
          '<input name="fotos" type="file" accept="image/*" multiple></label>' +
        '<div class="me-porta__pe">' +
          '<button class="me-bt me-bt--forte" type="submit">Pôr na carta</button>' +
          '<button class="me-bt me-bt--fino" type="button" data-fecha>Cancelar</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(fundo);
    var form = fundo.querySelector('form');
    form.querySelector('[name=titulo]').focus();
    fundo.querySelector('[data-fecha]').addEventListener('click', function () { fundo.remove(); });
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fundo.remove(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { return (form.querySelector('[name=' + n + ']').value || '').trim(); };
      var titulo = v('titulo');
      if (!titulo) return;

      var etapas = v('etapas').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
      var quantas = etapas.length;
      var numeral = v('numeral') || proximoRomano();

      var escolhidas = form.querySelector('[name=fotos]').files || [];
      var recusadas = [].filter.call(escolhidas, function (f) { return !arquivoAceito(f); });
      if (recusadas.length) { recusaArquivo(recusadas[0]); return; }
      var pesadas = [].filter.call(escolhidas, function (f) { return f.size > LIMITE_MB * 1048576; });
      if (pesadas.length) {
        fala('Há ' + pesadas.length + (pesadas.length === 1 ? ' fotografia acima' : ' fotografias acima') +
             ' de ' + LIMITE_MB + ' MB. Comprima antes.', true);
        return;
      }

      var menu = {
        id: 'chef-' + chapa(titulo) + '-' + Date.now().toString(36),
        titulo: titulo,
        ordem: 'Menu do chef ' + numeral,
        numeral: numeral,
        etapasNum: (POREXTENSO[quantas] || quantas) + (quantas === 1 ? ' etapa' : ' etapas'),
        resumo: v('resumo'),
        linha: v('linha'),
        etapas: etapas.join('|'),
        harmonia: v('harmonia'),
        pe: v('pe'),
        fotos: ''
      };

      var caminhos = [], locais = [];
      [].forEach.call(escolhidas, function (arq, i) {
        var destino = PASTA_ENVIADAS + '/' + nomeLimpo(arq.name);
        var url = URL.createObjectURL(arq);
        caminhos.push('./' + destino);
        locais.push(url);
        arquivos.push({ caminho: 'chef:' + menu.id + ':' + i, nome: destino.split('/').pop(), arquivo: arq, url: url });
      });
      menu.fotos = caminhos.join('|');
      menu.fotosLocais = locais.join('|');

      chefNovos.push(menu);
      poeChefNaGrade(menu);
      fundo.remove();
      pinta();
      fala('“' + titulo + '” entrou na carta. Salve para publicar.');
    });
  }

  function poeChefNaGrade(m) {
    var g = grade();
    if (!g || !window.__montaChef) return;
    var cartao = window.__montaChef(g, m, m.fotosLocais || '');
    if (!cartao) return;
    var tijolo = g.querySelector('.me-novo');
    if (tijolo) g.insertBefore(cartao, tijolo); else g.appendChild(cartao);
    poeExcluir(cartao, ESPECIES.chef);
    var botao = document.querySelector('.filtros button[data-cat="chef"]');
    if (botao && botao.getAttribute('aria-pressed') !== 'true') botao.click();
    else try { document.dispatchEvent(new CustomEvent('carta:mudou')); } catch (e) {}
    cartao.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* desenha o cartão na página, do mesmo molde dos que já estão lá */
  function poeNaGrade(p) {
    var g = grade();
    if (!g || !window.__montaCartao) return;
    var cartao = window.__montaCartao(g, p, p.fotoLocal || '');
    if (!cartao) return;
    var tijolo = g.querySelector('.me-novo');
    if (tijolo) g.insertBefore(cartao, tijolo); else g.appendChild(cartao);
    poeExcluir(cartao);
    abreMidia();
    /* leva a carta para a categoria do prato que acabou de entrar: seria
       estranho pôr uma sobremesa na carta e continuar olhando as entradas */
    var botao = document.querySelector('.filtros button[data-cat="' + p.cat + '"]');
    if (botao && botao.getAttribute('aria-pressed') !== 'true') botao.click();
    else try { document.dispatchEvent(new CustomEvent('carta:mudou')); } catch (e) {}
    cartao.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ==================================================================
     Subseções

     Um bloco novo na página, feito de escolhas e não de HTML solto: fundo,
     letra, tamanho, imagem e onde ela fica. Quem desenha é o conteudo.js,
     sempre da mesma forma — assim a subseção nasce parecida com o resto do
     site e nada do que se escreve aqui pode desmontar o layout.

     As opções de cor e de letra não são inventadas: são lidas da própria
     página, do :root. Se a paleta da casa mudar, o formulário muda junto.
     ================================================================== */
  var secoesNovas = [];        /* criadas nesta sessão */
  var secoesFora = [];         /* ids retirados */

  var TAMANHOS_NOME = [
    ['peq', 'Pequeno'], ['normal', 'Normal'], ['grande', 'Grande'], ['enorme', 'Muito grande']
  ];
  var LARGURAS_NOME = [
    ['peq', 'Pequena'], ['media', 'Média'], ['grande', 'Grande'], ['cheia', 'Largura toda']
  ];
  var LUGARES_NOME = [
    ['esquerda', 'À esquerda do texto'], ['direita', 'À direita do texto'],
    ['acima', 'Acima do texto'], ['abaixo', 'Abaixo do texto']
  ];

  /* as cores que a página já usa, lidas do :root — nem uma a mais */
  function coresDaCasa() {
    var raiz = getComputedStyle(document.documentElement);
    var achadas = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var regras;
      try { regras = document.styleSheets[i].cssRules; } catch (e) { continue; }
      if (!regras) continue;
      for (var j = 0; j < regras.length; j++) {
        var r = regras[j];
        if (!r.style || r.selectorText !== ':root') continue;
        for (var k = 0; k < r.style.length; k++) {
          var nome = r.style[k];
          if (nome.indexOf('--') !== 0) continue;
          var valor = raiz.getPropertyValue(nome).trim();
          if (!/^#[0-9a-f]{6}$/i.test(valor)) continue;
          if (achadas.some(function (c) { return c.valor.toLowerCase() === valor.toLowerCase(); })) continue;
          achadas.push({ nome: nome.replace(/^--/, '').replace(/-/g, ' '), valor: valor });
        }
      }
    }
    return achadas;
  }

  /* onde a subseção pode entrar: depois de qualquer seção da página */
  function ancoras() {
    var fora = {};
    var lista = [];
    var candidatas = document.querySelectorAll('main > section, body > section, main > div[id]');
    for (var i = 0; i < candidatas.length; i++) {
      var s = candidatas[i];
      if (s.classList.contains('me-secao')) continue;
      if (s.closest('.me-fora')) continue;
      var caminho = window.__caminhoDe ? window.__caminhoDe(s) : '';
      if (!caminho || fora[caminho]) continue;
      fora[caminho] = 1;
      var h = s.querySelector('h1, h2, h3');
      var rotulo = h ? String(h.textContent).replace(/\s+/g, ' ').trim().slice(0, 44) : '';
      if (!rotulo) rotulo = s.id ? s.id : 'seção sem título';
      lista.push({ caminho: caminho, rotulo: rotulo });
    }
    return lista;
  }

  function formularioDeSecao(existente) {
    var cores = coresDaCasa();
    var alvos = ancoras();
    var r = existente || {};
    var fundoEscolhido = r.fundo || (cores[0] && cores[0].valor) || '#F2EDE0';

    var fundo = document.createElement('div');
    fundo.className = 'me-porta me-fora';
    fundo.innerHTML =
      '<form class="me-porta__carta me-porta__carta--larga">' +
        '<button class="me-porta__x" type="button" aria-label="Fechar">✕</button>' +
        '<p class="me-porta__olho">Página</p>' +
        '<h2>' + (existente ? 'Ajustar a subseção' : 'Nova subseção') + '</h2>' +

        '<label class="me-campo"><span>Onde entra</span><select name="depois">' +
          alvos.map(function (a) {
            return '<option value="' + a.caminho.replace(/"/g, '&quot;') + '"' +
              (r.depois === a.caminho ? ' selected' : '') + '>Depois de: ' + a.rotulo + '</option>';
          }).join('') +
        '</select></label>' +

        '<div class="me-campo"><span>Cor de fundo</span>' +
          '<div class="me-cores">' +
            cores.map(function (c) {
              return '<button type="button" class="me-cor' +
                (c.valor.toLowerCase() === String(fundoEscolhido).toLowerCase() ? ' is-posta' : '') +
                '" data-cor="' + c.valor + '" title="' + c.nome + '" ' +
                'style="background:' + c.valor + '"><span>' + c.nome + '</span></button>';
            }).join('') +
          '</div>' +
          '<p class="me-contraste"></p>' +
        '</div>' +

        '<label class="me-campo"><span>Título <em>opcional</em></span>' +
          '<input name="titulo" maxlength="90" value="' + escapa(r.titulo) + '"></label>' +
        '<label class="me-campo"><span>Texto <em>uma linha em branco separa parágrafos</em></span>' +
          '<textarea name="texto" rows="6" maxlength="2400">' + escapa(r.texto) + '</textarea></label>' +

        '<div class="me-campo me-campo--par">' +
          '<label><span>Tipo de letra</span><select name="fonte">' +
            '<option value="serifa"' + (r.fonte !== 'grot' ? ' selected' : '') + '>Cormorant Garamond</option>' +
            '<option value="grot"' + (r.fonte === 'grot' ? ' selected' : '') + '>Jost</option>' +
          '</select></label>' +
          '<label><span>Tamanho da letra</span><select name="tamanho">' +
            TAMANHOS_NOME.map(function (t) {
              return '<option value="' + t[0] + '"' + (r.tamanho === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
            }).join('') +
          '</select></label>' +
        '</div>' +

        '<label class="me-campo"><span>Imagem <em>opcional</em></span>' +
          '<input name="imagem" type="file" accept="image/*"></label>' +
        (r.imagem ? '<p class="me-nota">Hoje: ' + r.imagem.split('/').pop() + ' — escolha outra para trocar.</p>' : '') +
        '<div class="me-campo me-campo--par">' +
          '<label><span>Tamanho da imagem</span><select name="imagemLargura">' +
            LARGURAS_NOME.map(function (t) {
              return '<option value="' + t[0] + '"' + (r.imagemLargura === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
            }).join('') +
          '</select></label>' +
          '<label><span>Lugar da imagem</span><select name="imagemLugar">' +
            LUGARES_NOME.map(function (t) {
              return '<option value="' + t[0] + '"' + (r.imagemLugar === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
            }).join('') +
          '</select></label>' +
        '</div>' +

        '<div class="me-porta__pe">' +
          '<button class="me-bt me-bt--forte" type="submit">' + (existente ? 'Guardar' : 'Pôr na página') + '</button>' +
          '<button class="me-bt me-bt--fino" type="button" data-fecha>Cancelar</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(fundo);

    var form = fundo.querySelector('form');
    var escolhida = fundoEscolhido;
    var recado = fundo.querySelector('.me-contraste');

    /* O contraste é dito na hora, e não descoberto meses depois. A cor da
       letra já é deduzida pela conta, então o número aqui quase sempre é
       bom — mas num fundo de meia altura ele pode ficar apertado, e é
       exatamente aí que convém saber antes de publicar. */
    function diContraste() {
      if (!recado || !window.__corQueLe || !window.__contraste) return;
      var letra = window.__corQueLe(escolhida);
      var r = window.__contraste(letra, escolhida);
      var bom = r >= 4.5, otimo = r >= 7;
      recado.className = 'me-contraste ' + (bom ? 'is-bom' : 'is-ruim');
      recado.textContent = otimo
        ? 'Contraste ' + r.toFixed(1) + ':1 — a leitura fica confortável.'
        : bom
          ? 'Contraste ' + r.toFixed(1) + ':1 — passa, mas por pouco. Um fundo mais escuro ou mais claro ajudaria.'
          : 'Contraste ' + r.toFixed(1) + ':1 — abaixo do mínimo de 4,5. Neste fundo o texto vai ficar difícil de ler.';
    }

    fundo.querySelectorAll('.me-cor').forEach(function (b) {
      b.addEventListener('click', function () {
        escolhida = b.getAttribute('data-cor');
        fundo.querySelectorAll('.me-cor').forEach(function (o) { o.classList.remove('is-posta'); });
        b.classList.add('is-posta');
        diContraste();
      });
    });
    diContraste();
    function fecha() { fundo.remove(); }
    fundo.querySelector('[data-fecha]').addEventListener('click', fecha);
    fundo.querySelector('.me-porta__x').addEventListener('click', fecha);
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fecha(); });
    form.querySelector('[name=titulo]').focus();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { return (form.querySelector('[name=' + n + ']').value || '').trim(); };
      var texto = v('texto');
      var titulo = v('titulo');
      if (!texto && !titulo) { fala('Escreva ao menos um título ou um texto.', true); return; }

      var arq = form.querySelector('[name=imagem]').files[0] || null;
      if (arq && !arquivoAceito(arq)) { recusaArquivo(arq); return; }
      if (arq && arq.size > LIMITE_MB * 1048576) {
        fala('A imagem tem ' + (arq.size / 1048576).toFixed(1) + ' MB. O limite é ' + LIMITE_MB + ' MB.', true);
        return;
      }

      var reg = {
        id: r.id || ('sec-' + chapa(titulo || texto.slice(0, 24)) + '-' + Date.now().toString(36)),
        pagina: pagina(),
        depois: v('depois'),
        fundo: escolhida,
        titulo: titulo,
        texto: texto,
        fonte: v('fonte'),
        tamanho: v('tamanho'),
        imagem: r.imagem || '',
        imagemLargura: v('imagemLargura'),
        imagemLugar: v('imagemLugar')
      };
      if (arq) {
        reg.imagem = './' + PASTA_ENVIADAS + '/' + nomeLimpo(arq.name);
        arquivos = arquivos.filter(function (a) { return a.caminho !== 'secao:' + reg.id; });
        arquivos.push({ caminho: 'secao:' + reg.id, nome: reg.imagem.split('/').pop(), arquivo: arq, url: URL.createObjectURL(arq) });
        reg.imagemLocal = arquivos[arquivos.length - 1].url;
      }

      /* substitui a versão anterior, se estamos ajustando */
      secoesNovas = secoesNovas.filter(function (x) { return x.id !== reg.id; });
      secoesNovas.push(reg);
      if (conteudo.secoes) conteudo.secoes = conteudo.secoes.filter(function (x) { return x.id !== reg.id; });

      desenhaSecao(reg);
      fecha();
      pinta();
      fala(existente ? 'Subseção ajustada. Salve para publicar.' : 'Subseção criada. Salve para publicar.');
    });
  }

  function escapa(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function desenhaSecao(reg) {
    if (!window.__montaSecao) return;
    var antiga = document.querySelector('[data-secao-id="' + reg.id + '"]');
    var previa = {};
    Object.keys(reg).forEach(function (k) { previa[k] = reg[k]; });
    if (reg.imagemLocal) previa.imagem = reg.imagemLocal;
    var bloco = window.__montaSecao(previa);
    if (!bloco) return;
    if (antiga) antiga.parentNode.replaceChild(bloco, antiga);
    else {
      var ancora = window.__porCaminho ? window.__porCaminho(reg.depois) : null;
      if (ancora && ancora.parentNode) ancora.parentNode.insertBefore(bloco, ancora.nextSibling);
      else (document.querySelector('main') || document.body).appendChild(bloco);
    }
    poeAlcasDaSecao(bloco);
    bloco.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* as duas alças de uma subseção: ajustar e tirar */
  function poeAlcasDaSecao(bloco) {
    if (bloco.querySelector('.me-alcas')) return;
    var id = bloco.getAttribute('data-secao-id');
    var caixa = document.createElement('div');
    caixa.className = 'me-alcas me-fora';
    caixa.appendChild(botao('↑', function () { moveSecao(bloco, id, -1); }));
    caixa.appendChild(botao('↓', function () { moveSecao(bloco, id, 1); }));
    caixa.appendChild(botao('Ajustar subseção', function () {
      var reg = achaSecao(id);
      if (reg) formularioDeSecao(reg);
    }));
    caixa.appendChild(botao('Excluir subseção', function () { tiraSecao(bloco, id); }, true));
    if (getComputedStyle(bloco).position === 'static') bloco.classList.add('me-relativo');
    bloco.appendChild(caixa);
  }

  /* Subir e descer uma subseção é trocá-la de âncora: ela passa a vir depois
     da seção vizinha, na direção pedida. As seções desenhadas do site não se
     movem — várias são animadas pela rolagem (a taça, o scrub, o terroir
     grudado), e mudar a ordem delas quebraria essas animações. */
  function moveSecao(bloco, id, rumo) {
    var reg = achaSecao(id);
    if (!reg) return;
    var irmas = [].slice.call((bloco.parentNode || document).children).filter(function (e) {
      return e.tagName === 'SECTION' || (e.tagName === 'DIV' && e.id);
    });
    var onde = irmas.indexOf(bloco);
    var vizinha = irmas[onde + (rumo < 0 ? -1 : 1)];
    if (!vizinha) { fala(rumo < 0 ? 'Já é a primeira.' : 'Já é a última.'); return; }

    if (rumo < 0) {
      /* sobe: passa a vir depois de quem estava antes da vizinha */
      var anterior = irmas[onde - 2] || null;
      bloco.parentNode.insertBefore(bloco, vizinha);
      reg.depois = anterior && window.__caminhoDe ? window.__caminhoDe(anterior) : '';
    } else {
      bloco.parentNode.insertBefore(bloco, vizinha.nextSibling);
      reg.depois = window.__caminhoDe ? window.__caminhoDe(vizinha) : reg.depois;
    }

    /* a mudança de lugar é uma mudança por salvar como qualquer outra */
    secoesNovas = secoesNovas.filter(function (x) { return x.id !== reg.id; });
    secoesNovas.push(reg);
    pinta();
    bloco.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function achaSecao(id) {
    var daSessao = secoesNovas.filter(function (x) { return x.id === id; })[0];
    if (daSessao) return daSessao;
    return (conteudo.secoes || []).filter(function (x) { return x.id === id; })[0] || null;
  }

  function tiraSecao(bloco, id) {
    var reg = achaSecao(id);
    var nome = (reg && (reg.titulo || String(reg.texto || '').slice(0, 30))) || 'esta subseção';
    if (!confirm('Tirar “' + nome.trim() + '” da página?\n\nSome do site quando você salvar.')) return;
    /* Só quem nunca foi salvo some sem deixar recado. Uma subseção que já
       está no ar precisa que a retirada vire uma mudança por salvar — senão
       ela desaparece da tela e volta na próxima visita, porque nada foi
       gravado. Quem apaga de fato é o guardaSecoes(), ao salvar. */
    var nuncaFoiSalva = secoesNovas.some(function (x) { return x.id === id; });
    secoesNovas = secoesNovas.filter(function (x) { return x.id !== id; });
    if (!nuncaFoiSalva && secoesFora.indexOf(id) === -1) secoesFora.push(id);
    arquivos = arquivos.filter(function (a) { return a.caminho !== 'secao:' + id; });
    bloco.remove();
    pinta();
  }

  /* toda subseção já na página ganha as alças assim que a edição liga */
  function abreSecoes() {
    var todas = document.querySelectorAll('.me-secao[data-secao-id]');
    for (var i = 0; i < todas.length; i++) poeAlcasDaSecao(todas[i]);
  }

  /* ==================================================================
     Histórico: quem mudou o quê, e como voltar atrás

     Cada Salvar é um commit assinado pelo token de quem salvou, então o
     registro já existe — faltava uma janela para lê-lo. Voltar a uma versão
     não apaga nada: grava por cima o conteúdo daquele dia, como um commit
     novo. O caminho de volta continua sempre disponível, inclusive o de
     desfazer o desfazer.
     ================================================================== */
  function janelaDeHistorico() {
    var fundo = document.createElement('div');
    fundo.className = 'me-porta me-fora';
    fundo.innerHTML =
      '<div class="me-porta__carta me-porta__carta--larga">' +
        '<button class="me-porta__x" type="button" aria-label="Fechar">✕</button>' +
        '<p class="me-porta__olho">Registro</p>' +
        '<h2>O que mudou, e quando</h2>' +
        '<p class="me-nota">Voltar a uma versão não apaga o que veio depois: grava aquele ' +
          'dia por cima, como uma alteração nova. Dá para voltar outra vez.</p>' +
        '<div class="me-lista"><p class="me-nota">Buscando…</p></div>' +
      '</div>';
    document.body.appendChild(fundo);
    function fecha() { fundo.remove(); }
    fundo.querySelector('.me-porta__x').addEventListener('click', fecha);
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fecha(); });

    var lista = fundo.querySelector('.me-lista');
    api('/repos/' + repo + '/commits?path=conteudo.json&per_page=20')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (commits) {
        if (!commits.length) { lista.innerHTML = '<p class="me-nota">Nada gravado ainda.</p>'; return; }
        lista.innerHTML = '';
        commits.forEach(function (c, i) {
          var quem = (c.author && c.author.login) || (c.commit.author && c.commit.author.name) || 'alguém';
          var quando = new Date(c.commit.author.date);
          var oque = String(c.commit.message || '').split('\n')[0].replace(/^Modo Edição:\s*/, '');
          var linha = document.createElement('div');
          linha.className = 'me-versao';
          linha.innerHTML =
            '<div><b>' + escapa(oque || 'alteração') + '</b>' +
            '<span>' + escapa(quem) + ' · ' + quando.toLocaleString('pt-BR', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) + (i === 0 ? ' · <em>é o que está no ar</em>' : '') + '</span></div>';
          if (i > 0) {
            var bt = botao('Voltar para esta', function () { voltaPara(c.sha, oque, bt); });
            linha.appendChild(bt);
          }
          lista.appendChild(linha);
        });
      })
      .catch(function () { lista.innerHTML = '<p class="me-nota">Não consegui buscar o registro agora.</p>'; });

    function voltaPara(sha, oque, bt) {
      if (!confirm('Voltar o site para a versão “' + oque + '”?\n\nO que veio depois não se perde: fica no registro, e dá para voltar de novo.')) return;
      bt.disabled = true; bt.textContent = 'Voltando…';
      api('/repos/' + repo + '/contents/conteudo.json?ref=' + sha)
        .then(function (r) { if (!r.ok) throw new Error('não achei aquela versão'); return r.json(); })
        .then(function (antiga) {
          return api('/repos/' + repo + '/contents/conteudo.json?ref=' + ramo)
            .then(function (r) { return r.ok ? r.json() : {}; })
            .then(function (atual) {
              return api('/repos/' + repo + '/contents/conteudo.json', {
                method: 'PUT',
                body: JSON.stringify({
                  message: 'Modo Edição: volta para “' + oque + '”',
                  content: antiga.content.replace(/\n/g, ''),
                  sha: atual.sha, branch: ramo
                })
              });
            });
        })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || 'erro'); });
          fundo.remove();
          fala('Voltamos para “' + oque + '”. O site se atualiza em cerca de um minuto.');
          setTimeout(function () { location.reload(); }, 2500);
        })
        .catch(function (e) {
          bt.disabled = false; bt.textContent = 'Voltar para esta';
          fala('Não deu para voltar: ' + e.message, true);
        });
    }
  }

  /* ------------------------------------------------------------------
     O que pode ser enviado

     O `accept` do seletor de arquivos é sugestão, não tranca: a chamada à
     API manda o que estiver no objeto. E tudo o que entra no repositório
     passa a ser servido pelo mesmo endereço do site — um .html ou um .js
     ali dentro seria código hospedado na origem da casa, com acesso a
     tudo o que a origem tem. Por isso a lista é fechada, e conferida aqui
     e não no seletor.
     ------------------------------------------------------------------ */
  var EXTENSOES_OK = {
    '.jpg': 1, '.jpeg': 1, '.png': 1, '.webp': 1, '.gif': 1, '.avif': 1,
    '.mp4': 1, '.webm': 1, '.mov': 1, '.m4v': 1
  };

  function arquivoAceito(arq) {
    if (!arq || !arq.name) return false;
    var ponto = arq.name.lastIndexOf('.');
    var ext = ponto === -1 ? '' : arq.name.slice(ponto).toLowerCase();
    if (!EXTENSOES_OK[ext]) return false;
    /* o tipo declarado tem de concordar com a extensão */
    var tipo = String(arq.type || '').toLowerCase();
    if (tipo && !/^image\/|^video\//.test(tipo)) return false;
    return true;
  }

  function recusaArquivo(arq) {
    fala('“' + (arq && arq.name ? arq.name : 'esse arquivo') + '” não é foto nem vídeo. ' +
         'Só entram jpg, png, webp, gif, avif, mp4, webm, mov e m4v.', true);
  }

  function nomeLimpo(nome) {
    var ponto = nome.lastIndexOf('.');
    var corpo = (ponto === -1 ? nome : nome.slice(0, ponto));
    var ext = (ponto === -1 ? '' : nome.slice(ponto)).toLowerCase();
    corpo = corpo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                 .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'arquivo';
    return corpo + '-' + Date.now().toString(36) + ext;
  }

  /* ==================================================================
     a barra
     ================================================================== */
  function temMudanca() {
    return Object.keys(mudancas).length > 0 || arquivos.length > 0 ||
           novos.length > 0 || removidos.length > 0 || apagados.length > 0 ||
           chefNovos.length > 0 || chefFora.length > 0 ||
           secoesNovas.length > 0 || secoesFora.length > 0;
  }

  /* o que está por salvar, dito em português */
  function inventario() {
    var partes = [];
    var t = Object.keys(mudancas).length;
    /* a fotografia de um prato novo já é contada no prato */
    var m = arquivos.filter(function (a) {
      return a.caminho.indexOf('prato:') !== 0 && a.caminho.indexOf('chef:') !== 0 &&
             a.caminho.indexOf('secao:') !== 0;
    }).length;
    if (t) partes.push(t + (t === 1 ? ' texto' : ' textos'));
    if (m) {
      /* dizer 'arquivo' quando é um vídeo esconde o que está sendo trocado:
         quem vai salvar precisa ler a palavra que corresponde ao que fez */
      var vid = arquivos.filter(function (a) {
        var el = document.querySelector('[data-me-midia="' + a.caminho.replace(/"/g, '') + '"]');
        return el && el.tagName === 'VIDEO';
      }).length;
      var fot = m - vid;
      if (vid) partes.push(vid + (vid === 1 ? ' vídeo trocado' : ' vídeos trocados'));
      if (fot) partes.push(fot + (fot === 1 ? ' arquivo' : ' arquivos'));
    }
    if (apagados.length) partes.push(apagados.length + (apagados.length === 1 ? ' vídeo excluído' : ' vídeos excluídos'));
    if (novos.length) partes.push(novos.length + (novos.length === 1 ? ' prato novo' : ' pratos novos'));
    if (removidos.length) partes.push(removidos.length + (removidos.length === 1 ? ' prato retirado' : ' pratos retirados'));
    if (chefNovos.length) partes.push(chefNovos.length + (chefNovos.length === 1 ? ' menu do chef novo' : ' menus do chef novos'));
    if (chefFora.length) partes.push(chefFora.length + (chefFora.length === 1 ? ' menu do chef retirado' : ' menus do chef retirados'));
    if (secoesNovas.length) partes.push(secoesNovas.length + (secoesNovas.length === 1 ? ' subseção' : ' subseções'));
    if (secoesFora.length) partes.push(secoesFora.length + (secoesFora.length === 1 ? ' subseção retirada' : ' subseções retiradas'));
    return partes;
  }

  /* Salvar não publica: leva para a prévia, onde se vê o resultado antes de
     decidir. Publicar é um segundo gesto, deliberado, e mora só ali. Por isso
     a barra tem duas caras — a de quem está mexendo e a de quem está olhando
     o que fez. */
  function montaBarra() {
    barra = document.createElement('div');
    barra.className = 'me-barra me-fora' + (naPrevia ? ' is-previa' : '');
    barra.innerHTML =
      '<span class="me-barra__selo">' + (naPrevia ? 'Prévia' : 'Modo Edição') + '</span>' +
      '<span class="me-barra__conta" id="me-conta">Clique em qualquer texto para escrever</span>' +
      '<span class="me-barra__acoes">' +
        '<button class="me-bt" type="button" id="me-nova">+ Subseção</button>' +
        '<button class="me-bt" type="button" id="me-historico">Histórico</button>' +
        (naPrevia
          ? '<button class="me-bt" type="button" id="me-copia">Copiar endereço</button>' +
            '<button class="me-bt" type="button" id="me-desfaz">Descartar</button>' +
            '<button class="me-bt" type="button" id="me-salva">Guardar mudanças</button>' +
            '<button class="me-bt me-bt--forte" type="button" id="me-publica">Salvar em definitivo</button>'
          : '<button class="me-bt" type="button" id="me-desfaz">Descartar</button>' +
            '<button class="me-bt me-bt--forte" type="button" id="me-salva">Salvar</button>') +
        '<button class="me-bt me-bt--fino" type="button" id="me-sai">Sair</button>' +
      '</span>';
    document.body.appendChild(barra);
    aviso = document.createElement('div');
    aviso.className = 'me-fala me-fora';
    document.body.appendChild(aviso);

    barra.querySelector('#me-salva').addEventListener('click', salva);
    barra.querySelector('#me-nova').addEventListener('click', function () { formularioDeSecao(null); });
    barra.querySelector('#me-historico').addEventListener('click', janelaDeHistorico);
    if (naPrevia) {
      barra.querySelector('#me-publica').addEventListener('click', publicaDefinitivo);
      barra.querySelector('#me-copia').addEventListener('click', function (e) {
        copiaTexto(location.href);
        e.target.textContent = 'Copiado';
        setTimeout(function () { e.target.textContent = 'Copiar endereço'; }, 2200);
      });
    }
    barra.querySelector('#me-desfaz').addEventListener('click', descarta);
    barra.querySelector('#me-sai').addEventListener('click', function () {
      if (temMudanca() && !confirm('Você tem mudanças não guardadas. Sair mesmo assim?')) return;
      sessionStorage.removeItem(LIGADO);
      esqueceGuardada();
      location.href = location.pathname;
    });
    pinta();
  }

  function descarta() {
    if (naPrevia) {
      if (!confirm('Descartar tudo o que está nesta prévia?\n\nO site volta a ser exatamente o que está no ar agora.')) return;
      var bt = document.getElementById('me-desfaz');
      bt.disabled = true; bt.textContent = 'Descartando…';
      api('/repos/' + repo + '/contents/conteudo.json?ref=' + ramo)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (publicado) {
          if (!publicado) throw new Error('não achei o conteúdo publicado');
          return api('/repos/' + repo + '/contents/conteudo-previa.json?ref=' + ramo)
            .then(function (r) { return r.ok ? r.json() : {}; })
            .then(function (rascunho) {
              return api('/repos/' + repo + '/contents/conteudo-previa.json', {
                method: 'PUT',
                body: JSON.stringify({
                  message: 'Modo Edição: prévia descartada',
                  content: publicado.content.replace(/\n/g, ''),
                  sha: rascunho.sha, branch: ramo
                })
              });
            });
        })
        .then(function () {
          try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch (e) {}
          fala('Prévia descartada. Voltando ao site como está no ar.');
          setTimeout(function () { location.href = location.pathname + '?editar=1'; }, 1800);
        })
        .catch(function (e) {
          bt.disabled = false; bt.textContent = 'Descartar';
          fala('Não deu para descartar: ' + e.message, true);
        });
      return;
    }
    if (!temMudanca()) return;
    if (!confirm('Descartar tudo o que você mudou nesta página?')) return;
    location.reload();
  }

  function copiaTexto(t) {
    var campo = document.createElement('textarea');
    campo.value = t;
    campo.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(campo);
    campo.select();
    try { document.execCommand('copy'); } catch (e) {}
    campo.remove();
  }

  /* O segundo gesto: o que está na prévia passa a ser o site. Copia arquivo
     para arquivo, sem recalcular nada — o que ela viu é exatamente o que vai
     ao ar. */
  /* Publica o que está na tela, e não o que a API disser que está no arquivo.

     Antes isto lia o conteudo-previa.json de volta pela API e copiava. Numa
     das vezes a leitura veio velha — a API respondeu com a versão anterior à
     gravação, feita segundos antes — e o commit "versão publicada" saiu com o
     conteúdo antigo: o site não mudou, embora a prévia mostrasse a mudança.

     O objeto `conteudo` que está aqui na memória é exatamente o que desenhou
     esta página. Publicar a partir dele fecha a brecha e torna a promessa
     literal: o que ela viu é o que vai ao ar. */
  function publicaDefinitivo() {
    if (!confirm('Publicar esta versão?\n\nO site passa a mostrar o que você está vendo agora, para todo mundo.')) return;
    var bt = document.getElementById('me-publica');
    var rotulo = bt.textContent;
    bt.disabled = true; bt.textContent = 'Publicando…';
    gravaArquivo('conteudo.json', 'Modo Edição: versão publicada')
      .then(function () {
        try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch (e) {}
        fala('Publicado. O site mostra a versão nova em cerca de um minuto.');
        setTimeout(function () { location.href = location.pathname + '?editar=1'; }, 2600);
      })
      .catch(function (e) {
        bt.disabled = false; bt.textContent = rotulo;
        fala('Não deu para publicar: ' + e.message, true);
      });
  }

  function pinta() {
    var conta = document.getElementById('me-conta');
    if (!conta) return;
    var partes = inventario();
    if (!partes.length) {
      conta.textContent = 'Clique em qualquer texto para escrever';
      barra.classList.remove('is-suja');
      return;
    }
    conta.textContent = partes.join(', ') + ' por salvar';
    barra.classList.add('is-suja');
  }

  function fala(texto, ruim) {
    aviso.textContent = texto;
    aviso.className = 'me-fala me-fora is-viva' + (ruim ? ' is-ruim' : '');
    clearTimeout(fala.t);
    fala.t = setTimeout(function () { aviso.className = 'me-fala me-fora'; }, ruim ? 9000 : 5000);
  }

  /* ==================================================================
     salvar — os arquivos primeiro, depois o conteudo.json
     ================================================================== */
  /* Salvar guarda o trabalho e leva para a prévia — não publica. Quem publica
     é o segundo botão, do outro lado. Assim ninguém troca a foto errada e
     descobre pelo site no ar. */
  function salva() {
    if (!temMudanca()) {
      fala(naPrevia ? 'Não há nada novo para guardar.' : 'Não há nada mudado para salvar.');
      return;
    }
    var bt = document.getElementById('me-salva');
    var rotulo = bt.textContent;
    bt.disabled = true; bt.textContent = 'Guardando…';

    enviaArquivos()
      .then(function (enviados) {
        juntaTudo(enviados);
        guardaNaSessao();
        return gravaArquivo('conteudo-previa.json', 'Modo Edição: ' + resumo());
      })
      .then(function () {
        mudancas = {}; arquivos = []; novos = []; removidos = []; apagados = [];
        chefNovos = []; chefFora = [];
        secoesNovas = []; secoesFora = [];
        document.querySelectorAll('.me-apagada').forEach(function (e) { e.classList.remove('me-apagada'); });
        document.querySelectorAll('.me-trocada').forEach(function (e) { e.classList.remove('me-trocada'); });
        pinta();
        if (naPrevia) {
          fala('Guardado. Recarregando a prévia com a mudança…');
          setTimeout(function () { location.reload(); }, 1600);
        } else {
          fala('Guardado. Levando você para ver como ficou…');
          setTimeout(function () {
            location.href = location.pathname + '?editar=1&previa=1';
          }, 1600);
        }
      })
      .catch(function (e) {
        fala('Não deu para guardar: ' + e.message, true);
        bt.disabled = false; bt.textContent = rotulo;
      });
  }

  /* Tudo o que foi mexido nesta sessão entra no objeto do conteúdo. É o mesmo
     passo para salvar e para a prévia: o que muda entre os dois é só o nome
     do arquivo em que ele acaba. */
  function juntaTudo(enviados) {
    var chave = pagina();
    conteudo.pagina = conteudo.pagina || {};
    conteudo.pagina[chave] = conteudo.pagina[chave] || {};
    Object.keys(mudancas).forEach(function (c) { conteudo.pagina[chave][c] = mudancas[c]; });
    (enviados || []).forEach(function (a) {
      /* a fotografia de um prato novo não é um trecho da página: é um campo
         da receita, e viaja com ela */
      if (a.caminho.indexOf('prato:') === 0 || a.caminho.indexOf('chef:') === 0 ||
          a.caminho.indexOf('secao:') === 0) return;
      conteudo.pagina[chave][a.caminho] = { src: a.destino };
    });
    apagados.forEach(function (c) { conteudo.pagina[chave][c] = { removido: true }; });
    guardaCarta();
    guardaSecoes();
  }

  /* as decisões sobre a carta viram dois recados no conteudo.json: quem sai
     e quem entra. Um prato retirado fica retirado mesmo que o site seja
     montado de novo — o HTML continua com ele, e o recado continua valendo. */
  function guardaCarta() {
    anota(removidos, novos, 'pratosRemovidos', 'pratosNovos', ['fotoLocal'], 'foto');
    anota(chefFora, chefNovos, 'chefRemovidos', 'chefNovos', ['fotosLocais'], null);
  }

  /* As subseções ficam numa lista só, sem lápide: quem sai, sai da lista. Elas
     não existem no HTML — nasceram aqui — e por isso não há um original ao
     qual voltar, nem recado a deixar. */
  function guardaSecoes() {
    if (!secoesNovas.length && !secoesFora.length) return;
    var lista = (conteudo.secoes || []).slice();
    if (secoesFora.length) {
      lista = lista.filter(function (x) { return secoesFora.indexOf(x.id) === -1; });
    }
    secoesNovas.forEach(function (reg) {
      var limpo = {};
      Object.keys(reg).forEach(function (k) { if (k !== 'imagemLocal') limpo[k] = reg[k]; });
      lista = lista.filter(function (x) { return x.id !== limpo.id; });
      lista.push(limpo);
    });
    conteudo.secoes = lista;
  }

  function anota(saem, entram, chaveFora, chaveDentro, descarta, campoFoto) {
    if (!saem.length && !entram.length) return;
    if (saem.length) {
      var fora = (conteudo[chaveFora] || []).slice();
      saem.forEach(function (id) { if (fora.indexOf(id) === -1) fora.push(id); });
      conteudo[chaveFora] = fora;
    }
    if (entram.length) {
      var dentro = (conteudo[chaveDentro] || []).slice();
      entram.forEach(function (p) {
        var limpo = {};
        Object.keys(p).forEach(function (k) {
          if (descarta.indexOf(k) !== -1) return;          /* prévia local não vai para o repositório */
          limpo[k] = p[k];
        });
        if (campoFoto && limpo[campoFoto]) limpo[campoFoto] = './' + String(limpo[campoFoto]).replace(/^\.\//, '');
        dentro.push(limpo);
      });
      conteudo[chaveDentro] = dentro;
    }
    /* quem entrou e saiu na mesma sessão não precisa de recado nenhum */
    if (conteudo[chaveFora] && conteudo[chaveDentro]) {
      var ids = conteudo[chaveDentro].map(function (p) { return p.id; });
      conteudo[chaveFora] = conteudo[chaveFora].filter(function (id) { return ids.indexOf(id) === -1; });
    }
  }

  function enviaArquivos() {
    if (!arquivos.length) return Promise.resolve([]);
    var fila = arquivos.slice(), enviados = [];
    return fila.reduce(function (antes, a, i) {
      return antes.then(function () {
        var eVideo = /.(mp4|webm|mov|m4v)$/i.test(a.nome);
        fala('Enviando ' + (eVideo ? 'vídeo ' : 'arquivo ') + (i + 1) + ' de ' + fila.length + '…');
        var destino = PASTA_ENVIADAS + '/' + a.nome;
        return base64(a.arquivo).then(function (dados) {
          return api('/repos/' + repo + '/contents/' + destino, {
            method: 'PUT',
            body: JSON.stringify({
              message: 'Modo Edição: ' + a.nome,
              content: dados, branch: ramo
            })
          }).then(function (r) {
            if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || ('envio de ' + a.nome)); });
            enviados.push({ caminho: a.caminho, destino: './' + destino });
          });
        });
      });
    }, Promise.resolve()).then(function () { return enviados; });
  }

  function base64(arquivo) {
    return new Promise(function (ok, erro) {
      var leitor = new FileReader();
      leitor.onload = function () { ok(String(leitor.result).split(',')[1]); };
      leitor.onerror = function () { erro(new Error('não consegui ler o arquivo')); };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* O mesmo gravador serve ao conteudo.json e ao rascunho da prévia: muda o
     nome do arquivo e a mensagem do commit, nada mais. */
  function gravaArquivo(nome, mensagem, segundaTentativa) {
    return api('/repos/' + repo + '/contents/' + nome + '?ref=' + ramo)
      .then(function (r) { return r.ok ? r.json() : { sha: undefined }; })
      .then(function (atual) {
        var texto = JSON.stringify(conteudo, null, 2) + '\n';
        var corpo = { message: mensagem, content: paraBase64(texto), branch: ramo };
        if (atual && atual.sha) corpo.sha = atual.sha;
        return api('/repos/' + repo + '/contents/' + nome, {
          method: 'PUT', body: JSON.stringify(corpo)
        });
      })
      .then(function (r) {
        if (r.ok) return true;
        if (r.status === 409 && !segundaTentativa) return gravaArquivo(nome, mensagem, true);
        return r.json().then(function (j) { throw new Error(j.message || ('erro ' + r.status)); });
      });
  }

  function resumo() {
    return inventario().join(', ') + ' em ' + pagina();
  }

  function paraBase64(texto) {
    var bytes = new TextEncoder().encode(texto), bruto = '';
    for (var i = 0; i < bytes.length; i++) bruto += String.fromCharCode(bytes[i]);
    return btoa(bruto);
  }

  /* ==================================================================
     a entrada discreta, para quem não está editando
     ================================================================== */
  function atalhoDeEntrada() {
    document.addEventListener('DOMContentLoaded', function () {
      var elo = document.querySelector('.rodape__entrar a, [data-entrar]');
      if (elo) elo.setAttribute('href', location.pathname + '?editar=1');
    });
  }

  /* ==================================================================
     o estilo do editor — todo prefixado, para não encostar no do site
     ================================================================== */
  function estilo() {
    var css = document.createElement('style');
    css.textContent = [
      /* o cursor desenhado da casa é bonito e atrapalha quem escreve:
         para editar é preciso ver onde a letra vai cair */
      '.me-editando .cursor{ display:none !important; }',
      '.me-editando, .me-editando *{ cursor:auto; }',
      '.me-editando [data-me]{ cursor:text; }',
      '.me-editando [data-me]{ outline:1px dashed rgba(92,126,125,.42); outline-offset:3px; border-radius:2px; transition:outline-color .2s, background .2s; }',
      '.me-editando [data-me]:hover{ outline-color:rgba(92,126,125,.9); background:rgba(92,126,125,.07); }',
      '.me-editando [data-me]:focus{ outline:1px solid #5C7E7D; background:rgba(92,126,125,.1); }',
      '.me-relativo{ position:relative; }',
      /* o painel de mídia mora no corpo da página e nunca dentro da moldura:
         entrar no modo de edição não pode mover um pixel do que está no ar */
      '.me-controles{ position:fixed; z-index:2147482000; transform:translate(-50%,-50%);',
      '  display:flex; gap:7px; padding:7px; border-radius:3px; background:rgba(18,16,14,.9);',
      '  box-shadow:0 8px 30px rgba(0,0,0,.3); opacity:0; pointer-events:none;',
      '  transition:opacity .2s; white-space:nowrap; }',
      '.me-controles.is-viva{ opacity:1; pointer-events:auto; }',
      '.me-bt--mini{ padding:9px 14px; font-size:10px; letter-spacing:.18em; }',
      '.me-bt--perigo{ border-color:rgba(196,106,90,.5); color:#E8A99B; }',
      '.me-bt--perigo:hover{ background:rgba(140,59,46,.55); border-color:#8C3B2E; color:#fff; }',
      '.me-trocada{ outline:2px solid #5C7E7D; outline-offset:2px; }',
      '.me-apagada{ opacity:.24; filter:grayscale(1); outline:2px dashed #8C3B2E; outline-offset:2px; }',
      '.me-barra{ position:fixed; z-index:2147483000; left:50%; bottom:18px; transform:translateX(-50%);',
      '  display:flex; align-items:center; gap:18px; flex-wrap:wrap; justify-content:center;',
      '  max-width:calc(100vw - 24px); padding:12px 14px 12px 20px; border-radius:3px;',
      '  background:rgba(18,16,14,.94); color:#EDE7DA; box-shadow:0 10px 40px rgba(0,0,0,.32);',
      '  font:400 12px/1.5 "Jost","Helvetica Neue",Arial,sans-serif; }',
      '.me-barra__selo{ font-size:10px; letter-spacing:.28em; text-transform:uppercase; opacity:.62; }',
      '.me-barra__conta{ opacity:.9; }',
      '.me-barra.is-suja .me-barra__conta{ color:#C9D18A; }',
      /* a barra da prévia tem outra cara: é a hora de decidir, não de mexer */
      '.me-barra.is-previa{ background:rgba(140,59,46,.96); }',
      '.me-barra.is-previa .me-barra__selo{ opacity:1; color:#F3DDD8; }',
      '.me-barra.is-previa .me-bt--forte{ background:#EDE7DA; color:#8C3B2E; border-color:#EDE7DA; }',
      /* a barra da decisão: só a pergunta e as duas respostas */
      '.me-barra--decisao{ background:rgba(18,16,14,.94); gap:22px; padding:14px 16px 14px 22px; }',
      '.me-barra--decisao .me-barra__conta{ opacity:.92; }',
      '.me-barra--decisao .me-bt--forte{ background:#EDE7DA; color:#12100E; border-color:#EDE7DA; }',
      '.me-barra--decisao .me-bt--fino{ border-color:rgba(237,231,218,.3); opacity:.85; }',
      '.me-barra__acoes{ display:flex; gap:8px; }',
      '.me-bt{ font:400 11px/1 "Jost","Helvetica Neue",Arial,sans-serif; letter-spacing:.2em; text-transform:uppercase;',
      '  padding:11px 18px; border-radius:2px; border:1px solid rgba(237,231,218,.34); background:none;',
      '  color:#EDE7DA; cursor:pointer; transition:background .3s, border-color .3s, color .3s; }',
      '.me-bt:hover{ background:rgba(237,231,218,.14); }',
      '.me-bt--forte{ background:#EDE7DA; color:#12100E; border-color:#EDE7DA; }',
      '.me-bt--forte:hover{ background:#fff; }',
      '.me-bt--forte:disabled{ opacity:.5; cursor:default; }',
      '.me-bt--fino{ border-color:transparent; opacity:.7; }',
      '.me-fala{ position:fixed; z-index:2147483000; left:50%; bottom:86px; transform:translateX(-50%) translateY(8px);',
      '  max-width:min(560px,calc(100vw - 32px)); padding:14px 20px; border-radius:3px;',
      '  background:#5C7E7D; color:#fff; font:400 13px/1.6 "Jost","Helvetica Neue",Arial,sans-serif;',
      '  opacity:0; pointer-events:none; transition:opacity .3s, transform .3s; text-align:center; }',
      '.me-fala.is-viva{ opacity:1; transform:translateX(-50%) translateY(0); }',
      '.me-fala.is-ruim{ background:#8C3B2E; }',
      '.me-porta{ position:fixed; inset:0; z-index:2147483600; display:grid; place-items:center;',
      '  padding:24px; background:rgba(18,16,14,.92); }',
      '.me-porta__carta{ position:relative; width:min(400px,100%); padding:38px 34px 34px; border-radius:3px;',
      '  background:#F2EDE0; color:#3A3A28; font-family:"Jost","Helvetica Neue",Arial,sans-serif; }',
      '.me-porta__olho{ margin:0 0 10px; font-size:10px; letter-spacing:.3em; text-transform:uppercase; opacity:.55; }',
      '.me-porta__carta h2{ margin:0 34px 0 0; font:300 27px/1.25 "Cormorant Garamond",Georgia,serif; }',
      '.me-porta__x{ position:absolute; top:14px; right:14px; width:34px; height:34px;',
      '  display:grid; place-items:center; border:0; border-radius:50%; background:none;',
      '  color:#3A3A28; font-size:15px; line-height:1; cursor:pointer; opacity:.45;',
      '  transition:opacity .25s, background .25s; }',
      '.me-porta__x:hover, .me-porta__x:focus-visible{ opacity:1; background:rgba(58,58,40,.09); }',
      '.me-porta__erro{ margin:18px 0 0; padding:12px 14px; border-radius:2px; background:#F3DDD8;',
      '  color:#8C3B2E; font-size:12px; line-height:1.6; }',
      '.me-porta__pe{ display:flex; align-items:center; gap:18px; margin-top:24px; }',
      '.me-porta__pe .me-bt--forte{ background:#3A3A28; color:#F2EDE0; border-color:#3A3A28; }',
      /* ---- a carta: tirar e pôr pratos ---- */
      '.me-excluir{ position:absolute; z-index:62; top:10px; right:10px;',
      '  padding:7px 13px; border:0; border-radius:2px; background:rgba(140,59,46,.92); color:#fff;',
      '  font:400 9px/1 "Jost","Helvetica Neue",Arial,sans-serif; letter-spacing:.2em; text-transform:uppercase;',
      '  cursor:pointer; opacity:0; transition:opacity .25s; }',
      '.me-editando .cartao:hover > .me-excluir, .me-excluir:focus{ opacity:1; }',
      '.me-novo{ display:grid; place-content:center; gap:10px; min-height:220px; padding:26px;',
      '  border:1px dashed rgba(92,126,125,.55); border-radius:2px; background:rgba(92,126,125,.05);',
      '  color:#5C7E7D; font:400 11px/1 "Jost","Helvetica Neue",Arial,sans-serif;',
      '  letter-spacing:.24em; text-transform:uppercase; cursor:pointer; justify-items:center;',
      '  transition:background .3s, border-color .3s; }',
      '.me-novo:hover{ background:rgba(92,126,125,.12); border-color:#5C7E7D; }',
      '.me-novo__mais{ font-size:26px; letter-spacing:0; line-height:1; }',
      '.me-porta__carta--larga{ width:min(560px,100%); max-height:88vh; overflow:auto; }',
      '.me-campo{ display:block; margin-top:16px; }',
      '.me-campo > span{ display:block; margin-bottom:7px; font-size:10px; letter-spacing:.2em;',
      '  text-transform:uppercase; opacity:.72; }',
      '.me-campo > span em{ font-style:normal; opacity:.6; letter-spacing:.1em; }',
      '.me-campo input, .me-campo textarea, .me-campo select{',
      '  width:100%; padding:11px 13px; border:1px solid #CFC8B2; border-radius:2px; background:#fff;',
      '  font:400 13px/1.6 "Jost",Arial,sans-serif; color:#3A3A28; }',
      '.me-campo textarea{ resize:vertical; }',
      '.me-campo input:focus, .me-campo textarea:focus, .me-campo select:focus{ outline:1px solid #5C7E7D; border-color:#5C7E7D; }',
      '.me-campo--par{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }',
      '.me-campo--par span{ display:block; margin-bottom:7px; font-size:10px; letter-spacing:.2em;',
      '  text-transform:uppercase; opacity:.72; }',
      '.me-campo--par span em{ font-style:normal; opacity:.6; letter-spacing:.1em; }',
      '.me-nota{ margin:8px 0 0; font-size:11px; line-height:1.6; opacity:.6; }',
      /* ---- as cores da casa, como amostras ---- */
      '.me-cores{ display:flex; flex-wrap:wrap; gap:8px; }',
      '.me-cor{ position:relative; width:46px; height:46px; border-radius:3px; cursor:pointer;',
      '  border:1px solid rgba(58,58,40,.22); padding:0; transition:transform .18s, box-shadow .18s; }',
      '.me-cor:hover{ transform:translateY(-2px); }',
      '.me-cor.is-posta{ box-shadow:0 0 0 2px #F2EDE0, 0 0 0 4px #3A3A28; }',
      '.me-cor span{ position:absolute; left:50%; top:calc(100% + 5px); transform:translateX(-50%);',
      '  font-size:9px; letter-spacing:.06em; color:#3A3A28; opacity:0; white-space:nowrap;',
      '  pointer-events:none; transition:opacity .2s; }',
      '.me-cor:hover span, .me-cor.is-posta span{ opacity:.7; }',
      '.me-cores{ margin-bottom:18px; }',
      /* ---- as alças de uma subseção ---- */
      '.me-alcas{ position:absolute; z-index:62; top:14px; right:14px; display:flex; gap:7px;',
      '  opacity:0; transition:opacity .25s; }',
      '.me-editando .me-secao:hover > .me-alcas, .me-alcas:focus-within{ opacity:1; }',
      '.me-editando .me-secao{ outline:1px dashed rgba(92,126,125,.35); outline-offset:-6px; }',
      /* ---- o aviso de contraste, no formulário ---- */
      '.me-contraste{ margin:10px 0 0; padding:9px 12px; border-radius:2px;',
      '  font-size:11.5px; line-height:1.6; }',
      '.me-contraste.is-bom{ background:#E2EDE4; color:#2F6B3F; }',
      '.me-contraste.is-ruim{ background:#F7E4E0; color:#A33A28; }',
      /* ---- o registro de versões ---- */
      '.me-lista{ margin-top:20px; display:flex; flex-direction:column; }',
      '.me-versao{ display:flex; align-items:center; gap:14px; padding:13px 0;',
      '  border-top:1px solid #DCD5C4; }',
      '.me-versao > div{ flex:1; min-width:0; }',
      '.me-versao b{ display:block; font-weight:500; font-size:13px; }',
      '.me-versao span{ display:block; margin-top:3px; font-size:11px; opacity:.62; }',
      '.me-versao em{ font-style:normal; color:#2F6B3F; }',
      '.me-versao .me-bt{ flex:none; color:#3A3A28; border-color:#CFC8B2; }',
      '.me-versao .me-bt:hover{ background:rgba(58,58,40,.08); }',
      /* ---- o endereço da prévia ---- */
      '.me-elo{ width:100%; margin-top:16px; padding:12px 13px; border:1px solid #CFC8B2;',
      '  border-radius:2px; background:#fff; font:400 12px/1.4 "IBM Plex Mono",ui-monospace,monospace;',
      '  color:#3A3A28; }',
      '@media (max-width:620px){',
      '  .me-barra{ left:12px; right:12px; bottom:12px; transform:none; max-width:none; padding:12px 14px; gap:10px; }',
      '  .me-barra__conta{ order:3; width:100%; text-align:center; font-size:11px; }',
      '  .me-barra__acoes{ margin-left:auto; }',
      '}'
    ].join('\n');
    document.head.appendChild(css);
  }
})();
