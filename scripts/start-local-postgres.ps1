$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localRoot = Join-Path $workspace '.local/postgres'
$dataPath = Join-Path $localRoot 'data'
$logPath = Join-Path $localRoot 'postgres.log'
$pgBin = 'C:/Program Files/PostgreSQL/17/bin'
$port = 55443
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
  & (Join-Path $pgBin 'initdb.exe') -D $dataPath -U postgres -A trust --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'Cannot initialize local PostgreSQL' }
  Add-Content -LiteralPath (Join-Path $dataPath 'postgresql.conf') -Encoding ascii -Value "`nlisten_addresses = '127.0.0.1'`nport = $port"
}
& (Join-Path $pgBin 'pg_ctl.exe') status -D $dataPath | Out-Null
if ($LASTEXITCODE -ne 0) {
  $pgProcess = Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -ArgumentList @('start', '-D', "`"$dataPath`"", '-l', "`"$logPath`"", '-w', '-t', '30') -WindowStyle Hidden -PassThru
  if (!$pgProcess.WaitForExit(35000)) { throw 'Local PostgreSQL startup timed out' }
  if ($pgProcess.ExitCode -ne 0) { throw "Cannot start local PostgreSQL; see $logPath" }
}
$exists = & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $port -U postgres -d postgres -w -tAc "select 1 from pg_database where datname='speego_local'"
if ($LASTEXITCODE -ne 0) { throw 'Cannot connect to local PostgreSQL' }
if ($exists -ne '1') {
  & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $port -U postgres -w speego_local
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create speego_local' }
}
Write-Output "PostgreSQL local ready: 127.0.0.1:$port/speego_local"
