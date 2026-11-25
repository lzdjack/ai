#!/usr/bin/env python3
"""生成 PC 标准组件库展示板：reference/src/v5/pc-components.html（1440×900）
直接消费 tokens/components.css（通过 pc.css 引入），沉淀全站唯一组件规范与视觉真相源。
用法：python3 scripts/gen-components.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"


def I(n, s=14, w=None, st=""):
    return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'


CHEV = f'<span class="cc-sel-caret">{I("chevd",13)}</span>'
CK = I("check", 12, 2.8)

STYLE = '''
.root{display:block;background:var(--wall);padding:24px 30px 26px}
.hd{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.hd .lg2{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden}
.hd h1{margin:0;font-size:20px;font-weight:800;letter-spacing:-.2px}
.hd .sub{font-size:12.5px;color:var(--text-3);margin-top:2px}
.grid{display:grid;grid-template-columns:1.18fr 1fr 1fr;gap:16px;height:786px}
.colb{display:flex;flex-direction:column;gap:14px;min-height:0}
.blk{border-radius:22px;padding:16px 18px;display:flex;flex-direction:column;gap:11px;min-height:0}
.bh{display:flex;align-items:center;gap:8px}
.bh b{font-size:14.5px;font-weight:700}
.bh code{font-family:"SF Mono",ui-monospace,monospace;font-size:11px;color:var(--blue);background:color-mix(in srgb,var(--blue) 12%,transparent);padding:2px 6px;border-radius:5px;margin-left:auto}
.subt{font-size:11.5px;color:var(--text-3);margin-top:-5px;line-height:1.45}
.fl{font-size:11.5px;font-weight:600;color:var(--text-3);margin-bottom:5px}
.dot7{width:7px;height:7px;border-radius:50%;flex:none}
.av22{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex:none}
.spec-tbl{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.spec-it{border-radius:12px;padding:9px 11px;background:var(--fill);display:flex;flex-direction:column;gap:3px}
.spec-it b{font-size:12px;font-weight:700;color:var(--text)}
.spec-it span{font-size:11px;color:var(--text-3);line-height:1.45}
.rule-box{border-radius:12px;padding:9px 11px;background:color-mix(in srgb,var(--purple) 8%,var(--fill));border:1px solid color-mix(in srgb,var(--purple) 22%,transparent);font-size:11.5px;color:var(--text-2);line-height:1.5}
.rule-box b{color:var(--text)}
'''

HTML = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>云匠 · 标准组件库规范（Component Library）</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body>
<div class="root">
  <div class="hd">
    <img src="logo.svg" width="38" height="38" alt="" style="margin:-2px">
    <div>
      <h1>云匠（CLOUDCRAFT）· 标准组件库规范</h1>
      <div class="sub">唯一真相源：<span class="mono">tokens/theme.css</span> + <span class="mono">tokens/components.css</span>（<span class="mono">docs/01-设计主题.md §16</span>）· 所有新页面与 M1 代码严格复用，禁止单页自造样式</div>
    </div>
    <span class="cc-pill cc-tag-b" style="margin-left:auto">基准锁定 · 2026-11-24</span>
  </div>

  <div class="grid">
    <!-- ==================== 列 1：下拉选择（核心基准）+ 展开菜单 ==================== -->
    <div class="colb">
      <section class="glass blk" style="flex:1">
        <div class="bh"><b>1. 下拉选择（用户钦定基准）</b><code>.cc-select</code></div>
        <div class="subt">底色 <span class="mono">--glass-2</span> + 边框 <span class="mono">1px --stroke</span> + 右对齐单向 <span class="mono">chevd 13px</span>；箭头绝不贴字、不加小方盒底色</div>

        <!-- 基准示例 1：复现环境 + 真人修复人（与手动新建工单完全同款） -->
        <div class="row g10">
          <div class="grow" style="min-width:0">
            <div class="fl">复现环境（带状态点 + 副说明）</div>
            <div class="cc-select">
              <span class="dot7" style="background:var(--green)"></span>
              <span class="cc-sel-val">测试环境</span>
              <span class="cc-sel-sub mono">test.tita.work/approval</span>
              {CHEV}
            </div>
          </div>
          <div style="width:166px;flex:none">
            <div class="fl">真人修复人（带头像）</div>
            <div class="cc-select">
              <span class="av22" style="background:linear-gradient(160deg,#FFC9A8,#F08F7A);color:#5A2414">林</span>
              <span class="cc-sel-val">林某（我）</span>
              <span class="cc-sel-sp"></span>
              {CHEV}
            </div>
          </div>
        </div>

        <!-- 基准示例 2：大表单 40px（AI 引擎 / 模型） -->
        <div>
          <div class="fl">大表单 40px（<span class="mono">.cc-select-lg</span>）</div>
          <div class="cc-select cc-select-lg">
            <span class="cc-sel-val mono">gpt-6.2-mini</span>
            <span class="cc-sel-sub">报错解读 / 翻译 / 轻问答</span>
            {CHEV}
          </div>
        </div>

        <!-- 基准示例 3：紧凑 34px + 语义色权限态 -->
        <div class="row g10">
          <div class="grow">
            <div class="fl">语义权限态（绿 · 可修改）</div>
            <div class="cc-select cc-select-sm is-green">
              {I("edit",13)}
              <span class="cc-sel-val">可修改（推 fix/）</span>
              <span class="cc-sel-sp"></span>
              {CHEV}
            </div>
          </div>
          <div class="grow">
            <div class="fl">语义权限态（蓝 · 仅查看）</div>
            <div class="cc-select cc-select-sm is-blue">
              {I("eye",13)}
              <span class="cc-sel-val">仅查看（只读隔离）</span>
              <span class="cc-sel-sp"></span>
              {CHEV}
            </div>
          </div>
        </div>

        <!-- 基准示例 4：聚焦展开态 + 毛玻璃悬浮菜单 -->
        <div>
          <div class="fl">展开态（<span class="mono">.is-open</span> + <span class="mono">.cc-menu</span> 悬浮毛玻璃菜单）</div>
          <div class="cc-select is-open" style="margin-bottom:6px">
            <span class="dot7" style="background:var(--green)"></span>
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
            <div class="cc-menu-item">
              <span class="cc-mi-ck"></span>
              <div class="cc-mi-main"><b class="mono">gemini-2.5-pro</b><em>Google · 长日志与跨仓上下文</em></div>
              <span class="cc-tag cc-tag-n">1M</span>
            </div>
          </div>
        </div>

        <div class="rule-box" style="margin-top:auto">
          <b>层级红线：</b>下拉选择统一用 <b><span class="mono">--glass-2</span> + <span class="mono">--stroke</span></b>（轻浮起），普通文本框统一用 <b><span class="mono">--fill</span></b>（微凹），用户 0.2 秒就能区分「点选」还是「打字」。
        </div>
      </section>
    </div>

    <!-- ==================== 列 2：输入框、搜索、分段、开关 + 按钮 ==================== -->
    <div class="colb">
      <section class="glass blk">
        <div class="bh"><b>2. 文本输入 / 搜索 / 分段 / 开关</b><code>.cc-input</code></div>
        <div class="col g8">
          <div class="cc-input">{I("globe",14,st="color:var(--text-3)")}<span class="mono grow ell">https://ai-gateway.tita.cloud</span><span class="f11 t3">默认微凹</span></div>
          <div class="cc-input is-focus">{I("lock",14,st="color:var(--blue)")}<span class="mono grow ell">glpat-•••••••••••• 91d0</span><span class="f11 lnk w6">聚焦蓝圈</span></div>
          <div class="cc-input is-error">{I("alert",14,st="color:var(--red)")}<span class="grow ell">邮箱或密码不对，请检查后重试</span><span class="f11" style="color:var(--red);font-weight:600">错误态</span></div>
          <div class="cc-search">{I("search",13)}<span class="grow">搜索仓库名、group/repo（300ms 防抖）…</span></div>
        </div>
        <div class="row g10" style="margin-top:2px">
          <div class="cc-seg grow">
            <span class="on" style="flex:1">公司网关</span>
            <span style="flex:1">API Key</span>
          </div>
          <div class="row g8" style="flex:none">
            <span class="cc-switch on"></span>
            <span class="cc-switch"></span>
          </div>
        </div>
      </section>

      <section class="glass blk" style="flex:1">
        <div class="bh"><b>3. 按钮系统（5 语义 × 3 高度）</b><code>.cc-btn</code></div>
        <div class="subt">同一底部操作栏最多 1 个蓝色主按钮（<span class="mono">pri</span>）；次要浮层按钮用 <span class="mono">glass</span></div>
        <div class="col g10">
          <div class="row g8" style="flex-wrap:wrap">
            <button class="cc-btn cc-btn-lg cc-btn-pri">{CK}保存并试构建</button>
            <button class="cc-btn cc-btn-lg cc-btn-glass">仅保存</button>
            <button class="cc-btn cc-btn-lg cc-btn-sec">取消</button>
          </div>
          <div class="row g8" style="flex-wrap:wrap">
            <button class="cc-btn cc-btn-pri">{I("zap",13)}立即采集</button>
            <button class="cc-btn cc-btn-glass">{I("search",13)}试采预览</button>
            <button class="cc-btn cc-btn-red">{I("undo",13)}打回重修</button>
            <button class="cc-btn cc-btn-ghost">跳过</button>
          </div>
          <div class="row g8" style="flex-wrap:wrap">
            <button class="cc-btn cc-btn-sm cc-btn-pri">挑选仓库</button>
            <button class="cc-btn cc-btn-sm cc-btn-glass">鉴权配置</button>
            <button class="cc-btn cc-btn-sm cc-btn-sec">刷新</button>
            <button class="cc-btn cc-btn-sm cc-btn-red">停用</button>
          </div>
        </div>
        <div class="hr" style="margin:2px 0"></div>
        <div class="bh"><b>4. 标签 &amp; 状态胶囊</b><code>.cc-tag / .cc-pill</code></div>
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
          <span class="cc-pill cc-tag-g">{CK}可修改 2 个</span>
          <span class="cc-pill cc-tag-o">Tita 采集失败 · 重试中</span>
        </div>
      </section>
    </div>

    <!-- ==================== 列 3：提示横幅、浮层规范、头像与滚动条 ==================== -->
    <div class="colb">
      <section class="glass blk">
        <div class="bh"><b>5. 提示横幅（4 种语义态）</b><code>.cc-banner</code></div>
        <div class="col g8">
          <div class="cc-banner cc-banner-info">{I("shield",14,st="color:var(--blue);margin-top:1px")}<span><b>信息提示：</b>权限红线由宿主机硬拦截，仅查看仓禁止推送。</span></div>
          <div class="cc-banner cc-banner-ok">{I("check",14,2.8,st="margin-top:1px")}<span><b>实测通过：</b>试采预览命中 2 张待修 Bug，耗时 210ms。</span></div>
          <div class="cc-banner cc-banner-warn">{I("alert",14,st="color:var(--orange);margin-top:1px")}<span><b>警告兜底：</b>未识别构建命令，点「微调 ›」手动补充。</span></div>
          <div class="cc-banner cc-banner-err">{I("alert",14,st="margin-top:1px")}<span><b>阻断报错：</b>401 Token 已过期，更新令牌后可断点重试。</span></div>
        </div>
      </section>

      <section class="glass blk" style="flex:1">
        <div class="bh"><b>6. 浮层、头像与滚动条规范</b><code>.cc-drawer</code></div>
        <div class="spec-tbl">
          <div class="spec-it">
            <b>右侧配置抽屉 · 640–660px</b>
            <span>模态轻模糊遮罩（<span class="mono">.cc-scrim</span>）：新建/编辑连接器、挑选仓库、微调配置、通用插件设置</span>
          </div>
          <div class="spec-it">
            <b>AI 帮手浮层 · 440px</b>
            <span>非模态轻遮罩（<span class="mono">.cc-scrim-light</span>）：点「问 AI」右侧滑出，不挡主表单、不丢填写内容</span>
          </div>
          <div class="spec-it">
            <b>居中对话框 · 520–560px</b>
            <span>轻量决策/新建动作：手动新建工单、打回原因、审核通过确认、首次发布配账号</span>
          </div>
          <div class="spec-it">
            <b>0px 悬浮滚动条</b>
            <span>绝不占容器宽度；默认隐藏、悬停/滚动淡入；静态图用底部羽化遮罩暗示可滚</span>
          </div>
        </div>

        <div class="hr" style="margin:2px 0"></div>
        <div class="fl" style="margin-bottom:2px">头像 + 状态点（34px 圆 · 12px 描边点）</div>
        <div class="row g12">
          <div class="row g8">
            <span class="av10" style="background:linear-gradient(150deg,#7FB2FF,#4C7DF0)">王某<i style="background:var(--blue)"></i></span>
            <div class="col"><span class="f12 w6">待你审核</span><span class="f11 t3">blue</span></div>
          </div>
          <div class="row g8">
            <span class="av10" style="background:linear-gradient(150deg,#FFC38A,#F08A5D)">周某<i style="background:var(--teal)"></i></span>
            <div class="col"><span class="f12 w6">修复中</span><span class="f11 t3">teal</span></div>
          </div>
          <div class="row g8">
            <span class="av10" style="background:linear-gradient(150deg,#9EDB9A,#4FB06A)">李娜<i style="background:var(--green)"></i></span>
            <div class="col"><span class="f12 w6">已通过</span><span class="f11 t3">green</span></div>
          </div>
          <div class="row g8">
            <span class="av10" style="background:linear-gradient(150deg,#F5A3C7,#D96BA0)">陈晨<i style="background:var(--red)"></i></span>
            <div class="col"><span class="f12 w6">需处理</span><span class="f11 t3">red</span></div>
          </div>
        </div>

        <div class="rule-box" style="margin-top:auto">
          <b>防跑偏铁律：</b>凡在本项目新增设计页或进入 M1 写 React 组件，一律以本页与 <span class="mono">tokens/components.css</span> 为唯一准绳，严禁局部自创控件样式。
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
