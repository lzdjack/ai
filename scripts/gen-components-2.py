#!/usr/bin/env python3
"""生成 PC 标准组件库展示板 2（数据展示、反馈加载、浮层尺寸与无障碍红线）：reference/src/v5/pc-components-2.html（1440×900）
严格消费 tokens/theme.css + tokens/components.css。
用法：python3 scripts/gen-components-2.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"


def I(n, s=14, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'


STYLE = '''
.root{display:block;background:var(--wall);padding:22px 28px 24px}
.hd{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.hd h1{margin:0;font-size:19.5px;font-weight:800;letter-spacing:-.2px}
.hd .sub{font-size:12px;color:var(--text-3);margin-top:2px}
.grid{display:grid;grid-template-columns:1.06fr 1.02fr 1.08fr;gap:15px;height:792px}
.colb{display:flex;flex-direction:column;gap:14px;min-height:0}
.blk{border-radius:var(--r-panel);padding:15px 17px;display:flex;flex-direction:column;gap:10px;min-height:0}
.bh{display:flex;align-items:center;gap:8px}
.bh b{font-size:14px;font-weight:700;white-space:nowrap}
.bh code{font-family:var(--font-mono);font-size:10.5px;color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 12%,transparent);padding:2px 6px;border-radius:5px;margin-left:auto;white-space:nowrap;flex:none}
.subt{font-size:11.5px;color:var(--text-3);margin-top:-5px;line-height:1.45}
.rule-box{border-radius:var(--r-lg);padding:9px 11px;background:color-mix(in srgb,var(--purple) 8%,var(--fill));border:1px solid color-mix(in srgb,var(--purple) 22%,transparent);font-size:11.5px;color:var(--text-2);line-height:1.5}
.rule-box b{color:var(--text)}

/* 可视化浮层比例示意图 */
.ov-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.ov-card{border-radius:13px;padding:9px 10px;background:var(--well);border:1px solid var(--hair);display:flex;flex-direction:column;gap:6px}
.ov-stage{height:68px;border-radius:9px;background:var(--glass);border:1px solid var(--hair);position:relative;overflow:hidden}
.ov-scr{position:absolute;inset:0;background:var(--scrim)}
.ov-scr-l{position:absolute;inset:0;background:var(--scrim-light)}
.ov-drw{position:absolute;top:5px;right:5px;bottom:5px;width:48%;border-radius:6px;background:var(--glass-overlay);border:1px solid var(--border-ctl);box-shadow:0 4px 12px rgba(0,0,0,.22)}
.ov-drw-sm{position:absolute;top:5px;right:5px;bottom:5px;width:34%;border-radius:6px;background:var(--glass-overlay);border:1px solid color-mix(in srgb,var(--purple) 45%,var(--border-ctl));box-shadow:0 4px 12px rgba(0,0,0,.22)}
.ov-dlg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:56%;height:44px;border-radius:7px;background:var(--glass-overlay);border:1px solid var(--border-ctl);box-shadow:0 6px 14px rgba(0,0,0,.28)}
.ov-sht{position:absolute;left:16px;right:16px;bottom:0;height:40px;border-radius:9px 9px 0 0;background:var(--glass-overlay);border:1px solid var(--border-ctl);border-bottom:0}
.ov-sht::before{content:"";display:block;width:20px;height:3px;border-radius:2px;background:var(--text-3);margin:4px auto 0;opacity:.6}
.ov-card b{font-size:11.5px;font-weight:700;color:var(--text)}
.ov-card span{font-size:10.5px;color:var(--text-3);line-height:1.4}
.z-bar{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.z-pill{height:20px;padding:0 6px;border-radius:5px;background:var(--fill);font-family:var(--font-mono);font-size:10px;color:var(--text-2);display:inline-flex;align-items:center;gap:3px}
.z-pill b{color:var(--ink-blue)}
'''

HTML = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>云匠 · 标准组件库规范 2/2（数据、反馈、浮层与无障碍）</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body>
<div class="root">
  <div class="hd">
    <img src="logo.svg" width="38" height="38" alt="" style="margin:-2px">
    <div>
      <h1>云匠标准组件库 · 2/2 导航、数据展示、反馈加载、浮层与无障碍红线</h1>
      <div class="sub">补齐 M1–M3 全部通用原语：<span class="mono">.cc-tabs / .cc-table / .cc-kv / .cc-banner / .cc-toast / .cc-tooltip / .cc-skeleton / .cc-empty / .cc-drawer / .cc-dialog</span></div>
    </div>
    <span class="cc-pill cc-tag-g" style="margin-left:auto">PC + Flutter 双端契约对齐</span>
  </div>

  <div class="grid">
    <!-- ==================== 列 1：导航、表格、键值对、终端代码块 ==================== -->
    <div class="colb">
      <section class="glass blk">
        <div class="bh"><b>7. 标签页（支持角标与超限折叠）</b><code>.cc-tabs</code></div>
        <div class="cc-tabs">
          <button class="cc-tab is-active">对话</button>
          <button class="cc-tab">代码改动 <em>3</em></button>
          <button class="cc-tab">证据 <em>4</em></button>
          <button class="cc-tab">更多 {I("chevd",11)}</button>
        </div>
        <div class="f11 t3">工单扩展插件标签最多直出 2 个，超出自动收进「更多 ▾」菜单防撑爆。</div>
      </section>

      <section class="glass blk" style="flex:1">
        <div class="bh"><b>8. 数据表格 &amp; 键值对清单</b><code>.cc-table / .cc-kv</code></div>
        <div class="cc-card-flat" style="padding:4px 6px">
          <table class="cc-table">
            <thead><tr><th>成员</th><th>角色</th><th>状态</th><th style="text-align:right">工单</th></tr></thead>
            <tbody>
              <tr><td class="w6">林某</td><td class="t2">项目管理员</td><td><span class="cc-tag cc-tag-g">正常</span></td><td class="mono" style="text-align:right">3</td></tr>
              <tr class="is-hover"><td class="w6">王某</td><td class="t2">测试复测人</td><td><span class="cc-tag cc-tag-b">悬停行</span></td><td class="mono" style="text-align:right">2</td></tr>
              <tr class="is-disabled"><td class="w6">赵某</td><td class="t2">成员（已停用）</td><td><span class="cc-tag cc-tag-n">禁选</span></td><td class="mono" style="text-align:right">0</td></tr>
            </tbody>
          </table>
        </div>

        <div class="cc-card-flat" style="padding:4px 12px">
          <div class="cc-kv"><span>连接方式</span><span class="w6">纯出站 WSS 443</span></div>
          <div class="cc-kv"><span>最近试测</span><span class="mono" style="color:var(--ink-green);font-weight:600">210ms · 正常</span></div>
          <div class="cc-kv"><span>令牌到期</span><span class="mono t2">2027-02-20</span></div>
        </div>

        <div class="cc-divider-text">第 2 轮 · 14:22</div>

        <div class="bh" style="margin-top:2px"><b>9. 终端指令块（含一键复制）</b><code>.cc-code-block</code></div>
        <div class="cc-code-block">
          <span class="grow ell">curl -fsSL https://get.cloudcraft.dev/runner | sh -s -- --token cc_live_91d0</span>
          <button class="cc-btn cc-btn-xs cc-btn-glass" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.18)">{I("copy",11)}复制</button>
        </div>
      </section>
    </div>

    <!-- ==================== 列 2：反馈横幅、Toast、Tooltip、加载与空状态 ==================== -->
    <div class="colb">
      <section class="glass blk">
        <div class="bh"><b>10. 提示横幅（4 态 · AA）</b><code>.cc-banner</code></div>
        <div class="col g7" style="gap:7px">
          <div class="cc-banner cc-banner-info">{I("shield",14,st="margin-top:1px")}<span><b>信息：</b>权限红线由宿主机拦截，仅查看仓禁推送。</span></div>
          <div class="cc-banner cc-banner-ok">{I("check",14,2.8,st="margin-top:1px")}<span><b>成功：</b>试采预览命中 2 张待修 Bug，耗时 210ms。</span></div>
          <div class="cc-banner cc-banner-warn">{I("alert",14,st="margin-top:1px")}<span><b>警告：</b>未识别构建命令，请点「微调 ›」手动补充。</span></div>
          <div class="cc-banner cc-banner-err">{I("alert",14,st="margin-top:1px")}<span><b>阻断：</b>401 Token 已过期，更新令牌后可断点重试。</span></div>
        </div>
      </section>

      <section class="glass blk" style="flex:1">
        <div class="bh"><b>11. Toast / 加载 / 空状态</b><code>.cc-toast / .cc-empty</code></div>
        <div class="row g8" style="flex-wrap:wrap">
          <div class="cc-toast">{I("check",14,2.8,st="color:var(--ink-green)")}<span class="w6">已移除仓库</span><span class="f12 w6" style="color:var(--ink-blue);margin-left:4px">撤销</span></div>
          <div class="cc-tooltip">插件市场 <span class="cc-kbd">⌘5</span></div>
        </div>

        <div class="col g7" style="gap:7px">
          <div class="row g10">
            <span class="cc-spinner" style="color:var(--ink-blue)"></span>
            <div class="cc-progress grow"><i style="width:68%"></i></div>
            <span class="mono f11 t3">68%</span>
          </div>
          <div class="cc-card-flat" style="padding:10px 12px;display:flex;align-items:center;gap:10px">
            <span class="cc-skeleton" style="width:32px;height:32px;border-radius:50%;flex:none"></span>
            <div class="col grow" style="gap:6px">
              <span class="cc-skeleton" style="height:11px;width:62%"></span>
              <span class="cc-skeleton" style="height:9px;width:88%"></span>
            </div>
          </div>
        </div>

        <div class="cc-empty" style="padding:12px 14px">
          <span class="cc-app-icon cc-app-icon-sm" style="background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("inbox",14)}</span>
          <b class="f13">暂无待审核工单</b>
          <span class="f11 t3">所有接入来源均正常，也可直接点「+」手动建单</span>
        </div>

        <div class="cc-empty-dashed" style="margin-top:auto">
          <span class="cc-icon-btn is-circle" style="width:26px;height:26px">{I("plus",13)}</span>
          <span class="grow">虚线引导占位槽（<span class="mono">.cc-empty-dashed</span> · 添加连接器/环境）</span>
        </div>
      </section>
    </div>

    <!-- ==================== 列 3：浮层比例示意图、身份标识、Z-Index 与无障碍红线 ==================== -->
    <div class="colb">
      <section class="glass blk" style="flex:1">
        <div class="bh"><b>12. 浮层尺寸比例示意图</b><code>.cc-drawer / .cc-dialog</code></div>
        <div class="ov-grid">
          <div class="ov-card">
            <div class="ov-stage"><div class="ov-scr"></div><div class="ov-drw"></div></div>
            <b>配置抽屉 · 640–660px</b>
            <span>模态模糊遮罩（<code>.cc-scrim</code>）+ Focus Trap + Esc 关闭</span>
          </div>
          <div class="ov-card">
            <div class="ov-stage"><div class="ov-scr-l"></div><div class="ov-drw-sm"></div></div>
            <b>AI 帮手 · 440px 非模态</b>
            <span>轻压暗（<code>.cc-scrim-light</code>），严禁锁死左侧主表单</span>
          </div>
          <div class="ov-card">
            <div class="ov-stage"><div class="ov-scr"></div><div class="ov-dlg"></div></div>
            <b>居中弹窗 · 440 / 540 / 650</b>
            <span>sm 确认 / md 打回配号 / lg 手动新建工单</span>
          </div>
          <div class="ov-card">
            <div class="ov-stage"><div class="ov-scr"></div><div class="ov-sht"></div></div>
            <b>移动端底弹层 · r:30px</b>
            <span>顶部 38×5px 拖条 + 底部安全区 + 44pt 触控</span>
          </div>
        </div>

        <div class="hr" style="margin:2px 0"></div>
        <div class="bh"><b>13. 头像、应用图标与 Z-Index 层级契约</b><code>--z-*</code></div>
        <div class="row g10">
          <span class="cc-avatar" style="background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某<i style="background:var(--blue)"></i></span>
          <span class="cc-avatar" style="background:linear-gradient(150deg,#FFC38A,#F08A5D)">周某<i style="background:var(--teal)"></i></span>
          <span class="cc-avatar" style="background:linear-gradient(150deg,#9EDB9A,#4FB06A)">李娜<i style="background:var(--green)"></i></span>
          <span style="width:1px;height:24px;background:var(--hair)"></span>
          <span class="cc-app-icon cc-app-icon-sm" style="background:linear-gradient(155deg,#FF8A4C,#E24329)">G</span>
          <span class="cc-app-icon" style="width:34px;height:34px;border-radius:9px;font-size:13px;background:linear-gradient(155deg,#4FA3FF,#1D6FE0)">J</span>
          <span class="cc-app-icon" style="background:linear-gradient(155deg,#34D399,#0284C7)">{I("pkg",17)}</span>
        </div>

        <div class="z-bar">
          <span class="z-pill">sticky <b>10</b></span>
          <span class="z-pill">dock <b>20</b></span>
          <span class="z-pill">scrim <b>30</b></span>
          <span class="z-pill">drawer <b>40</b></span>
          <span class="z-pill">dialog <b>50</b></span>
          <span class="z-pill">popover <b>60</b></span>
          <span class="z-pill">toast <b>70</b></span>
          <span class="z-pill">tooltip <b>80</b></span>
        </div>

        <div class="rule-box" style="margin-top:auto">
          <b>无障碍与防跑偏 4 条硬规：</b><br>
          ① 彩色文字统一走 <code>--ink-*</code>（WCAG 2.1 AA ≥4.5:1），禁止裸用 <code>--green/--orange</code> 写字；<br>
          ② 按钮/开关/分段只用 <code>:focus-visible</code>，输入用 <code>:focus-within</code>；支持 <code>prefers-reduced-motion</code>；<br>
          ③ 滚动条 0px 零占位悬浮（Radix <code>&lt;ScrollArea&gt;</code> / Flutter <code>CupertinoScrollbar</code>）；<br>
          ④ 移动端触控目标 ≥ <b>44×44pt</b>，严禁把 PC 28–36px 直接照搬进手机端。
        </div>
      </section>
    </div>
  </div>
</div>
<script src="icons.js"></script>
</body></html>
'''

out = OUT / "pc-components-2.html"
out.write_text(HTML, encoding="utf-8")
print("→", out)
