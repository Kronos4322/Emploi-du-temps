# ============================================================
# bump.ps1 — Invalide le cache de TOUS les assets en une commande.
#
# Usage :  powershell -ExecutionPolicy Bypass -File bump.ps1
#
# À lancer après chaque modification de JS ou CSS, AVANT de pousser.
# Cela évite le bug "ma modif n'apparaît pas" causé par le cache navigateur :
#   - met à jour ?v=... sur tous les <script src="js/..."> et <link href="css/...">
#   - met à jour le nom du cache du service worker (sw.js)
# Toutes les versions sont alignées sur un même horodatage (aaaaMMjjHHmm).
# ============================================================

$ErrorActionPreference = 'Stop'
$root    = $PSScriptRoot
$version = Get-Date -Format 'yyyyMMddHHmm'

# UTF-8 sans BOM (évite les problèmes de rendu)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Read-Text  ($p)        { [System.IO.File]::ReadAllText($p) }
function Write-Text ($p, $txt)  { [System.IO.File]::WriteAllText($p, $txt, $utf8NoBom) }

# 1. Bump ?v= sur tous les assets locaux (js/ et css/) dans chaque HTML
$htmlFiles = Get-ChildItem -Path $root -Filter *.html
foreach ($f in $htmlFiles) {
    $content = Read-Text $f.FullName
    # Cible : (src|href)="js/...."  ou  "css/...."  avec ou sans ?v= déjà présent.
    # Ne touche pas aux URL externes (https://...) qui ne commencent pas par js/ ou css/.
    $content = [regex]::Replace(
        $content,
        '((?:src|href)="(?:js|css)/[^"?]+)(?:\?v=[^"]*)?"',
        ('$1?v=' + $version + '"')
    )
    Write-Text $f.FullName $content
}

# 2. Bump le nom du cache du service worker pour forcer son rafraîchissement
$swPath = Join-Path $root 'sw.js'
if (Test-Path $swPath) {
    $sw = Read-Text $swPath
    $sw = [regex]::Replace($sw, "const CACHE = 'edt-v[^']*'", "const CACHE = 'edt-v$version'")
    Write-Text $swPath $sw
}

Write-Host "OK - version $version appliquee a $($htmlFiles.Count) fichiers HTML + sw.js"
