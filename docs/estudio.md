# Estúdio de vídeos e imagens

Pasta `studio/`, feita com [Remotion](https://www.remotion.dev): vídeos e imagens montados em código, com as mesmas cores, fonte (Geist) e logo do site. Fica fora do build do site e não pesa na página.

## Formatos prontos

| Nome | Tamanho | Uso |
|---|---|---|
| `Reels` | 1080×1920, 15s | Reels, Stories, TikTok, Shorts |
| `Feed` | 1080×1350, 15s | Feed do Instagram e LinkedIn |
| `Wide` | 1920×1080, 15s | Site, YouTube, apresentações |
| `Post` | 1080×1350, 5s | Post de feed (vídeo curto ou imagem) |

O vídeo tem 3 cenas: a pergunta ("Alguém confere?"), uma conta **fictícia** sendo conferida item por item e a chamada para o diagnóstico.

## Como usar

```bash
npm --prefix studio install   # uma vez
npm run studio                # abre o editor no navegador
npm run studio:render         # gera tudo em studio/out/
```

No editor, escolha o formato à esquerda e edite os textos no painel à direita (título, frase em destaque, itens da conta e chamada). O resultado aparece na hora. O botão **Render** exporta o MP4 ou o PNG.

Comandos por formato (dentro de `studio/`): `render:reels`, `render:feed`, `render:wide`, `render:post`, `still:post` (imagem) e `still:capa` (imagem 16:9).

## Elementos reutilizáveis (`studio/src/elements/`)

- `Logo`: símbolo e "ΛFERI".
- `Background`: fundo azul-marinho com brilho e grade.
- `EnergyLine`: linha de energia que se desenha, com pulso amarelo.
- `Headline`: título com palavras surgindo uma a uma e a frase-chave sublinhada à mão.
- `BillCard`: conta sendo conferida, com "Conferido" e "Revisar".
- `CtaPill`: botão principal do site.

## Regras

- Texto segue `docs/estilo.md`: sem prometer resultado, valores de exemplo sempre marcados como fictícios e sem citar IA.
- As cores e a logo são as do site. O teste `tests/studio-brand.test.ts` falha se mudarem só de um lado.

## Licenças

- **Remotion**: gratuito para pessoa física e para empresas com até 3 funcionários. Acima disso, exige licença paga ([remotion.pro](https://www.remotion.pro)).
- **Geist**: fonte com licença OFL, uso livre.

## Imagens e vídeos com IA generativa (fotos realistas)

Não rodam no servidor deste projeto, que não tem placa de vídeo. As opções gratuitas e abertas funcionam num computador com placa de vídeo NVIDIA (12 GB ou mais):

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI): editor visual.
- FLUX.1 [schnell]: gera imagens. Licença Apache 2.0, permite uso comercial.
- Wan 2.x: gera vídeos. Licença Apache 2.0.
