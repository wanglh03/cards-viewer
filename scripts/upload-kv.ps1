param(
  [Parameter(Mandatory = $true)]
  [string]$NamespaceId,
  [switch]$Remote
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
  python build.py kv
  $wranglerOptions = @(
    "kv", "key", "put", "info.json",
    "--namespace-id", $NamespaceId,
    "--path=kv/info.json"
  )
  if ($Remote) {
    $wranglerOptions += "--remote"
  }
  npx wrangler @wranglerOptions
  if ($LASTEXITCODE -ne 0) {
    throw "Workers KV upload failed"
  }
} finally {
  Pop-Location
}
