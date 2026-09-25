# Builds dist/attach-and-reply-<version>.xpi
#
# manifest.json must sit at the root of the archive - a wrapping folder makes the
# add-on impossible to install. Entries are therefore added by hand with forward
# slashes instead of relying on Compress-Archive.
#
#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$root = $PSScriptRoot
$manifestPath = Join-Path $root 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

$distDir = Join-Path $root 'dist'
if (-not (Test-Path -LiteralPath $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}
$outFile = Join-Path $distDir "attach-and-reply-$version.xpi"
if (Test-Path -LiteralPath $outFile) {
    Remove-Item -LiteralPath $outFile -Force
}

$excludedDirs = @('.git', '.github', 'dist', 'docs', 'test', 'tools')
$excludedFiles = @('package.json', '.gitignore', '.gitattributes', 'build.ps1')

$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
    $rel = $_.FullName.Substring($root.Length + 1)
    $top = ($rel -split '[\\/]')[0]
    ($excludedDirs -notcontains $top) -and
    ($excludedFiles -notcontains $rel) -and
    ($_.Name -notlike '*.xpi')
}

$zip = [System.IO.Compression.ZipFile]::Open($outFile, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $entryName = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $file.FullName, $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
}
finally {
    $zip.Dispose()
}

# Verify: manifest.json must be a top-level entry.
$check = [System.IO.Compression.ZipFile]::OpenRead($outFile)
try {
    $names = $check.Entries | ForEach-Object { $_.FullName }
}
finally {
    $check.Dispose()
}

if ($names -notcontains 'manifest.json') {
    throw "manifest.json is not at the root of $outFile"
}

# Refuse to hand out a package that fails the checks.
python (Join-Path $root 'tools/check-package.py') --xpi $outFile
if ($LASTEXITCODE -ne 0) {
    throw "check-package.py failed for $outFile"
}

$hash = (Get-FileHash -LiteralPath $outFile -Algorithm SHA256).Hash.ToLower()
$checksumFile = "$outFile.sha256"
Set-Content -LiteralPath $checksumFile -Value ("{0}  {1}" -f $hash, (Split-Path $outFile -Leaf)) -Encoding ascii

Write-Host "Built $outFile"
Write-Host "SHA256 $hash"
Write-Host ("Entries: {0}" -f ($names -join ', '))
