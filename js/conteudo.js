/* ==========================================================================
   conteudo.js — lê o conteudo.json publicado e atualiza a página.

   O HTML já sai da montagem com os textos dentro, então a página está certa
   antes deste arquivo rodar: sem JavaScript, nada muda de errado. Isto aqui
   serve para o dia em que só o JSON for atualizado — a página se acerta
   sozinha, sem montar o site de novo.

   Não mexe em estilo, posição nem estrutura: troca apenas o miolo de quem
   está marcado com data-ed, e os dados dos pratos.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.fetch) return;

  var alvos = document.querySelectorAll('[data-ed]');
  var temPratos = !!document.querySelector('.cartao[data-nome]');
  if (!alvos.length && !temPratos) return;

  fetch('./conteudo.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (dados) {
      if (!dados) return;

      var campos = dados.campos || {};
      for (var i = 0; i < alvos.length; i++) {
        var el = alvos[i];
        var novo = campos[el.getAttribute('data-ed')];
        if (typeof novo === 'string' && el.innerHTML !== novo) el.innerHTML = novo;
      }

      if (temPratos && Array.isArray(dados.pratos)) {
        var pares = { nome: 'nome', descricao: 'desc', notas: 'notas',
                      preco: 'preco', quantidade: 'qtd', subtitulo: 'sub' };
        dados.pratos.forEach(function (p) {
          var cartao = acha(p.id);
          if (!cartao) return;
          Object.keys(pares).forEach(function (k) {
            if (typeof p[k] === 'string') cartao.setAttribute('data-' + pares[k], p[k]);
          });
          /* o nome também aparece escrito no próprio cartão */
          var titulo = cartao.querySelector('.cartao__nome, h3');
          if (titulo && typeof p.nome === 'string' && titulo.textContent !== p.nome) titulo.textContent = p.nome;
        });
      }
    })
    .catch(function () { /* sem conteudo.json a página segue como veio */ });

  function acha(id) {
    var cartoes = document.querySelectorAll('.cartao[data-nome]');
    for (var i = 0; i < cartoes.length; i++) {
      var ref = cartoes[i].getAttribute('data-foto') || cartoes[i].getAttribute('data-slot') || '';
      if (ref.indexOf(id) !== -1) return cartoes[i];
    }
    return null;
  }
})();
