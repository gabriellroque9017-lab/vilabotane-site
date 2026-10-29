# Vila Botané — Vassouras, Vale do Café (RJ)

Site da microvinícola Vila Botané. HTML, CSS e JavaScript estáticos, sem build
e sem back-end: pode ser servido por qualquer servidor de arquivos.

| Página | Arquivo | O que é |
| --- | --- | --- |
| Vila Botané | `index.html` | Capa aquarela que seca e vira fotografia, terroir em quatro cenas, vídeo do Tiê, dois vinhos com fichas e a soleira para a casa irmã. |
| Portal | `portal.html` | Porta de entrada das duas casas irmãs; o clique dispara o voo do pássaro. |

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
