param([int]$Port = 5500, [switch]$NoBrowser)

# ============================================================
#  Relationship Helper
#  - Serve a app Relationship.html em http://localhost:PORT
#  - Publica imagens online (catbox.moe, sem conta) em /upload
# ============================================================

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript"; ".css"="text/css";
           ".json"="application/json"; ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg";
           ".gif"="image/gif"; ".svg"="image/svg+xml"; ".webp"="image/webp"; ".ico"="image/x-icon" }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch { Write-Host "Nao foi possivel abrir a porta $Port. Fecha o que estiver a usa-la ou corre com -Port outro_numero."; Read-Host "Enter para sair"; exit 1 }

Write-Host ""
Write-Host "  Relationship esta a correr em:  http://localhost:$Port/index.html"
Write-Host "  (deixa esta janela aberta enquanto trabalhas; fecha-a para terminar)"
Write-Host ""

if (-not $NoBrowser) { Start-Process "http://localhost:$Port/index.html" }

function Add-Cors($resp) {
  $resp.Headers["Access-Control-Allow-Origin"]  = "*"
  $resp.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
  $resp.Headers["Access-Control-Allow-Headers"] = "*"
}

function Publish-ToCatbox([byte[]]$imgBytes, [string]$filename, [string]$contentType) {
  if (-not $filename)    { $filename = "image.png" }
  if (-not $contentType) { $contentType = "application/octet-stream" }
  $boundary = [System.Guid]::NewGuid().ToString()
  $LF = "`r`n"
  $enc = [System.Text.Encoding]::GetEncoding('iso-8859-1')
  $ms = New-Object System.IO.MemoryStream
  $w = { param($s) $b = $enc.GetBytes($s); $ms.Write($b,0,$b.Length) }
  & $w "--$boundary$LF"
  & $w ("Content-Disposition: form-data; name=`"reqtype`"$LF$LF" + "fileupload$LF")
  & $w "--$boundary$LF"
  & $w ("Content-Disposition: form-data; name=`"fileToUpload`"; filename=`"$filename`"$LF")
  & $w "Content-Type: $contentType$LF$LF"
  $ms.Write($imgBytes,0,$imgBytes.Length)
  & $w $LF
  & $w "--$boundary--$LF"
  $body = $ms.ToArray()
  $r = Invoke-WebRequest -Uri 'https://catbox.moe/user/api.php' -Method Post `
        -ContentType "multipart/form-data; boundary=$boundary" -Body $body -TimeoutSec 60 -UseBasicParsing
  return ($r.Content).Trim()
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $resp = $ctx.Response
    Add-Cors $resp
    $path = $req.Url.AbsolutePath

    if ($req.HttpMethod -eq "OPTIONS") {
      $resp.StatusCode = 204; $resp.Close(); continue
    }

    if ($path -eq "/ping") {
      $b = [Text.Encoding]::UTF8.GetBytes("ok"); $resp.ContentType="text/plain"
      $resp.OutputStream.Write($b,0,$b.Length); $resp.Close(); continue
    }

    if ($path -eq "/upload" -and $req.HttpMethod -eq "POST") {
      try {
        $msIn = New-Object System.IO.MemoryStream
        $req.InputStream.CopyTo($msIn)
        $imgBytes = $msIn.ToArray()
        $fname = $req.Headers["X-Filename"]
        $ctype = $req.ContentType
        $url = Publish-ToCatbox $imgBytes $fname $ctype
        if ($url -notmatch '^https?://') { throw "Resposta inesperada: $url" }
        $b = [Text.Encoding]::UTF8.GetBytes($url); $resp.ContentType="text/plain"
        $resp.OutputStream.Write($b,0,$b.Length)
        Write-Host "  publicada: $url"
      } catch {
        $resp.StatusCode = 500
        $b = [Text.Encoding]::UTF8.GetBytes("ERRO: " + $_.Exception.Message); $resp.ContentType="text/plain"
        $resp.OutputStream.Write($b,0,$b.Length)
        Write-Host "  erro no upload: $($_.Exception.Message)"
      }
      $resp.Close(); continue
    }

    # Static files
    $rel = [System.Uri]::UnescapeDataString($path.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $file = Join-Path $root $rel
    if ((Test-Path $file -PathType Leaf) -and ($file.StartsWith($root))) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      if ($mime.ContainsKey($ext)) { $resp.ContentType = $mime[$ext] }
      $resp.OutputStream.Write($bytes,0,$bytes.Length)
    } else {
      $resp.StatusCode = 404
      $b = [Text.Encoding]::UTF8.GetBytes("404"); $resp.OutputStream.Write($b,0,$b.Length)
    }
    $resp.Close()
  } catch { }
}
