# gerar-lista.ps1
# Cria o arquivo musicas.json com todas as musicas da pasta "musicas" (inclui subpastas)
# e, quando existir, a capa de cada uma.
# Rode novamente sempre que adicionar ou remover musicas ou capas.
#
# Capas (a primeira que existir vence):
#   1. Imagem com o mesmo nome da musica:  "Artista - Musica.jpg"
#   2. Imagem da pasta: cover, folder, front ou capa (.jpg, .jpeg, .png ou .webp)

$raiz  = Split-Path -Parent $MyInvocation.MyCommand.Path
$pasta = Join-Path $raiz 'musicas'
$ext   = '.mp3','.flac','.ogg','.oga','.opus','.wav','.m4a','.aac','.weba'
$img   = '.jpg','.jpeg','.png','.webp'
$nomes = 'cover','folder','front','capa'

if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Path $pasta | Out-Null }

function Achar-Capa($arq) {
    $dir  = $arq.DirectoryName
    $base = [System.IO.Path]::GetFileNameWithoutExtension($arq.Name)
    foreach ($n in (@($base) + $nomes)) {
        foreach ($e in $img) {
            $p = Join-Path $dir ($n + $e)
            if (Test-Path -LiteralPath $p) { return $p }
        }
    }
    return $null
}

$raizMusicas = (Resolve-Path $pasta).Path.TrimEnd('\') + '\'
$lista = @(Get-ChildItem -Path $pasta -Recurse -File |
    Where-Object { $ext -contains $_.Extension.ToLower() } |
    ForEach-Object {
        $capa = Achar-Capa $_
        [pscustomobject]@{
            f = $_.FullName.Substring($raizMusicas.Length).Replace('\','/')
            c = if ($capa) { $capa.Substring($raizMusicas.Length).Replace('\','/') } else { $null }
        }
    })

$json = ConvertTo-Json -InputObject $lista
[System.IO.File]::WriteAllText((Join-Path $raiz 'musicas.json'), $json, (New-Object System.Text.UTF8Encoding($false)))

$comCapa = @($lista | Where-Object { $_.c }).Count
Write-Host ("{0} musicas listadas ({1} com capa) em musicas.json" -f $lista.Count, $comCapa)