# Vila Botané — Vassouras, Vale do Café (RJ)

Site da microvinícola Vila Botané. HTML, CSS e JavaScript estáticos, sem build
e sem back-end: pode ser servido por qualquer servidor de arquivos.

| Página | Arquivo | O que é |
| --- | --- | --- |
| Vila Botané | `index.html` | Capa aquarela que seca e vira fotografia, terroir em quatro cenas, vídeo do Tiê, dois vinhos com fichas e a soleira para a casa irmã. |
| Portal | `portal.html` | Porta de entrada das duas casas irmãs; o clique dispara o voo do pássaro. |
| Loja | `loja.html` | Vitrine com sacola: Pix e cartão pelo Mercado Pago (retirada) ou pedido pelo WhatsApp (envio). Feita à mão, fora da montagem. |

A casa irmã, Casa do Lago, é um site à parte:
<https://gabriellroque9017-lab.github.io/casadolago-site/>

## Rodar na sua máquina

O vídeo do Tiê é baixado por `fetch` e não funciona abrindo o arquivo direto
(`file://`). Suba um servidor:

```bash
npx serve .
# abra http://localhost:3000/
```

## Publicação

GitHub Pages, branch `main`, pasta raiz. Endereço:
<https://gabriellroque9017-lab.github.io/vilabotane-site/>

Para trocar por um domínio próprio: crie um arquivo `CNAME` na raiz com o
domínio, aponte o DNS para o GitHub Pages e atualize os links que apontam para
a Casa do Lago (busque por `github.io` nas páginas).

## Antes de mexer

- O layout, as cores, a tipografia, os textos e todas as animações estão
  aprovados pelo cliente. Não é um projeto para redesenhar.
- Os tempos do voo do pássaro (duração, espera, curva, escala, balanço) foram
  ajustados quadro a quadro: parecem arbitrários porque são.
- Sem framework e sem build: GSAP e Splitting entram por CDN.
- **Pagamento da reserva dos vinhos.** Cada ficha tem "Reservar", que abre um
  painel com duas saídas: conversar no WhatsApp ou pagar pelo Pix. A pessoa
  escolhe quantas garrafas (de 1 a 12) e confirma que tem 18 anos ou mais; só
  então o Pix libera, com o QR e o código copia-e-cola.
  O código é um Pix estático do Banco Central montado no próprio navegador:
  a chave da vinícola (o CNPJ, em `data-chave` no painel `#reserva`), o preço
  que está escrito na ficha vezes a quantidade, e um identificador do vinho
  (TIE, TIE3, TIEPRETO2...). O QR é desenhado por `js/qr.js` (biblioteca MIT,
  baixada só quando a reserva abre). Mudou o preço pelo painel ou pelo modo de
  edição? O Pix acompanha sozinho, sem gerar código à mão.
  Nada é processado aqui: o site não fala com banco nenhum e não há taxa de
  intermediário. A confirmação é manual, pelo comprovante no WhatsApp, que já
  sai com vinho, garrafas, valor e identificador. Os códigos e QRs fixos de uma
  garrafa (`data-codigo` nos botões e `img/pix-*.svg`, feitos por
  `ferramentas/pix-brcode.mjs`) ficam como reserva, caso o preço não possa ser
  lido.
- **Pix e cartão pelo Mercado Pago, e a carta de reserva.** Com
  `data-checkout` (no painel `#reserva`) apontando para a função em
  `../pagamento-cartao/` (Cloudflare Workers), os botões "Pagar no Pix" e
  "Pagar no cartão" levam ao Mercado Pago, cada um só com o seu meio. A função lê o preço do `conteudo.json`, sorteia a chave da carta
  (TIE-7KQ2M-X, TIEPRETO2-…) e a usa como referência da venda; a chave do
  Mercado Pago fica como segredo do Worker, nunca aqui. Na volta
  (`?pagamento=…&ref=…&nome=…`) o site pergunta à função (`/confere`) se a venda
  foi paga: só com "aprovado" do Mercado Pago o painel pede o nome e mostra
  a carta (ave, vinho,
  nome, data, salvar ou imprimir; a chave fica só como referência da venda). Pendente confere sozinho por meio
  minuto; recusado ou sem confirmação fica no aviso com o WhatsApp.
  Com `data-checkout=""` o painel volta ao Pix estático de antes, sem carta.
- **A loja (`loja.html`).** Chega-se a ela pelo menu ("Loja") e pela
  caixa "Loja" logo abaixo dos dois rótulos — não é uma seção da página
  inicial. O clique na caixa a deixa mais verde, faz vinhas com folhas de
  videira brotarem das bordas dela (SVG desenhado na hora) e cobre a tela com
  o creme da loja antes de trocar de página; nova aba, Modo Edição e
  "reduzir movimento" vão direto. Se o `index.html` for montado de novo, esses dois links
  têm de voltar.
  A vitrine é uma lista só, em `conteudo.json` → `loja.produtos` (id, nome,
  linha, preco, categoria vinhos/despensa/objetos, foto, selo, esgotado,
  visivel). Enquanto ninguém mexer nela pelo Modo Edição, vale o `loja.json`.
  No Modo Edição (`loja.html?editar=1`) cada cartão abre os campos e ganha
  ferramentas: trocar foto (reduzida no navegador para 1400 px, em webp, e
  enviada para `img/enviadas`), categoria, mover, esgotado, esconder e tirar;
  "+ Novo produto" acrescenta um. Salvar leva à prévia, como no resto do site.
  A sacola guarda só ids e quantidades no aparelho de quem compra
  (`localStorage`, chave `vb-sacola`). Pix e cartão vão ao mesmo Worker do
  Mercado Pago (`?sacola=tie:1,tiepreto:2&meio=pix`), que relê nome e preço no
  `conteudo.json` publicado — o preço da página não decide a cobrança — e
  devolve para `loja.html?pagamento=…&ref=LOJA-XXXXX-X`. "Pedido confirmado"
  só aparece com o aprovado do Mercado Pago (`/confere`). A página pergunta ao
  Worker se ele já sabe cobrar sacolas (`/loja`); se não souber, a sacola
  segue só pelo WhatsApp. Envio (frete) é sempre combinado no WhatsApp.
- Na seção "Na taça", a rolagem leva a janela do topo do vídeo até o pé da
  taça. Os últimos 6% do quadro nunca aparecem: é onde fica a marca d'água do
  gerador do vídeo. Em janela estreita e alta o vídeo cresce para encher o
  palco (classe `cobre`) em vez de sobrar preto e mostrar a marca.
- As fotos das garrafas na seção "Nossos vinhos" são `img/garrafa-tie.webp` e
  `img/garrafa-tiepreto.webp`, o par de fotos de cima, entre folhas de videira.
  A moldura é 4:5 e recorta pelo centro: se trocar, use uma foto em pé com a
  garrafa inteira no meio.

Este site é gerado a partir do pacote de design pelo script
`ferramentas/montar-sites.mjs`, um nível acima desta pasta.
