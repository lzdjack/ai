"""第一次使用步骤器：第 1、2、4、5、6、7 步的内容（第 3 步在 gen-onboard.py 里）。
STEP_PAGES(page, CHECK) → {"1": html, "2": html, ...}
"""

X = '''<style>
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.pc{border-radius:16px;padding:14px 16px;background:var(--fill);border:1.5px solid transparent;position:relative;min-width:0}
.pc.on{background:var(--glass-2);border-color:var(--blue);box-shadow:0 8px 20px -12px color-mix(in srgb,var(--blue) 70%,transparent)}
.pc.add{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13.5px;color:var(--text-3);background:transparent;border:1.5px dashed color-mix(in srgb,var(--text) 18%,transparent)}
.pc b{font-size:15.5px}
.rdo{width:18px;height:18px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--text) 25%,transparent);flex:none}
.rdo.on{border:0;background:var(--blue);box-shadow:inset 0 0 0 5px var(--blue),inset 0 0 0 9px #fff}
.cbx2{width:18px;height:18px;border-radius:5px;border:1.5px solid color-mix(in srgb,var(--text) 25%,transparent);flex:none;display:flex;align-items:center;justify-content:center}
.cbx2.on{border:0;background:var(--blue);color:#fff}
.sel{justify-content:space-between}
.gl{width:22px;height:22px;border-radius:6px;background:#FC6D26;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
.jr{width:22px;height:22px;border-radius:6px;background:#2684FF;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
.tt2{width:22px;height:22px;border-radius:6px;background:linear-gradient(160deg,#5AA0FF,#2F6BFF);color:#fff;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
.rp{display:grid;grid-template-columns:1fr 128px 128px 156px 132px;gap:8px 10px;align-items:center}
.rp .inp{height:40px;font-size:13.5px}
.dep{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dfl{flex-wrap:nowrap;gap:6px}.dfl .dn{padding:0 10px;gap:6px}.dn{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:10px;background:var(--glass-2);border:1px solid var(--stroke);font-size:13px}
.arw{color:var(--text-3)}
.obx{border-radius:16px;padding:14px 16px;background:var(--fill)}
.kv3{display:flex;align-items:center;gap:10px;margin-top:10px}
.kv3>span:first-child{width:72px;white-space:nowrap;flex:none;font-size:12.5px;color:var(--text-3)}
.kv3 .inp{height:36px;flex:1;font-size:13.5px}
.mp{display:grid;grid-template-columns:1fr 24px 1fr;gap:8px 12px;align-items:center}
.mp .inp{height:36px;font-size:13.5px}
.pvw{border:1px dashed var(--hair);border-radius:14px;padding:12px 16px 6px}.pvh{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-2);padding-bottom:8px}.tk{display:flex;align-items:center;gap:10px;height:36px;font-size:13px;color:var(--text-2);border-top:1px solid var(--hair)}
.skc{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:var(--fill);border:1.5px solid transparent}
.skc.on{background:var(--glass-2);border-color:color-mix(in srgb,var(--blue) 55%,transparent)}
.skc b{font-size:14px}.skadd{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;border:1.5px dashed var(--hair);color:var(--blue);font-size:13.5px}.skadd .t3{margin-left:auto}
.ic3{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
.pubc{border-radius:16px;padding:14px 16px;background:var(--fill);flex:1;min-width:0}
.chk3{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--hair);font-size:13.5px}
.chk3:first-child{border-top:0}
.ck3{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
.big-ok{display:flex;align-items:center;gap:16px;padding:16px 20px;border-radius:18px;background:color-mix(in srgb,var(--green) 10%,var(--glass-2));border:1px solid color-mix(in srgb,var(--green) 30%,transparent)}
</style>'''


def STEP_PAGES(page, CHECK):
    def I(n, s=16, w=None, st=""):
        return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'
    OK = f'<span class="okt">{CHECK}'
    CHD = I("chevd", 14)

    # ---------------- 1 选择项目 ----------------
    def proj(name, line, sub, st, on=False):
        stc = {"ok": '<span class="tag tg-g">已就绪</span>', "no": '<span class="tag tg-n">未准备</span>'}[st]
        return f'''<div class="pc{' on' if on else ''}"><div class="row g8"><span class="rdo{' on' if on else ''}"></span><b>{name}</b><span class="grow"></span>{stc}</div>
<div class="f12 t3" style="margin:6px 0 0 26px">{line}</div><div class="f12 t2" style="margin:3px 0 0 26px">{sub}</div></div>'''
    s1 = X + f'''
      <div style="margin-top:20px">
        <div class="lab">你能看到的项目<span>来自你的 Jira / GitLab 账号权限</span></div>
        <div class="g3">
          {proj("审批", "协同办公", "林某 准备过 · 可以直接用", "ok")}
          {proj("考勤", "人事", "王某 准备过 · 可以直接用", "ok")}
          {proj("OKR", "人才发展", "还没人准备", "no", True)}
          {proj("绩效", "人才发展", "还没人准备", "no")}
          {proj("薪酬", "人事", "还没人准备", "no")}
          <div class="pc add">{I("plus",16)}新建项目</div>
        </div>
      </div>
      <div class="note" style="margin-top:22px">{I("layers",15,st="color:var(--blue);margin-top:1px")}<span>一次准备一个项目。已就绪的项目别人准备过，不用再填；其他项目之后在「设置 → 项目」里加。</span></div>'''
    p1 = page(1, "先选一个要交给 Bot 的项目", "接下来几步都是为这个项目准备的：代码在哪、去哪复现、收哪些单、按什么规则修", s1,
              "代码仓库", skip=False, prev=False)

    # ---------------- 2 代码仓库 ----------------
    def repo(path, mb, tb, cmd, st):
        return f'''<div class="inp"><span class="gl">G</span><span class="mono grow ell">{path}</span></div>
<div class="inp sel"><span class="mono f12 ell">{mb}</span>{CHD}</div>
<div class="inp{' sel' if tb != '—' else ''}"><span class="mono f12 ell">{tb}</span>{CHD if tb != '—' else ''}</div>
<div class="inp"><span class="mono f12 ell">{cmd}</span></div>
<div>{st}</div>'''
    def bn(t, tag=None, tc="tg-n", mono=True):
        return f'<span class="dn"><span class="{'mono' if mono else ''}">{t}</span>' + (f'<span class="tag {tc}">{tag}</span>' if tag else '') + '</span>'
    ARW = f'<span class="arw">{I("arrowr",16)}</span>'
    s2 = X + f'''
      <div style="margin-top:20px">
        <div class="lab">仓库<span>从公司 GitLab 里选，数量不限 · 每个仓库的主分支、测试分支各自填 · 构建命令 Bot 从 package.json 推测，可以改</span></div>
        <div class="rp"><div class="rh">GitLab 仓库</div><div class="rh">主分支</div><div class="rh">测试分支</div><div class="rh">构建命令</div><div class="rh">Bot 实测</div>
          {repo("fe/tita-okr-web", "master", "dev-okr", "pnpm build-prod", OK + '构建通过 3:12</span>')}
          {repo("fe/tita-ui-kit", "main", "test", "pnpm build:lib", '<span class="ing"><span class="spin"></span>正在构建 1:05</span>')}
          {repo("fe/tita-main", "master", "—", "—", OK + '能拉取</span>')}
        </div>
        <div class="f13 lnk" style="margin-top:10px">+ 从 GitLab 选择仓库</div>
      </div>
      <div style="margin-top:20px">
        <div class="lab">修一张单时分支怎么走<span>进测试分支、回主分支都要提 MR 审核，Bot 不能自己合 · 每个仓库用自己的分支</span></div>
        <div class="obx"><div class="dep dfl">
          {bn("主分支", mono=False)}{ARW}{bn("fix/OKR-2381", "拉出修复分支", "tg-b")}{ARW}{bn("测试分支", "审核后合入，发测试", "tg-p", False)}{ARW}{bn("主分支", "测过再审核合回，发正式", "tg-g", False)}
        </div>
        <div class="row g12" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--hair)">
          <span class="f13 w6" style="flex:none">MR 审核人</span>
          <div class="kv3 grow" style="margin:0"><span style="width:auto">合入测试分支</span><div class="inp sel">工单的修复人{CHD}</div></div>
          <div class="kv3 grow" style="margin:0"><span style="width:auto">合回主分支</span><div class="inp sel">林某{CHD}</div></div>
        </div></div>
      </div>
      <div class="note" style="margin-top:22px">{I("key",15,st="color:var(--blue);margin-top:1px")}<span>Bot 用管理员开好的 GitLab 账号 <span class="mono">bot-fix</span> 拉代码、建分支、提 MR，不用你的账号。</span></div>'''
    p2 = page(2, "Bot 要改哪些代码", "选好仓库，告诉 Bot 主分支和测试分支；构建不过的仓库 Bot 改不了", s2, "环境与账号", skip=False)

    # ---------------- 4 工单来源 ----------------
    s4 = X + f'''
      <div class="row g12" style="margin-top:20px;align-items:stretch">
        <div class="obx grow"><div class="row g8"><span class="jr">J</span><b class="f15">Jira</b><span class="f12 t3">测试提的 Bug</span><span class="grow"></span>{OK}现在有 2 张</span></div>
          <div class="kv3"><span>项目</span><div class="inp sel">OKR · 目标管理{CHD}</div></div>
          <div class="kv3"><span>收单状态</span><div class="inp sel">AI修复{CHD}</div></div></div>
        <div class="obx grow"><div class="row g8"><span class="tt2">Tita</span><b class="f15">Tita 工单</b><span class="f12 t3">线上问题</span><span class="grow"></span>{OK}现在有 1 张</span></div>
          <div class="kv3"><span>产品</span><div class="inp sel">OKR{CHD}</div></div>
          <div class="kv3"><span>收单节点</span><div class="inp sel">AI干活{CHD}</div></div></div>
      </div>
      <div style="margin-top:20px">
        <div class="lab">每个来源的单去哪个环境复现<span>在这里统一设置，选第 3 步填过的环境 · 不读工单里的环境字段</span></div>
        <div class="mp">
          <div class="inp"><span class="jr" style="width:20px;height:20px;font-size:10px;margin-right:8px">J</span>Jira 工单<span class="t3 f12" style="margin-left:8px">测试提的 Bug</span></div><span class="arw">{I("arrowr",16)}</span><div class="inp sel">测试环境{CHD}</div>
          <div class="inp"><span class="tt2" style="margin-right:8px">Tita</span>Tita 工单<span class="t3 f12" style="margin-left:8px">线上问题</span></div><span class="arw">{I("arrowr",16)}</span><div class="inp sel">正式环境{CHD}</div>
        </div>
      </div>
      <div style="margin-top:20px">
        <div class="pvw">
          <div class="pvh">{I("eye",15,st="color:var(--text-3)")}<span>按上面的设置，现在能收到这 3 张，开工后会自动开始。这里只是预览，不用改。</span></div>
          <div class="tk"><span class="sc10 sc-j">Jira</span><span class="mono f12 t3">OKR-412</span><span class="grow ell">对齐视图里子目标重复显示</span><span class="f12 t3">测试环境 · 审核人 林某</span></div>
          <div class="tk"><span class="sc10 sc-j">Jira</span><span class="mono f12 t3">OKR-418</span><span class="grow ell">目标导入后截止日期错一天</span><span class="f12 t3">测试环境 · 审核人 林某</span></div>
          <div class="tk"><span class="sc10 sc-t">Tita</span><span class="mono f12 t3">TK-20902</span><span class="grow ell">目标进度导出缺少部门</span><span class="f12 t3">正式环境 · 审核人 周某</span></div>
        </div>
      </div>'''
    p4 = page(4, "收哪些单交给 Bot", "Bot 定期去 Jira 和 Tita 收单，符合条件的才接；审核人是工单里的修复人", s4, "Skills")

    # ---------------- 5 Skills ----------------
    def sk(name, desc, tag, on, ic, bg):
        return f'''<div class="skc{' on' if on else ''}"><span class="cbx2{' on' if on else ''}">{CHECK if on else ''}</span>
<div class="grow"><div class="row g8"><span class="ic3" style="background:{bg};width:22px;height:22px;border-radius:7px">{I(ic,12,2)}</span><b>{name}</b>{tag}</div><div class="f12 t2" style="margin-top:4px">{desc}</div></div></div>'''
    MY = '<span class="tag tg-p">我的</span>'
    BI = '<span class="tag tg-n">内置</span>'
    TM = '<span class="tag tg-t">团队</span>'
    CB = "linear-gradient(160deg,#5AA0FF,#1F6FFF)"
    VB = "linear-gradient(160deg,#5EDB7A,#28B04F)"
    s5 = X + f'''
      <div class="row g16" style="margin-top:20px;align-items:flex-start">
        <div class="grow col g8"><div class="lab" style="margin-bottom:2px">编码<span>管 Bot 怎么改</span></div>
          {sk("最小改动修复", "只改与根因相关的代码，不顺手重构", BI, True, "code", CB)}
          {sk("组件包升级", "只升本次需要的版本，锁文件一起更新", BI, True, "code", CB)}
          <div class="skadd">{I("plus",15)}写一条自己的编码规则<span class="f12 t3">写完出现在这里，标「我的」</span></div>
        </div>
        <div class="grow col g8"><div class="lab" style="margin-bottom:2px">验证<span>管修完怎么验</span></div>
          {sk("页面交互回归", "目标环境复现，改动版本上再复测一遍", BI, True, "eye", VB)}
          {sk("接口回归", "调用相关接口，核对返回有没有变", BI, False, "eye", VB)}
          <div class="skadd">{I("plus",15)}写一条自己的验证规则<span class="f12 t3">写完出现在这里，标「我的」</span></div>
        </div>
      </div>
      <div class="row g10" style="margin-top:18px">
        <span class="chip2">{I("spark",13,st="color:var(--purple)")}让 AI 读 OKR 的代码，帮你起草一条</span><span class="f12 t3">起草完你确认了才会启用</span>
      </div>
      <div class="note" style="margin-top:16px">{I("layers",15,st="color:var(--blue);margin-top:1px")}<span>第一次用只有系统内置的，够用就直接下一步。自己写的当场加进列表，不用离开步骤器，之后也能在 Skills 里改。</span></div>'''
    p5 = page(5, "Bot 按什么规则改、怎么验", "Skills 是写给 Bot 的规则。系统内置的直接能用，有自己的规则也可以在这里写", s5, "发布配置")

    # ---------------- 5 · 写一条自己的规则（弹出面板） ----------------
    rule = [("1", "## 什么时候用", "h"), ("2", "OKR 页面里和表单有关的 Bug：录入、校验、提交。", ""), ("3", "", ""),
            ("4", "## 怎么改", "ha"), ("5", "1. 表单统一用 @tita/ui 的 TitaForm，不手写输入框和样式。", "add"),
            ("6", "2. 新字段照 configs 的写法加，参考 objective/form.config.ts。", "add"),
            ("7", "3. 校验规则写进 configs，不在 onSubmit 里另写一套。", "add"),
            ("8", "4. 改完在表单页提交一次，看校验和提示对不对。", "add")]
    rl = "".join(f'<div class="cl{" add" if t in ("add","ha") else ""}" style="line-height:26px"><span class="n">{n}</span><span class="c" style="padding-left:8px;{"color:var(--purple);font-weight:600" if t in ("h","ha") else ""}">{c}</span></div>' for n, c, t in rule)
    DRW = f'''<style>
.scr{{position:fixed;inset:0;z-index:30;background:rgba(15,20,40,.28);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}}
html.dark .scr{{background:rgba(0,0,0,.45)}}
.drw{{position:fixed;z-index:31;top:20px;right:20px;bottom:20px;width:700px;border-radius:26px;display:flex;flex-direction:column;overflow:hidden;
  background:rgba(255,255,255,.95);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);box-shadow:0 30px 80px -20px rgba(10,20,60,.45),0 0 0 1px var(--stroke)}}
html.dark .drw{{background:rgba(36,38,52,.96)}}
.drw .dh{{display:flex;gap:12px;align-items:center;padding:20px 22px 16px;border-bottom:1px solid var(--hair)}}
.drw .db{{flex:1;display:flex;flex-direction:column;gap:14px;padding:18px 22px;min-height:0}}
.drw .df{{display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--hair)}}
.xb{{width:32px;height:32px;border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;color:var(--text-2)}}
</style>
<div class="scr"></div>
<div class="drw">
  <div class="dh"><span class="ic3" style="background:{CB};width:40px;height:40px;border-radius:11px">{I("code",20,2)}</span>
    <div class="grow"><div style="font-size:18px;font-weight:800">写一条自己的编码规则</div><div class="f12 t3" style="margin-top:3px">只给「OKR」用 · 保存后加进第 5 步的列表，标「我的」并勾上</div></div>
    <span class="xb">{I("x",16,2.2)}</span></div>
  <div class="db">
    <div><div class="flabel">名称</div><div class="field">复用公司表单组件</div></div>
    <div><div class="flabel">用途（Bot 判断什么时候用）</div><div class="field">OKR 页面里和表单有关的 Bug：录入、校验、提交。</div></div>
    <div><div class="row g8"><span class="flabel grow" style="margin:0">规则正文</span><span class="f12 t3">Markdown · 8 行</span></div>
      <div class="code" style="margin-top:6px;border-radius:14px;background:var(--glass-2);border:1px solid var(--stroke);padding:8px 0;font-size:12.5px">{rl}</div></div>
    <div class="gbord" style="padding:14px 16px 12px">
      <div class="row g8"><span class="aid" style="width:22px;height:22px;border-radius:7px">{I("spark",12)}</span><span class="f13 w7 grow">AI 帮你写</span><span class="f12 t3">读的是 fe/tita-okr-web</span></div>
      <div class="me" style="font-size:12.5px;padding:8px 12px;margin-top:10px;max-width:100%;width:fit-content;margin-left:auto">起草一条：表单都用公司组件库来写</div>
      <div class="f12 t2" style="margin-top:10px;line-height:1.6">读了 23 个表单，22 个用的是 TitaForm。已起草第 4–8 行（绿色），先看一遍再决定：</div>
      <div class="row g8" style="margin-top:8px"><span class="btn2 sm" style="background:var(--blue);color:#fff;padding:0 18px">采用</span><span class="btn2 sm a-sec" style="background:var(--fill);padding:0 18px">放弃</span></div></div>
  </div>
  <div class="df"><button class="bigb secb">取消</button><span class="grow"></span><span class="f12 t3">从下一张单开始生效，之后在 Skills 里也能改</span><button class="bigb pri">保存并加到列表</button></div>
</div>'''
    p5n = p5.replace('</div><script src="icons.js">', DRW + '</div><script src="icons.js">', 1)

    # ---------------- 6 发布配置（可选） ----------------
    def kv(k, v, sel=True, extra="", hint=""):
        h = f'<span class="f12 t3" style="margin-left:auto;flex:none;padding-left:10px">{hint}</span>' if hint else ""
        return f'<div class="kv3"><span>{k}</span><div class="inp{" sel" if sel else ""}"><span class="ell">{v}</span>{h}{CHD if sel else ""}</div>{extra}</div>'
    s6 = X + f'''
      <div class="row g12" style="margin-top:20px;align-items:stretch">
        <div class="pubc"><div class="row g8"><b class="f15">测试环境</b><span class="tag tg-b">测试</span><span class="grow"></span><span class="f12 t3">修完一键发测试</span></div>
          {kv("打包上传", '<span class="mono f12">tita build</span>', False, hint="在测试分支上打")}
          {kv("发布到测试", '<span class="mono f12">tita release --app www --env TEST</span>', False)}
          {kv("发测试的人", "工单修复人", hint="可改成指定的人或任何人")}
          <div class="f12 t3" style="margin:10px 0 0 82px;line-height:1.6">版本号不用填，tita release 从包里读。发完 Bot 核对测试环境 Apollo 里的提交号，对上了才通知测试人。</div></div>
        <div class="pubc"><div class="row g8"><b class="f15">正式环境</b><span class="tag tg-o">线上</span><span class="grow"></span><span class="f12 t3">测试通过才能发</span></div>
          {kv("打包上传", '<span class="mono f12">tita build</span>', False, hint="合回主分支后重新打")}
          {kv("发布到正式", '<span class="mono f12">tita release --app www --env PROD</span>', False)}
          {kv("正式发布人", "任何人", hint="可以改成指定的人")}
          {kv("紧急回滚", "Apollo · Tita_Static", hint="只回滚配置")}
          {kv("谁能回滚", "同正式发布人", hint="可改 · 测试环境不限")}</div>
      </div>
      <div class="pubc" style="margin-top:14px;flex:none">
        <div class="row g8"><b class="f15">你的账号</b><span class="tag tg-n">只给你用</span><span class="grow"></span><span class="f12 t3">合入 MR 用你的 GitLab，发布、回滚用你的 Apollo，记的都是本人</span></div>
        <div class="row g10" style="margin-top:12px">
          <div class="inp grow" style="flex:1.3"><span class="t3 f12" style="flex:none">GitLab 令牌</span><span class="mono f13" style="letter-spacing:1px">•••••••••• 7c2e</span></div>
          <div class="inp grow"><span class="t3 f12" style="flex:none">Apollo 用户名</span><span class="mono f13">lin.x</span></div>
          <div class="inp grow"><span class="t3 f12" style="flex:none">密码</span><span class="mono f13" style="letter-spacing:2px">••••••••</span></div>
          <button class="btn2 a-sec" style="background:var(--glass-2);flex:none">{I("zap",14)}试连接</button>
        </div>
        <div class="row g10" style="margin-top:10px">{OK}都已连通 · OKR 能合入两个分支、能发测试和正式</span><span class="grow"></span><span class="f12 t3">存到「设置 → 我的账号」· 其他人第一次用到时再配</span></div>
      </div>
      <div class="note" style="margin-top:14px">{I("rocket",15,st="color:var(--blue);margin-top:1px")}<span>这一步可以先跳过：不影响 Bot 修代码，只是修完不能一键发测试。之后在「设置 → 项目」里补。</span></div>'''
    foot6 = ('<button class="bigb secb"><i data-i="chevl" data-s="16" data-w="2.4"></i>上一步</button><span class="grow"></span>'
             '<button class="bigb secb">先跳过</button><button class="bigb pri">保存，下一步：检查并开工<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    p6 = page(6, "修完怎么发到测试和正式环境", "可选。Bot 在仓库目录下执行这些命令；填了之后，修复人能在工单里一键发测试", s6, foot=foot6)

    # ---------------- 7 检查并开工 ----------------
    def c(st, t, r):
        bg = {"ok": "var(--green)", "wn": "var(--orange)", "sk": "color-mix(in srgb,var(--text) 25%,transparent)"}[st]
        g = {"ok": CHECK, "wn": "!", "sk": "–"}[st]
        rc = {"ok": "var(--text-3)", "wn": "var(--orange)", "sk": "var(--text-3)"}[st]
        return f'<div class="chk3"><span class="ck3" style="background:{bg};font-size:12px;font-weight:800">{g}</span><span class="grow">{t}</span><span class="f12" style="color:{rc}">{r}</span></div>'
    s7 = X + f'''
      <div class="big-ok" style="margin-top:20px">
        <span class="ck3" style="width:46px;height:46px;background:var(--green)">{I("check",24,3)}</span>
        <div class="grow"><div class="f16 w7">必需条件全部通过，可以开工了</div><div class="f13 t2" style="margin-top:3px">Bot-02 实际跑了一遍 · 用时 4 分 38 秒 · 今天 10:42</div></div>
        <span class="f12 lnk">看完整日志 ›</span>
      </div>
      <div class="row g12" style="margin-top:16px;align-items:flex-start">
        <div class="obx grow" style="padding:6px 16px">
          {c("ok", "AI 已连接 · gpt-6.2-sol", "管理员配置")}
          {c("ok", "拉取 3 个仓库，构建 2 个", "4 分 02 秒")}
          {c("ok", "打开 3 个环境", "都能打开")}
          {c("ok", "账号试登录", "6 个成功")}
          {c("wn", "正式环境 · OKR 管理员 Cookie 已过期", "不挡开工，用到时提醒你")}
          {c("ok", "收单条件", "能收到 3 张")}
          {c("ok", "Skills", "3 个已启用")}
          {c("ok", "你的 GitLab、Apollo 账号", "都已连通 · 没配不挡开工")}
          {c("sk", "发布配置", "已跳过 · 修完不能一键发测试")}
        </div>
        <div class="obx" style="width:270px;flex:none">
          <div class="f13 w7">开工后</div>
          <div class="f12 t2" style="margin-top:6px;line-height:1.6">已收的 3 张单马上开始，进度在工作台里看；手机会收到「待你审核」通知。</div>
          <div class="col g6" style="margin-top:10px">
            <div class="tk" style="background:var(--glass-2);height:34px;font-size:12.5px"><span class="sc10 sc-j">Jira</span><span class="grow ell">对齐视图里子目标重复显示</span></div>
            <div class="tk" style="background:var(--glass-2);height:34px;font-size:12.5px"><span class="sc10 sc-j">Jira</span><span class="grow ell">目标导入截止日期错一天</span></div>
            <div class="tk" style="background:var(--glass-2);height:34px;font-size:12.5px"><span class="sc10 sc-t">Tita</span><span class="grow ell">目标进度导出缺少部门</span></div>
          </div>
        </div>
      </div>'''
    foot7 = ('<button class="bigb secb"><i data-i="chevl" data-s="16" data-w="2.4"></i>上一步</button><span class="grow"></span>'
             '<span class="f13 t3" style="margin-right:6px">之后在「设置 → 项目」里随时改</span>'
             '<button class="bigb pri">开始接单，进入工作台<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    p7 = page(7, "Bot 把条件实际跑了一遍", "每一项都是真的去拉代码、打开环境、登录账号、收单，不是只看填没填", s7, foot=foot7)

    return {"1": p1, "2": p2, "4": p4, "5": p5, "5-new": p5n, "6": p6, "7": p7}



def ai_step(page, CHECK):
    """管理员专用的第 1 步：连接 AI。"""
    def I(n, s=16, w=None, st=None):
        return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'
    CHD = I("chevd", 14)
    OK = f'<span class="okt">{CHECK}'
    def row(k, v):
        return f'<div class="kv3" style="margin-top:12px"><span>{k}</span>{v}</div>'
    body = X + f'''
      <div class="obx" style="margin-top:20px;padding:18px 20px">
        {row("AI 工具", f'<div class="inp sel">Codex{CHD}</div>')}
        {row("模型", f'<div class="inp sel">gpt-6.2-sol{CHD}</div>')}
        {row("连接方式", '<div class="seg" style="flex:1"><span class="on" style="flex:1;justify-content:center">公司网关</span><span style="flex:1;justify-content:center">API Key</span></div>')}
        {row("网关地址", '<div class="inp"><span class="mono f12">https://ai-gateway.tita.cloud</span></div>')}
        {row("访问令牌", '<div class="inp"><span class="mono f12">•••••••••••••••• 3f9a</span></div>')}
        <div class="row g10" style="margin:16px 0 0 82px">
          <button class="btn2 a-sec" style="background:var(--glass-2)">{I("zap",14)}试一下</button>
          {OK}已连通 · Bot-02 实际调用了一次，1.2 秒</span>
        </div>
      </div>
      <div class="obx" style="margin-top:14px;padding:14px 20px">
        <div class="row g8"><b class="f15">Bot 用的 GitLab 账号</b><span class="grow"></span><span class="f12 t3">拉代码、推 fix/、提 MR，不给合入权限 · 令牌都加密存在内网服务器上 · Jira、Tita 采集账号在「来源采集」配</span></div>
        {row("账号", '<div class="inp"><span class="mono f13">bot-fix</span><span class="f12 t3" style="margin-left:auto">从令牌识别</span></div>')}
        {row("访问令牌", '<div class="inp"><span class="mono f12">•••••••••••••••• 91d0</span></div>')}
        <div class="row g10" style="margin:14px 0 0 82px">
          <button class="btn2 a-sec" style="background:var(--glass-2)">{I("zap",14)}试连接</button>
          {OK}已连通 · 能拉取、能提 MR，没有合入权限（正好）</span>
        </div>
      </div>
'''
    return page(1, "先把 AI 和 Bot 账号接上", "Bot 靠它们读工单、改代码。全公司接一次，所有项目共用；只有管理员会看到这一步", body,
                "选择项目", skip=False, prev=False)
