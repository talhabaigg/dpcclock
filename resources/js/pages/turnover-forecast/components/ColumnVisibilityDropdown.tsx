import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Columns3 } from 'lucide-react';

export type ColumnGroup = {
    label: string;
    columns: { id: string; label: string; visible: boolean }[];
};

interface ColumnVisibilityDropdownProps {
    columnGroups: ColumnGroup[];
    onToggle: (columnId: string) => void;
    onShowAll: () => void;
    onHideAll: () => void;
}

export function ColumnVisibilityDropdown({
    columnGroups,
    onToggle,
    onShowAll,
    onHideAll,
}: ColumnVisibilityDropdownProps) {
    const hiddenCount = columnGroups.reduce(
        (count, group) => count + group.columns.filter((c) => !c.visible).length,
        0
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Columns3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Columns</span>
                    {hiddenCount > 0 && (
                        <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            {hiddenCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                <div className="flex gap-1 p-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                            e.preventDefault();
                            onShowAll();
                        }}
                        className="flex-1 h-7 text-xs"
                    >
                        Show All
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                            e.preventDefault();
                            onHideAll();
                        }}
                        className="flex-1 h-7 text-xs"
                    >
                        Hide All
                    </Button>
                </div>
                <DropdownMenuSeparator />
                {columnGroups.map((group) => (
                    <div key={group.label}>
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            {group.label}
                        </DropdownMenuLabel>
                        {group.columns.map((col) => (
                            <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={col.visible}
                                onCheckedChange={() => onToggle(col.id)}
                                onSelect={(e) => e.preventDefault()}
                            >
                                {col.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </div>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
