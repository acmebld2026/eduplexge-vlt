[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$errors = [System.Collections.Generic.List[string]]::new()

foreach ($required in @('AGENTS.md', 'README.md', '.nojekyll', 'ifirlhkv/index.html', 'admin-4ck2v7p3/index.html')) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $required))) {
        $errors.Add("필수 파일 누락: $required")
    }
}

$tracked = @(git ls-files)
if ($LASTEXITCODE -ne 0) {
    throw 'git ls-files 실행에 실패했습니다.'
}

foreach ($path in $tracked) {
    if ($path -match '^(private-input|private-output|local-mapping)/') {
        $errors.Add("비공개 경로가 Git에 추적됨: $path")
    }
}

$htmlFiles = @($tracked | Where-Object { $_ -match '(^|/)index\.html$' })
foreach ($relativePath in $htmlFiles) {
    $fullPath = Join-Path $root $relativePath
    $content = Get-Content -LiteralPath $fullPath -Raw

    if ($content -match 'file:///') {
        $errors.Add("로컬 file URI 발견: $relativePath")
    }
    if ($content -match '(?i)[a-z]:\\') {
        $errors.Add("Windows 절대경로 발견: $relativePath")
    }

    $robots = [regex]::Matches($content, '(?is)<meta\s+[^>]*name=["'']robots["''][^>]*>')
    if ($robots.Count -ne 1) {
        $errors.Add("robots 메타 태그가 정확히 1개가 아님: $relativePath ($($robots.Count)개)")
    }
    elseif ($robots[0].Value -notmatch '(?i)noindex' -or
            $robots[0].Value -notmatch '(?i)nofollow' -or
            $robots[0].Value -notmatch '(?i)noarchive') {
        $errors.Add("robots 메타에 noindex/nofollow/noarchive가 모두 없음: $relativePath")
    }

    $folder = Split-Path -Parent $relativePath
    if ($folder -notmatch '^(admin-)?[a-z0-9]{8}$') {
        $errors.Add("배포 폴더명이 8자리 ASCII 슬러그 규칙과 다름: $relativePath")
    }
}

if ($errors.Count -gt 0) {
    Write-Host '저장소 검증 실패:' -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host "저장소 검증 통과: HTML $($htmlFiles.Count)개, 추적 파일 $($tracked.Count)개" -ForegroundColor Green
