# 📸 슬라이드쇼 갤러리

디렉토리별로 이미지를 관리하고 웹에서 슬라이드쇼로 보여주는 정적 웹앱입니다.
GitHub Pages에서 무료로 호스팅됩니다.

## 사용 방법

### 새 슬라이드쇼 추가
1. `slides/` 폴더 안에 새 폴더 생성 (예: `slides/my-trip/`)
2. 이미지 파일을 해당 폴더에 복사 (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`)
3. 스크립트 실행:
   ```bash
   python generate_manifest.py
   ```
4. 변경사항 GitHub에 push:
   ```bash
   git add .
   git commit -m "Add new slideshow"
   git push
   ```

### 폴더 이름 규칙
| 폴더명 | 표시 제목 | 그룹 |
|--------|----------|------|
| `nature` | Nature | General |
| `01-spring` | Spring | Group 1 |
| `02-summer` | Summer | Group 2 |
| `my_travel_2024` | My Travel 2024 | General |

## 파일 구조
```
├── index.html              # 메인 페이지 (썸네일 그리드)
├── viewer.html             # 슬라이드 뷰어
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── main.js
│       └── viewer.js
├── slides/
│   ├── manifest.json       # 자동 생성 (직접 편집 불필요)
│   └── <폴더>/            # 슬라이드쇼 폴더
└── generate_manifest.py    # manifest 생성 스크립트
```

## 로컬 테스트
```bash
python -m http.server 8080
# http://localhost:8080 접속
```

## 뷰어 조작법
| 키 / 동작 | 기능 |
|----------|------|
| `→` `↓` `Space` | 다음 슬라이드 |
| `←` `↑` | 이전 슬라이드 |
| `Home` | 첫 슬라이드 |
| `End` | 마지막 슬라이드 |
| 스와이프 | 모바일 터치 네비게이션 |
| 하단 썸네일 클릭 | 특정 슬라이드로 이동 |
