param(
  [string]$Bucket = "cards-viewer-images",
  [switch]$Remote
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$issuersRoot = Join-Path $root "assets\issuers"

$mimeTypes = @{
  ".avif" = "image/avif"
  ".gif" = "image/gif"
  ".ico" = "image/x-icon"
  ".jpeg" = "image/jpeg"
  ".jfif" = "image/jpeg"
  ".jpg" = "image/jpeg"
  ".png" = "image/png"
  ".svg" = "image/svg+xml"
  ".webp" = "image/webp"
}

Get-ChildItem -LiteralPath $issuersRoot -Recurse -File |
  Where-Object { $mimeTypes.ContainsKey($_.Extension.ToLowerInvariant()) } |
  ForEach-Object {
    $relative = $_.FullName.Substring($issuersRoot.Length).TrimStart("\").Replace("\", "/")
    $key = "issuers/$relative"
    $contentType = $mimeTypes[$_.Extension.ToLowerInvariant()]
    $wranglerOptions = @(
      "r2", "object", "put", "$Bucket/$key",
      "--file=$($_.FullName)",
      "--content-type=$contentType"
    )
    if ($Remote) {
      $wranglerOptions += "--remote"
    }
    Write-Host "Uploading $key"
    & npx wrangler @wranglerOptions
    if ($LASTEXITCODE -ne 0) {
      throw "R2 upload failed for $key"
    }
  }
