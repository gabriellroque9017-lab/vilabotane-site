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
- As duas garrafas da seção "Nossos vinhos" ainda estão sem foto no pacote de
  design; o lugar delas fica vazio até chegarem as imagens.

Este site é gerado a partir do pacote de design pelo script
`ferramentas/montar-sites.mjs`, um nível acima desta pasta.
