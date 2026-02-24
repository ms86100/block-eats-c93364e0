import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

interface AttributeBlockFormProps {
  blockType: string;
  schema: Record<string, any>;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
}

export function AttributeBlockForm({ blockType, schema, value, onChange }: AttributeBlockFormProps) {
  const properties = schema?.properties || {};

  return (
    <div className="space-y-3">
      {Object.entries(properties).map(([key, propSchema]: [string, any]) => (
        <FieldRenderer
          key={key}
          fieldKey={key}
          schema={propSchema}
          value={value[key]}
          onChange={(v) => onChange({ ...value, [key]: v })}
        />
      ))}
    </div>
  );
}

function FieldRenderer({ fieldKey, schema, value, onChange }: {
  fieldKey: string;
  schema: any;
  value: any;
  onChange: (v: any) => void;
}) {
  const label = fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (schema.type === 'string') {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        {fieldKey.includes('details') || fieldKey.includes('description') || fieldKey.includes('policy') ? (
          <Textarea
            placeholder={`Enter ${label.toLowerCase()}...`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
          />
        ) : (
          <Input
            placeholder={`Enter ${label.toLowerCase()}...`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    );
  }

  if (schema.type === 'number') {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          placeholder="0"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        />
      </div>
    );
  }

  if (schema.type === 'boolean') {
    return (
      <div className="flex items-center justify-between py-1">
        <Label className="text-xs">{label}</Label>
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }

  if (schema.type === 'array') {
    if (schema.items?.type === 'string') {
      return <StringArrayField label={label} value={value || []} onChange={onChange} />;
    }
    if (schema.items?.type === 'object') {
      return <ObjectArrayField label={label} itemSchema={schema.items} value={value || []} onChange={onChange} />;
    }
  }

  return null;
}

function StringArrayField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInput('');
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5 flex-wrap mb-1">
        {value.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
            {item}
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="hover:text-destructive">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          className="h-8 text-xs"
          placeholder={`Add ${label.toLowerCase()}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={add}>
          <Plus size={12} />
        </Button>
      </div>
    </div>
  );
}

function ObjectArrayField({ label, itemSchema, value, onChange }: {
  label: string;
  itemSchema: any;
  value: Record<string, any>[];
  onChange: (v: Record<string, any>[]) => void;
}) {
  const addRow = () => {
    const empty: Record<string, any> = {};
    Object.keys(itemSchema.properties || {}).forEach(k => { empty[k] = ''; });
    onChange([...value, empty]);
  };

  const updateRow = (idx: number, key: string, val: any) => {
    const updated = [...value];
    updated[idx] = { ...updated[idx], [key]: val };
    onChange(updated);
  };

  const removeRow = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {value.map((row, idx) => (
        <div key={idx} className="flex gap-1.5 items-start">
          <div className="flex-1 grid grid-cols-2 gap-1.5">
            {Object.keys(itemSchema.properties || {}).map(k => {
              const prop = itemSchema.properties[k];
              if (prop.type === 'array') {
                return (
                  <div key={k} className="col-span-2">
                    <StringArrayField
                      label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      value={row[k] || []}
                      onChange={(v) => updateRow(idx, k, v)}
                    />
                  </div>
                );
              }
              return (
                <Input
                  key={k}
                  className="h-7 text-xs"
                  placeholder={k.replace(/_/g, ' ')}
                  value={row[k] || ''}
                  onChange={(e) => updateRow(idx, k, e.target.value)}
                />
              );
            })}
          </div>
          <button onClick={() => removeRow(idx)} className="mt-1 text-muted-foreground hover:text-destructive">
            <X size={14} />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addRow}>
        <Plus size={12} className="mr-1" /> Add {label}
      </Button>
    </div>
  );
}
