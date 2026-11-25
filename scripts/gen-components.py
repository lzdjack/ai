#!/usr/bin/env python3
"""生成 PC 标准组件库展示板 1（基础控件与 4 档统一尺寸标尺）：reference/src/v5/pc-components.html（1440×900）
严格消费 tokens/theme.css + tokens/components.css（3 路多 Agent 审核定稿：Apple Liquid Glass HIG + WCAG 2.1 AA）。
用法：python3 scripts/gen-components.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"


def I(n, s=14, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'


CHEV = f'<span class="cc-sel-caret">{I("chevd",13)}</span>'
CK = I("check", 13, 2.8)

STYLE = '''
.root{display:block;background:var(--wall);padding:22px 28px 24px}
.hd{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.hd h1{margin:0;font-size:19.5px;font-weight:800;letter-spacing:-.2px}
.hd .sub{font-size:12px;color:var(--text-3);margin-top:2px}
.grid{display:grid;grid-template-columns:1.14fr 1.04fr 1fr;gap:15px;height:792px}
.colb{display:flex;flex-direction:column;gap:14px;min-height:0}
.blk{border-radius:var(--r-panel);padding:15px 17px;display:flex;flex-direction:column;gap:10px;min-height:0}
.bh{display:flex;align-items:center;gap:8px}
.bh b{font-size:14px;font-weight:700}
.bh code{font-family:var(--font-mono);font-size:10.5px;color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 12%,transparent);padding:2px 6px;border-radius:5px;margin-left:auto}
.subt{font-size:11.5px;color:var(--text-3);margin-top:-5px;line-height:1.45}
.rule-box{border-radius:var(--r-lg);padding:9px 11px;background:color-mix(in srgb,var(--purple) 8%,var(--fill));border:1px solid color-mix(in srgb,var(--purple) 22%,transparent);font-size:11.5px;color:var(--text-2);line-height:1.5}
.rule-box b{color:var(--text)}
.srow{display:flex;align-items:center;gap:8px}
.srow .st{width:50px;flex:none;font-family:var(--font-mono);font-size:10.5px;color:var(--text-3);font-weight:600}
'''

HTML = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>云匠 · 标准组件库规范 1/2（基础控件与尺寸标尺）</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body>
<div class="root">
  <div class="hd">
    <img src="logo.svg" width="38" height="38" alt="" style="margin:-2px">
    <div>
      <h1>云匠标准组件库 · 1/2 基础表单、选择控件与 4 档尺寸标尺</h1>
      <div class="sub">唯一真相源：<span class="mono">tokens/theme.css</span> + <span class="mono">tokens/components.css</span> · Apple Liquid Glass HIG × WCAG 2.1 AA（≥4.5:1）× 4px 同档等高网格</div>
    </div>
    <span class="cc-pill cc-tag-b" style="margin-left:auto">3 路多 Agent 审定 · 2026-11-24</span>
  </div>

  <div class="grid">
    <!-- ==================== 列 1：下拉选择（钦定基准）+ 字段解剖 + 悬浮菜单 ==================== -->
    <div class="colb">
      <section class="glass blk" style="flex:1">
        <div class="bh"><b>1. 下拉选择（用户钦定基准）&amp; 字段解剖</b><code>.cc-select / .cc-field</code></div>
        <div class="subt"><span class="mono">--glass-2</span> + <span class="mono">--border-ctl</span> + 右对齐单向 <span class="mono">chevd 13px</span>；展开菜单走 L3 <span class="mono">--glass-elev</span>（94% 实底防透字，<span class="mono">z:60</span>）</div>

        <div class="row g10">
          <div class="cc-field grow">
            <div class="cc-field-hd"><span>复现环境</span><span class="cc-field-req">*</span><span class="cc-field-hint">默认 md 36px</span></div>
            <div class="cc-select">
              <span class="cc-dot" style="background:var(--green)"></span>
              <span class="cc-sel-val">测试环境</span>
              <span class="cc-sel-sub mono">test.tita.work/approval</span>
              {CHEV}
            </div>
          </div>
          <div class="cc-field" style="width:162px;flex:none">
            <div class="cc-field-hd"><span>真人修复人</span></div>
            <div class="cc-select">
              <span class="cc-avatar cc-avatar-xs" style="background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
              <span class="cc-sel-val">林某（我）</span>
              <span class="cc-sel-sp"></span>
              {CHEV}
            </div>
          </div>
        </div>

        <div class="row g10">
          <div class="cc-field grow">
            <div class="cc-field-hd"><span>语义权限态（WCAG AA --ink-*）</span></div>
            <div class="cc-select cc-select-sm is-green">
              {I("edit",13)}<span class="cc-sel-val">可修改（推 fix/）</span><span class="cc-sel-sp"></span>{CHEV}
            </div>
          </div>
          <div class="cc-field grow">
            <div class="cc-field-hd"><span>只读 / 禁用态</span></div>
            <div class="cc-select cc-select-sm is-blue">
              {I("eye",13)}<span class="cc-sel-val">仅查看（隔离）</span><span class="cc-sel-sp"></span>{CHEV}
            </div>
          </div>
        </div>

        <div class="cc-field">
          <div class="cc-field-hd"><span>展开态（<span class="mono">.is-open</span> + L3 悬浮菜单 <span class="mono">.cc-menu</span> · 含禁用/危险/高反差嵌套标）</span></div>
          <div class="cc-select is-open" style="margin-bottom:6px">
            <span class="cc-dot" style="background:var(--green)"></span>
            <span class="cc-sel-val mono">gpt-6.2-sol</span>
            <span class="cc-sel-sub">公司网关 · 主力修单模型</span>
            {CHEV}
          </div>
          <div class="cc-menu">
            <div class="cc-menu-item is-selected">
              <span class="cc-mi-ck">{CK}</span>
              <div class="cc-mi-main"><b class="mono">gpt-6.2-sol</b><em>公司网关 · 主力修单与多文件推理</em></div>
              <span class="cc-tag cc-tag-b">推荐</span>
            </div>
            <div class="cc-menu-item">
              <span class="cc-mi-ck"></span>
              <div class="cc-mi-main"><b class="mono">claude-4.5-sonnet</b><em>Anthropic · 复杂重构与前端还原</em></div>
              <span class="cc-tag cc-tag-n">200K</span>
            </div>
            <div class="cc-menu-item is-disabled">
              <span class="cc-mi-ck"></span>
              <div class="cc-mi-main"><b class="mono">o3-deep-research</b><em>未在当前网关开通（禁选态）</em></div>
              <span class="cc-tag cc-tag-n">未开通</span>
            </div>
            <div class="cc-menu-divider"></div>
            <div class="cc-menu-item is-danger">
              <span class="cc-mi-ck">{I("x",12,2.4)}</span>
              <div class="cc-mi-main"><b>清空当前模型覆盖</b></div>
            </div>
          </div>
        </div>

        <div class="rule-box" style="margin-top:auto">
          <b>选中嵌套标已达 AA：</b>选中蓝行内 <code>推荐</code> 切换独立高反差底（亮 6.1:1 / 暗 8.7:1）；浅色抽屉内用 <code>--border-ctl</code> 彻底杜绝白边隐形。
        </div>
      </section>
    </div>

    <!-- ==================== 列 2：文本输入、搜索、多行框 & 选择器 ==================== -->
    <div class="colb">
      <section class="glass blk">
        <div class="bh"><b>2. 文本输入 / 搜索 / 多行框（同源 L-1 凹槽）</b><code>.cc-input</code></div>
        <div class="subt">统一 <span class="mono">--well</span> 微凹底 + <span class="mono">1px --hair</span>（暗色真正微凹），聚焦 <span class="mono">:focus-within</span> 转 <span class="mono">--glass-2</span> + 蓝圈</div>
        <div class="col g8">
          <div class="cc-input">{I("globe",14,st="color:var(--text-3)")}<span class="mono grow ell">https://ai-gateway.tita.cloud</span><span class="f11 t3">默认</span></div>
          <div class="cc-input is-focus">{I("lock",14,st="color:var(--ink-blue)")}<span class="mono grow ell">glpat-•••••••••••• 91d0</span><span class="f11 w6" style="color:var(--ink-blue)">聚焦</span></div>
          <div class="cc-field" style="gap:4px">
            <div class="cc-input is-error">{I("alert",14,st="color:var(--ink-red)")}<span class="grow ell">lin@company</span><span class="f11 w6" style="color:var(--ink-red)">错误</span></div>
            <div class="cc-field-err">请输入有效的邮箱地址（错误提示挂在 .cc-field 下方）</div>
          </div>
          <div class="cc-search">{I("search",14)}<span class="grow">okr-web</span><span class="cc-search-clear">{I("x",10,2.8)}</span><span class="cc-kbd">⌘F</span></div>
          <div class="cc-textarea" style="min-height:58px">1. 打开审批中心筛选「研发/前端组」&#10;2. 勾选 3 条点击批量导出（<span class="t3">.cc-textarea 同源微凹</span>）</div>
        </div>
      </section>

      <section class="glass blk" style="flex:1">
        <div class="bh"><b>3. 分段 / 开关 / 复选 / 单选 / 芯片</b><code>.cc-seg / .cc-switch</code></div>
        <div class="row g10">
          <div class="cc-seg grow">
            <span class="on" style="flex:1">公司网关</span>
            <span style="flex:1">API Key</span>
          </div>
          <div class="row g6" style="flex:none">
            <span class="cc-switch on"></span>
            <span class="cc-switch"></span>
            <span class="cc-switch on is-disabled"></span>
          </div>
        </div>
        <div class="f11 t3" style="margin-top:-4px">开关统一 40×24px（达 WCAG 2.5.8 ≥24px 下限），最右为锁定不可关禁用态</div>

        <div class="row g14" style="flex-wrap:wrap;margin-top:2px">
          <span class="row g6 f12"><span class="cc-checkbox is-checked">{I("check",12,3)}</span>已勾选</span>
          <span class="row g6 f12"><span class="cc-checkbox is-indeterminate" style="font-size:13px;font-weight:800;line-height:1">–</span>半选</span>
          <span class="row g6 f12"><span class="cc-checkbox"></span>未选</span>
          <span class="row g6 f12"><span class="cc-radio is-checked"></span>选中</span>
          <span class="row g6 f12"><span class="cc-radio"></span>未选</span>
        </div>

        <div class="hr" style="margin:2px 0"></div>
        <div class="bh"><b>4. 同档等高对齐实测（36px 基准）</b><code>--ctl-md</code></div>
        <div class="row g8">
          <div class="cc-input grow">{I("lock",14,st="color:var(--text-3)")}<span class="mono ell">•••• 8k2m</span></div>
          <div class="cc-select" style="width:116px;flex:none"><span class="cc-sel-val">PAT</span><span class="cc-sel-sp"></span>{CHEV}</div>
          <button class="cc-btn cc-btn-glass">{I("zap",14,st="color:var(--ink-blue)")}试连</button>
        </div>
        <div class="f11 t3">输入框、下拉、按钮、分段同属 <code>md</code> 时天然 36px 齐平，零手写 inline height。</div>
      </section>
    </div>

    <!-- ==================== 列 3：4 档尺寸标尺 + 按钮系统 + 标签/角标 ==================== -->
    <div class="colb">
      <section class="glass blk" style="flex:1">
        <div class="bh"><b>5. 按钮系统（5 语义 × 4 档标尺 + 8 态）</b><code>.cc-btn</code></div>
        <div class="subt">主按钮采用高对比 <span class="mono">--btn-pri-bg</span>（白字 ≥4.8:1）；含禁用态与加载态</div>
        <div class="col g8">
          <div class="srow"><span class="st">lg 40</span><button class="cc-btn cc-btn-lg cc-btn-pri">{I("check",15,2.6)}保存并试构建</button><button class="cc-btn cc-btn-lg cc-btn-glass">仅保存</button></div>
          <div class="srow"><span class="st">md 36</span><button class="cc-btn cc-btn-pri">{I("zap",14)}立即采集</button><button class="cc-btn cc-btn-glass">试采预览</button><button class="cc-btn cc-btn-red">打回</button></div>
          <div class="srow"><span class="st">sm 32</span><button class="cc-btn cc-btn-sm cc-btn-pri">挑选仓库</button><button class="cc-btn cc-btn-sm cc-btn-sec">刷新</button><button class="cc-btn cc-btn-sm cc-btn-ghost">跳过</button><span class="cc-icon-btn is-circle">{I("x",14,2.2)}</span></div>
          <div class="srow"><span class="st">xs 28</span><button class="cc-btn cc-btn-xs cc-btn-glass">改 ›</button><button class="cc-btn cc-btn-xs cc-btn-red">停用</button><span class="cc-chip is-selected">审批 · 已开工</span><span class="cc-chip">OKR</span></div>
          <div class="srow" style="margin-top:2px"><span class="st">状态</span><button class="cc-btn cc-btn-sm cc-btn-pri is-loading"><span class="cc-spinner cc-spinner-sm"></span>试构建中…</button><button class="cc-btn cc-btn-sm cc-btn-pri is-disabled">审核通过（禁用）</button></div>
        </div>

        <div class="hr" style="margin:4px 0"></div>
        <div class="bh"><b>6. WCAG AA 语义标签、胶囊与角标</b><code>.cc-tag / .cc-badge</code></div>
        <div class="row g6" style="flex-wrap:wrap">
          <span class="cc-tag cc-tag-b">已授权</span>
          <span class="cc-tag cc-tag-g">鉴权通过</span>
          <span class="cc-tag cc-tag-o">待人工复测</span>
          <span class="cc-tag cc-tag-r">令牌过期</span>
          <span class="cc-tag cc-tag-p">{I("spark",10)}AI 推测</span>
          <span class="cc-tag cc-tag-t">修复中</span>
          <span class="cc-tag cc-tag-n">公司共用</span>
        </div>
        <div class="row g6" style="flex-wrap:wrap">
          <span class="cc-pill cc-tag-b">待我审核 · 第 2 轮</span>
          <span class="cc-pill cc-tag-g">{I("check",12,2.8)}可修改 2 个</span>
          <span class="cc-pill cc-tag-o">采集失败 · 重试中</span>
        </div>
        <div class="row g12" style="margin-top:2px">
          <span class="row g6 f12"><span class="cc-badge">3</span>红点角标</span>
          <span class="row g6 f12"><span class="cc-count">12</span>分组计数</span>
          <span class="row g6 f12"><span class="cc-dot is-pulse" style="background:var(--green)"></span>在线呼吸点</span>
        </div>

        <div class="rule-box" style="margin-top:auto">
          <b>4 档全局标尺：</b><code>xs 28</code>（行内微操作）· <code>sm 32</code>（工具栏）· <code>md 36</code>（全站默认）· <code>lg 40</code>（大表单/底栏）；移动端经 <code>@media(pointer:coarse)</code> 自动升至 <b>44pt</b> 触控底线。
        </div>
      </section>
    </div>
  </div>
</div>
<script src="icons.js"></script>
</body></html>
'''

out = OUT / "pc-components.html"
out.write_text(HTML, encoding="utf-8")
print("→", out)
