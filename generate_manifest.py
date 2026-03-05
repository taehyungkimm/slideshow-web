#!/usr/bin/env python3
"""
slides/ 폴더를 스캔하여 manifest.json을 자동 생성합니다.

사용법:
    python generate_manifest.py

새 슬라이드 추가 방법:
    1. slides/<폴더명>/ 디렉토리 생성
    2. 이미지 파일 복사 (.jpg, .jpeg, .png, .gif, .webp)
    3. python generate_manifest.py 실행
"""

import os
import json
import re

SLIDES_DIR = "slides"
MANIFEST_PATH = os.path.join(SLIDES_DIR, "manifest.json")
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}


def folder_to_title(name: str) -> str:
    """폴더명을 읽기 좋은 제목으로 변환."""
    name = re.sub(r"^\d+[-_]?", "", name)          # 앞의 숫자 접두사 제거
    name = name.replace("-", " ").replace("_", " ") # 구분자 → 공백
    return " ".join(w.capitalize() for w in name.split())


def folder_to_group(name: str) -> str:
    """폴더명 앞의 숫자가 있으면 그룹 번호 추출, 없으면 기본 그룹."""
    m = re.match(r"^(\d+)", name)
    if m:
        return f"Group {m.group(1)}"
    return "General"


def scan_slides():
    slideshows = []

    if not os.path.isdir(SLIDES_DIR):
        print(f"ERROR: '{SLIDES_DIR}' 폴더가 없습니다.")
        return slideshows

    for folder in sorted(os.listdir(SLIDES_DIR)):
        folder_path = os.path.join(SLIDES_DIR, folder)
        if not os.path.isdir(folder_path):
            continue

        images = sorted([
            f for f in os.listdir(folder_path)
            if os.path.splitext(f)[1].lower() in IMAGE_EXTS
        ])

        if not images:
            print(f"  SKIP (이미지 없음): {folder}/")
            continue

        slideshow_id = folder
        title = folder_to_title(folder)
        group = folder_to_group(folder)
        directory = f"slides/{folder}"
        thumbnail = f"{directory}/{images[0]}"

        slideshows.append({
            "id": slideshow_id,
            "title": title,
            "group": group,
            "directory": directory,
            "thumbnail": thumbnail,
            "images": images
        })
        print(f"  OK: {folder}/ → '{title}' ({len(images)}장)")

    return slideshows


def main():
    print(f"slides/ 폴더 스캔 중...\n")
    slideshows = scan_slides()

    manifest = {"slideshows": slideshows}

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\n완료! {len(slideshows)}개의 슬라이드쇼가 {MANIFEST_PATH}에 저장되었습니다.")


if __name__ == "__main__":
    main()
