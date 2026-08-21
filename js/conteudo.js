/* ==========================================================================
   conteudo.js — lê o conteudo.json publicado e atualiza a página.

   O HTML já sai da montagem com os textos dentro, então a página está certa
   antes deste arquivo rodar: sem JavaScript, nada muda de errado. Isto aqui
   serve para quando só o JSON for atualizado, pelo Modo Edição — a página se
   acerta sozinha, sem montar o site de novo.

   Não mexe em estilo, posição nem estrutura: troca o miolo de quem está
   marcado com data-ed, o endereço de quem tem data-ed-img, e os dados dos
   pratos do cardápio.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.fetch) return;

  var textos = document.querySelectorAll('[data-ed]');
  var imagens = document.querySelectorAll('[data-ed-img]');
  var cartoes = document.querySelectorAll('.cartao[data-nome]');
  if (!textos.length && !imagens.length && !cartoes.length) return;

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

  fetch('./conteudo.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (dados) {
      if (!dados) return;

      for (var i = 0; i < textos.length; i++) {
        var el = textos[i];
        var novo = pega(dados.campos, el.getAttribute('data-ed'));
        if (typeof novo === 'string' && el.innerHTML !== novo) el.innerHTML = novo;
      }

      for (var j = 0; j < imagens.length; j++) {
        var im = imagens[j];
        var end = relativo(pega(dados.imagens, im.getAttribute('data-ed-img')));
        if (typeof end === 'string' && end && !mesmoEndereco(im, end)) im.setAttribute('src', end);
      }

      if (cartoes.length && Array.isArray(dados.pratos)) {
        var pares = { nome: 'nome', descricao: 'desc', notas: 'notas',
                      preco: 'preco', quantidade: 'qtd', subtitulo: 'sub', foto: 'foto' };
        dados.pratos.forEach(function (p) {
          var cartao = acha(p.id);
          if (!cartao) return;
          Object.keys(pares).forEach(function (k) {
            if (typeof p[k] === 'string') cartao.setAttribute('data-' + pares[k], k === 'foto' ? relativo(p[k]) : p[k]);
          });
          /* o cartão mostra o nome e a foto: os dois acompanham */
          var titulo = cartao.querySelector('.cartao__nome, h3');
          if (titulo && typeof p.nome === 'string' && titulo.textContent !== p.nome) titulo.textContent = p.nome;
          var foto = cartao.querySelector('img');
          var end2 = relativo(p.foto);
          if (foto && typeof end2 === 'string' && end2 && !mesmoEndereco(foto, end2)) foto.setAttribute('src', end2);
        });
      }
    })
    .catch(function () { /* sem conteudo.json, a página segue como veio */ });

  function mesmoEndereco(img, novo) {
    var atual = img.getAttribute('src') || '';
    return atual === novo || atual.replace(/^\.\//, '') === novo.replace(/^\.\//, '');
  }

  function acha(id) {
    for (var i = 0; i < cartoes.length; i++) {
      var ref = cartoes[i].getAttribute('data-foto') || cartoes[i].getAttribute('data-slot') || '';
      if (ref.indexOf(id) !== -1) return cartoes[i];
    }
    return null;
  }
})();
