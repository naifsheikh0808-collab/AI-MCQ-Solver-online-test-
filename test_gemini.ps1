$key = "AIzaSyAHglldUV4QxEYZUDND6L2cJ-wJq2ep4Kc"
$body = '{"contents":[{"parts":[{"text":"What is 2+2? Reply with just the number."}]}]}'
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=$key"

try {
  $r = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $body -TimeoutSec 15 -ErrorAction Stop
  Write-Host "SUCCESS - Status: $($r.StatusCode)"
  $content = ($r.Content | ConvertFrom-Json).candidates[0].content.parts[0].text
  Write-Host "Gemini replied: $content"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "FAILED - HTTP $code"
  Write-Host $_.Exception.Message
}
