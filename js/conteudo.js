/* ==========================================================================
   conteudo.js — lê o conteudo.json publicado e atualiza a página.

   O HTML já sai da montagem com os textos dentro, então a página está certa
   antes deste arquivo rodar: sem JavaScript, nada muda de errado. Isto aqui
   serve para quando só o JSON for atualizado, pelo Modo Edição — a página se
   acerta sozinha, sem montar o site de novo.

   Há duas gerações de marcação convivendo, e as duas continuam valendo:

   · campos/imagens/pratos — as chaves escritas à mão no HTML (data-ed,
     data-ed-img). É o que o painel /admin/ edita.
   · pagina — qualquer trecho da página, endereçado pelo caminho do elemento
     na árvore. É o que o Modo Edição na própria página grava, e por isso
     alcança texto que ninguém marcou antes.

   O caminho vence, quando os dois falam do mesmo elemento: ele é o mais
   recente e o mais específico.

   Não mexe em estilo, posição nem estrutura: troca o miolo de quem está
   endereçado, o endereço de quem é imagem ou vídeo, e os dados dos pratos.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.fetch) return;

  /* ------------------------------------------------------------------
     O endereço de um elemento na árvore.

     Vale o mesmo aqui e no editor — é a mesma função, e é por isso que
     ela mora num lugar só. Quando o elemento tem id, o caminho para ali:
     id é promessa de unicidade. Sem id, desce de pai em filho usando a
     etiqueta e a primeira classe, com o índice entre irmãos iguais.

     Sobrevive a mudança de texto, que é o que a proprietária faz. Não
     sobrevive a mudança de estrutura, que é o que nós fazemos — e quando
     nós mexemos, o site é montado de novo de qualquer jeito.
     ------------------------------------------------------------------ */
  function caminhoDe(el) {
    if (!el || el.nodeType !== 1) return '';
    var partes = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      if (el.id) { partes.unshift('#' + el.id); break; }
      var etiqueta = el.tagName.toLowerCase();
      if (etiqueta === 'body') { partes.unshift('body'); break; }
      var classe = '';
      if (el.classList && el.classList.length) {
        for (var c = 0; c < el.classList.length; c++) {
          /* classes de estado entram e saem com a rolagem: não servem de endereço */
          var nome = el.classList[c];
          if (nome.indexOf('is-') !== 0 && nome.indexOf('js-') !== 0) { classe = '.' + nome; break; }
        }
      }
      /* Conta irmãos pela mesma regra com que porCaminho() vai procurar:
         etiqueta e a classe escolhida. Comparar a lista inteira de classes
         daria dois endereços iguais para <p class="rotulo"> e
         <p class="rotulo rev"> — cada um se acharia filho único. */
      var pai = el.parentNode, indice = 0, total = 0;
      var soClasse = classe ? classe.slice(1) : '';
      if (pai) {
        for (var i = 0; i < pai.children.length; i++) {
          var irmao = pai.children[i];
          if (irmao.tagName !== el.tagName) continue;
          if (soClasse && !irmao.classList.contains(soClasse)) continue;
          total++;
          if (irmao === el) indice = total;
        }
      }
      partes.unshift(etiqueta + classe + (total > 1 ? ':' + indice : ''));
      el = pai;
    }
    return partes.join('>');
  }
  window.__caminhoDe = caminhoDe;

  /* Que página é esta. O editor grava por aqui e o aplicador procura por
     aqui — é a mesma conta, e por isso mora num lugar só. A raiz do site é
     index.html mesmo quando o endereço não diz. */
  function paginaAtual() {
    return location.pathname.split('/').pop() || 'index.html';
  }
  window.__paginaAtual = paginaAtual;

  /* o painel grava caminho absoluto; o site vive numa subpasta */
  function relativo(v) { return (typeof v === 'string' && v.charAt(0) === '/') ? '.' + v : v; }

  /* 'arte.voz' busca { arte: { voz: ... } } */
  function pega(raiz, caminho) {
    var partes = caminho.split('.'), onde = raiz;
    for (var i = 0; i < partes.length; i++) {
      if (!onde || typeof onde !== 'object') return undefined;
      onde = onde[partes[i]];
    }
    return onde;
  }

  function mesmoEndereco(el, novo) {
    var atual = el.getAttribute('src') || '';
    return atual === novo || atual.replace(/^\.\//, '') === novo.replace(/^\.\//, '');
  }

  function trocaMidia(el, endereco) {
    endereco = relativo(endereco);
    if (typeof endereco !== 'string' || !endereco) return;
    if (el.tagName === 'VIDEO') {
      var fonte = el.querySelector('source');
      var antigo = fonte ? fonte.getAttribute('src') : el.getAttribute('src');
      if (antigo === endereco) return;
      if (fonte) fonte.setAttribute('src', endereco); else el.setAttribute('src', endereco);
      el.load();
      var tocar = el.play();
      if (tocar && tocar.catch) tocar.catch(function () {});
      return;
    }
    if (!mesmoEndereco(el, endereco)) el.setAttribute('src', endereco);
  }

  function aplica(dados) {
    if (!dados) return;

    /* ---------- primeira geração: as chaves escritas à mão ---------- */
    var textos = document.querySelectorAll('[data-ed]');
    for (var i = 0; i < textos.length; i++) {
      var el = textos[i];
      var novo = pega(dados.campos, el.getAttribute('data-ed'));
      if (typeof novo === 'string' && el.innerHTML !== novo) el.innerHTML = novo;
    }

    var imagens = document.querySelectorAll('[data-ed-img]');
    for (var j = 0; j < imagens.length; j++) {
      var im = imagens[j];
      trocaMidia(im, pega(dados.imagens, im.getAttribute('data-ed-img')));
    }

    var cartoes = document.querySelectorAll('.cartao[data-nome]');
    if (cartoes.length && Array.isArray(dados.pratos)) {
      var pares = { nome: 'nome', descricao: 'desc', notas: 'notas',
                    preco: 'preco', quantidade: 'qtd', subtitulo: 'sub', foto: 'foto' };
      dados.pratos.forEach(function (p) {
        var cartao = achaPrato(cartoes, p.id);
        if (!cartao) return;
        Object.keys(pares).forEach(function (k) {
          if (typeof p[k] === 'string') cartao.setAttribute('data-' + pares[k], k === 'foto' ? relativo(p[k]) : p[k]);
        });
        var titulo = cartao.querySelector('.cartao__nome, h3');
        if (titulo && typeof p.nome === 'string' && titulo.textContent !== p.nome) titulo.textContent = p.nome;
        var foto = cartao.querySelector('img');
        if (foto && typeof p.foto === 'string') trocaMidia(foto, p.foto);
      });
    }

    /* ---------- segunda geração: qualquer trecho, pelo caminho ---------- */
    var desta = (dados.pagina || {})[paginaAtual()] || {};
    var enderecos = Object.keys(desta);
    for (var k = 0; k < enderecos.length; k++) {
      var caminho = enderecos[k], valor = desta[caminho];
      var alvos = porCaminhoTodos(caminho);
      for (var a = 0; a < alvos.length; a++) {
        var alvo = alvos[a];
        if (valor && typeof valor === 'object' && valor.src) { trocaMidia(alvo, valor.src); continue; }
        if (typeof valor === 'string' && alvo.innerHTML !== valor) alvo.innerHTML = valor;
      }
    }

    /* quem depende do texto para se desenhar refaz as contas agora */
    try {
      document.dispatchEvent(new CustomEvent('conteudo:aplicado'));
    } catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('conteudo:aplicado', true, true);
      document.dispatchEvent(ev);
    }
  }

  /* o caminho de volta: do endereço para o elemento */
  function porCaminho(caminho) {
    var partes = caminho.split('>');
    var onde = null;
    for (var i = 0; i < partes.length; i++) {
      var passo = partes[i];
      if (passo.charAt(0) === '#') {
        onde = document.getElementById(passo.slice(1));
        if (!onde) return null;
        continue;
      }
      if (passo === 'body') { onde = document.body; continue; }
      if (!onde) return null;
      var indice = 1, corte = passo.lastIndexOf(':');
      if (corte > 0) { indice = parseInt(passo.slice(corte + 1), 10) || 1; passo = passo.slice(0, corte); }
      var ponto = passo.indexOf('.');
      var etiqueta = (ponto === -1 ? passo : passo.slice(0, ponto)).toUpperCase();
      var classe = ponto === -1 ? '' : passo.slice(ponto + 1);
      var achou = null, conta = 0;
      for (var j = 0; j < onde.children.length; j++) {
        var f = onde.children[j];
        if (f.tagName !== etiqueta) continue;
        if (classe && !f.classList.contains(classe)) continue;
        conta++;
        if (conta === indice) { achou = f; break; }
      }
      if (!achou) return null;
      onde = achou;
    }
    return onde;
  }
  window.__porCaminho = porCaminho;

  /* As galerias que rodam sem emenda duplicam os seus itens, e a cópia leva o
     mesmo id do original. Quando o endereço é só um id, o valor novo vai para
     todos os que o carregam — senão a cópia continuaria mostrando o antigo
     ao lado do novo. */
  function porCaminhoTodos(caminho) {
    if (caminho.charAt(0) === '#' && caminho.indexOf('>') === -1) {
      var iguais = document.querySelectorAll('[id="' + caminho.slice(1).replace(/"/g, '\\"') + '"]');
      if (iguais.length) return [].slice.call(iguais);
    }
    var um = porCaminho(caminho);
    return um ? [um] : [];
  }

  function achaPrato(cartoes, id) {
    for (var i = 0; i < cartoes.length; i++) {
      var ref = cartoes[i].getAttribute('data-foto') || cartoes[i].getAttribute('data-slot') || '';
      if (ref.indexOf(id) !== -1) return cartoes[i];
    }
    return null;
  }

  window.__aplicaConteudo = aplica;

  fetch('./conteudo.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(aplica)
    .catch(function () { /* sem conteudo.json, a página segue como veio */ });
})();
