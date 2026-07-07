import CsvImporterDialog from '@/components/csv-importer';
import LoadingDialog from '@/components/loading-dialog';
import LocationPageHeader from '@/components/location-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { cn } from '@/lib/utils';
import { Head, router, usePage } from '@inertiajs/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Download, FileSpreadsheet, Lock, Package, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import AttachMaterialsDialog from './partials.tsx/AttachMaterialsDialog';
import EditPriceDialog from './partials.tsx/EditPriceDialog';
import LocationPriceHistoryDialog from './partials.tsx/LocationPriceHistoryDialog';
import PriceHistoryDialog from './partials.tsx/PriceHistoryDialog';
import RemoveMaterialDialog from './partials.tsx/RemoveMaterialDialog';

type MaterialItem = {
    id: number;
    code: string;
    description: string;
    supplier?: {
        id: number;
        code: string;
    };
    pivot?: {
        unit_cost_override: number;
        is_locked: boolean;
        updated_by: number | null;
        updated_by_name: string | null;
        updated_at: string | null;
    };
};

type Location = LocationBase & {
    material_items: MaterialItem[];
};

const COLUMN_COUNT = 6;
const ROW_HEIGHT = 32;

const formatPrice = (raw: number | null | undefined) => {
    const num = Number(raw ?? 0);
    const formatted = num.toFixed(6).replace(/\.?0+$/, '');
    const decimals = formatted.includes('.') ? formatted.split('.')[1].length : 0;
    return decimals < 2 ? num.toFixed(2) : formatted;
};

export default function LocationPriceList() {
    const { location } = usePage<{ location: Location }>().props;

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [csvImportHeaders] = useState<string[]>(['location_id', 'code', 'unit_cost', 'is_locked']);
    const [showLockedOnly, setShowLockedOnly] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
    const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

    const availableSuppliers = useMemo(() => {
        const set = new Set<string>();
        let hasNoSupplier = false;
        (location.material_items ?? []).forEach((item) => {
            if (item.supplier?.code) {
                set.add(item.supplier.code);
            } else {
                hasNoSupplier = true;
            }
        });
        const codes = Array.from(set).sort((a, b) => a.localeCompare(b));
        return hasNoSupplier ? [...codes, '__none__'] : codes;
    }, [location.material_items]);

    const toggleSupplier = (code: string) => {
        setSupplierFilter((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
    };

    const handleUpload = (locationId: number) => {
        if (!selectedFile) {
            toast.error('No file selected for upload');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('location_id', locationId.toString());

        setIsUploading(true);
        router.post('/material-items/location/upload', formData, {
            forceFormData: true,
            onSuccess: () => {
                setSelectedFile(null);
                setIsUploading(false);
            },
            onError: () => {
                setIsUploading(false);
            },
            onFinish: () => {
                setIsUploading(false);
            },
        });
    };

    const handleCsvSubmit = (mappedData: any) => {
        const csvContent = `${csvImportHeaders.join(',')}\n${mappedData
            .map((row: any) => csvImportHeaders.map((header) => row[header] ?? '').join(','))
            .join('\n')}`;
        const file = new File([csvContent], 'exported_data.csv', { type: 'text/csv' });
        setSelectedFile(file);
        setShouldUploadAfterSet(true);
    };

    useEffect(() => {
        if (selectedFile && shouldUploadAfterSet) {
            handleUpload(location.id);
            setShouldUploadAfterSet(false);
        }
    }, [selectedFile, shouldUploadAfterSet]);

    const filteredMaterialItems = useMemo(() => {
        const items = location.material_items ?? [];
        const query = searchQuery.trim().toLowerCase();
        return items.filter((item) => {
            if (showLockedOnly && !item.pivot?.is_locked) return false;
            if (supplierFilter.length > 0) {
                const code = item.supplier?.code ?? '__none__';
                if (!supplierFilter.includes(code)) return false;
            }
            if (!query) return true;
            return (
                item.code?.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query) ||
                item.supplier?.code?.toLowerCase().includes(query)
            );
        });
    }, [location.material_items, showLockedOnly, searchQuery, supplierFilter]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: filteredMaterialItems.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 10,
    });

    const virtualItems = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();
    const paddingTop = virtualItems[0]?.start ?? 0;
    const paddingBottom = totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);

    const isEmpty = filteredMaterialItems.length === 0;

    return (
        <LocationLayout location={location} activeTab="price-list">
            <Head title={`Price List - ${location.name}`} />
            <LoadingDialog open={isUploading} setOpen={() => {}} message="Uploading price list..." />

            <LocationPageHeader location={location} title="Price List">
                <div className="mr-1 flex items-center gap-2 sm:mr-2">
                    <Switch id="show-locked" checked={showLockedOnly} onCheckedChange={setShowLockedOnly} />
                    <Label htmlFor="show-locked" className="flex cursor-pointer items-center gap-1 text-sm">
                        <Lock className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Locked Only</span>
                    </Label>
                </div>
                <AttachMaterialsDialog locationId={location.id} existingMaterialIds={location.material_items?.map((m) => m.id) ?? []} />
                <LocationPriceHistoryDialog locationId={location.id} locationName={location.name} />
                <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                <a href={`/material-items/location/${location.id}/download-csv`}>
                    <Button variant="outline" size="sm" className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span className="hidden sm:inline">CSV</span>
                    </Button>
                </a>
                <a href={`/material-items/location/${location.id}/download-excel`}>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Excel</span>
                    </Button>
                </a>
            </LocationPageHeader>

            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="relative w-full max-w-xs">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
                        <Input
                            placeholder="Search code, description, supplier..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-7 pr-7 pl-7 text-xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                                aria-label="Clear search"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                                <span>Supplier</span>
                                {supplierFilter.length > 0 && (
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                                        {supplierFilter.length}
                                    </Badge>
                                )}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[220px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search suppliers..." className="h-8 text-xs" />
                                <CommandList>
                                    <CommandEmpty>No suppliers found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableSuppliers.map((code) => {
                                            const isNone = code === '__none__';
                                            const label = isNone ? 'No supplier' : code;
                                            const checked = supplierFilter.includes(code);
                                            return (
                                                <CommandItem
                                                    key={code}
                                                    value={label}
                                                    onSelect={() => toggleSupplier(code)}
                                                    className="text-xs"
                                                >
                                                    <Checkbox checked={checked} className="mr-2 h-3.5 w-3.5" />
                                                    <span className={cn(isNone && 'text-muted-foreground italic')}>{label}</span>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                            {supplierFilter.length > 0 && (
                                <div className="border-t p-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-full justify-center text-xs"
                                        onClick={() => setSupplierFilter([])}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {filteredMaterialItems.length.toLocaleString()} {showLockedOnly ? 'locked items' : 'items'}
                </span>
            </div>

            <Card className="py-0">
                <CardContent className="p-0">
                    <TooltipProvider delay={200}>
                        <div ref={scrollRef} className="h-[calc(100vh-260px)] min-h-[320px] overflow-auto">
                            <Table className="w-full table-fixed text-xs [&_td]:h-8 [&_td]:py-0 [&_th]:h-8 [&_th]:py-0">
                                <TableHeader className="bg-card sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--border)]">
                                    <TableRow>
                                        <TableHead className="w-[110px] pl-3 sm:w-[140px] sm:pl-6">Code</TableHead>
                                        <TableHead className="hidden w-[90px] lg:table-cell">Supplier</TableHead>
                                        <TableHead className="hidden sm:table-cell">Description</TableHead>
                                        <TableHead className="w-[90px] text-right sm:w-[110px]">Unit Cost</TableHead>
                                        <TableHead className="hidden w-[130px] md:table-cell">Updated By</TableHead>
                                        <TableHead className="w-20 pr-3 sm:w-28 sm:pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isEmpty ? (
                                        <TableRow>
                                            <TableCell colSpan={COLUMN_COUNT} className="h-32 text-center">
                                                <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                    <Package className="h-8 w-8 opacity-40" />
                                                    <p>{showLockedOnly ? 'No locked items' : 'No price list available'}</p>
                                                    <p className="text-xs">
                                                        {showLockedOnly ? 'No items are currently locked' : 'Import a CSV to add items'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <>
                                            {paddingTop > 0 && (
                                                <tr aria-hidden style={{ height: paddingTop }}>
                                                    <td colSpan={COLUMN_COUNT} />
                                                </tr>
                                            )}
                                            {virtualItems.map((vi) => {
                                                const item = filteredMaterialItems[vi.index];
                                                const isLocked = !!item.pivot?.is_locked;
                                                return (
                                                    <TableRow
                                                        key={item.id}
                                                        className={cn('group', isLocked && 'bg-amber-50/50 dark:bg-amber-950/20')}
                                                    >
                                                        <TableCell className="pl-3 sm:pl-6">
                                                            <div className="flex items-center gap-2">
                                                                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                                                                    {item.code}
                                                                </code>
                                                                {isLocked && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Price is locked</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden lg:table-cell">
                                                            {item.supplier?.code ? (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {item.supplier.code}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs italic">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="hidden sm:table-cell">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="text-muted-foreground truncate">{item.description}</div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{item.description}</TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                                ${formatPrice(item.pivot?.unit_cost_override)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell">
                                                            {item.pivot?.updated_by_name ? (
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-medium">{item.pivot.updated_by_name}</span>
                                                                    {item.pivot?.updated_at && (
                                                                        <span className="text-muted-foreground text-[11px]">
                                                                            {new Date(item.pivot.updated_at).toLocaleDateString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs italic">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="pr-3 sm:pr-6">
                                                            <div className="flex items-center gap-1">
                                                                {!isLocked && (
                                                                    <EditPriceDialog
                                                                        locationId={location.id}
                                                                        materialItemId={item.id}
                                                                        code={item.code}
                                                                        description={item.description}
                                                                        currentPrice={Number(item.pivot?.unit_cost_override ?? 0)}
                                                                        isLocked={isLocked}
                                                                    />
                                                                )}
                                                                <PriceHistoryDialog
                                                                    locationId={location.id}
                                                                    materialItemId={item.id}
                                                                    code={item.code}
                                                                    description={item.description}
                                                                />
                                                                {!isLocked && (
                                                                    <RemoveMaterialDialog
                                                                        locationId={location.id}
                                                                        materialItemId={item.id}
                                                                        code={item.code}
                                                                        description={item.description}
                                                                    />
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {paddingBottom > 0 && (
                                                <tr aria-hidden style={{ height: paddingBottom }}>
                                                    <td colSpan={COLUMN_COUNT} />
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TooltipProvider>
                </CardContent>
            </Card>
        </LocationLayout>
    );
}
