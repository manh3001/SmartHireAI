import type { SalaryMatrix as SalaryMatrixData } from "@/lib/salary/insights";

export default function SalaryMatrix({ matrix }: { matrix: SalaryMatrixData }) {
  if (matrix.rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="p-2 text-left font-semibold text-foreground">Ngành</th>
            {matrix.levels.map((l) => (
              <th key={l.level} className="p-2 text-right font-medium text-muted-foreground">
                {l.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60">
              <td className="p-2 text-left font-medium text-foreground">{row.label}</td>
              {row.cells.map((cell, i) => (
                <td key={i} className="p-2 text-right text-foreground">
                  {cell == null ? "—" : `${Math.round(cell / 1_000_000)} tr`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
