#!/usr/bin/env python3
"""把项目全部核心 Markdown 文档渲染进 scripts/index.template.html，生成唯一的项目总览集合 index.html。

当前自动汇入的文档：
- docs/00-一期产品需求.md  → 需求标签页
- docs/05-链路流转.md      → 方案与链路标签页（链路流转全文）
- docs/04-修复流转方案.md  → 方案与链路标签页（修复流转方案全文）
- docs/06-技术设计方案.md  → 技术设计标签页（含架构/ER/状态机 SVG 图）

用法：python3 scripts/build-index.py
"""
import html
import pathlib
import re
import struct
from tech_diagrams import render_mermaid
from ui_flow_map import render_ui_flow_section

ROOT = pathlib.Path(__file__).resolve().parent.parent
TPL = ROOT / "scripts" / "index.template.html"
OUT = ROOT / "index.html"

DOCS = {
    "REQ": (ROOT / "docs" / "00-一期产品需求.md", "req"),
    "FLOW": (ROOT / "docs" / "05-链路流转.md", "flow"),
    "RUN": (ROOT / "docs" / "04-修复流转方案.md", "run"),
    "TECH": (ROOT / "docs" / "06-技术设计方案.md", "tech"),
}


def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    # 先保护行内代码，避免内部星号被误解析
    code_slots = []

    def _hold_code(m):
        code_slots.append(f"<code>{m.group(1)}</code>")
        return f"\x00CODE{len(code_slots) - 1}\x00"

    t = re.sub(r"`([^`]+)`", _hold_code, t)

    # 图片（相对路径从 docs/ 归一到项目根目录）
    def _img(m):
        alt, src = m.group(1), m.group(2)
        if src.startswith("../"):
            src = src[3:]
        if src.endswith("-亮色.png"):
            dark = src[:-7] + "-暗色.png"
            return (
                f'<div class="gal" style="grid-template-columns:1fr;margin:12px 0"><figure>'
                f'<img class="img-l" src="{src}" alt="{alt}">'
                f'<img class="img-d" src="{dark}" alt="{alt}">'
                f'<figcaption><b>{alt}</b></figcaption></figure></div>'
            )
        return f'<div class="gal" style="grid-template-columns:1fr;margin:12px 0"><figure><img src="{src}" alt="{alt}"></figure></div>'

    t = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", _img, t)
    t = re.sub(r"\*\*待定\*\*", '<span class="tag-tbd">待定</span>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', t)

    for idx, snippet in enumerate(code_slots):
        t = t.replace(f"\x00CODE{idx}\x00", snippet)
    return t


def format_heading_text(text: str) -> str:
    """将标题末尾的「（已确认 2026-11-21）」「（用户确认 2026-11-21）」「（推荐）」渲染为紧凑状态徽章。"""
    badges = []

    def _badge(m):
        full = m.group(1)
        if "已确认" in full or "用户确认" in full:
            cls = "p-green"
        elif "推荐" in full:
            cls = "p-blue"
        elif "待定" in full or "待确认" in full:
            cls = "p-orange"
        else:
            return m.group(0)
        badges.append(f'<span class="pill {cls} h-pill">{html.escape(full)}</span>')
        return ""

    clean = re.sub(r"（([^）]*(?:已确认|用户确认|推荐|待定|待确认)[^）]*)）", _badge, text).strip()
    return inline(clean) + ("".join(badges) if badges else "")


def strip_heading_status(text: str) -> str:
    """目录项展示更紧凑：去掉括号里的日期尾巴，保留简短状态标记。"""
    t = re.sub(r"（(?:已确认|用户确认)\s*\d{4}-\d{2}-\d{2}）", " ✓", text)
    t = re.sub(r"（推荐）", "", t)
    return t.strip()


def split_table_row(row: str) -> list[str]:
    return [c.strip() for c in row.strip().strip("|").split("|")]


def md_to_html(src: str, prefix: str):
    lines = src.splitlines()
    out, toc = [], []
    i, n, hid = 0, len(lines), 0
    while i < n:
        ln = lines[i]
        s = ln.strip()
        if not s:
            i += 1
            continue

        # 水平分隔线
        if re.match(r"^-{3,}$", s):
            out.append('<hr class="md-hr">')
            i += 1
            continue

        # 围栏代码块（含 mermaid）
        if s.startswith("```"):
            lang = s[3:].strip().lower()
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            if i < n:
                i += 1
            code_text = "\n".join(buf)
            if lang == "mermaid":
                rendered = render_mermaid(code_text, prefix)
                if rendered:
                    out.append(rendered)
                else:
                    # 链路流转文档里已放高清总图，mermaid 文字版折叠展示，避免重复占屏
                    if prefix == "flow":
                        out.append(
                            '<details class="md-fold"><summary>查看 Mermaid 文本版（给 AI 阅读）</summary>'
                            f'<pre class="code"><code>{html.escape(code_text)}</code></pre></details>'
                        )
                    else:
                        out.append(f'<pre class="code"><code>{html.escape(code_text)}</code></pre>')
            else:
                out.append(f'<pre class="code"><code>{html.escape(code_text)}</code></pre>')
            continue

        # 引用块
        if s.startswith(">"):
            q_lines = []
            while i < n and lines[i].strip().startswith(">"):
                q_lines.append(re.sub(r"^>\s?", "", lines[i].strip()))
                i += 1
            out.append(f'<blockquote class="md-quote">{"<br>".join(inline(x) for x in q_lines if x)}</blockquote>')
            continue

        # 标题
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            lv = len(m.group(1))
            text = m.group(2)
            if lv == 1:
                i += 1
                continue  # 文档一级标题由页面头部承担
            hid += 1
            anchor = f"{prefix}-{hid}"
            out.append(f'<h{lv} id="{anchor}">{format_heading_text(text)}</h{lv}>')
            if lv <= 3:
                toc.append((lv, anchor, strip_heading_status(text)))
            i += 1
            continue

        # 表格
        if s.startswith("|"):
            rows = []
            while i < n and lines[i].strip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            if len(rows) >= 2:
                head = split_table_row(rows[0])
                body = [split_table_row(r) for r in rows[2:]]
                t = '<div class="tw"><table><thead><tr>' + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
                t += "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
                out.append(t + "</tbody></table></div>")
            continue

        # 无序列表（支持缩进子项）
        if re.match(r"^[-*]\s+", s):
            items = []
            while i < n:
                raw = lines[i]
                st = raw.strip()
                if re.match(r"^[-*]\s+", st):
                    indent = len(raw) - len(raw.lstrip(" "))
                    content = re.sub(r"^[-*]\s+", "", st)
                    items.append((indent, content))
                    i += 1
                elif st and (raw.startswith("  ") or raw.startswith("\t")) and items:
                    # 续行或嵌套数字子项附加到上一项
                    if re.match(r"^\d+\.\s+", st):
                        items.append((4, st))
                    else:
                        prev_ind, prev_txt = items[-1]
                        items[-1] = (prev_ind, prev_txt + " " + st)
                    i += 1
                else:
                    break
            li_html = []
            for indent, content in items:
                cls = ' class="sub-li"' if indent >= 2 else ""
                li_html.append(f"<li{cls}>{inline(content)}</li>")
            out.append("<ul>" + "".join(li_html) + "</ul>")
            continue

        # 有序列表
        if re.match(r"^\d+\.\s+", s):
            items = []
            while i < n:
                raw = lines[i]
                st = raw.strip()
                if re.match(r"^\d+\.\s+", st):
                    items.append(re.sub(r"^\d+\.\s+", "", st))
                    i += 1
                elif st and (raw.startswith("  ") or raw.startswith("\t")) and items:
                    items[-1] = items[-1] + " " + st
                    i += 1
                else:
                    break
            out.append("<ol>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ol>")
            continue

        # 普通段落
        para = [s]
        i += 1
        while i < n and lines[i].strip() and not re.match(r"^(#|\||[-*]\s|\d+\.\s|```|>|-{3,}$)", lines[i].strip()):
            para.append(lines[i].strip())
            i += 1
        cls = ' class="meta"' if para[0].startswith("版本") else ""
        out.append(f"<p{cls}>{inline(' '.join(para))}</p>")

    return "\n".join(out), toc


def build_toc_html(toc) -> str:
    return "".join(
        f'<a class="toc-l{lv}" href="#{anchor}" data-go="{anchor}">{html.escape(text)}</a>'
        for lv, anchor, text in toc
    )


def png_size(path: pathlib.Path) -> tuple[int, int] | None:
    """从 PNG 文件头（IHDR）零依赖读取像素宽高，用于生成预占位尺寸防布局抖动。"""
    if not path.exists():
        return None
    with path.open("rb") as f:
        header = f.read(24)
    if len(header) >= 24 and header[:8] == b"\x89PNG\r\n\x1a\n" and header[12:16] == b"IHDR":
        return struct.unpack(">II", header[16:24])
    return None


def optimize_images(html_text: str) -> tuple[str, int]:
    """为所有 reference/ 图片自动注入 loading="lazy"、decoding="async" 和真实宽高比例占位。"""
    count = 0

    def _repl(m):
        nonlocal count
        tag = m.group(0)
        src_m = re.search(r'src="(reference/[^"]+)"', tag)
        if not src_m:
            return tag
        src = src_m.group(1)
        extras = []
        if "loading=" not in tag:
            extras.append('loading="lazy"')
        if "decoding=" not in tag:
            extras.append('decoding="async"')
        if "width=" not in tag and "height=" not in tag:
            dims = png_size(ROOT / src)
            if dims:
                w, h = dims
                extras.append(f'width="{w}" height="{h}"')
        if not extras:
            return tag
        count += 1
        return tag[:-1] + " " + " ".join(extras) + ">"

    return re.sub(r"<img\b[^>]*>", _repl, html_text), count


def main():
    page = TPL.read_text(encoding="utf-8")
    for key, (path, prefix) in DOCS.items():
        if not path.exists():
            raise FileNotFoundError(f"缺少源文件：{path}")
        body, toc = md_to_html(path.read_text(encoding="utf-8"), prefix)
        toc_html = build_toc_html(toc)
        page = page.replace(f"{{{{{key}_BODY}}}}", body).replace(f"{{{{{key}_TOC}}}}", toc_html)
    page = page.replace("{{UIFLOW_BODY}}", render_ui_flow_section())
    page, img_cnt = optimize_images(page)
    OUT.write_text(page, encoding="utf-8")
    print(f"→ {OUT}（已优化 {img_cnt} 张图片：lazy + 尺寸占位）")


if __name__ == "__main__":
    main()
