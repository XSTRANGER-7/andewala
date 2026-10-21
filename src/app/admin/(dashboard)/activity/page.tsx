import { fmtWhen } from "@/lib/time";
import { listAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const rows = await listAudit(200);
  if (!rows.length) {
    return (
      <div className="card text-center">
        <h2 className="font-display text-lg font-bold">No changes yet</h2>
        <p className="text-sm text-ink-2">Price, stock and order changes are recorded here with who made them.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper">
      <table className="w-full text-sm">
        <thead className="bg-mint-100 text-left text-[11px] uppercase tracking-wider text-ink-3">
          <tr>
            <th className="px-3 py-2.5">When</th>
            <th className="px-3 py-2.5">Who</th>
            <th className="px-3 py-2.5">What changed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{fmtWhen(r.at)}</td>
              <td className="px-3 py-2.5">{r.by}</td>
              <td className="px-3 py-2.5">
                {r.action}
                {r.detail && <span className="text-ink-3"> · {r.detail}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
