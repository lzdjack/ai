#!/usr/bin/env python3
"""按章节号读取 docs/ 下的文档，只输出需要的那几节，避免整份通读。

用法：
  python3 scripts/doc-section.py 06              列出 06 的章节目录（带行号，很短）
  python3 scripts/doc-section.py 06 3.6          输出 06 的 §3.6（到下一个同级或更高级标题为止）
  python3 scripts/doc-section.py 06 3.6 2.12     一次输出多节
  python3 scripts/doc-section.py 05 3a           05 的「3a 回答 Bot」
  python3 scripts/doc-section.py 07 9            07 的任务台账

章节号匹配标题的第一个词（去掉末尾的「.」「、」）；匹配不到时退回为标题包含该文字。
"""
import pathlib
import re
import sys

DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
HEAD = re.compile(r"^(#{1,6})\s+(.*)$")


def find_doc(num: str) -> pathlib.Path:
    hits = sorted(DOCS.glob(f"{num}-*.md"))
    if not hits:
        sys.exit(f"找不到 docs/{num}-*.md")
    return hits[0]


def headings(lines):
    """返回 [(行号, 级别, 标题文字)]，跳过代码块里的 #。"""
    out, fence = [], False
    for i, line in enumerate(lines):
        if line.startswith("```"):
            fence = not fence
            continue
        if fence:
            continue
        m = HEAD.match(line)
        if m:
            out.append((i, len(m.group(1)), m.group(2).strip()))
    return out


def section_id(title: str) -> str:
    first = title.split()[0] if title.split() else ""
    return first.rstrip(".、")


def pick(heads, key):
    key = key.lstrip("§").rstrip(".、")
    exact = [h for h in heads if section_id(h[2]) == key]
    if exact:
        return exact[0]
    loose = [h for h in heads if key in h[2]]
    return loose[0] if loose else None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = find_doc(sys.argv[1])
    lines = path.read_text(encoding="utf-8").splitlines()
    heads = headings(lines)
    if len(sys.argv) == 2:
        print(f"# {path.name}（{len(lines)} 行）")
        for i, lvl, title in heads:
            if lvl >= 2:
                print(f"{i + 1:>5}  {'  ' * (lvl - 2)}{title}")
        return
    for key in sys.argv[2:]:
        h = pick(heads, key)
        if not h:
            print(f"!! {path.name} 里没有章节「{key}」，先不带章节号运行看目录")
            continue
        start, lvl, _ = h
        end = len(lines)
        for i, l2, _t in heads:
            if i > start and l2 <= lvl:
                end = i
                break
        print(f"--- {path.name} 第 {start + 1}–{end} 行 ---")
        print("\n".join(lines[start:end]).rstrip())
        print()


if __name__ == "__main__":
    main()
