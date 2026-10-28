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

# 원장 페이지 편집기로 저장한 정본(<html data-page-edited>)을 빌더 산출물이 덮어쓰지 않았는지 확인한다.
$directorEdited = @(git grep -l -e 'data-page-edited=' HEAD -- '*/index.html' 2>$null | ForEach-Object { $_ -replace '^HEAD:', '' })
foreach ($relativePath in $directorEdited) {
    $fullPath = Join-Path $root $relativePath
    if ((Test-Path -LiteralPath $fullPath) -and -not ((Get-Content -LiteralPath $fullPath -Raw) -match '<html\b[^>]*\sdata-page-edited=')) {
        $errors.Add("원장이 고친 정본을 덮어씀(되돌리거나 원장 확인 필요): $relativePath")
    }
}
foreach ($asset in @('assets/page-editor/page-editor.js', 'assets/page-editor/page-editor.css', 'assets/page-editor/editor.bundle.js', 'assets/page-editor/editor.css', 'assets/page-editor/content.css', 'assets/page-editor/tiptap.bundle.js')) {
    if (($tracked -contains $asset) -and -not (Test-Path -LiteralPath (Join-Path $root $asset))) {
        $errors.Add("원장 페이지 편집기 파일 누락: $asset")
    }
}

# admin 기본 정렬(상담 최신순)은 학생에게 연결된 모든 자료의 가장 최근 날짜로 계산한다(상시 규칙, AGENTS.md "admin 학생 목록 정렬").
$admin = Get-Content -LiteralPath (Join-Path $root 'admin-4ck2v7p3/index.html') -Raw
if ($admin -notmatch '<option value="newest" selected>') {
    $errors.Add('admin 기본 정렬이 상담 최신순(newest)이 아님')
}
if ($admin -notmatch 'timestamp:\s*Math\.max\([^\r\n]*activityTimestamps\(\[preAnalysis, mbtiDynamics, growth, sessions\]\)') {
    $errors.Add('admin 상담 최신순 기준일이 연결된 모든 자료의 최근 날짜(activityTimestamps)로 계산되지 않음')
}
foreach ($m in [regex]::Matches($admin, '\b(date|updated):\s*"([^"]*)"')) {
    if ($m.Groups[2].Value -notmatch '^\d{4}\.\d{2}\.\d{2}$') {
        $errors.Add("admin 날짜 형식이 YYYY.MM.DD 가 아님(정렬에서 빠짐): $($m.Groups[1].Value): `"$($m.Groups[2].Value)`"")
    }
}

if ($errors.Count -gt 0) {
    Write-Host '저장소 검증 실패:' -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host "저장소 검증 통과: HTML $($htmlFiles.Count)개, 추적 파일 $($tracked.Count)개" -ForegroundColor Green
