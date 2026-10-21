# Mark Supermium profiles as cleanly exited before launch.
# The nightly close has to force-kill the browser, which leaves
# "exit_type":"Crashed" in Preferences, so the next start runs in crash-recovery mode.
# Runs on PowerShell 2.0 (Win Embedded 7). Reads/writes UTF-8 without BOM so the
# non-ASCII bytes in Preferences survive.
# Usage:
#   powershell -File fix_floor_exit.ps1                 (floorboard PC 172.18.0.51: SupermiumFloorA/B)
#   powershell -File fix_floor_exit.ps1 C:\EdgeWall     (lobby PC 172.18.0.208)
$dirs = $args
if ($dirs.Count -eq 0) { $dirs = @('C:\SupermiumFloorA', 'C:\SupermiumFloorB') }
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($d in $dirs) {
  $p = Join-Path $d 'Default\Preferences'
  if (Test-Path $p) {
    $t = [System.IO.File]::ReadAllText($p, $utf8)
    $n = $t.Replace('"exit_type":"Crashed"', '"exit_type":"Normal"').Replace('"exited_cleanly":false', '"exited_cleanly":true')
    if ($n -ne $t) { [System.IO.File]::WriteAllText($p, $n, $utf8) }
  }
}
