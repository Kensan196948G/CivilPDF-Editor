<#
.SYNOPSIS
  CivilPDF Editor 用のコードサイニング自己署名証明書を生成し PFX に書き出す。

.DESCRIPTION
  社内配布向けの自己署名証明書を作成する。生成した .cer はクライアントの
  「信頼されたルート証明機関」および「信頼された発行元」へ配布すること
  （GPO / Intune）。さもないと SmartScreen / UAC 警告が出る。

.EXAMPLE
  pwsh -File scripts/gen-selfsigned-cert.ps1 -Password "P@ssw0rd!" -OutDir .\certs
#>
param(
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$Subject = "CN=CivilPDF-DX Internal Code Signing",
  [string]$OutDir = ".\certs",
  [int]$YearsValid = 3
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "Creating self-signed code-signing certificate: $Subject"
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -KeyAlgorithm RSA -KeyLength 3072 `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears($YearsValid)

$securePwd = ConvertTo-SecureString -String $Password -Force -AsPlainText
$pfxPath = Join-Path $OutDir "civilpdf-codesign.pfx"
$cerPath = Join-Path $OutDir "civilpdf-codesign.cer"

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePwd | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

Write-Host ""
Write-Host "PFX (CI 署名用 / 秘匿):    $pfxPath"
Write-Host "CER (クライアント配布用):  $cerPath"
Write-Host ""
Write-Host "次の手順:"
Write-Host " 1. PFX を base64 化し CI Secret CSC_LINK に、Password を CSC_KEY_PASSWORD に設定"
Write-Host "      [Convert]::ToBase64String([IO.File]::ReadAllBytes('$pfxPath')) > pfx.b64"
Write-Host " 2. CER を GPO/Intune でクライアントの Trusted Root + Trusted Publishers へ配布"
Write-Host " 3. PFX は厳重保管。リポジトリにコミットしないこと（certs/ は .gitignore 済み）"
