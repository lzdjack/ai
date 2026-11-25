#!/usr/bin/env python3
"""生成移动端标准组件库规范板（3 屏 1440×1000）：reference/src/v5/m-components.html
经 3 路移动端专家 Agent 审定（iOS 26 Liquid Glass HIG + Android M3 + WCAG 2.1 AA + Flutter 1:1 映射）。
严格消费 tokens/theme.css + tokens/components.css（.cc-m-* 与 .cc-*）。
用法：python3 scripts/gen-mobile-components.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"
sys.path.insert(0, str(ROOT / "scripts"))
from shell_m import status, tabbar  # noqa: E402


def board(title, phones):
    cols = "".join(
        f'<div class="col3"><div class="phone"><div class="scr">{status}{body}{extra}<div class="home"></div></div></div>'
        f'<div class="lbl">{t}<em>{sub}</em></div></div>'
        for t, sub, body, extra in phones
    )
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="m.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
</head><body><div class="board">{cols}</div><script src="icons.js"></script></body></html>'''


def I(n, s=15, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'


CHEVD = f'<span class="cc-sel-caret">{I("chevd",14)}</span>'
CHEVR = I("chevr", 14, st="color:var(--text-3)")
CK = I("check", 12, 3)

# =====================================================================
# 屏 1：基础控件与 44pt 表单标尺（NavBar · 输入/OTP/搜索 · 下拉 · 分段 · 开关 · 吸底栏）
# =====================================================================
p1 = f'''
<div class="cc-m-nav">
  <span class="cc-m-nav-back">{I("chevr",19,st="transform:rotate(180deg)")}返回</span>
  <span class="cc-m-nav-title">基础控件 · 44pt 标尺</span>
  <span class="cc-m-nav-act glass">{I("more",17)}</span>
</div>
<div class="pad" style="display:flex;flex-direction:column;gap:9px;padding-top:4px">
  <!-- 46px 搜索框（微凹 --well + 清除钮） -->
  <div class="cc-m-search">
    {I("search",15,st="color:var(--text-3)")}
    <span class="grow">okr-web</span>
    <span class="cc-search-clear">{I("x",10,2.8)}</span>
    <span class="cc-tag cc-tag-b" style="height:18px;font-size:10px">46pt</span>
  </div>

  <!-- OTP 聚焦输入（46px） + 错误态字段 -->
  <div class="cc-m-input is-focus">
    {I("shield",15,st="color:var(--ink-blue)")}
    <span class="mono w6 grow">482 910</span>
    <span class="f12 w6" style="color:var(--ink-blue);white-space:nowrap">58s 重发</span>
  </div>
  <div class="cc-field" style="gap:4px">
    <div class="cc-m-input is-error">
      {I("alert",15,st="color:var(--ink-red)")}
      <span class="grow ell">lin@company</span>
      <span class="f11 w6" style="color:var(--ink-red)">错误</span>
    </div>
    <div class="cc-field-err">邮箱格式不正确，请检查后重试</div>
  </div>

  <!-- 移动端下拉（46px · 轻浮 --glass-2 + --border-ctl） -->
  <div class="cc-m-select">
    <span class="cc-dot" style="background:var(--green)"></span>
    <span class="cc-sel-val">测试环境</span>
    <span class="cc-sel-sub mono">test.tita.work/okr</span>
    {CHEVD}
  </div>

  <!-- 移动端统一分段控件（40px 视觉 + 44pt 触控） -->
  <div class="cc-m-seg">
    <span>密码</span>
    <span class="is-active">Cookie</span>
    <span>Token</span>
  </div>

  <!-- Inset Grouped List：48px 行高 + 46×28pt Cupertino 开关 + 复选/单选 -->
  <div class="cc-m-list glass">
    <div class="cc-m-row">
      <span class="grow f13 w6">推送到本机（48pt 行）</span>
      <span class="cc-m-switch on"></span>
    </div>
    <div class="cc-m-row">
      <span class="row g6 grow f13">{I("lock",13,st="color:var(--text-3)")}<span>发布失败提醒（锁死）</span></span>
      <span class="cc-m-switch on is-disabled"></span>
    </div>
    <div class="cc-m-row" style="gap:14px">
      <span class="row g6 f12"><span class="cc-m-checkbox is-checked">{CK}</span>已选</span>
      <span class="row g6 f12"><span class="cc-m-checkbox"></span>未选</span>
      <span class="row g6 f12"><span class="cc-m-radio is-checked"></span>单选</span>
      <span class="row g6 f12"><span class="cc-m-radio"></span>未选</span>
    </div>
  </div>
</div>

<!-- 吸底操作栏（同心圆弧 26-10=16 · 打回/通过 12px 间距 · AA 高对比按钮） -->
<div class="cc-m-bar glass">
  <div class="row f11 t3" style="padding:0 4px"><span class="grow">吸底操作栏 · 间距 12pt · AA 按钮实底</span><span class="mono">44–48pt</span></div>
  <div class="row" style="gap:12px">
    <span class="cc-m-btn cc-m-btn-red" style="flex:1">{I("undo",14)}打回</span>
    <span class="cc-m-btn cc-m-btn-pri" style="flex:1.55">{CK}审核通过 a3f9c21</span>
  </div>
  <div class="row" style="gap:10px">
    <span class="cc-m-btn cc-m-btn-glass" style="flex:1;height:40px;font-size:13px"><span class="cc-spinner cc-spinner-sm" style="color:var(--ink-blue)"></span>试连中…</span>
    <span class="cc-m-btn cc-m-btn-ok" style="flex:1;height:40px;font-size:13px">{CK}复测通过</span>
  </div>
</div>
'''

# =====================================================================
# 屏 2：分组列表、10 秒审核卡、L2 高危锁与悬浮 5-Tab
# =====================================================================
p2 = f'''
<div class="pad" style="padding-top:4px;display:flex;flex-direction:column;gap:9px">
  <!-- 大标题 + 下拉刷新胶囊 -->
  <div class="row">
    <span style="font-size:24px;font-weight:800;letter-spacing:-.4px" class="grow">工单审核</span>
    <span class="cc-m-ptr"><span class="cc-spinner cc-spinner-sm" style="color:var(--ink-blue)"></span>同步中…</span>
  </div>

  <!-- 分组列表：蓝色选中工单行 + 48px 设置行 -->
  <div class="cc-m-list glass">
    <div class="cc-m-ticket-row is-selected">
      <span class="cc-avatar" style="width:36px;height:36px;background:linear-gradient(150deg,#F5A3C7,#D96BA0);box-shadow:0 0 0 2px rgba(255,255,255,.5)">王芳<i style="background:var(--blue);box-shadow:0 0 0 2px #fff"></i></span>
      <div class="col grow" style="min-width:0">
        <div class="row g6"><span class="f13 w7 grow ell">点击分组后界面卡住</span><span class="f11" style="opacity:.85">8 分钟</span></div>
        <div class="row g6" style="margin-top:3px"><span class="cc-tag" style="background:rgba(255,255,255,.22);color:#fff;height:18px">Tita</span><span class="f11 ell" style="opacity:.88">第 2 轮交付 · 待我审核</span></div>
      </div>
    </div>
    <div class="cc-m-row">
      <span class="grow f13 w6">环境版本（48pt 标准行）</span>
      <span class="cc-m-row-val mono">2.18.0-fix.2{CHEVR}</span>
    </div>
  </div>

  <!-- Bot 横向 4 步进度条 -->
  <div class="steps glass" style="min-height:38px;padding:6px 10px;gap:8px;font-size:12px">
    <span class="botav" style="width:22px;height:22px;border-radius:7px">{I("bot",12)}</span>
    <span class="sp2"><i class="ok">{I("check",9,3)}</i>复现</span>
    <span class="sp2"><i class="ok">{I("check",9,3)}</i>定位</span>
    <span class="sp2"><i class="ok">{I("check",9,3)}</i>改码</span>
    <span class="sp2"><i class="ok">{I("check",9,3)}</i>验证</span>
  </div>

  <!-- 10 秒极速审核卡 + L2 高危锁横幅（补齐 M3 规范空缺） -->
  <div class="cc-m-review-card glass">
    <div class="row g6">
      <span class="f14 w7 grow">第 2 轮交付</span>
      <span class="cc-tag cc-tag-g">{CK}机审通过</span>
      <span class="cc-tag cc-tag-r">L2 高危</span>
    </div>
    <div class="f12 t2" style="line-height:1.45"><b style="color:var(--text)">根因</b> 权限守卫未拦截跨租户回调 · <span class="mono f11" style="color:var(--ink-green)">+38</span> <span class="mono f11" style="color:var(--ink-red)">−12</span></div>
    <div class="row g8">
      <div style="flex:1;height:52px;border-radius:10px;background:var(--well);border:1px solid var(--hair);padding:7px 9px;display:flex;flex-direction:column;justify-content:space-between">
        <span class="f11 t3">修前复现 · 已看</span>
        <span class="mono f11" style="color:var(--ink-red)">403 漏拦截</span>
      </div>
      <div style="flex:1;height:52px;border-radius:10px;background:var(--well);border:2px solid var(--green);padding:6px 9px;display:flex;flex-direction:column;justify-content:space-between">
        <span class="f11 w6" style="color:var(--ink-green)">修后复测 · 通过</span>
        <span class="mono f11" style="color:var(--ink-green)">报错 3 → 0</span>
      </div>
    </div>
    <div class="cc-m-l2-lock">
      {I("lock",14,2.2,st="margin-top:1px;flex:none")}
      <span><b>L2 高危改动（命中 auth/ 核心路径）</b><br>手机端已禁用 10 秒速过，请去 PC 端逐行审 Diff</span>
    </div>
    <div class="row g8">
      <span class="cc-m-btn cc-m-btn-locked" style="flex:1.15;height:40px;font-size:12.5px">{I("lock",13)}仅限 PC 审核</span>
      <span class="cc-m-btn cc-m-btn-glass" style="flex:1;height:40px;font-size:12.5px;color:var(--ink-blue)">{I("ext",13)}发到 PC ›</span>
    </div>
  </div>
</div>
{tabbar("chat", 24)}
'''

# =====================================================================
# 屏 3：悬浮 Toast（z:70）、骨架与离线态 + Bottom Sheet（z:40 · r:30px · 安全区 34pt）
# =====================================================================
p3_bg = f'''
<div class="pad" style="padding-top:8px;display:flex;flex-direction:column;gap:9px">
  <!-- 悬浮 Toast（z:70，验证盖过遮罩与弹层） -->
  <div class="cc-m-toast">
    {I("check",15,2.8,st="color:var(--ink-green)")}
    <span class="w6 grow">已移除仓库 okr-web</span>
    <span class="f12 w7" style="color:var(--ink-blue)">撤销</span>
  </div>

  <!-- 警告横幅 + 骨架屏 + 离线执行器条 -->
  <div class="cc-banner cc-banner-warn" style="padding:8px 11px">
    {I("alert",14,st="margin-top:1px")}
    <span><b>Tita 采集失败</b> · 自动重试中（2 分钟前）</span>
  </div>
  <div class="glass" style="border-radius:16px;padding:10px 12px;display:flex;align-items:center;gap:10px">
    <span class="cc-skeleton" style="width:36px;height:36px;border-radius:50%;flex:none"></span>
    <div class="col grow" style="gap:7px">
      <span class="cc-skeleton" style="height:11px;width:58%"></span>
      <span class="cc-skeleton" style="height:9px;width:86%"></span>
    </div>
  </div>
  <div class="cc-empty-dashed" style="padding:9px 12px;border-radius:14px">
    <span class="cc-dot" style="background:var(--orange)"></span>
    <span class="f12 grow">本机执行器离线 · 新单安全排队等上线</span>
  </div>
</div>
'''

p3_sheet = f'''
<div class="cc-m-scrim"></div>
<div class="cc-m-sheet">
  <div class="cc-m-sheet-grab"></div>
  <div class="cc-m-sheet-hd">
    <div class="col grow">
      <span class="f17 w7">打回第 2 轮 · Bottom Sheet</span>
      <span class="f11 t3">r:30px · --glass-overlay · z:40 · 避让 34pt 安全区</span>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>

  <div class="col" style="gap:9px">
    <!-- 弹层内移动端下拉（46px） -->
    <div class="cc-m-select">
      <span class="cc-sel-val">问题分类</span>
      <span class="cc-sel-sub">验证不充分 · 需补管理员复测</span>
      {CHEVD}
    </div>

    <!-- 聚焦多行输入（--glass-2 + 蓝圈） -->
    <div class="cc-m-textarea is-focus">管理员切到「销售部」仍偶发卡顿，loading 遮罩未收起。</div>

    <!-- 快捷理由芯片（gap ≥ 8pt） -->
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <span class="cc-chip is-selected" style="height:32px">问题仍存在</span>
      <span class="cc-chip" style="height:32px">改法不认可</span>
      <span class="cc-chip" style="height:32px">缺少复测</span>
    </div>

    <!-- 44pt 复选行 -->
    <div class="row" style="gap:10px;min-height:40px">
      <span class="cc-m-checkbox is-checked">{CK}</span>
      <span class="f13 grow">下一轮使用管理员账号补跑验证</span>
    </div>

    <!-- 2 步竖向微时间线 -->
    <div class="cc-card-flat" style="padding:8px 11px;display:flex;flex-direction:column;gap:5px">
      <div class="row g8 f12"><span class="ok2" style="background:var(--switch-on)">{I("check",9,3)}</span><span>附加代码位置 <span class="mono">GroupPicker.tsx:49</span></span></div>
      <div class="row g8 f12 t2"><span class="cc-dot" style="background:var(--blue);margin:0 4px"></span><span>提交后立即通知 Bot-01 开始第 3 轮修复</span></div>
    </div>

    <!-- 48pt 高对比实底危险主按钮（--btn-danger-bg，5.74:1） -->
    <span class="cc-m-btn cc-m-btn-lg cc-m-btn-danger" style="margin-top:2px">{I("undo",15)}打回并通知 Bot 重修</span>
    <div class="f11 t3" style="text-align:center">Flutter: <span class="mono">CcBottomSheet</span> · <span class="mono">SafeArea(bottom: 34pt)</span> · 支持下滑收起</div>
  </div>
</div>
'''

html = board("移动端 · 标准组件库规范（3 路多 Agent 审定）", [
    ("基础控件与 44pt 标尺", "NavBar · 输入 · 下拉 · 开关 · 吸底栏", p1, ""),
    ("列表、审核卡与 5-Tab", "下拉刷新 · 10 秒交付 · L2 高危锁", p2, ""),
    ("弹层、Toast 与空态", "Toast(z:70) · 骨架 · Bottom Sheet", p3_bg, p3_sheet),
])

out = OUT / "m-components.html"
out.write_text(html, encoding="utf-8")
print("→", out)
