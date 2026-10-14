# Thin wrapper for people who used to run this script: the real build lives in
# tools/build.mjs, which is dependency-free and runs on any platform, so the
# reviewer's reproduction and this entry point cannot drift apart.
#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
finally {
    Pop-Location
}
