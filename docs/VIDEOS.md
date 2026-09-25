# Vídeos das aulas sem YouTube (Cloudflare R2, grátis)

O banco **não guarda vídeo**: a aula guarda só o link (`lessons.video_url`). O arquivo `.mp4` fica no
Cloudflare R2 e toca direto no LURE Player.

Plano grátis do R2 (por mês): **10 GB armazenados**, tráfego de saída (alunos assistindo) **sem custo**.
O R2 pede um cartão ou PayPal para ser ativado, mas não cobra nada enquanto você ficar dentro desses limites.

## 1. Comprimir o vídeo (HandBrake, grátis)

Vídeo cru de câmera ou OBS pesa muito. Comprima antes de subir:

1. Instale o [HandBrake](https://handbrake.fr/).
2. Abra o vídeo e escolha o preset **General → Fast 720p30** (ou **Fast 1080p30** se tiver tela/código pequeno na aula).
3. Marque **Web Optimized** (aba *Summary*). Isso deixa o aluno pular para qualquer ponto sem baixar o vídeo inteiro.
4. Formato **MP4**. Nome sem espaço nem acento, ex.: `m01-aula-01.mp4`.

Referência: 1 h de aula em 720p fica em torno de 0,5–0,8 GB, então os 10 GB dão algo entre 12 e 20 h de aula.

## 2. Criar o bucket (uma vez só)

1. Crie uma conta em <https://dash.cloudflare.com> → menu **R2 Object Storage** → ative o plano grátis.
2. **Create bucket** → nome `lure-aulas` → local *Automatic*.
3. No bucket: **Settings → Public access**.
   - Tem domínio no Cloudflare? Use **Custom Domains → Connect domain** (ex.: `videos.seudominio.com.br`). É o recomendado.
   - Não tem? Ative **R2.dev subdomain**. Funciona, mas a Cloudflare limita a velocidade dessa URL. Serve para começar.

## 3. Subir cada aula

1. No bucket → **Upload** → arraste o `.mp4` (pode criar pastas, ex.: `modulo-1/`).
2. Clique no arquivo e copie a **Public URL**, ex.:
   `https://pub-xxxxxxxx.r2.dev/modulo-1/m01-aula-01.mp4`
3. Na plataforma: **Admin → Módulos → editar módulo → aula → Link do vídeo** → cole → **Salvar**.

A duração da aula é preenchida sozinha na primeira vez que o vídeo toca.

## Observações

- Links do YouTube continuam funcionando. Dá para misturar os dois no mesmo módulo.
- O link precisa começar com `https://` e terminar em `.mp4`, `.m4v`, `.webm` ou `.mov`.
- Quem tem o link consegue abrir o arquivo. O player esconde o botão de download, mas isso não é proteção
  contra cópia (o YouTube "Não listado" tem a mesma limitação).
- Para acompanhar o uso: bucket → **Metrics**. Se passar de 10 GB, apague versões antigas ou recomprima em 720p.
