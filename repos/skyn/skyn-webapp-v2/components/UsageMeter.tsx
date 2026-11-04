'use client';

interface Props {
  used:  number;
  limit: number;
  cost?: number;
}

export default function UsageMeter({ used, limit, cost }: Props) {
  const pct  = Math.min(100, Math.round((used / limit) * 100));
  const warn = pct >= 80;
  const over = pct >= 100;
  const color = over ? '#ef4444' : warn ? '#f59e0b' : 'var(--nx-accent)';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
      <span style={{ fontSize:'10px', color:'var(--nx-text-muted)', whiteSpace:'nowrap', fontFamily:'var(--nx-font)' }}>
        {used}/{limit}
      </span>
      <div style={{ flex:1, height:'3px', background:'var(--nx-border)', borderRadius:'2px', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'2px', transition:'width 0.3s' }} />
      </div>
      {cost !== undefined && (
        <span style={{ fontSize:'9px', color:'var(--nx-text-muted)', whiteSpace:'nowrap', fontFamily:'monospace' }}>
          ${cost.toFixed(4)}
        </span>
      )}
    </div>
  );
}
