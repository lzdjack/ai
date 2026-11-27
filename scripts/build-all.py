#!/usr/bin/env python3
"""统一生成与出图：按依赖顺序生成全部页面 HTML → 渲染亮暗 PNG → 生成 index.html。

用法：
  python3 scripts/build-all.py                 # 全量：生成 HTML + 出全部图 + 生成 index.html
  python3 scripts/build-all.py --changed       # 只重出 HTML 相对 git HEAD 有改动的页面（改了公共样式则全量）
  python3 scripts/build-all.py --only 流程模板 pc-roles   # 只出 HTML 名或图名包含关键字的页面
  python3 scripts/build-all.py --no-render     # 只生成 HTML 和 index.html，不出图
  python3 scripts/build-all.py --check         # 只核对对照表：缺源文件、有图没登记、登记了没图

新增页面时：在 GENERATORS 里登记生成脚本（注意依赖顺序），在 RENDERS 里登记「HTML → 图」一行，
然后运行 --check 确认没有遗漏。render.sh 共用一个 Chrome 配置目录，所以出图只能串行。
"""
import argparse
import pathlib
import struct
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "reference" / "src"
IMG = ROOT / "reference" / "images"

# 生成脚本，按依赖顺序执行（参数为相对仓库根目录的路径）。
# 依赖：gen-clipboard-invite 读 pc-ai.html；gen-missing-gaps 读 onboard-pc-4 / onboard-pc-prod / pc-code / pc-evidence，
# 所以这两个必须排在 gen-pages、gen-onboard 之后。
GENERATORS = [
    ("gen-mobile.py", "reference/src/v4/mobile.html"),
    ("gen-pages.py",),
    ("gen-onboard.py",),
    ("gen-onboard-m.py",),
    ("gen-mobile-pages.py",),
    ("gen-login.py",),
    ("gen-splash.py",),
    ("gen-runner-select.py",),
    ("gen-runner-init.py",),
    ("gen-runner-server.py",),
    ("gen-runner-pro.py",),
    ("gen-market.py",),
    ("gen-components.py",),
    ("gen-components-2.py",),
    ("gen-mobile-components.py",),
    ("gen-org-suite.py",),
    ("gen-audit-gaps.py",),
    ("gen-phase2.py",),
    ("gen-flow.py",),
    ("gen-clipboard-invite.py",),   # 依赖 pc-ai.html
    ("gen-missing-gaps.py",),       # 依赖 onboard-pc-4 / onboard-pc-prod / pc-code / pc-evidence
]

# 改了这些公共样式，所有页面都要重出（--changed 时自动切换为全量）
SHARED = ("tokens/", "reference/src/v3/", "reference/src/v4/apple.css",
          "reference/src/v5/pc.css", "reference/src/v5/m.css", "reference/src/v5/icons.js")

# 出图对照表：(HTML 相对 reference/src, 查询参数, 图片前缀相对 reference/images[, 宽, 高])，默认 1440×900。
# 每行产出「前缀-亮色.png」和「前缀-暗色.png」。reference/images/explore/ 与 logo/AppIcon-1024.png 是一次性产物，不在此列。
RENDERS = [
    ("v4/apple-chat.html", "v=10&sel=5&ic=3", "PC-主界面"),
    ("v4/mobile.html", "", "移动端", 1440, 1000),
    ("v5/pc-ai.html", "", "pages/PC-AI助手"),
    ("v5/pc-ask.html", "", "pages/PC-Bot提问回复"),
    ("v5/pc-skills.html", "", "pages/PC-Skills"),
    ("v5/pc-skimport.html", "", "pages/PC-Skills-导入"),
    ("v5/pc-skhistory.html", "", "pages/PC-Skills-版本历史"),
    ("v5/pc-code.html", "", "pages/PC-代码改动"),
    ("v5/web-admin-blueprint.html", "", "pages/PC-企业管理后台-蓝图"),
    ("v5/web-admin-roles.html", "", "pages/PC-企业管理后台-角色策略"),
    ("v5/pc-clipboard-invite.html", "", "pages/PC-剪贴板识别邀请"),
    ("v5/pc-release.html", "", "pages/PC-发布"),
    ("v5/pc-pubpassed.html", "", "pages/PC-发布-复测通过"),
    ("v5/pc-pubfail.html", "", "pages/PC-发布-失败"),
    ("v5/pc-waittest.html", "", "pages/PC-发布-等复测"),
    ("v5/pc-prod.html", "", "pages/PC-发正式"),
    ("v5/pc-pubbefore.html", "", "pages/PC-发测试-发布前"),
    ("v5/pc-mrmain.html", "", "pages/PC-合回主分支-MR审核"),
    ("v5/pc-bundle.html", "", "pages/PC-大包明细"),
    ("v5/pc-fullpreview.html", "", "pages/PC-完整文件与证据预览"),
    ("v5/pc-approve.html", "", "pages/PC-审核通过-有未测项"),
    ("v5/pc-edge-extra.html", "", "pages/PC-工作台-边界补全"),
    ("v5/pc-working.html", "", "pages/PC-工单-修复中"),
    ("v5/pc-tkrelease.html", "", "pages/PC-工单-发布"),
    ("v5/pc-confirm.html", "", "pages/PC-工单-待原平台确认"),
    ("v5/join-existing-pc.html", "", "pages/PC-已注册成员确认加入"),
    ("v5/runner-pro-pc.html", "", "pages/PC-开通云端托管Pro"),
    ("v5/pc-newticket.html", "", "pages/PC-手动新建工单"),
    ("v5/pc-reject.html", "", "pages/PC-打回原因"),
    ("v5/runner-init-pc.html", "", "pages/PC-执行器初始化"),
    ("v5/pc-log.html", "", "pages/PC-执行日志报错"),
    ("v5/pc-queue.html", "", "pages/PC-排队"),
    ("v5/pc-market.html", "", "pages/PC-插件市场"),
    ("v5/pc-plugin-runtime.html", "", "pages/PC-插件运行态规范"),
    ("v5/onboard-pc-0-ai.html", "", "pages/PC-步骤器-0-连接AI"),
    ("v5/onboard-pc-1-ai.html", "", "pages/PC-步骤器-1-向导AI帮手"),
    ("v5/onboard-pc-1-ticket.html", "", "pages/PC-步骤器-1-工单鉴权与触发条件"),
    ("v5/onboard-pc-1-new.html", "", "pages/PC-步骤器-1-新建连接器鉴权"),
    ("v5/onboard-pc-1.html", "", "pages/PC-步骤器-1-连接器与鉴权"),
    ("v5/onboard-pc-2-tune.html", "", "pages/PC-步骤器-2-微调配置"),
    ("v5/onboard-pc-2-pick.html", "", "pages/PC-步骤器-2-挑选仓库"),
    ("v5/onboard-pc-2.html", "", "pages/PC-步骤器-2-授权项目与代码"),
    ("v5/onboard-pc-3-acct.html", "", "pages/PC-步骤器-3-添加账号"),
    ("v5/onboard-pc-4-log.html", "", "pages/PC-步骤器-4-体检完整日志"),
    ("v5/onboard-pc-4.html", "", "pages/PC-步骤器-4-体检并开工"),
    ("v5/register-pc.html", "", "pages/PC-注册"),
    ("v5/login-pc.html", "", "pages/PC-登录"),
    ("v5/pc-empty.html", "", "pages/PC-空状态"),
    ("v5/pc-empty2.html", "", "pages/PC-空状态-2"),
    ("v5/pc-acctneed.html", "", "pages/PC-第一次发布-配账号"),
    ("v5/pc-rollback.html", "", "pages/PC-紧急回滚"),
    ("v5/pc-components.html", "", "pages/PC-组件库规范"),
    ("v5/pc-components-2.html", "", "pages/PC-组件库规范-2"),
    ("v5/pc-member-handoff.html", "", "pages/PC-组织-停用交接"),
    ("v5/pc-member-edit.html", "", "pages/PC-组织-添加编辑成员"),
    ("v5/pc-org-defaults.html", "", "pages/PC-组织-部门默认设置"),
    ("v5/pc-settings.html", "", "pages/PC-设置"),
    ("v5/pc-aiset.html", "", "pages/PC-设置-全局AI"),
    ("v5/pc-members.html", "", "pages/PC-设置-成员与身份"),
    ("v5/pc-myacct.html", "", "pages/PC-设置-我的账号"),
    ("v5/pc-runners.html", "", "pages/PC-设置-执行器"),
    ("v5/pc-operation-log.html", "", "pages/PC-设置-操作记录与数据回滚"),
    ("v5/pc-source.html", "", "pages/PC-设置-来源采集"),
    ("v5/pc-roles.html", "", "pages/PC-设置-角色与权限"),
    ("v5/pc-connectors.html", "", "pages/PC-设置-连接器"),
    ("v5/pc-notify.html", "", "pages/PC-设置-通知"),
    ("v5/pc-project-workflow.html", "", "pages/PC-设置-项目-流程模板"),
    ("v5/pc-evidence.html", "", "pages/PC-证据"),
    ("v5/pc-evidence-zoom.html", "", "pages/PC-证据大图对照"),
    ("v5/pc-edge.html", "", "pages/PC-边界状态"),
    ("v5/runner-server-pc.html", "", "pages/PC-连接团队服务器"),
    ("v5/runner-select-pc.html", "", "pages/PC-选择执行环境"),
    ("v5/join-invite-pc.html", "", "pages/PC-邀请加入"),
    ("v5/pc-invite-expired.html", "", "pages/PC-邀请失效与切号"),
    ("v5/reset-pwd-pc.html", "", "pages/PC-重置密码"),
    ("v5/pc-ws-switch.html", "", "pages/PC-头像菜单-切换空间与升级团队"),
    ("v5/onboard-pc.html", "", "pages/PC-首次使用步骤器"),
    ("v5/onboard-pc-prod.html", "", "pages/PC-首次使用步骤器-正式环境"),
    ("v5/m-skills.html", "", "pages/移动端-Skills与设置", 1440, 1000),
    ("v5/m-code.html", "", "pages/移动端-代码与审核", 1440, 1000),
    ("v5/m-clipboard-invite.html", "", "pages/移动端-剪贴板识别邀请", 1440, 1000),
    ("v5/m-release.html", "", "pages/移动端-发布", 1440, 1000),
    ("v5/m-rollback.html", "", "pages/移动端-大包与紧急回滚", 1440, 1000),
    ("v5/m-preview.html", "", "pages/移动端-完整文件与证据预览", 1440, 1000),
    ("v5/m-rules.html", "", "pages/移动端-审核与排队", 1440, 1000),
    ("v5/m-market.html", "", "pages/移动端-插件市场与执行器", 1440, 1000),
    ("v5/login-m.html", "", "pages/移动端-登录", 1880, 1000),
    ("v5/m-empty.html", "", "pages/移动端-空状态", 1440, 1000),
    ("v5/m-empty2.html", "", "pages/移动端-空状态-2", 1440, 1000),
    ("v5/m-components.html", "", "pages/移动端-组件库规范", 1440, 1000),
    ("v5/m-org-members.html", "", "pages/移动端-组织与成员", 1440, 1000),
    ("v5/m-evidence.html", "", "pages/移动端-证据报错发布", 1440, 1000),
    ("v5/m-runtime-extra.html", "", "pages/移动端-运行态与异常补齐", 1440, 1000),
    ("v5/m-notify.html", "", "pages/移动端-通知", 1440, 1000),
    ("v5/m-auth-extra.html", "", "pages/移动端-重设密码与邀请", 1440, 1000),
    ("v5/onboard-m.html", "", "pages/移动端-首次使用步骤器", 1880, 1000),
    ("v5/flow.html", "", "flow/链路总图", 2400, 1300),
    ("v5/phase2-spec.html", "", "phase2/二期-1-需求变更集与活原型"),
    ("v5/phase2-drawer.html", "", "phase2/二期-2-无损抽屉下钻审切片"),
    ("v5/phase2-ticket.html", "", "phase2/二期-3-工单实战三栏与契约护栏"),
    ("v5/phase2-qa.html", "", "phase2/二期-4-QA联调验收与AI归因"),
    ("v5/splash-pc.html", "", "splash/PC-闪屏"),
    ("v5/splash-m.html", "", "splash/移动端-闪屏", 1440, 1000),
    ("v5/logo.html", "", "logo/Logo-展示"),
]


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, **kw)


def png_size(p):
    w, h = struct.unpack(">II", p.read_bytes()[16:24])
    return w // 2, h // 2


def targets():
    for row in RENDERS:
        src, qs, out = row[:3]
        w, h = (row[3], row[4]) if len(row) == 5 else (1440, 900)
        yield src, qs, out, w, h


def check():
    problems = 0
    listed = set()
    for src, qs, out, w, h in targets():
        listed.add(out)
        if not (SRC / src).exists():
            print(f"缺源文件   {src}  →  {out}"); problems += 1
        light = IMG / f"{out}-亮色.png"
        if not light.exists():
            print(f"登记了没图 {out}"); problems += 1
        elif png_size(light) != (w, h):
            print(f"尺寸不符   {out}：图是 {png_size(light)}，登记 {(w, h)}"); problems += 1
    for p in sorted(IMG.rglob("*-亮色.png")):
        rel = str(p.relative_to(IMG))[: -len("-亮色.png")]
        if rel not in listed:
            print(f"有图没登记 {rel}"); problems += 1
    for py, *_ in GENERATORS:
        if not (ROOT / "scripts" / py).exists():
            print(f"缺生成脚本 scripts/{py}"); problems += 1
    registered = {g[0] for g in GENERATORS}
    for p in sorted((ROOT / "scripts").glob("gen-*.py")):
        if p.name not in registered:
            print(f"生成脚本没登记 scripts/{p.name}"); problems += 1
    print(f"对照表 {len(RENDERS)} 行，问题 {problems} 个")
    return problems


def generate():
    for py, *args in GENERATORS:
        r = run([sys.executable, f"scripts/{py}", *args], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f"生成失败：scripts/{py}\n{r.stderr}")
    print(f"已生成 HTML（{len(GENERATORS)} 个脚本）")


def changed_paths():
    out = run(["git", "status", "--porcelain", "--untracked-files=all"], capture_output=True, text=True).stdout
    paths = []
    for line in out.splitlines():
        p = line[3:].strip().strip('"')
        if " -> " in p:
            p = p.split(" -> ", 1)[1]
        paths.append(p)
    return paths


def pick(args):
    rows = list(targets())
    if args.only:
        rows = [r for r in rows if any(k in r[0] or k in r[2] for k in args.only)]
    if args.changed:
        paths = changed_paths()
        if any(p.startswith(SHARED) for p in paths):
            print("公共样式有改动，全部重出")
        else:
            srcs = {p[len("reference/src/"):] for p in paths if p.startswith("reference/src/")}
            rows = [r for r in rows if r[0] in srcs]
    return rows


def render(rows):
    t0 = time.time()
    for i, (src, qs, out, w, h) in enumerate(rows, 1):
        r = run(["bash", "scripts/render.sh", f"reference/src/{src}", qs, f"reference/images/{out}", str(w), str(h)],
                capture_output=True, text=True)
        status = "ok" if r.returncode == 0 else f"失败\n{r.stderr}"
        print(f"[{i}/{len(rows)}] {out} {status}")
        if r.returncode != 0:
            sys.exit(1)
    print(f"已出图 {len(rows)} 组（{time.time() - t0:.0f}s）")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--changed", action="store_true", help="只重出 HTML 有改动的页面")
    ap.add_argument("--only", nargs="+", metavar="关键字", help="只出 HTML 名或图名包含关键字的页面")
    ap.add_argument("--no-render", action="store_true", help="不出图")
    ap.add_argument("--check", action="store_true", help="只核对对照表")
    args = ap.parse_args()
    sys.stdout.reconfigure(line_buffering=True)  # 与子进程输出保持先后顺序

    if args.check:
        sys.exit(1 if check() else 0)
    generate()
    if not args.no_render:
        rows = pick(args)
        if rows:
            render(rows)
        else:
            print("没有需要重出的页面")
    run([sys.executable, "scripts/build-index.py"], check=True)


if __name__ == "__main__":
    main()
