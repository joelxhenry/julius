<#
.SYNOPSIS
    Backs up the Turbo Julius database and inventory images to a destination
    folder (ideally a second disk or a network location).

.DESCRIPTION
    Runs pg_dump for the julius database and copies the inventory-images folder.
    Keeps the most recent N daily backups. Intended to be run on the host on a
    schedule via Task Scheduler.

.EXAMPLE
    .\backup.ps1 -Destination D:\JuliusBackups
    Uses the postgres superuser; will prompt for the password unless -PgPassword
    or the PGPASSWORD environment variable is set.

.EXAMPLE
    .\backup.ps1 -Destination \\NAS\backups\julius -PgUser julius_app -PgPassword "..."
#>
#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [int]   $PgMajor    = 16,
    [int]   $Port       = 5432,
    [string]$Database   = 'julius',
    [string]$PgUser     = 'postgres',
    [string]$PgPassword = '',
    [string]$DataRoot   = 'C:\JuliusData',
    # How many timestamped backup folders to keep.
    [int]   $KeepDays   = 14
)

$ErrorActionPreference = 'Stop'
$pgBin   = "C:\Program Files\PostgreSQL\$PgMajor\bin"
$pgDump  = Join-Path $pgBin 'pg_dump.exe'

function Info($t) { Write-Host "  -> $t" -ForegroundColor White }
function Ok($t)   { Write-Host "  [OK] $t" -ForegroundColor Green }

try {
    if (-not (Test-Path $pgDump)) { throw "pg_dump not found at $pgDump" }
    if (-not (Test-Path $Destination)) { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }

    $stamp     = Get-Date -Format 'yyyy-MM-dd_HHmmss'
    $backupDir = Join-Path $Destination "backup_$stamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    if ($PgPassword) { $env:PGPASSWORD = $PgPassword }

    # Database dump (custom format - restore with pg_restore).
    $dumpFile = Join-Path $backupDir "$Database.dump"
    Info "Dumping database '$Database' -> $dumpFile"
    & $pgDump -U $PgUser -h localhost -p $Port -F c -f $dumpFile $Database
    if ($LASTEXITCODE -ne 0) { throw "pg_dump exited with code $LASTEXITCODE." }
    Ok 'Database dumped.'

    # Inventory images.
    $imagesSrc = Join-Path $DataRoot 'inventory-images'
    if (Test-Path $imagesSrc) {
        $imagesDest = Join-Path $backupDir 'inventory-images'
        Info "Copying images from $imagesSrc"
        Copy-Item -Path $imagesSrc -Destination $imagesDest -Recurse -Force
        Ok 'Images copied.'
    } else {
        Write-Host "  [!]  No images folder at $imagesSrc (skipping)." -ForegroundColor Yellow
    }

    # Retention: remove backup folders older than the newest $KeepDays.
    Info "Pruning old backups (keeping newest $KeepDays)"
    Get-ChildItem -Path $Destination -Directory -Filter 'backup_*' |
        Sort-Object Name -Descending |
        Select-Object -Skip $KeepDays |
        ForEach-Object { Remove-Item $_.FullName -Recurse -Force }
    Ok "Backup complete: $backupDir"
}
catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
