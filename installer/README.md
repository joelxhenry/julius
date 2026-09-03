# Turbo Julius — Host Setup

Turbo Julius runs on a local network. **One machine is the host**: it stores the
shared PostgreSQL database and the inventory images. Every other machine is a
**client workstation** that connects to the host over the LAN.

These scripts provision the host. You only run them **once**, on the host.

---

## What you need

- A Windows 10/11 (64-bit) machine to be the host — ideally always-on.
- Administrator access on that machine.
- The host and all workstations on the same local network.
- **Recommended:** give the host a **static / reserved IP** (via your router).
  The workstations connect to it by IP, so a changing IP would break them.

---

## 1. Run the host setup

1. Copy the `installer` folder onto the host machine.
2. Right-click **`host-setup.bat`** → **Run as administrator** → approve the prompt.
3. Wait for it to finish (installing PostgreSQL takes a few minutes). It will:
   - install PostgreSQL,
   - create the `julius` database and a `julius_app` login,
   - allow database connections from your LAN subnet,
   - open the firewall port (private/domain networks only),
   - create and share the `C:\JuliusData` folder for images,
   - write **`C:\JuliusData\connection-info.txt`** with everything the
     workstations need.

Keep `connection-info.txt` — it contains the database password and the network
path to type into each workstation.

### Options

Run from an elevated PowerShell prompt to customise:

```powershell
# Offline install (no internet on the host): download the PostgreSQL installer
# elsewhere and bundle it next to the script.
.\host-setup.ps1 -InstallerPath .\postgresql-16.4-1-windows-x64.exe

# Restrict database access to a specific subnet
.\host-setup.ps1 -LanSubnet 192.168.1.0/24

# Use your own passwords instead of generated ones
.\host-setup.ps1 -AppPassword 'choose-a-strong-one' -SuperPassword '...'
```

| Parameter          | Default            | Purpose                                        |
|--------------------|--------------------|------------------------------------------------|
| `-Port`            | `5432`             | PostgreSQL port                                |
| `-Database`        | `julius`           | Application database name                       |
| `-AppUser`         | `julius_app`       | Login the app uses                             |
| `-LanSubnet`       | auto (`/24`)       | CIDR allowed to connect, e.g. `192.168.1.0/24` |
| `-InstallerPath`   | *(download)*       | Path to a bundled installer (offline)          |
| `-InstallerSha256` | *(none)*           | Verify the installer before running it         |
| `-SkipInstall` / `-SkipShare` / `-SkipFirewall` | off | Skip a step |

The script is **idempotent** — safe to re-run; finished steps are skipped.

---

## 2. First launch (run migrations)

Launch **Turbo Julius once on the host** (or any workstation) and complete the
first-run wizard using the values in `connection-info.txt`. On first successful
connection the app creates all database tables automatically.

---

## 3. Set up each workstation

On every other machine, install Turbo Julius and complete the first-run wizard:

- **Role:** *Client workstation*
- **Database:** the host IP, port, `julius`, `julius_app`, and the password from
  `connection-info.txt`
- **File storage:** *LAN file server*, network path `\\HOST\JuliusData`
  (replace `HOST` with the host's computer name or IP). The app automatically
  uses the `inventory-images` subfolder inside it.

---

## 4. Backups (recommended)

Schedule regular backups of the database and images with `backup.ps1`:

```powershell
.\backup.ps1 -Destination D:\JuliusBackups
```

Create a **Task Scheduler** job to run it daily:

1. Open Task Scheduler → **Create Task** (run whether logged on or not, highest privileges).
2. Trigger: Daily, e.g. 22:00.
3. Action: *Start a program*
   - Program: `powershell.exe`
   - Arguments: `-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\backup.ps1" -Destination "D:\JuliusBackups"`

Restore a database dump with `pg_restore` (see PostgreSQL docs); images restore
by copying the `inventory-images` folder back into `C:\JuliusData`.

---

## Troubleshooting

- **A workstation can't connect to the database.** Confirm the host IP is
  correct and reachable (`ping HOST`), that the firewall rule exists, and that
  the workstation's subnet matches the `-LanSubnet` the script allowed. Re-run
  `host-setup.ps1 -LanSubnet <your-subnet>` if your network uses a different range.
- **"password authentication failed".** Use the exact `julius_app` password from
  `connection-info.txt`. Re-running the script resets it (and reprints it).
- **Images don't load on a workstation.** Verify the workstation can open
  `\\HOST\JuliusData` in File Explorer and has read/write access to the share.
- **PowerShell won't run the script.** Use `host-setup.bat`, or launch with
  `-ExecutionPolicy Bypass` from an elevated prompt.
