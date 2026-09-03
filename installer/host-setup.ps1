<#
.SYNOPSIS
    Provisions a Windows machine as the Turbo Julius host: installs PostgreSQL,
    creates the application database + role, opens the database to the LAN, and
    shares the file-storage folder.

.DESCRIPTION
    Run this once on the machine that will store the shared database and files.
    The script is idempotent - re-running it skips steps that are already done.

    When it finishes it writes C:\JuliusData\connection-info.txt containing every
    value a workstation needs to type into the Turbo Julius first-run wizard.

.NOTES
    Must be run as Administrator (right-click host-setup.bat > Run as
    administrator, or run this file from an elevated PowerShell prompt).

.EXAMPLE
    .\host-setup.ps1
    Installs PostgreSQL 16, auto-detects the LAN subnet, generates passwords.

.EXAMPLE
    .\host-setup.ps1 -InstallerPath .\postgresql-16.4-1-windows-x64.exe -LanSubnet 192.168.1.0/24
    Offline install from a bundled installer, explicit subnet.
#>
#Requires -Version 5.1
[CmdletBinding()]
param(
    # PostgreSQL major version / installer version. Used for the download URL and
    # to locate the install (C:\Program Files\PostgreSQL\<major>).
    [string]$PgVersion   = '16.4-1',
    [int]   $PgMajor     = 16,
    [int]   $Port        = 5432,
    [string]$Database    = 'julius',
    [string]$AppUser     = 'julius_app',
    # Leave blank to auto-generate a strong password (printed at the end).
    [string]$AppPassword    = '',
    [string]$SuperPassword  = '',
    [string]$DataRoot    = 'C:\JuliusData',
    [string]$ShareName   = 'JuliusData',
    # LAN CIDR allowed to reach the database, e.g. 192.168.1.0/24.
    # Blank = auto-detect a /24 from the active adapter.
    [string]$LanSubnet   = '',
    # Offline install: path to a downloaded postgresql-*-windows-x64.exe.
    [string]$InstallerPath  = '',
    # Optional SHA-256 of the installer to verify before running it.
    [string]$InstallerSha256 = '',
    [switch]$SkipInstall,
    [switch]$SkipShare,
    [switch]$SkipFirewall
)

$ErrorActionPreference = 'Stop'
$script:PgRoot   = "C:\Program Files\PostgreSQL\$PgMajor"
$script:PgBin    = Join-Path $script:PgRoot 'bin'
$script:PgData   = Join-Path $script:PgRoot 'data'
$script:Service  = "postgresql-x64-$PgMajor"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Section($Text) {
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor Cyan
}

function Write-Step($Text)  { Write-Host "  -> $Text" -ForegroundColor White }
function Write-Ok($Text)    { Write-Host "  [OK] $Text" -ForegroundColor Green }
function Write-Warn2($Text) { Write-Host "  [!]  $Text" -ForegroundColor Yellow }

function Assert-Admin {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'This script must be run as Administrator. Use host-setup.bat > Run as administrator.'
    }
}

function New-RandomPassword([int]$Length = 20) {
    # Alphanumeric only: avoids shell/psql quoting pitfalls in generated secrets.
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
    $bytes = New-Object 'System.Byte[]' $Length
    $rng   = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $sb = New-Object System.Text.StringBuilder
    foreach ($b in $bytes) { [void]$sb.Append($chars[$b % $chars.Length]) }
    return $sb.ToString()
}

function Get-LanSubnet {
    # Pick the IPv4 address on the adapter that owns the default gateway, then
    # widen it to a /24. Good enough for a flat small-business LAN.
    $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1
    if (-not $cfg) { throw 'Could not detect an active network adapter. Pass -LanSubnet explicitly.' }
    $ip = ($cfg.IPv4Address | Select-Object -First 1).IPAddress
    $octets = $ip.Split('.')
    return "$($octets[0]).$($octets[1]).$($octets[2]).0/24"
}

function Get-PrimaryIPv4 {
    $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1
    if ($cfg) { return ($cfg.IPv4Address | Select-Object -First 1).IPAddress }
    return 'localhost'
}

# Run a SQL statement as the postgres superuser. Uses PGPASSWORD via env.
function Invoke-Psql([string]$Sql, [string]$Db = 'postgres') {
    $psql = Join-Path $script:PgBin 'psql.exe'
    if (-not (Test-Path $psql)) { throw "psql.exe not found at $psql" }
    $env:PGPASSWORD = $script:SuperPasswordResolved
    $out = & $psql -U postgres -h localhost -p $Port -d $Db -tAc $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql failed for: $Sql" }
    return $out
}

# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

function Install-PostgreSQL {
    Write-Section 'PostgreSQL'

    if (Get-Service -Name $script:Service -ErrorAction SilentlyContinue) {
        Write-Ok "PostgreSQL $PgMajor already installed (service $script:Service). Skipping install."
        return
    }
    if ($SkipInstall) { Write-Warn2 'SkipInstall set but PostgreSQL is not installed. Aborting.'; throw 'PostgreSQL not installed.' }

    $installer = $InstallerPath
    if (-not $installer) {
        $url  = "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64.exe"
        $installer = Join-Path $env:TEMP "postgresql-$PgVersion-windows-x64.exe"
        Write-Step "Downloading PostgreSQL installer from $url"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
    } else {
        Write-Step "Using bundled installer: $installer"
        if (-not (Test-Path $installer)) { throw "Installer not found: $installer" }
    }

    if ($InstallerSha256) {
        Write-Step 'Verifying installer SHA-256'
        $actual = (Get-FileHash -Algorithm SHA256 -Path $installer).Hash
        if ($actual -ne $InstallerSha256.ToUpper()) {
            throw "Installer hash mismatch. Expected $InstallerSha256 got $actual."
        }
        Write-Ok 'Installer hash verified.'
    } else {
        Write-Warn2 'No -InstallerSha256 provided; skipping installer integrity check.'
    }

    Write-Step 'Installing PostgreSQL silently (this can take a few minutes)...'
    $pgArgs = @(
        '--mode', 'unattended',
        '--unattendedmodeui', 'minimal',
        '--superpassword', $script:SuperPasswordResolved,
        '--serverport', "$Port",
        '--enable-stackbuilder', '0',
        '--prefix', $script:PgRoot,
        '--datadir', $script:PgData
    )
    $proc = Start-Process -FilePath $installer -ArgumentList $pgArgs -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "PostgreSQL installer exited with code $($proc.ExitCode)." }

    if (-not (Get-Service -Name $script:Service -ErrorAction SilentlyContinue)) {
        throw "Install finished but service $script:Service was not created."
    }
    Write-Ok "PostgreSQL $PgMajor installed."
}

function New-AppDatabase {
    Write-Section 'Database and role'

    Start-Service -Name $script:Service -ErrorAction SilentlyContinue

    # Role
    $roleExists = Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname = '$AppUser'"
    if ($roleExists -eq '1') {
        Write-Ok "Role '$AppUser' already exists. Updating its password."
        Invoke-Psql "ALTER ROLE `"$AppUser`" WITH LOGIN PASSWORD '$($script:AppPasswordResolved)'" | Out-Null
    } else {
        Write-Step "Creating role '$AppUser'"
        Invoke-Psql "CREATE ROLE `"$AppUser`" WITH LOGIN PASSWORD '$($script:AppPasswordResolved)'" | Out-Null
        Write-Ok "Role '$AppUser' created."
    }

    # Database
    $dbExists = Invoke-Psql "SELECT 1 FROM pg_database WHERE datname = '$Database'"
    if ($dbExists -eq '1') {
        Write-Ok "Database '$Database' already exists."
    } else {
        Write-Step "Creating database '$Database' owned by '$AppUser'"
        Invoke-Psql "CREATE DATABASE `"$Database`" OWNER `"$AppUser`"" | Out-Null
        Write-Ok "Database '$Database' created."
    }

    # Ensure the app role can create objects in the public schema (PG15+ locked
    # this down by default). Owning the schema keeps migrations working.
    Write-Step 'Granting schema privileges'
    Invoke-Psql "GRANT ALL ON SCHEMA public TO `"$AppUser`"" $Database | Out-Null
    Invoke-Psql "ALTER SCHEMA public OWNER TO `"$AppUser`"" $Database | Out-Null
    Write-Ok 'Schema privileges granted.'
}

function Enable-LanAccess {
    Write-Section 'LAN access'

    $subnet = $LanSubnet
    if (-not $subnet) { $subnet = Get-LanSubnet }
    Write-Step "Allowing database connections from $subnet"

    # postgresql.conf: listen on all interfaces.
    $conf = Join-Path $script:PgData 'postgresql.conf'
    $marker = '# --- Turbo Julius (added by host-setup) ---'
    $confText = Get-Content -Path $conf -Raw
    if ($confText -notmatch [regex]::Escape($marker)) {
        Add-Content -Path $conf -Value "`r`n$marker`r`nlisten_addresses = '*'`r`n"
        Write-Ok "postgresql.conf: listen_addresses = '*'"
    } else {
        Write-Ok 'postgresql.conf already configured.'
    }

    # pg_hba.conf: scram rule scoped to the app db/user and the LAN subnet.
    $hba = Join-Path $script:PgData 'pg_hba.conf'
    $hbaRule = "host    $Database    $AppUser    $subnet    scram-sha-256"
    $hbaText = Get-Content -Path $hba -Raw
    if ($hbaText -notmatch [regex]::Escape($hbaRule)) {
        Add-Content -Path $hba -Value "`r`n$marker`r`n$hbaRule`r`n"
        Write-Ok "pg_hba.conf: added rule for $AppUser@$Database from $subnet"
    } else {
        Write-Ok 'pg_hba.conf already has the LAN rule.'
    }

    Write-Step 'Restarting PostgreSQL to apply network settings'
    Restart-Service -Name $script:Service
    Write-Ok 'PostgreSQL restarted.'
    return $subnet
}

function Enable-Firewall {
    Write-Section 'Windows Firewall'
    if ($SkipFirewall) { Write-Warn2 'SkipFirewall set; not opening the port.'; return }

    $ruleName = 'Turbo Julius PostgreSQL'
    if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
        Write-Ok "Firewall rule '$ruleName' already exists."
    } else {
        # Scoped to private/domain profiles only - not the public profile.
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $Port -Profile Private,Domain | Out-Null
        Write-Ok "Opened TCP $Port inbound (Private/Domain profiles)."
    }
}

function New-FileShare {
    Write-Section 'File storage share'
    if ($SkipShare) { Write-Warn2 'SkipShare set; not creating the share.'; return }

    $imagesDir = Join-Path $DataRoot 'inventory-images'
    if (-not (Test-Path $imagesDir)) {
        New-Item -ItemType Directory -Path $imagesDir -Force | Out-Null
    }
    Write-Ok "Data folder ready: $DataRoot"

    if (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue) {
        Write-Ok "SMB share '$ShareName' already exists."
    } else {
        # Change access (read/write, not full control) for workstation accounts.
        # Tighten -ChangeAccess to a specific group in a managed environment.
        New-SmbShare -Name $ShareName -Path $DataRoot -ChangeAccess 'Everyone' -Description 'Turbo Julius shared files' | Out-Null
        Write-Ok "Created SMB share '$ShareName' -> $DataRoot"
        Write-Warn2 "Share grants Change access to 'Everyone'. Restrict to a workstation group if required."
    }
}

function Write-ConnectionInfo([string]$Subnet) {
    Write-Section 'Summary'

    $hostIp   = Get-PrimaryIPv4
    $hostName = $env:COMPUTERNAME
    $unc      = "\\$hostName\$ShareName"

    $lines = @(
        'Turbo Julius - Host connection details',
        '======================================',
        "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        '',
        'Enter these in the Turbo Julius first-run wizard on each workstation.',
        '',
        '--- Database (step 2) ---',
        "Host:      $hostIp   (or hostname: $hostName)",
        "Port:      $Port",
        "Database:  $Database",
        "Username:  $AppUser",
        "Password:  $($script:AppPasswordResolved)",
        'SSL:       off',
        '',
        '--- File storage (step 3) ---',
        'Type:      LAN file server',
        "Network path to enter:  $unc",
        "  (the app stores images under $unc\inventory-images)",
        '',
        '--- LAN access ---',
        "Allowed subnet:  $Subnet",
        '',
        '--- PostgreSQL superuser (keep secret) ---',
        "postgres password:  $($script:SuperPasswordResolved)",
        '',
        'Next: launch Turbo Julius once on the host (or any workstation) to run',
        'database migrations, then create your users.'
    )

    $infoPath = Join-Path $DataRoot 'connection-info.txt'
    $lines | Set-Content -Path $infoPath -Encoding UTF8
    Write-Ok "Wrote $infoPath"
    Write-Host ''
    Write-Host ($lines -join "`r`n") -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

try {
    Write-Section 'Turbo Julius - Host setup'
    Assert-Admin

    # Resolve secrets (generate if not supplied).
    $script:SuperPasswordResolved = if ($SuperPassword) { $SuperPassword } else { New-RandomPassword 24 }
    $script:AppPasswordResolved   = if ($AppPassword)   { $AppPassword }   else { New-RandomPassword 20 }

    if (-not (Test-Path $DataRoot)) { New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null }

    Install-PostgreSQL
    New-AppDatabase
    $subnet = Enable-LanAccess
    Enable-Firewall
    New-FileShare
    Write-ConnectionInfo -Subnet $subnet

    Write-Section 'Done'
    Write-Ok 'Host setup complete.'
}
catch {
    Write-Host ''
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '  Setup did not complete. Fix the issue above and re-run this script.' -ForegroundColor Red
    exit 1
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
