$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'PEGA AQUI EL NUEVO TOKEN Y PULSA INTRO' -ForegroundColor Cyan
Write-Host 'No apareceran caracteres mientras lo pegas. Es normal.'
Write-Host ''

$secureToken = Read-Host 'Token personal de Supabase' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
$plainToken = $null

try {
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)

  if ($plainToken -notmatch '^sbp_[A-Za-z0-9_-]{20,}$') {
    throw 'El valor pegado no tiene el formato de un token personal de Supabase.'
  }

  & npx supabase login --token $plainToken --agent no
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase no pudo guardar el token en el almacen local de credenciales.'
  }

  $plainToken = $null

  Write-Host ''
  Write-Host 'Comprobando que Supabase reconoce la cuenta...'
  & npx supabase projects list --agent no
  if ($LASTEXITCODE -ne 0) {
    throw 'El acceso se guardo, pero Supabase no pudo consultar la cuenta.'
  }

  Write-Host ''
  Write-Host 'ACCESO COMPLETADO Y VERIFICADO' -ForegroundColor Green
  Write-Host 'Vuelve a Codex y escribe: listo'
} finally {
  $plainToken = $null
  if ($tokenPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  }
}
