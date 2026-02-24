import { Badge } from '@/components/ui/badge';

interface BlockData {
  type: string;
  data: Record<string, any>;
}

interface ProductAttributeBlocksProps {
  specifications: Record<string, any> | null | undefined;
}

export function ProductAttributeBlocks({ specifications }: ProductAttributeBlocksProps) {
  if (!specifications?.blocks || !Array.isArray(specifications.blocks)) return null;

  const blocks = specifications.blocks as BlockData[];
  const nonEmpty = blocks.filter(b => hasContent(b.data));
  if (nonEmpty.length === 0) return null;

  return (
    <div className="space-y-3">
      {nonEmpty.map((block) => (
        <BlockRenderer key={block.type} block={block} />
      ))}
    </div>
  );
}

function hasContent(data: Record<string, any> | undefined): boolean {
  if (!data) return false;
  return Object.values(data).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== '' && v !== null && v !== undefined
  );
}

function BlockRenderer({ block }: { block: BlockData }) {
  const { type, data } = block;

  // Render variants as tags
  if (type === 'variants' && data.options?.length) {
    return (
      <div className="space-y-1.5">
        {data.options.map((opt: any, i: number) => (
          <div key={i}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{opt.label}</p>
            <div className="flex flex-wrap gap-1">
              {(opt.values || []).map((v: string, j: number) => (
                <Badge key={j} variant="secondary" className="text-[10px]">{v}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render size chart as table
  if (type === 'size_chart' && data.rows?.length) {
    const keys = Object.keys(data.rows[0] || {});
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border">
              {keys.map(k => (
                <th key={k} className="py-1 px-2 text-left font-semibold text-muted-foreground uppercase">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: any, i: number) => (
              <tr key={i} className="border-b border-border/50">
                {keys.map(k => <td key={k} className="py-1 px-2 text-foreground">{row[k]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Render string arrays as badges
  if (data.methods?.length || data.certifications?.length) {
    const items = data.methods || data.certifications || [];
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item: string, i: number) => (
          <Badge key={i} variant="outline" className="text-[10px]">{item}</Badge>
        ))}
      </div>
    );
  }

  // Render custom attributes (key-value entries)
  if (type === 'custom_attributes' && data.entries?.length) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {data.entries.map((entry: any, i: number) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{entry.key}</span>
            <span className="font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }

  // Render text-type blocks (return_policy, location)
  if (data.policy || data.details || data.description || data.seasonal_note) {
    const text = data.policy || data.details || data.description || data.seasonal_note;
    return <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>;
  }

  // Generic key-value fallback
  const entries = Object.entries(data).filter(([_, v]) =>
    v !== null && v !== undefined && v !== '' && !Array.isArray(v) && typeof v !== 'object'
  );
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {entries.map(([key, val]) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
          <span className="font-medium text-foreground">{String(val)}</span>
        </div>
      ))}
    </div>
  );
}
