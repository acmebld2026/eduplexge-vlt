# 다른 PC에서 이어서 작업하기

이 저장소는 특정 PC의 절대경로를 전제로 하지 않는다. Git, PowerShell 7, GitHub 인증만 준비하면 임의의 디렉터리에 clone하여 배포 결과지 작업을 이어갈 수 있다.

## 1. 최초 준비

```powershell
git clone https://github.com/acmebld2026/eduplexge-vlt.git
Set-Location ./eduplexge-vlt
git switch master
git pull --ff-only origin master
pwsh ./scripts/verify-repository.ps1
```

작업 전에 저장소 루트의 `AGENTS.md`를 끝까지 읽는다. 학부모용 표준 디자인과 `REPORT_DATA` 구조는 `ifirlhkv/index.html`을 기준으로 삼는다.

## 2. 비공개 입력자료 배치

학생 녹취, 검사 PDF, 전화번호, 실명-슬러그 매핑은 공개 저장소에 커밋하지 않는다. 로컬 저장소 안에서 작업하려면 다음처럼 `private-input/` 아래에 둔다. 이 디렉터리는 `.gitignore`로 차단되어 있다.

```text
private-input/
└─ <학생ID>/
   ├─ transcript.txt
   ├─ vlt-report.pdf
   ├─ student-form.pdf
   ├─ parent-form.pdf
   └─ apt/
```

Google Sheets와 관리자 페이지는 저장소에 인증정보를 저장하지 않고 각 작업 환경의 승인된 계정으로 접근한다. 새 PC에서 이어갈 때 필요한 것은 저장소 clone, 해당 학생의 비공개 입력자료, 승인된 Google/GitHub 접근 권한이다.

## 3. 결과지 생성 위치

- 학부모용: 중복되지 않는 ASCII 8자리 폴더의 `index.html`
- 매니저용: 별도의 ASCII 8자리 폴더의 `index.html`
- 관리자 목록: `admin-4ck2v7p3/index.html`
- 공용 이미지: `assets/`
- 공식 타입명: `references/xcm16-types.md`

기존 학생 수정 시에는 기존 슬러그를 유지한다. 신규 결과지는 `ifirlhkv/index.html`의 13개 섹션, 반응형·인쇄 스타일과 `REPORT_DATA` 구조를 복제해 학생별 데이터만 교체한다.

## 4. 검증과 배포

```powershell
pwsh ./scripts/verify-repository.ps1
git diff --check
git status --short
git add -- <변경한 파일 경로만 명시>
git diff --cached --check
git diff --cached
git commit -m "Deploy <student> counseling report"
git push origin master
```

푸시 후 해당 커밋의 GitHub Pages 상태가 `built`인지 확인하고, 변경된 학부모용·매니저용 URL이 HTTP 200인지 직접 검증한다.

## 5. 저장소에 넣지 않는 자료

- 상담 녹취 및 원본 음성·영상
- 학생·학부모 검사 원본과 전화번호
- 실명과 랜덤 슬러그의 비공개 매핑
- Google 인증 파일, 토큰, 쿠키, API 키
- 임시 렌더링 파일과 로컬 캐시

이 저장소는 공개 GitHub Pages 원본이다. `noindex`와 랜덤 슬러그는 검색 노출을 줄일 뿐 접근 통제가 아니다.
