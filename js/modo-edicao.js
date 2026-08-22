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
  var LIGADO = 'modo-edicao:ligado';
  var PASTA_ENVIADAS = 'img/enviadas';   /* onde a mídia enviada é guardada */
  var LIMITE_MB = 24;          /* acima disso a API do GitHub fica instável */

  if (!window.fetch || !window.localStorage) return;

  var querEditar = /[?&]editar=1/.test(location.search) ||
                   sessionStorage.getItem(LIGADO) === '1';
  if (!querEditar) { atalhoDeEntrada(); return; }

  /* quem entrou continua dentro ao navegar entre as páginas do site */
  sessionStorage.setItem(LIGADO, '1');

  var repo = null, ramo = 'main';
  var mudancas = {};           /* caminho -> texto */
  var arquivos = [];           /* { caminho, nome, arquivo, url } */
  var conteudo = null;         /* o conteudo.json inteiro, como está no ar */
  var barra = null, aviso = null;

  document.addEventListener('DOMContentLoaded', comeca);
  if (document.readyState !== 'loading') comeca();
  var jaComecou = false;

  function comeca() {
    if (jaComecou) return;
    jaComecou = true;
    estilo();
    lerConfiguracao()
      .then(function () {
        var token = localStorage.getItem(CHAVE_TOKEN);
        if (!token) return pedeToken();
        return confere(token).then(function (ok) { return ok ? liga() : pedeToken('O token não abre este repositório. Confira se ele dá acesso a ' + repo + ' com Contents: Read and write.'); });
      })
      .catch(function (e) { pedeToken('Não consegui ler a configuração do painel: ' + e.message); });
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
    return fetch('https://api.github.com' + caminho, opcoes);
  }

  function confere(token) {
    localStorage.setItem(CHAVE_TOKEN, token);
    return api('/repos/' + repo)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return !!(d && d.permissions && d.permissions.push); })
      .catch(function () { return false; });
  }

  /* ==================================================================
     a porta
     ================================================================== */
  function pedeToken(recado) {
    var fundo = document.createElement('div');
    fundo.className = 'me-porta';
    fundo.innerHTML =
      '<form class="me-porta__carta">' +
        '<p class="me-porta__olho">Modo Edição</p>' +
        '<h2>Entrar para editar</h2>' +
        '<p class="me-porta__prosa">Cole o token de acesso do GitHub. Ele fica só neste navegador ' +
          'e some quando você sair.</p>' +
        (recado ? '<p class="me-porta__erro"></p>' : '') +
        '<input class="me-porta__campo" type="password" autocomplete="off" spellcheck="false" ' +
          'placeholder="github_pat_…" aria-label="Token de acesso">' +
        '<div class="me-porta__pe">' +
          '<button class="me-bt me-bt--forte" type="submit">Entrar</button>' +
          '<a class="me-porta__elo" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Criar um token</a>' +
        '</div>' +
        '<a class="me-porta__sai">Voltar ao site</a>' +
      '</form>';
    document.body.appendChild(fundo);
    fundo.querySelector('.me-porta__sai').setAttribute('href', location.pathname);
    if (recado) fundo.querySelector('.me-porta__erro').textContent = recado;
    var campo = fundo.querySelector('.me-porta__campo');
    campo.focus();
    fundo.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = campo.value.trim();
      if (!t) return;
      campo.disabled = true;
      confere(t).then(function (ok) {
        if (!ok) {
          campo.disabled = false; campo.value = '';
          var er = fundo.querySelector('.me-porta__erro');
          if (!er) { er = document.createElement('p'); er.className = 'me-porta__erro'; campo.parentNode.insertBefore(er, campo); }
          er.textContent = 'Esse token não abre ' + repo + '. Confira o acesso ao repositório e a permissão Contents: Read and write.';
          campo.focus();
          return;
        }
        fundo.remove();
        liga();
      });
    });
    fundo.querySelector('.me-porta__sai').addEventListener('click', function () {
      sessionStorage.removeItem(LIGADO);
    });
  }

  /* ==================================================================
     ligar
     ================================================================== */
  function liga() {
    document.documentElement.classList.add('me-editando');
    try { document.dispatchEvent(new CustomEvent('modo-edicao:ligado')); } catch (e) {}
    return baixaConteudo().then(function () {
      abreTextos();
      abreMidia();
      montaBarra();
      /* o que chega depois — fichas que abrem, listas que o JS monta */
      var relogio = setInterval(function () { abreTextos(); abreMidia(); }, 1200);
      window.addEventListener('beforeunload', function (e) {
        if (!temMudanca()) return;
        e.preventDefault(); e.returnValue = '';
      });
      window.addEventListener('unload', function () { clearInterval(relogio); });
    });
  }

  function baixaConteudo() {
    return fetch('./conteudo.json', { cache: 'no-cache' })
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

  function ehFolha(el) {
    for (var i = 0; i < el.children.length; i++) {
      var f = el.children[i];
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
      marcaTroca(el, caminho);
    }
  }

  function marcaTroca(el, caminho) {
    var laco = document.createElement('button');
    laco.type = 'button';
    laco.className = 'me-troca me-fora';
    laco.title = el.tagName === 'VIDEO' ? 'Trocar o vídeo' : 'Trocar a fotografia';
    laco.innerHTML = '<span>' + (el.tagName === 'VIDEO' ? 'Trocar vídeo' : 'Trocar foto') + '</span>';

    var pai = el.parentNode;
    if (!pai) return;
    if (getComputedStyle(pai).position === 'static') pai.classList.add('me-relativo');
    pai.appendChild(laco);

    laco.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var campo = document.createElement('input');
      campo.type = 'file';
      campo.accept = el.tagName === 'VIDEO' ? 'video/mp4,video/*' : 'image/*';
      campo.addEventListener('change', function () {
        var arq = campo.files && campo.files[0];
        if (!arq) return;
        if (arq.size > LIMITE_MB * 1048576) {
          fala('Esse arquivo tem ' + (arq.size / 1048576).toFixed(1) + ' MB. O limite aqui é ' +
               LIMITE_MB + ' MB — acima disso o envio ao GitHub falha. Comprima antes.', true);
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
        arquivos = arquivos.filter(function (a) { return a.caminho !== caminho; });
        arquivos.push({ caminho: caminho, nome: nomeLimpo(arq.name), arquivo: arq, url: url });
        el.classList.add('me-trocada');
        pinta();
      });
      campo.click();
    });
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
  function temMudanca() { return Object.keys(mudancas).length > 0 || arquivos.length > 0; }

  function montaBarra() {
    barra = document.createElement('div');
    barra.className = 'me-barra me-fora';
    barra.innerHTML =
      '<span class="me-barra__selo">Modo Edição</span>' +
      '<span class="me-barra__conta" id="me-conta">Clique em qualquer texto para escrever</span>' +
      '<span class="me-barra__acoes">' +
        '<button class="me-bt" type="button" id="me-desfaz">Descartar</button>' +
        '<button class="me-bt me-bt--forte" type="button" id="me-salva">Salvar</button>' +
        '<button class="me-bt me-bt--fino" type="button" id="me-sai">Sair</button>' +
      '</span>';
    document.body.appendChild(barra);
    aviso = document.createElement('div');
    aviso.className = 'me-fala me-fora';
    document.body.appendChild(aviso);

    barra.querySelector('#me-salva').addEventListener('click', salva);
    barra.querySelector('#me-desfaz').addEventListener('click', function () {
      if (!temMudanca()) return;
      if (!confirm('Descartar tudo o que você mudou nesta página?')) return;
      location.reload();
    });
    barra.querySelector('#me-sai').addEventListener('click', function () {
      if (temMudanca() && !confirm('Você tem mudanças não salvas. Sair mesmo assim?')) return;
      sessionStorage.removeItem(LIGADO);
      location.href = location.pathname;
    });
    pinta();
  }

  function pinta() {
    var conta = document.getElementById('me-conta');
    if (!conta) return;
    var t = Object.keys(mudancas).length, m = arquivos.length;
    if (!t && !m) { conta.textContent = 'Clique em qualquer texto para escrever'; barra.classList.remove('is-suja'); return; }
    var partes = [];
    if (t) partes.push(t + (t === 1 ? ' texto' : ' textos'));
    if (m) partes.push(m + (m === 1 ? ' arquivo' : ' arquivos'));
    conta.textContent = partes.join(' e ') + ' por salvar';
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
  function salva() {
    if (!temMudanca()) { fala('Não há nada mudado para salvar.'); return; }
    var bt = document.getElementById('me-salva');
    bt.disabled = true; bt.textContent = 'Salvando…';

    enviaArquivos()
      .then(function (enviados) {
        var chave = pagina();
        conteudo.pagina = conteudo.pagina || {};
        conteudo.pagina[chave] = conteudo.pagina[chave] || {};
        Object.keys(mudancas).forEach(function (c) { conteudo.pagina[chave][c] = mudancas[c]; });
        enviados.forEach(function (a) { conteudo.pagina[chave][a.caminho] = { src: a.destino }; });
        return gravaConteudo();
      })
      .then(function () {
        mudancas = {}; arquivos = [];
        document.querySelectorAll('.me-trocada').forEach(function (e) { e.classList.remove('me-trocada'); });
        pinta();
        fala('Salvo. O site publica a mudança em cerca de um minuto.');
      })
      .catch(function (e) {
        fala('Não deu para salvar: ' + e.message, true);
      })
      .then(function () { bt.disabled = false; bt.textContent = 'Salvar'; });
  }

  function enviaArquivos() {
    if (!arquivos.length) return Promise.resolve([]);
    var fila = arquivos.slice(), enviados = [];
    return fila.reduce(function (antes, a, i) {
      return antes.then(function () {
        fala('Enviando arquivo ' + (i + 1) + ' de ' + fila.length + '…');
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

  function gravaConteudo(segundaTentativa) {
    return api('/repos/' + repo + '/contents/conteudo.json?ref=' + ramo)
      .then(function (r) { return r.ok ? r.json() : { sha: undefined }; })
      .then(function (atual) {
        var texto = JSON.stringify(conteudo, null, 2) + '\n';
        var corpo = {
          message: 'Modo Edição: ' + resumo(),
          content: paraBase64(texto),
          branch: ramo
        };
        if (atual && atual.sha) corpo.sha = atual.sha;
        return api('/repos/' + repo + '/contents/conteudo.json', {
          method: 'PUT', body: JSON.stringify(corpo)
        });
      })
      .then(function (r) {
        if (r.ok) return true;
        if (r.status === 409 && !segundaTentativa) return gravaConteudo(true);
        return r.json().then(function (j) { throw new Error(j.message || ('erro ' + r.status)); });
      });
  }

  function resumo() {
    var t = Object.keys(mudancas).length, m = arquivos.length, partes = [];
    if (t) partes.push(t + (t === 1 ? ' texto' : ' textos'));
    if (m) partes.push(m + (m === 1 ? ' arquivo' : ' arquivos'));
    return partes.join(' e ') + ' em ' + pagina();
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
      '.me-troca{ position:absolute; z-index:60; left:50%; top:50%; transform:translate(-50%,-50%);',
      '  padding:9px 16px; border:0; border-radius:2px; background:rgba(18,16,14,.82); color:#EDE7DA;',
      '  font:400 10px/1 "Jost","Helvetica Neue",Arial,sans-serif; letter-spacing:.22em; text-transform:uppercase;',
      '  cursor:pointer; opacity:0; transition:opacity .25s; pointer-events:auto; white-space:nowrap; }',
      '.me-editando *:hover > .me-troca, .me-troca:focus{ opacity:1; }',
      '.me-trocada{ outline:2px solid #5C7E7D; outline-offset:2px; }',
      '.me-barra{ position:fixed; z-index:2147483000; left:50%; bottom:18px; transform:translateX(-50%);',
      '  display:flex; align-items:center; gap:18px; flex-wrap:wrap; justify-content:center;',
      '  max-width:calc(100vw - 24px); padding:12px 14px 12px 20px; border-radius:3px;',
      '  background:rgba(18,16,14,.94); color:#EDE7DA; box-shadow:0 10px 40px rgba(0,0,0,.32);',
      '  font:400 12px/1.5 "Jost","Helvetica Neue",Arial,sans-serif; }',
      '.me-barra__selo{ font-size:10px; letter-spacing:.28em; text-transform:uppercase; opacity:.62; }',
      '.me-barra__conta{ opacity:.9; }',
      '.me-barra.is-suja .me-barra__conta{ color:#C9D18A; }',
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
      '.me-porta__carta{ width:min(430px,100%); padding:34px; border-radius:3px; background:#F2EDE0; color:#3A3A28;',
      '  font-family:"Jost","Helvetica Neue",Arial,sans-serif; }',
      '.me-porta__olho{ margin:0; font-size:10px; letter-spacing:.3em; text-transform:uppercase; opacity:.6; }',
      '.me-porta__carta h2{ margin:12px 0 0; font:300 27px/1.2 "Cormorant Garamond",Georgia,serif; }',
      '.me-porta__prosa{ margin:12px 0 0; font-size:13px; line-height:1.7; opacity:.8; }',
      '.me-porta__erro{ margin:16px 0 0; padding:12px 14px; border-radius:2px; background:#F3DDD8;',
      '  color:#8C3B2E; font-size:12px; line-height:1.6; }',
      '.me-porta__campo{ width:100%; margin-top:18px; padding:13px 14px; border:1px solid #CFC8B2; border-radius:2px;',
      '  background:#fff; font:400 13px/1 "Jost",Arial,sans-serif; color:#3A3A28; }',
      '.me-porta__campo:focus{ outline:1px solid #5C7E7D; border-color:#5C7E7D; }',
      '.me-porta__pe{ display:flex; align-items:center; gap:18px; margin-top:20px; }',
      '.me-porta__pe .me-bt--forte{ background:#3A3A28; color:#F2EDE0; border-color:#3A3A28; }',
      '.me-porta__elo{ font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#5C7E7D; text-decoration:none; }',
      '.me-porta__sai{ display:inline-block; margin-top:22px; font-size:11px; letter-spacing:.16em;',
      '  text-transform:uppercase; color:#3A3A28; opacity:.5; text-decoration:none; }',
      '@media (max-width:620px){',
      '  .me-barra{ left:12px; right:12px; bottom:12px; transform:none; max-width:none; padding:12px 14px; gap:10px; }',
      '  .me-barra__conta{ order:3; width:100%; text-align:center; font-size:11px; }',
      '  .me-barra__acoes{ margin-left:auto; }',
      '}'
    ].join('\n');
    document.head.appendChild(css);
  }
})();
