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

  /* ------------------------------------------------------------------
     A assinatura não é conteúdo.

     O crédito de desenvolvimento fica fora do editor por `data-nao-editar`
     no HTML. Isto aqui é a segunda tranca, para o caso de alguém mexer no
     conteudo.json direto no repositório: guardamos o parágrafo como ele
     nasceu e, depois de aplicar qualquer coisa, conferimos se ele continua
     de pé. Se não estiver, volta.

     A cópia sai do próprio HTML, não de um texto escrito aqui: assim ela
     acompanha o que cada página diz, sem uma segunda versão para manter.
     ------------------------------------------------------------------ */
  var ASSINA = /desenvolvido por/i;
  var CREDITO = (function () {
    var todos = document.querySelectorAll('.rodape__credito, .rodape__direitos');
    for (var i = 0; i < todos.length; i++) {
      if (ASSINA.test(todos[i].textContent || '')) {
        return { classe: todos[i].className, html: todos[i].outerHTML,
                 pai: todos[i].parentNode, depois: todos[i].nextSibling };
      }
    }
    return null;
  })();

  function creditoDePe() {
    var todos = document.querySelectorAll('.rodape__credito, .rodape__direitos');
    for (var i = 0; i < todos.length; i++) {
      if (ASSINA.test(todos[i].textContent || '')) return todos[i];
    }
    return null;
  }

  function garanteCredito() {
    if (!CREDITO || creditoDePe()) return;
    var molde = document.createElement('div');
    molde.innerHTML = CREDITO.html;
    var novo = molde.firstElementChild;
    if (!novo) return;
    /* o parágrafo ainda existe, mas foi esvaziado: troca-se o miolo */
    var mesmo = document.querySelector('.' + String(CREDITO.classe).split(' ')[0]);
    if (mesmo) { mesmo.parentNode.replaceChild(novo, mesmo); return; }
    /* sumiu de vez: volta ao lugar de onde saiu */
    if (!CREDITO.pai || !CREDITO.pai.parentNode) return;
    var depois = (CREDITO.depois && CREDITO.depois.parentNode === CREDITO.pai) ? CREDITO.depois : null;
    CREDITO.pai.insertBefore(novo, depois);
  }

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
        if (valor && typeof valor === 'object') {
          /* um vídeo tirado sai da página inteiro: parar de tocar não basta,
             o navegador ainda baixaria o arquivo */
          if (valor.removido) {
            if (alvo.tagName === 'VIDEO') { try { alvo.pause(); } catch (e) {} }
            if (alvo.parentNode) alvo.parentNode.removeChild(alvo);
            continue;
          }
          if (valor.src) { trocaMidia(alvo, valor.src); continue; }
        }
        if (typeof valor === 'string' && alvo.innerHTML !== valor) alvo.innerHTML = valor;
      }
    }

    cuidaDaCarta(dados);
    cuidaDasSecoes(dados);
    garanteCredito();

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

  /* ------------------------------------------------------------------
     A carta: quem saiu e quem entrou.

     Os 17 pratos vivem no HTML. O conteudo.json guarda apenas as decisões
     tomadas depois: uma lista de quem foi retirado e as receitas inteiras
     de quem foi acrescentado. Assim a carta muda sem tocar no código, e o
     HTML continua sendo o que ele é — o ponto de partida.

     Um prato novo é feito do molde de um que já está lá: mesmas classes,
     mesma estrutura, mesmo comportamento. Nada de um cartão de segunda
     categoria que não abre a ficha nem responde ao filtro.
     ------------------------------------------------------------------ */
  function cuidaDaCarta(dados) {
    var grade = document.querySelector('.pratos');
    if (!grade) return;
    var mexeu = false;

    mexeu = tira(grade, 'data-prato-id', dados.pratosRemovidos) || mexeu;
    mexeu = tira(grade, 'data-chef-id', dados.chefRemovidos) || mexeu;
    mexeu = poe(grade, 'data-prato-id', dados.pratosNovos, montaCartao) || mexeu;
    mexeu = poe(grade, 'data-chef-id', dados.chefNovos, montaChef) || mexeu;

    if (mexeu) {
      try { document.dispatchEvent(new CustomEvent('carta:mudou')); } catch (e) {}
    }
  }

  function tira(grade, atributo, lista) {
    var mexeu = false;
    var fora = lista || [];
    for (var i = 0; i < fora.length; i++) {
      var velho = grade.querySelector('[' + atributo + '="' + String(fora[i]).replace(/"/g, '') + '"]');
      if (velho) { velho.remove(); mexeu = true; }
    }
    return mexeu;
  }

  function poe(grade, atributo, lista, monta) {
    var mexeu = false;
    var dentro = lista || [];
    for (var j = 0; j < dentro.length; j++) {
      var p = dentro[j];
      if (!p || !p.id) continue;
      if (grade.querySelector('[' + atributo + '="' + String(p.id).replace(/"/g, '') + '"]')) continue;
      var cartao = monta(grade, p);
      if (cartao) { grade.appendChild(cartao); mexeu = true; }
    }
    return mexeu;
  }

  /* ------------------------------------------------------------------
     Um menu do chef é uma sequência, não um prato: o cartão traz a lombada
     com o numeral, o nome e o resumo, e todo o resto — a apresentação, as
     etapas, a harmonização, as fotografias que passam — vive nos atributos
     que o painel lê ao abrir. Também aqui o molde é um que já está na
     página, para que o novo abra e se comporte como os outros.
     ------------------------------------------------------------------ */
  function montaChef(grade, m, fotosLocais) {
    var molde = grade.querySelector('.cartao--chef[data-chef-id]');
    if (!molde) return null;
    var novo = molde.cloneNode(true);
    prepara(novo);
    novo.setAttribute('data-chef-id', m.id);
    novo.setAttribute('data-cat', 'chef');

    var pares = { titulo: 'titulo', ordem: 'ordem', etapasNum: 'etapas-num',
                  linha: 'linha', etapas: 'etapas', harmonia: 'harmonia', pe: 'pe' };
    for (var k in pares) {
      if (!Object.prototype.hasOwnProperty.call(pares, k)) continue;
      novo.setAttribute('data-' + pares[k], typeof m[k] === 'string' ? m[k] : '');
    }
    var fotos = fotosLocais || m.fotos || '';
    novo.setAttribute('data-fotos', fotos);

    var lombada = novo.querySelector('.rotulo');
    if (lombada) {
      lombada.innerHTML = 'Menu do chef <span aria-hidden="true">·</span> ' +
        (m.numeral || String(m.ordem || '').replace(/^Menu do chef\s*/i, '') || '');
    }
    var titulo = novo.querySelector('h3');
    if (titulo) titulo.textContent = m.titulo || '';
    var resumo = novo.querySelector('.cartao--chef__vao p:last-of-type');
    if (resumo && resumo !== lombada) resumo.textContent = m.resumo || '';
    return novo;
  }
  window.__montaChef = montaChef;

  /* o que todo clone precisa esquecer antes de entrar na página */
  function prepara(novo) {
    novo.classList.add('is-vis', 'is-dentro');
    novo.removeAttribute('style');
    novo.hidden = false;
    var sujos = novo.querySelectorAll('[data-me],[data-me-midia],.me-troca,.me-excluir');
    for (var i = 0; i < sujos.length; i++) {
      var s = sujos[i];
      if (s.classList.contains('me-troca') || s.classList.contains('me-excluir')) { s.remove(); continue; }
      s.removeAttribute('data-me'); s.removeAttribute('data-me-midia');
    }
    novo.removeAttribute('data-me'); novo.removeAttribute('data-me-midia');
    novo.classList.remove('me-relativo', 'me-trocada', 'me-apagada');
    limpaMarcas(novo);
    var netos = novo.querySelectorAll('*');
    for (var n = 0; n < netos.length; n++) limpaMarcas(netos[n]);
  }

  function limpaMarcas(el) {
    if (!el.attributes) return;
    for (var i = el.attributes.length - 1; i >= 0; i--) {
      var nome = el.attributes[i].name;
      if (nome.indexOf('data-ligado') === 0) el.removeAttribute(nome);
    }
  }

  function montaCartao(grade, p, fotoLocal) {
    var molde = grade.querySelector('.cartao[data-prato-id]:not(.cartao--chef)');
    if (!molde) return null;
    var novo = molde.cloneNode(true);

    /* O clone não herda nada do editor. E nasce já revelado: a entrada por
       rolagem é para quem estava na página desde o começo — um prato que
       acaba de chegar não pode ficar invisível esperando a vez dele. */
    prepara(novo);
    novo.setAttribute('data-prato-id', p.id);
    var pares = { cat: 'cat', catNome: 'cat-nome', nome: 'nome', subtitulo: 'sub',
                  notas: 'notas', quantidade: 'qtd', preco: 'preco', descricao: 'desc' };
    for (var k in pares) {
      if (!Object.prototype.hasOwnProperty.call(pares, k)) continue;
      novo.setAttribute('data-' + pares[k], typeof p[k] === 'string' ? p[k] : '');
    }
    novo.setAttribute('data-foto', relativo(p.foto) || '');

    var titulo = novo.querySelector('h3');
    if (titulo) titulo.textContent = p.nome || '';

    var foto = novo.querySelector('img');
    var endereco = fotoLocal || relativo(p.foto);
    if (foto) {
      if (endereco) {
        foto.setAttribute('src', endereco);
        foto.setAttribute('alt', p.nome || '');
        foto.removeAttribute('srcset');
      } else {
        /* sem fotografia ainda: o quadro fica, com o creme da casa */
        foto.removeAttribute('src');
        foto.setAttribute('alt', '');
      }
    }
    return novo;
  }
  window.__montaCartao = montaCartao;

  /* ==================================================================
     Subseções: blocos que a casa acrescenta à página.

     Não são um pedaço de HTML solto guardado no JSON — seria um convite a
     quebrar a página. São um punhado de escolhas (fundo, letra, tamanho,
     imagem e onde ela fica) que viram sempre a mesma estrutura, desenhada
     aqui. Assim a subseção nasce parecida com o resto do site, e nada do
     que a proprietária escreve pode desmontar o layout.

     A cor do texto não é escolhida: ela é deduzida do fundo. Fundo escuro
     pede letra clara e vice-versa — e é a única forma de garantir que uma
     escolha de cor não produza um bloco ilegível.
     ================================================================== */
  var TAMANHOS = {
    peq:    'clamp(15px,1.3vw,17px)',
    normal: 'clamp(17px,1.5vw,19px)',
    grande: 'clamp(20px,2vw,25px)',
    enorme: 'clamp(24px,3vw,34px)'
  };
  var LARGURAS = { peq: '260px', media: '420px', grande: '620px', cheia: '100%' };

  function claridade(hex) {
    var m = String(hex || '').replace('#', '').match(/.{1,2}/g);
    if (!m || m.length < 3) return 1;
    var c = m.slice(0, 3).map(function (h) {
      var v = parseInt(h, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function estiloDasSecoes() {
    if (document.getElementById('me-secao-estilo')) return;
    var e = document.createElement('style');
    e.id = 'me-secao-estilo';
    e.textContent = [
      '.me-secao{ background:var(--me-fundo); color:var(--me-cor); padding:clamp(56px,8vw,120px) var(--margem); }',
      '.me-secao__miolo{ max-width:1180px; margin-inline:auto; display:grid; gap:clamp(24px,4vw,60px); align-items:center; }',
      '.me-secao__miolo--esquerda{ grid-template-columns:auto minmax(0,1fr); }',
      '.me-secao__miolo--direita{ grid-template-columns:minmax(0,1fr) auto; }',
      '.me-secao__miolo--direita .me-secao__foto{ order:2; }',
      '.me-secao__foto img{ display:block; width:var(--me-largura); max-width:100%; height:auto; }',
      '.me-secao__miolo--cheia .me-secao__foto img,',
      '.me-secao__miolo--acima .me-secao__foto img,',
      '.me-secao__miolo--abaixo .me-secao__foto img{ width:var(--me-largura); margin-inline:auto; }',
      '.me-secao__miolo--abaixo .me-secao__foto{ order:2; }',
      '.me-secao__titulo{ font-family:var(--serifa); font-weight:300; line-height:1.1;',
      '  font-size:calc(var(--me-tamanho) * 1.9); margin:0 0 .6em; text-wrap:balance; }',
      '.me-secao__prosa{ font-family:var(--me-fonte); font-size:var(--me-tamanho); line-height:1.8;',
      '  margin:0; max-width:62ch; text-wrap:pretty; }',
      '.me-secao__prosa p + p{ margin-top:1.2em; }',
      '@media (max-width:860px){',
      '  .me-secao__miolo--esquerda, .me-secao__miolo--direita{ grid-template-columns:1fr; }',
      '  .me-secao__miolo--direita .me-secao__foto{ order:0; }',
      '  .me-secao__foto img{ width:100%; }',
      '}'
    ].join('\n');
    document.head.appendChild(e);
  }

  function montaSecao(reg) {
    if (!reg || !reg.id) return null;
    estiloDasSecoes();
    var raiz = getComputedStyle(document.documentElement);
    var fundo = reg.fundo || raiz.getPropertyValue('--tinta').trim() || '#F2EDE0';
    var escuro = claridade(fundo) < 0.35;
    var cor = (escuro ? raiz.getPropertyValue('--marfim') : raiz.getPropertyValue('--tinta'));
    cor = String(cor).trim();
    /* numa página escura, --tinta é o próprio escuro: então o claro vem do marfim */
    if (!escuro && claridade(cor) > 0.5) cor = '#12100E';
    if (escuro && claridade(cor) < 0.5) cor = '#EDE7DA';

    var sec = document.createElement('section');
    sec.className = 'me-secao';
    sec.setAttribute('data-secao-id', reg.id);
    /* o miolo daqui se edita pelo formulário da própria subseção, não pelo
       cursor: dois caminhos para o mesmo texto dariam duas versões dele */
    sec.setAttribute('data-nao-editar', '');
    sec.style.setProperty('--me-fundo', fundo);
    sec.style.setProperty('--me-cor', cor);
    sec.style.setProperty('--me-fonte', 'var(--' + (reg.fonte === 'grot' ? 'grot' : 'serifa') + ')');
    sec.style.setProperty('--me-tamanho', TAMANHOS[reg.tamanho] || TAMANHOS.normal);
    sec.style.setProperty('--me-largura', LARGURAS[reg.imagemLargura] || LARGURAS.media);

    var lugar = reg.imagemLugar || 'esquerda';
    var miolo = document.createElement('div');
    miolo.className = 'me-secao__miolo me-secao__miolo--' + lugar;

    if (reg.imagem) {
      var moldura = document.createElement('div');
      moldura.className = 'me-secao__foto';
      var im = document.createElement('img');
      im.setAttribute('src', relativo(reg.imagem));
      im.setAttribute('alt', reg.titulo || '');
      im.setAttribute('loading', 'lazy');
      im.setAttribute('decoding', 'async');
      moldura.appendChild(im);
      miolo.appendChild(moldura);
    } else {
      miolo.className += ' me-secao__miolo--so-texto';
      miolo.style.gridTemplateColumns = '1fr';
    }

    var texto = document.createElement('div');
    texto.className = 'me-secao__texto';
    if (reg.titulo) {
      var h = document.createElement('h2');
      h.className = 'me-secao__titulo';
      h.textContent = reg.titulo;
      texto.appendChild(h);
    }
    var prosa = document.createElement('div');
    prosa.className = 'me-secao__prosa';
    String(reg.texto || '').split(/\n{2,}/).forEach(function (bloco) {
      var t = bloco.trim();
      if (!t) return;
      var p = document.createElement('p');
      t.split(/\n/).forEach(function (linha, i) {
        if (i) p.appendChild(document.createElement('br'));
        p.appendChild(document.createTextNode(linha));
      });
      prosa.appendChild(p);
    });
    texto.appendChild(prosa);
    miolo.appendChild(texto);
    sec.appendChild(miolo);
    return sec;
  }
  window.__montaSecao = montaSecao;

  function cuidaDasSecoes(dados) {
    var lista = (dados.secoes || []).filter(function (r) {
      return r && r.pagina === paginaAtual();
    });
    if (!lista.length) return;
    for (var i = 0; i < lista.length; i++) {
      var reg = lista[i];
      if (document.querySelector('[data-secao-id="' + String(reg.id).replace(/"/g, '') + '"]')) continue;
      var bloco = montaSecao(reg);
      if (!bloco) continue;
      var ancora = reg.depois ? porCaminho(reg.depois) : null;
      if (ancora && ancora.parentNode) ancora.parentNode.insertBefore(bloco, ancora.nextSibling);
      else (document.querySelector('main') || document.body).appendChild(bloco);
    }
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
