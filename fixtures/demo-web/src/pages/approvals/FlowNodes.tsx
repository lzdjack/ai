import { useI18n } from '../../i18n';
import type { FlowNode } from '../../types';

export function FlowNodes({ nodes }: { nodes: FlowNode[] }) {
  const { t } = useI18n();
  return (
    <ol className="flow">
      {nodes.map((n) => (
        <li key={n.name} className={`flow-node flow-node--${n.result}`}>
          <strong>{n.name}</strong> · {n.approver_name} · {t(`detail.node.${n.result}`)}
        </li>
      ))}
    </ol>
  );
}
