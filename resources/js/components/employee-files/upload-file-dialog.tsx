import { Button } from '@/components/ui/button';
import { DatePickerDemo } from '@/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { router } from '@inertiajs/react';
import { format } from 'date-fns';
import { FileText, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Dropzone from 'shadcn-dropzone';

interface FileType {
    id: number;
    name: string;
    category: string[] | null;
    has_back_side: boolean;
    expiry_requirement: 'required' | 'optional' | 'none';
    requires_completed_date: boolean;
    options: string[] | null;
    is_other?: boolean;
}

const OTHER_VALUE = 'other';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employeeId: number;
    fileTypes: FileType[];
}

export default function UploadFileDialog({ open, onOpenChange, employeeId, fileTypes }: Props) {
    const [category, setCategory] = useState('');
    const [typeId, setTypeId] = useState('');
    const [customName, setCustomName] = useState('');
    const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
    const [completedAt, setCompletedAt] = useState<Date | undefined>(undefined);
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const [fileFront, setFileFront] = useState<File | null>(null);
    const [fileBack, setFileBack] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const isOther = typeId === OTHER_VALUE;
    const selectedType = fileTypes.find((t) => String(t.id) === typeId);

    const categories = useMemo(() => {
        const cats = new Set(fileTypes.filter((ft) => !ft.is_other).flatMap((ft) => ft.category ?? ['Other']));
        return Array.from(cats).sort();
    }, [fileTypes]);

    const filteredTypes = useMemo(() => {
        if (!category) return [];
        return fileTypes.filter((ft) => !ft.is_other && (ft.category ?? ['Other']).includes(category));
    }, [fileTypes, category]);

    const reset = () => {
        setCategory('');
        setTypeId('');
        setCustomName('');
        setExpiresAt(undefined);
        setCompletedAt(undefined);
        setSelectedOptions([]);
        setFileFront(null);
        setFileBack(null);
    };

    const handleSubmit = () => {
        if (!fileFront || (isOther ? !customName.trim() : !typeId)) return;
        setSubmitting(true);

        const data: Record<string, string | File | string[]> = { file_front: fileFront };
        if (isOther) {
            data.custom_name = customName.trim();
            data.custom_category = category;
        } else {
            data.employee_file_type_id = typeId;
            if (completedAt) data.completed_at = format(completedAt, 'yyyy-MM-dd');
            if (selectedOptions.length > 0) data.selected_options = selectedOptions;
        }
        if (expiresAt) data.expires_at = format(expiresAt, 'yyyy-MM-dd');
        if (fileBack) data.file_back = fileBack;

        router.post(`/employees/${employeeId}/files`, data, {
            forceFormData: true,
            onFinish: () => setSubmitting(false),
            onSuccess: () => {
                reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) reset();
                onOpenChange(v);
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Employee File</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label>Document Type</Label>
                        <Select
                            value={category}
                            onValueChange={(v) => {
                                setCategory(v);
                                setTypeId('');
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {category && (
                        <div className="flex flex-col gap-1.5">
                            <Label>Document Name</Label>
                            <Select value={typeId} onValueChange={setTypeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select document..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredTypes.map((ft) => (
                                        <SelectItem key={ft.id} value={String(ft.id)}>
                                            {ft.name}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value={OTHER_VALUE}>Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {typeId && (
                        <>
                            {isOther && (
                                <div className="flex flex-col gap-1.5">
                                    <Label>Document Name</Label>
                                    <Input
                                        value={customName}
                                        onChange={(e) => setCustomName(e.target.value)}
                                        placeholder="Enter the qualification / document name"
                                    />
                                </div>
                            )}

                            {selectedType?.options && selectedType.options.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <Label>Options</Label>
                                    <div className="flex flex-col gap-1.5 rounded-md border border-input p-2">
                                        {selectedType.options.map((opt) => (
                                            <label key={opt} className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-input"
                                                    checked={selectedOptions.includes(opt)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedOptions([...selectedOptions, opt]);
                                                        } else {
                                                            setSelectedOptions(selectedOptions.filter((o) => o !== opt));
                                                        }
                                                    }}
                                                />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedType?.requires_completed_date && (
                                <div className="flex flex-col gap-1.5">
                                    <Label>Completed Date</Label>
                                    <DatePickerDemo
                                        value={completedAt}
                                        onChange={setCompletedAt}
                                        placeholder="Select completed date"
                                        className="w-full"
                                    />
                                </div>
                            )}

                            {(isOther || selectedType?.expiry_requirement !== 'none') && (
                                <div className="flex flex-col gap-1.5">
                                    <Label>
                                        Expiry Date
                                        {(isOther || selectedType?.expiry_requirement === 'optional') && (
                                            <span className="text-muted-foreground ml-1 text-xs font-normal">(Optional)</span>
                                        )}
                                    </Label>
                                    <DatePickerDemo
                                        value={expiresAt}
                                        onChange={setExpiresAt}
                                        placeholder="Select expiry date"
                                        className="w-full"
                                    />
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <Label>Front Side</Label>
                                {fileFront ? (
                                    <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                        <FileText size={16} className="text-muted-foreground shrink-0" />
                                        <span className="flex-1 truncate text-sm">{fileFront.name}</span>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setFileFront(null)}>
                                            <X size={14} />
                                        </Button>
                                    </div>
                                ) : (
                                    <Dropzone onDrop={(files) => files.length > 0 && setFileFront(files[0])} maxFiles={1} multiple={false} />
                                )}
                            </div>

                            {selectedType?.has_back_side && (
                                <div className="flex flex-col gap-1.5">
                                    <Label>Back Side</Label>
                                    {fileBack ? (
                                        <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                            <FileText size={16} className="text-muted-foreground shrink-0" />
                                            <span className="flex-1 truncate text-sm">{fileBack.name}</span>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setFileBack(null)}>
                                                <X size={14} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Dropzone onDrop={(files) => files.length > 0 && setFileBack(files[0])} maxFiles={1} multiple={false} />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !fileFront || (isOther ? !customName.trim() : !typeId)}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Upload
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
