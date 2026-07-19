# VLT-5G 결과지 배포 Git 프로젝트 정리

> 확인 기준: 2026-07-15 (KST)
> 로컬 저장소: 임의의 경로에 clone 가능
> 원격 저장소: `https://github.com/acmebld2026/eduplexge-vlt`

## 1. 프로젝트 목적

이 저장소는 VLT-5G 초기상담 결과지와 내부 운영용 페이지를 정적 HTML로 보관하고, GitHub Pages를 통해 배포하는 프로젝트다.

- 별도의 빌드 도구나 서버 애플리케이션은 없다.
- 각 페이지는 슬러그 폴더 아래의 `index.html` 한 파일로 구성된다.
- `master` 브랜치 루트가 GitHub Pages 배포 원본이다.
- `.nojekyll`을 사용해 Jekyll 변환 없이 파일을 그대로 배포한다.

## 2. 저장소 구성

```text
배포/
├── .git/                    Git 이력과 로컬 저장소 설정
├── .nojekyll                GitHub Pages의 Jekyll 처리 비활성화
├── AGENTS.md                다른 로컬에서도 자동 적용되는 작업 지침
├── README.md                작성·검수·배포 운영 기준
├── GIT_프로젝트_정리.md      Git·Pages 운영 현황과 절차
├── assets/                  공용 정적 자산
├── <랜덤 슬러그>/index.html  학부모용 또는 매니저용 결과지
└── admin-<랜덤 슬러그>/
    └── index.html           원장·매니저용 링크 목록
```

이번 문서와 `AGENTS.md`를 포함한 다음 커밋 기준 추적 파일은 총 34개다.

- 학부모용 결과지: 14개
- 매니저용 내부 기록지: 14개
- 관리자 목록: 1개
- 공용 자산: 1개
- 운영 파일: `README.md`, `AGENTS.md`, `GIT_프로젝트_정리.md`, `.nojekyll`

학생 실명과 슬러그의 상세 운영 매핑은 저장소 밖의 `결과지\배포_기록.md`에서도 관리한다. 관리자 목록과 매니저용 페이지는 내부 운영용으로 표시되어 있으나 저장소와 Pages 자체는 공개이므로 접근 제어로 간주하지 않는다.

## 3. Git 및 GitHub 현황

| 항목 | 현재 값 |
|---|---|
| 기본 브랜치 | `master` |
| 원격 이름 | `origin` |
| 원격 저장소 | `acmebld2026/eduplexge-vlt` |
| 저장소 공개 범위 | `PUBLIC` |
| 로컬 HEAD | 커밋 전 `f79e0b8` |
| 원격 `master` | 커밋 전 `f79e0b8` |
| 로컬 변경 상태 | `AGENTS.md`, `README.md`, 본 문서 변경 후 커밋 예정 |
| 전체 커밋 수 | 커밋 전 53개 |
| 최초 커밋 | `f55a9c8` — 2026-07-07, 결과지 배포 초기본 |
| 최신 커밋 | 커밋 전 `f79e0b8` — 조영우 초기상담 결과지 배포 |
| 태그 | 없음 |
| 작업 브랜치 | `master` 단일 브랜치 |
| GitHub Pages 원본 | `master` 브랜치의 `/` |
| HTTPS 강제 | 사용 |

문서 갱신 시작 시 로컬 `master`와 `origin/master`는 `f79e0b8`로 일치했다. 본 문서와 저장소 지침은 다음 커밋으로 `master`에 반영한다.

## 4. 변경 이력 요약

커밋은 다음 흐름으로 누적됐다.

1. 초기 결과지와 관리자 목록 배포
2. 한글 경로를 ASCII 랜덤 슬러그로 변경
3. GitHub Pages 프로젝트 경로에 맞춰 관리자 링크를 상대경로로 수정
4. 학생별 학부모 결과지와 매니저 기록지 추가
5. 로고를 base64로 내장하고 로컬 `file:///` 참조 제거
6. 상담일, 가격, 프로그램 명칭, 진단 수치 및 문구 정정
7. 배포 완료 기준과 검수 절차를 `README.md`에 문서화

커밋 작성자는 3개 계정으로 기록되어 있으며, 대부분의 커밋은 `acmebld2026` 계정에서 작성됐다.

## 5. 현재 GitHub Pages 상태

Git 상태와 실제 Pages 반영 상태는 같지 않으므로 별도로 확인해야 한다.

- 기존 학부모용 페이지 표본: HTTP 200
- 관리자 목록 페이지: HTTP 200
- 사이트 루트: HTTP 404 (`/index.html`이 없기 때문)
- 커밋 전 최신 Pages 대상: `f79e0b8`
- 커밋 전 최신 Pages 상태: `built`

본 문서와 지침을 푸시한 뒤에는 새 커밋을 기준으로 다시 `built` 상태와 필요한 URL의 HTTP 200을 확인한다.

## 6. 표준 작업 절차

### 작업 시작 전

```powershell
Set-Location <clone한 저장소 경로>
pwsh ./scripts/verify-repository.ps1
git status --short --branch
git fetch origin
git log --oneline --decorate -5
```

원격 변경이 있으면 기존 작업과 충돌하지 않는지 확인한 후 반영한다.

### 수정 검토와 커밋

```powershell
git diff --check
git diff -- <수정한 파일>
git add -- <수정한 파일>
git diff --cached --check
git diff --cached
git commit -m "Deploy <대상> counseling report"
```

`git add -A`보다 파일 경로를 명시하는 방식을 권장한다. 실수로 내부 문서나 관계없는 파일이 공개 저장소에 포함되는 것을 줄일 수 있다.

### 원격 배포

```powershell
git push origin master
```

푸시 후에는 커밋이 원격과 일치하는지만 보지 말고 Pages 빌드와 실제 URL을 확인한다.

```powershell
git ls-remote origin refs/heads/master
gh api repos/acmebld2026/eduplexge-vlt/pages/builds/latest
```

최종 완료 조건은 다음과 같다.

1. 최신 Pages 빌드의 커밋이 방금 푸시한 커밋과 일치한다.
2. 빌드 상태가 `built`다.
3. 수정한 모든 공개 URL이 HTTP 200이다.
4. 라이브 HTML 내용이 로컬 최신 파일과 일치한다.

## 7. 되돌리기

이미 푸시한 변경은 이력을 삭제하지 말고 새 되돌리기 커밋을 만든다.

```powershell
git log --oneline -10
git revert <되돌릴-커밋-해시>
git push origin master
```

여러 사람이 사용하는 공개 배포 브랜치에서 `git reset --hard` 후 강제 푸시는 사용하지 않는다.

## 8. 보안 및 개인정보 위험

### 최우선 위험

이 GitHub 저장소는 `PUBLIC`이며 GitHub Pages 페이지도 인증 없이 열 수 있다. `noindex, nofollow, noarchive`는 검색엔진에 대한 요청일 뿐 접근 제어가 아니다.

현재 일부 매니저용 HTML에는 전화번호 형식의 개인정보가 포함되어 있다. 관리자 페이지와 랜덤 슬러그 역시 비밀번호나 권한 검사가 아니므로, 링크 유출·저장소 탐색·Git 이력 조회를 통한 접근을 막지 못한다.

권장 조치는 다음과 같다.

1. 전화번호와 내부 운영 기록을 공개 GitHub Pages에서 즉시 분리한다.
2. 매니저용 자료는 로그인이 필요한 사내 스토리지나 인증형 웹 서비스로 이전한다.
3. 공개 저장소와 과거 Git 이력에 포함된 개인정보 범위를 점검한다.
4. 개인정보가 이미 공개 이력에 들어갔다면 파일 삭제 커밋만으로 끝내지 말고, 이력 정리와 기존 URL 폐기 여부를 검토한다.
5. 관리자 목록 URL과 매니저용 슬러그는 노출된 비밀값으로 간주하고 재사용하지 않는다.

### 저장소 운영 보완 사항

- `.gitignore`가 비공개 입력·출력, 매핑, 임시 파일과 로컬 의존성 디렉터리의 추적을 차단한다.
- `.gitattributes`가 HTML, Markdown, PowerShell, YAML 파일의 LF 줄바꿈을 통일한다.
- `scripts/verify-repository.ps1`와 GitHub Actions가 로컬 경로, 검색 차단 메타, 비공개 경로 추적 여부를 자동 검사한다.
- 태그나 릴리스가 없다. 배포 시점을 명확히 보존하려면 안정 배포에 날짜 태그를 붙이는 방식을 고려할 수 있다.
- 루트 `index.html`이 없어 사이트 기본 주소가 404다. 의도한 경우 유지해도 되지만, 운영 점검 시 장애로 오인되지 않도록 README에 명시하거나 정보 없는 안내 페이지를 둘 수 있다.

## 9. 배포 전 최소 점검표

- [ ] `git status`에 이번 작업 파일만 표시되는가
- [ ] 학생 실명이 폴더명에 포함되지 않았는가
- [ ] 기존 학생은 기존 슬러그를 유지했는가
- [ ] `file:///` 로컬 경로가 0건인가
- [ ] 학부모용 로고가 base64로 내장됐는가
- [ ] 각 HTML에 `noindex, nofollow, noarchive`가 정확히 1회 있는가
- [ ] 공개 금지 문구와 개인정보가 학부모용 페이지에 없는가
- [ ] 관리자 링크가 `../<슬러그>/` 형식의 상대경로인가
- [ ] `git diff --check`와 `git diff --cached --check`가 통과하는가
- [ ] 커밋에 관계없는 파일이 포함되지 않았는가
- [ ] Pages 빌드가 `built`인가
- [ ] 대상 URL이 모두 HTTP 200인가

## 10. 관련 문서

- 저장소 내부 `README.md`: 결과지 작성과 배포 완료 기준
- 저장소 내부 `AGENTS.md`: 다른 로컬에서도 pull 후 자동 적용되는 최우선 작업 지침
- `docs/PORTABLE_WORKFLOW.md`: 다른 PC의 clone, 비공개 입력자료, 검증·배포 절차
- `references/xcm16-types.md`: 저장소 내부 공식 타입명 기준표
- Git 비추적 `local-mapping\`: 비공개 학생·슬러그 매핑과 운영 기록

비공개 매핑과 개인정보는 이 문서나 공개 저장소의 README에 복사하지 않는다.
