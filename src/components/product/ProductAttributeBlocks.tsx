import { Badge } from '@/components/ui/badge';
import { useBlockLibrary, type AttributeBlock } from '@/hooks/useAttributeBlocks';

interface BlockData {
  type: string;
  data: Record<string, any>;
}

interface FieldDef {
  key: string;
  label: string;
  type: string;
  options?: string[];
}

interface ProductAttributeBlocksProps {
  specifications: Record<string, any> | null | undefined;
}

export function ProductAttributeBlocks({ specifications }: ProductAttributeBlocksProps) {
  const { data: library = [] } = useBlockLibrary();

  if (!specifications?.blocks || !Array.isArray(specifications.blocks)) return null;

  const blocks = specifications.blocks as BlockData[];
  const nonEmpty = blocks.filter(b => hasContent(b.data));
  if (nonEmpty.length === 0) return null;

  return (
    <div className="space-y-4">
      {nonEmpty.map((block) => {
        const libBlock = library.find(lb => lb.block_type === block.type);
        return (
          <BlockSection key={block.type} block={block} libBlock={libBlock} />
        );
      })}
    </div>
  );
}

function hasContent(data: Record<string, any> | undefined): boolean {
  if (!data) return false;
  return Object.values(data).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== '' && v !== null && v !== undefined
  );
}

function BlockSection({ block, libBlock }: { block: BlockData; libBlock?: AttributeBlock }) {
  const { type, data } = block;
  const fields: FieldDef[] = libBlock?.schema?.fields || [];
  const displayName = libBlock?.display_name || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const rendererType = libBlock?.renderer_type || 'key_value';

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{displayName}</p>
      <BlockContent data={data} fields={fields} rendererType={rendererType} blockType={type} />
    </div>
  );
}

function BlockContent({ data, fields, rendererType, blockType }: {
  data: Record<string, any>;
  fields: FieldDef[];
  rendererType: string;
  blockType: string;
}) {
  // Special: variant_rows
  if (blockType === 'variants' && data.options?.length) {
    return (
      <div className="space-y-1.5">
        {data.options.map((opt: any, i: number) => (
          <div key={i}>
            <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{opt.label}</p>
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

  // Special: size_table
  if (blockType === 'size_chart' && data.rows?.length) {
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

  // Tag fields → render as badges
  const tagFields = fields.filter(f => f.type === 'tag_input');
  if (tagFields.length > 0 && rendererType === 'tags') {
    const allTags = tagFields.flatMap(f => data[f.key] || []);
    if (allTags.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {allTags.map((tag: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
          ))}
        </div>
      );
    }
  }

  // Badge list (e.g. delivery methods, certifications)
  if (rendererType === 'badge_list') {
    const badgeFields = fields.filter(f => f.type === 'tag_input');
    const allItems = badgeFields.flatMap(f => data[f.key] || []);
    if (allItems.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {allItems.map((item: string, i: number) => (
            <Badge key={i} variant="outline" className="text-[10px]">{item}</Badge>
          ))}
        </div>
      );
    }
  }

  // Text renderer
  if (rendererType === 'text') {
    const textFields = fields.filter(f => f.type === 'textarea' || f.type === 'text');
    const textContent = textFields.map(f => data[f.key]).filter(Boolean).join(' — ');
    if (textContent) {
      return <p className="text-xs text-muted-foreground leading-relaxed">{textContent}</p>;
    }
  }

  // Default: key_value grid using field labels
  const fieldMap = new Map(fields.map(f => [f.key, f]));
  const entries = Object.entries(data).filter(([_, v]) => {
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });

  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {entries.map(([key, val]) => {
        const fieldDef = fieldMap.get(key);
        const label = fieldDef?.label || key.replace(/_/g, ' ');

        // Tag arrays inline
        if (Array.isArray(val)) {
          return (
            <div key={key} className="col-span-2 space-y-0.5">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <div className="flex flex-wrap gap-1">
                {val.map((item: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{String(item)}</Badge>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={key} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}</span>
          </div>
        );
      })}
    </div>
  );
}
