import type { VariantEntry } from '../../api';

type VariantTableProps = {
  variants: VariantEntry[] | null | undefined;
};

export default function VariantTable({ variants }: VariantTableProps) {
  // Defensive: ensure variants is always an array
  const safeVariants = Array.isArray(variants) ? variants : [];

  if (safeVariants.length === 0) {
    return <span className="text-text-muted text-sm">暂无变体信息</span>;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-1.5 px-2 text-text-secondary font-medium text-xs uppercase tracking-wider">形式</th>
          <th className="text-left py-1.5 px-2 text-text-secondary font-medium text-xs uppercase tracking-wider">内容</th>
        </tr>
      </thead>
      <tbody>
        {safeVariants.map((v, i) => (
          <tr key={i} className="border-b border-border/50 hover:bg-surface-elevated/50">
            <td className="py-1.5 px-2 text-accent font-medium">{v.form}</td>
            <td className="py-1.5 px-2 text-text-primary">{v.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
