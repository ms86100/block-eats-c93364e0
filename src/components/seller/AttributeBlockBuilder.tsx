import { useState, useEffect } from 'react';
import { useBlockLibrary, filterByCategory, type AttributeBlock, type BlockData } from '@/hooks/useAttributeBlocks';
import { AttributeBlockForm } from './AttributeBlockForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2, Puzzle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AttributeBlockBuilderProps {
  category: string | null;
  value: BlockData[];
  onChange: (blocks: BlockData[]) => void;
}

export function AttributeBlockBuilder({ category, value, onChange }: AttributeBlockBuilderProps) {
  const { data: library = [] } = useBlockLibrary();
  const [isOpen, setIsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeBlocks = value;
  const activeTypes = new Set(activeBlocks.map(b => b.type));
  const availableBlocks = filterByCategory(library, category)
    .filter(b => !activeTypes.has(b.block_type));

  const addBlock = (block: AttributeBlock) => {
    onChange([...activeBlocks, { type: block.block_type, data: {} }]);
    setSheetOpen(false);
    setExpandedBlock(block.block_type);
  };

  const removeBlock = (type: string) => {
    onChange(activeBlocks.filter(b => b.type !== type));
    if (expandedBlock === type) setExpandedBlock(null);
  };

  const updateBlockData = (type: string, data: Record<string, any>) => {
    onChange(activeBlocks.map(b => b.type === type ? { ...b, data } : b));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activeBlocks.findIndex(b => b.type === active.id);
    const newIndex = activeBlocks.findIndex(b => b.type === over.id);
    const reordered = [...activeBlocks];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);
    onChange(reordered);
  };

  const getLibraryBlock = (type: string) => library.find(b => b.block_type === type);

  if (library.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
          <div className="flex items-center gap-2">
            <Puzzle size={16} className="text-primary" />
            <span className="text-sm font-medium">Customize Listing</span>
            {activeBlocks.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {activeBlocks.length} block{activeBlocks.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-2">
        {activeBlocks.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeBlocks.map(b => b.type)} strategy={verticalListSortingStrategy}>
              {activeBlocks.map((block) => {
                const libBlock = getLibraryBlock(block.type);
                if (!libBlock) return null;
                return (
                  <SortableBlock
                    key={block.type}
                    block={block}
                    libBlock={libBlock}
                    isExpanded={expandedBlock === block.type}
                    onToggle={() => setExpandedBlock(expandedBlock === block.type ? null : block.type)}
                    onRemove={() => removeBlock(block.type)}
                    onDataChange={(data) => updateBlockData(block.type, data)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs border-dashed"
          onClick={() => setSheetOpen(true)}
          disabled={availableBlocks.length === 0}
        >
          <Plus size={14} className="mr-1" />
          Add Attribute Block
        </Button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[60vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Attribute Block</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              {availableBlocks.map((block) => (
                <button
                  key={block.block_type}
                  onClick={() => addBlock(block)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                >
                  <span className="text-lg shrink-0">{block.icon || '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{block.display_name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{block.description}</p>
                  </div>
                  <Plus size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                </button>
              ))}
              {availableBlocks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {category ? 'All available blocks have been added' : 'Select a category first to see available attribute blocks'}
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SortableBlock({ block, libBlock, isExpanded, onToggle, onRemove, onDataChange }: {
  block: BlockData;
  libBlock: AttributeBlock;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDataChange: (data: Record<string, any>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.type });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasData = Object.values(block.data || {}).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== '' && v !== null && v !== undefined
  );

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical size={14} />
        </button>
        <span className="text-sm">{libBlock.icon || '📋'}</span>
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="text-xs font-medium text-foreground">{libBlock.display_name}</span>
          {hasData && <span className="ml-1.5 text-[9px] text-primary">●</span>}
        </button>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <Trash2 size={12} />
        </button>
        <button onClick={onToggle} className="text-muted-foreground">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-border pt-2">
          <AttributeBlockForm
            blockType={block.type}
            schema={libBlock.schema}
            value={block.data || {}}
            onChange={onDataChange}
          />
        </div>
      )}
    </div>
  );
}
