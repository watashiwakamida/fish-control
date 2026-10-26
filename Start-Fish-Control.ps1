$ErrorActionPreference='Stop'
$panelRoot=$PSScriptRoot
$env:FISH_ROOT='D:\DeepSeekCompanion'
$url='http://127.0.0.1:17860'
$running=$false
try { $r=Invoke-RestMethod "$url/api/status" -TimeoutSec 2; $running=($r.version -eq '0.1.0') } catch {}
if(-not $running){
 $node=(Get-Command node -ErrorAction SilentlyContinue).Source
 if(-not $node){$node='D:\DeepSeekCompanion\runtime\napcat\node.exe'}
 Start-Process -FilePath $node -ArgumentList @("`"$panelRoot\server.mjs`"") -WorkingDirectory $panelRoot -WindowStyle Hidden
 for($i=0;$i -lt 30;$i++){try{$null=Invoke-RestMethod "$url/api/status" -TimeoutSec 1;break}catch{Start-Sleep -Milliseconds 300}}
}
Start-Process $url
