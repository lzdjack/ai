#!/usr/bin/env python3
"""生成链路总图 reference/src/v5/flow.html（2400 × 1240）。
编号和 docs/05-链路流转.md 第三节一一对应；改了链路两边一起改。
用法：python3 scripts/gen-flow.py
     scripts/render.sh reference/src/v5/flow.html "" reference/images/flow/链路总图 2400 1300
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5" / "flow.html"

W, H = 2400, 1300
X0, CW, NW, NH = 206, 155, 136, 116
Y0, LH = 150, 146

# 泳道：名称、说明、颜色
LANES = [
    ("来源 / 建单", "Jira / Tita / 手建", "gray"),
    ("工作台", "收单 · 通知 · 记录", "purple"),
    ("Bot", "Pi · 无状态执行器", "teal"),
    ("修复人", "工单负责人 · 也做开工准备", "blue"),
    ("MR 审核人", "项目里设，默认修复人", "indigo"),
    ("测试人", "Jira 默认提单人", "green"),
    ("正式发布人", "默认任何人", "orange"),
]
LI = {n: i for i, (n, _, _) in enumerate(LANES)}

# 阶段：名称、起止列
STAGES = [("准备", 0, 0), ("收单 / 建单", 1, 2), ("修复", 3, 3), ("审核", 4, 4), ("发测试", 5, 8),
          ("复测", 9, 9), ("合回主分支", 10, 10), ("发正式 · 原单确认", 11, 12), ("修复完成", 13, 13)]

# 节点：id, 编号, 泳道, 列, 标题, 结果, 提示, 提示色, 图
NODES = [
    ("S0", "0", "修复人", 0, "开工准备", "连接器鉴权 · 授权仓<br>环境账号 · 体检开工", "必需项没过挡住开工", "orange", "步骤器 0–4"),
    ("S1", "1", "来源 / 建单", 1, "交给 AI", "Jira / Tita 自动触发<br>或点 + 手动新建", "手建自动编 M-序号", "blue", "原平台 · 手动建单"),
    ("S2", "2", "工作台", 2, "收单", "建任务 · 待修复<br>通知修复人", "对不上人 → 需要处理", "red", "来源采集 · 成员"),
    ("S3", "3", "Bot", 3, "Bot 修复", "复现改码 · Hard 门禁<br>浏览器复测 + 棘轮", "门禁 2 次不过→协助", "red", "修复中 · 证据"),
    ("S3a", "3a", "修复人", 3, "回答 Bot", "Bot 从原步骤继续", "可存为项目规则", "orange", "Bot 在问你"),
    ("S4", "4", "修复人", 4, "审核代码", "通过→5 · 外单生 13<br>L2 高危强制 PC 审", "打回 → 回 3 新一轮", "red", "代码改动 · 打回"),
    ("S5", "5", "修复人", 5, "发起发测试", "建发布任务<br>测试人发前可换", "谁能发：项目里配置", "gray", "发测试 · 发布前"),
    ("S6", "6", "MR 审核人", 6, "MR → 测试分支", "单独审核，不沿用 4<br>通过后工作台合入", "打回 → 回 3", "red", "发布 · 第 1 步"),
    ("S7", "7", "Bot", 7, "打包 · 发布 · 核对", "tita build → release<br>TEST → 提交号对上", "失败 → 从失败步重试", "red", "发布 · 失败"),
    ("S8", "8", "工作台", 8, "可测通知", "已生效 · 等复测", "对不上就不通知", "orange", "发布 · 等复测"),
    ("S9", "9", "测试人", 9, "复测", "通过 → 10", "打回 → 回 3 新一轮", "red", "等复测 · 复测通过"),
    ("S10", "10", "MR 审核人", 10, "MR → 主分支", "修复人点了才提 MR<br>审核后工作台合入", "打回 → 回 3 要重测", "red", "合回主分支 MR"),
    ("S11", "11", "正式发布人", 11, "发布到正式", "三项前置齐<br>按钮才变蓝", "没测过的不给发", "orange", "发正式"),
    ("S12", "12", "Bot", 12, "重新打包 · 发 PROD", "主分支 tita build<br>→ PROD → 核对", "出故障 → 紧急回滚", "red", "发正式"),
    ("S13", "13", "修复人", 11, "原平台确认", "仅 Jira / Tita 外单<br>回来点「已确认」", "手动单自动跳过", "orange", "待原平台确认"),
    ("SA", "·", "来源 / 建单", 11, "原单手动操作", "Tita 点「已完成」<br>Jira 按原流程改状态", "", "", "在原平台"),
    ("S14", "14", "修复人", 13, "修复完成", "工单负责人点<br>「修复完成」", "没做完的会再提醒", "orange", "待原平台确认"),
]
N = {}
for nid, num, lane, col, *_ in NODES:
    cx = X0 + col * CW + CW / 2
    cy = Y0 + LI[lane] * LH + LH / 2
    N[nid] = dict(cx=cx, cy=cy, l=cx - NW / 2, r=cx + NW / 2, t=cy - NH / 2, b=cy + NH / 2, lane=lane)


def lane_bottom(lane):
    return Y0 + (LI[lane] + 1) * LH


GAP = (CW - NW) / 2
# 连线：点列表, 颜色, 是否虚线, 标签(文字, x, y)
E = []
def edge(pts, c="blue", dash=False, label=None):
    E.append((pts, c, dash, label))

n = N
edge([(n["S1"]["r"], n["S1"]["cy"]), (n["S2"]["cx"], n["S1"]["cy"]), (n["S2"]["cx"], n["S2"]["t"])])
edge([(n["S0"]["r"], n["S0"]["cy"]), (n["S2"]["cx"], n["S0"]["cy"]), (n["S2"]["cx"], n["S2"]["b"])], "gray", True,
     ("准备好才开工", n["S2"]["cx"], n["S3"]["cy"]))
edge([(n["S2"]["r"], n["S2"]["cy"]), (n["S3"]["cx"], n["S2"]["cy"]), (n["S3"]["cx"], n["S3"]["t"])])
edge([(n["S3"]["cx"] - 16, n["S3"]["b"]), (n["S3"]["cx"] - 16, n["S3a"]["t"])], "orange", False, ("在问你", n["S3"]["cx"] - 16, (n["S3"]["b"] + n["S3a"]["t"]) / 2, "l"))
edge([(n["S3a"]["cx"] + 16, n["S3a"]["t"]), (n["S3"]["cx"] + 16, n["S3"]["b"])], "orange", False, ("继续", n["S3"]["cx"] + 16, (n["S3"]["b"] + n["S3a"]["t"]) / 2, "r"))
edge([(n["S3"]["r"], n["S3"]["cy"] - 18), (n["S4"]["cx"], n["S3"]["cy"] - 18), (n["S4"]["cx"], n["S4"]["t"])])
gx = n["S4"]["l"] - GAP
edge([(n["S4"]["l"], n["S4"]["cy"] + 8), (gx, n["S4"]["cy"] + 8), (gx, n["S3"]["cy"] + 24), (n["S3"]["r"], n["S3"]["cy"] + 24)], "red", True,
     ("打回", gx, n["S3"]["cy"] + 44, "r"))
edge([(n["S4"]["r"], n["S4"]["cy"]), (n["S5"]["l"], n["S5"]["cy"])])
yb = lane_bottom("修复人") - 7
edge([(n["S4"]["cx"], n["S4"]["b"]), (n["S4"]["cx"], yb), (n["S13"]["cx"], yb), (n["S13"]["cx"], n["S13"]["b"])], "gray", True,
     ("仅 Jira / Tita 外部单生成「待原平台确认」（手动单跳过），和发布并行", (n["S4"]["cx"] + n["S13"]["cx"]) / 2, yb, "c"))
edge([(n["S5"]["r"], n["S5"]["cy"]), (n["S6"]["cx"], n["S5"]["cy"]), (n["S6"]["cx"], n["S6"]["t"])])
edge([(n["S6"]["r"], n["S6"]["cy"]), (n["S7"]["cx"], n["S6"]["cy"]), (n["S7"]["cx"], n["S7"]["b"])])
edge([(n["S7"]["r"], n["S7"]["cy"]), (n["S8"]["cx"], n["S7"]["cy"]), (n["S8"]["cx"], n["S8"]["b"])])
edge([(n["S8"]["r"], n["S8"]["cy"]), (n["S9"]["cx"], n["S8"]["cy"]), (n["S9"]["cx"], n["S9"]["t"])])
edge([(n["S9"]["r"], n["S9"]["cy"]), (n["S10"]["cx"], n["S9"]["cy"]), (n["S10"]["cx"], n["S10"]["b"])], "blue", False,
     ("通过", (n["S9"]["r"] + n["S10"]["cx"]) / 2, n["S9"]["cy"] - 12, "c"))
edge([(n["S10"]["r"], n["S10"]["cy"]), (n["S11"]["cx"], n["S10"]["cy"]), (n["S11"]["cx"], n["S11"]["t"])])
edge([(n["S11"]["r"], n["S11"]["cy"]), (n["S12"]["cx"], n["S11"]["cy"]), (n["S12"]["cx"], n["S12"]["b"])])
edge([(n["S12"]["r"], n["S12"]["cy"]), (n["S14"]["cx"], n["S12"]["cy"]), (n["S14"]["cx"], n["S14"]["t"])])
edge([(n["S13"]["r"], n["S13"]["cy"]), (n["S14"]["l"], n["S14"]["cy"])], "gray", True)
edge([(n["S13"]["cx"] - 16, n["S13"]["t"]), (n["S13"]["cx"] - 16, n["SA"]["b"])], "gray", True, ("打开原单", n["S13"]["cx"] - 16, n["S8"]["cy"], "l"))
edge([(n["SA"]["cx"] + 16, n["SA"]["b"]), (n["SA"]["cx"] + 16, n["S13"]["t"])], "gray", True, ("回来标记", n["SA"]["cx"] + 16, n["S3"]["cy"], "r"))

LANE_C = {"gray": "#8E8E93", "purple": "var(--purple)", "teal": "var(--teal)", "blue": "var(--blue)",
          "indigo": "var(--indigo)", "green": "var(--green)", "orange": "var(--orange)"}
EDGE_C = {"blue": "var(--blue)", "orange": "var(--orange)", "red": "var(--red)", "gray": "var(--text-3)"}


def svg():
    s = [f'<svg class="edges" width="{W}" height="{H}" viewBox="0 0 {W} {H}">', "<defs>"]
    for k, c in EDGE_C.items():
        s.append(f'<marker id="m-{k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:{c}"/></marker>')
    s.append("</defs>")
    for pts, c, dash, _ in E:
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        s.append(f'<path d="{d}" fill="none" style="stroke:{EDGE_C[c]}" stroke-width="{2 if c == "blue" else 1.8}" '
                 f'stroke-linejoin="round" {"stroke-dasharray=\"6 5\"" if dash else ""} marker-end="url(#m-{c})"/>')
    s.append("</svg>")
    return "".join(s)


def labels():
    h = []
    for _, c, _, lab in E:
        if not lab:
            continue
        t, x, y, *al = lab
        al = al[0] if al else "c"
        tx = {"c": "translate(-50%,-50%)", "l": "translate(calc(-100% - 6px),-50%)", "r": "translate(6px,-50%)"}[al]
        h.append(f'<span class="elab el-{c}" style="left:{x:.0f}px;top:{y:.0f}px;transform:{tx}">{t}</span>')
    return "".join(h)


def nodes():
    h = []
    for nid, num, lane, col, title, res, note, nc, img in NODES:
        p = N[nid]
        lc = LANE_C[LANES[LI[lane]][2]]
        nt = f'<div class="nn" style="color:{EDGE_C.get(nc, "var(--text-3)")}">{note}</div>' if note else ""
        h.append(f'''<div class="nd glass{" ext" if lane == "来源 / 建单" else ""}" style="left:{p["l"]:.0f}px;top:{p["t"]:.0f}px;width:{NW}px;height:{NH}px">
<div class="nh"><span class="nb" style="background:{lc}">{num}</span><b>{title}</b></div>
<div class="nr">{res}</div>{nt}<span class="grow"></span><div class="ni">图 · {img}</div></div>''')
    return "".join(h)


def lanes():
    h = []
    for i, (nm, sub, c) in enumerate(LANES):
        y = Y0 + i * LH
        h.append(f'<div class="ln{" alt" if i % 2 else ""}" style="top:{y}px;height:{LH}px"></div>')
        h.append(f'<div class="lh" style="top:{y + 10}px;height:{LH - 20}px"><b><span class="ld" style="background:{LANE_C[c]}"></span>{nm}</b><em>{sub}</em></div>')
    for nm, a, b in STAGES:
        x = X0 + a * CW + 4
        w = (b - a + 1) * CW - 8
        h.append(f'<div class="st" style="left:{x}px;width:{w}px">{nm}</div>')
    return "".join(h)


CSS = f"""
body{{margin:0}}
.root{{position:relative;width:{W}px;height:{H}px;overflow:hidden;background:var(--wall);font-family:var(--font);color:var(--text)}}
.hd{{position:absolute;left:36px;top:30px;right:36px;display:flex;align-items:flex-end;gap:18px}}
.hd h1{{font-size:30px;font-weight:800;letter-spacing:.3px}}
.hd span{{font-size:15px;color:var(--text-3);padding-bottom:4px}}
.st{{position:absolute;top:{Y0 - 40}px;height:30px;border-radius:9px;background:color-mix(in srgb,var(--text) 6%,transparent);display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:700;color:var(--text-2);letter-spacing:.5px}}
.ln{{position:absolute;left:30px;right:30px;border-radius:16px}}
.ln.alt{{background:color-mix(in srgb,var(--text) 3.5%,transparent)}}
.lh{{position:absolute;left:42px;width:150px;display:flex;flex-direction:column;justify-content:center;gap:4px}}
.lh b{{font-size:16px;font-weight:700;display:flex;align-items:center}}
.lh em{{font-style:normal;font-size:12px;color:var(--text-3)}}
.ld{{width:10px;height:10px;border-radius:50%;margin-right:8px;flex:none}}
.edges{{position:absolute;left:0;top:0}}
.nd{{position:absolute;border-radius:14px;padding:9px 10px 8px;display:flex;flex-direction:column;gap:3px;background:var(--glass-2);border:1px solid var(--stroke);box-shadow:0 8px 22px -14px rgba(20,40,100,.45)}}
.nd.ext{{background:color-mix(in srgb,var(--text) 5%,transparent);border-style:dashed;box-shadow:none}}
.nh{{display:flex;align-items:center;gap:6px}}
.nh b{{font-size:13.5px;font-weight:700;white-space:nowrap}}
.nb{{min-width:20px;height:20px;padding:0 5px;border-radius:10px;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}}
.nr{{font-size:11.5px;line-height:1.4;color:var(--text-2)}}
.nn{{font-size:11px;font-weight:600;white-space:nowrap}}
.ni{{font-size:10.5px;color:var(--text-3);white-space:nowrap}}
.grow{{flex:1}}
.elab{{position:absolute;font-size:11.5px;font-weight:600;padding:2px 7px;border-radius:7px;background:var(--glass-2);border:1px solid var(--stroke);white-space:nowrap}}
.el-blue{{color:var(--blue)}}.el-orange{{color:var(--orange)}}.el-red{{color:var(--red)}}.el-gray{{color:var(--text-2)}}
.ft{{position:absolute;left:30px;right:30px;top:{Y0 + 7 * LH + 16}px;display:flex;gap:14px;align-items:stretch}}
.fc{{border-radius:14px;padding:11px 14px;display:flex;flex-direction:column;gap:7px;background:var(--glass-2);border:1px solid var(--stroke)}}
.fc .t{{font-size:12px;font-weight:700;color:var(--text-3);letter-spacing:.3px}}
.fr{{display:flex;align-items:center;gap:16px;font-size:12.5px;color:var(--text-2);white-space:nowrap}}
.fr i{{display:inline-block;width:26px;height:0;border-top:2px solid;vertical-align:middle;margin-right:6px}}
.chip{{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:8px;background:color-mix(in srgb,var(--text) 6%,transparent);font-size:12.5px;white-space:nowrap}}
.chip b{{font-weight:700}}
"""

html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>链路总图</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{CSS}</style></head><body><div class="root">
<div class="hd"><h1>一张单的完整链路</h1><span>从交给 AI 到正式上线、回原平台确认 · 节点编号对应 docs/05-链路流转.md · 每个节点：名称 → 结果 → 分支 → 对应设计图</span></div>
{lanes()}
{svg()}
{nodes()}
{labels()}
<div class="ft">
  <div class="fc"><span class="t">线</span>
    <div class="fr"><span><i style="border-color:var(--blue)"></i>主流程</span><span><i style="border-color:var(--orange)"></i>Bot 问人，答完回原步骤</span><span><i style="border-color:var(--red);border-top-style:dashed"></i>打回，回到 3 开新一轮</span><span><i style="border-color:var(--text-3);border-top-style:dashed"></i>前置条件 / 并行待办</span><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:22px;height:14px;border-radius:4px;border:1px dashed var(--text-3)"></span>在原平台，不在工作台</span></div></div>
  <div class="fc"><span class="t">四份独立记录（不互相代替）</span>
    <div class="fr"><span class="chip"><b>工单状态</b>2–4</span><span class="chip"><b>发布任务</b>5–8 · 11–12</span><span class="chip"><b>测试记录</b>9</span><span class="chip"><b>原平台确认</b>13</span></div></div>
  <div class="fc grow"><span class="t">随时可进的支线</span>
    <div class="fr"><span class="chip"><b>紧急回滚</b>项目里设谁能回滚 · 只回滚 Apollo</span><span class="chip"><b>AI 助手</b>每一步都能用对话办</span><span class="chip"><b>Skills</b>下一张单生效</span><span class="chip"><b>登录与权限</b>过期回原处 · 无权不显示</span></div></div>
</div>
</div></body></html>'''

OUT.write_text(html, encoding="utf-8")
print("→", OUT)
