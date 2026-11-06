# CoreStream 2050

Player de música web com visual de aplicativo de celular. Toca as músicas guardadas em uma pasta do servidor (Windows Server / IIS) e permite que cada usuário adicione suas próprias músicas, com artista e capa, e crie playlists.

Projeto acadêmico feito apenas com HTML, CSS e JavaScript, sem frameworks e sem dependências externas.

<!-- Adicione aqui uma captura de tela do projeto, por exemplo: -->
<!-- ![Captura de tela](docs/screenshot.png) -->

## Funcionalidades

- **Biblioteca do servidor:** lê as músicas de uma pasta do servidor, incluindo subpastas.
- **Capas:** usa a imagem da música ou da pasta; sem imagem, gera uma capa colorida automaticamente.
- **Adicionar música:** o usuário escolhe o arquivo de áudio, o título, o artista e a capa.
- **Playlists:** criar, renomear, excluir e tocar; adicionar ou remover músicas.
- **Player completo:** mini player fixo, tela cheia com capa grande, barra de progresso, anterior/próxima, aleatório e repetir (desligado, todas ou uma).
- **Busca** na lista de músicas.
- **Controles do celular:** funciona na tela bloqueada e na central de notificações (Media Session API).
- **Atalhos de teclado:** `Espaço` toca/pausa e `Esc` fecha a tela cheia.
- **Layout responsivo**, pensado primeiro para o celular.

## Tecnologias

- HTML5, CSS3 e JavaScript (puro)
- IndexedDB e localStorage (armazenamento no navegador)
- Media Session API
- PowerShell (script que gera a lista de músicas)
- IIS no Windows Server (hospedagem)

## Estrutura do projeto

```
corestream/
├── index.html        # página principal
├── style.css         # estilos
├── script.js         # lógica do player, músicas e playlists
├── gerar-lista.ps1   # gera o musicas.json a partir da pasta musicas
├── web.config        # libera formatos de áudio no IIS
├── musicas.json      # gerado pelo script (não vai para o GitHub)
└── musicas/          # suas músicas e capas (não vai para o GitHub)
```

## Como hospedar no Windows Server (IIS)

1. Crie um site no IIS apontando para uma pasta, por exemplo `C:\inetpub\wwwroot\corestream`.
2. Copie para essa pasta os arquivos `index.html`, `style.css`, `script.js`, `gerar-lista.ps1` e `web.config`.
3. Crie a pasta `musicas` dentro dela e coloque as músicas (subpastas são aceitas).
4. Clique com o botão direito em `gerar-lista.ps1` e escolha **Executar com PowerShell**. Isso cria o `musicas.json`.
5. Acesse o endereço do site no navegador.

> **Importante:** abra o site pelo endereço do servidor. Abrir o `index.html` com dois cliques no computador não funciona, porque o navegador bloqueia a leitura do `musicas.json`.

Se o Windows bloquear a execução do script, rode no PowerShell, dentro da pasta do site:

```powershell
powershell -ExecutionPolicy Bypass -File .\gerar-lista.ps1
```

### Atualizar a lista automaticamente (opcional)

O navegador não consegue listar uma pasta do servidor, por isso o `gerar-lista.ps1` cria o arquivo `musicas.json` com a lista de músicas. Rode o script sempre que adicionar ou remover músicas ou capas. Para automatizar, crie uma tarefa no Agendador de Tarefas (execute em um Prompt de Comando como administrador e troque o caminho pelo da sua pasta):

```
schtasks /Create /TN "CoreStream - atualizar lista" /SC MINUTE /MO 15 /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"C:\inetpub\wwwroot\corestream\gerar-lista.ps1\""
```

## Organizando as músicas e capas

**Nome do arquivo:** use `Artista - Título.mp3`. Se o nome não tiver " - ", o nome da pasta da música é usado como artista.

**Formatos de áudio aceitos:** mp3, flac, ogg, oga, opus, wav, m4a, aac e weba.

**Capas** (a primeira que existir é usada):

1. Imagem com o mesmo nome da música: `Artista - Título.jpg`
2. Imagem da pasta chamada `cover`, `folder`, `front` ou `capa` (`.jpg`, `.jpeg`, `.png` ou `.webp`)

Exemplo:

```
musicas/
├── Anitta/
│   ├── Envolver.mp3
│   └── cover.jpg
├── Queen - Bohemian Rhapsody.mp3
└── Queen - Bohemian Rhapsody.jpg
```

## Músicas e playlists dos usuários

- O botão **+** abre a janela para adicionar uma música (áudio, título, artista e capa).
- Na aba **Playlists** é possível criar e gerenciar playlists. Em cada música, o botão **⋮** adiciona ou remove a música de uma playlist.
- Playlists também podem conter as músicas da pasta do servidor.

## Limitações

- As músicas, capas e playlists adicionadas pelos usuários ficam salvas **no navegador do próprio usuário** (IndexedDB e localStorage). Elas não vão para o servidor, não aparecem em outros aparelhos e não são vistas por outros usuários.
- Limpar os dados do site ou usar aba anônima apaga essas músicas e playlists.
- Apenas as músicas colocadas na pasta `musicas` do servidor são compartilhadas entre todos.
- Para que os controles da tela bloqueada funcionem em todos os aparelhos, o ideal é acessar por HTTPS.

## Melhorias futuras

- Salvar músicas e playlists em um banco de dados no servidor, com upload de arquivos.
- Contas de usuário e playlists compartilhadas.
- Ler a capa embutida nos arquivos MP3.

## Autor

**[Seu nome]** — projeto da disciplina **[nome da disciplina]**, **[nome da faculdade]**.

## Aviso sobre direitos autorais

Não publique no GitHub músicas protegidas por direitos autorais. As pastas `musicas/` e o arquivo `musicas.json` ficam apenas no servidor.
