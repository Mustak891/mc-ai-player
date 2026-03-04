$apkPath = "android/app/build/outputs/apk/release/app-release.apk"

if (-not (Test-Path $apkPath)) {
    Write-Error "APK not found at $apkPath. Build release first."
    exit 1
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk = Get-Item $apkPath
Write-Host "APK: $($apk.FullName)"
Write-Host ("Size: {0:N2} MB" -f ($apk.Length / 1MB))
Write-Host ""
Write-Host "Top 20 largest entries:"

$zip = [IO.Compression.ZipFile]::OpenRead($apkPath)
try {
    $zip.Entries |
        Sort-Object Length -Descending |
        Select-Object -First 20 FullName, Length |
        Format-Table -AutoSize
} finally {
    $zip.Dispose()
}
