import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import {
    closestCorners,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    rectIntersection,
    useDroppable,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Head, router } from '@inertiajs/react';
import {
    ArrowDown01,
    ChevronDown,
    ChevronRight,
    GripVertical,
    Loader2,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

type AccountType = 'revenue' | 'expense';
type SectionType = 'revenue' | 'cogs' | 'operating_expense' | 'other_income' | 'other_expense';

const SECTION_OPTIONS: { value: SectionType; label: string }[] = [
    { value: 'revenue', label: 'Revenue' },
    { value: 'cogs', label: 'Cost of Goods Sold' },
    { value: 'operating_expense', label: 'Operating Expense' },
    { value: 'other_income', label: 'Other Income' },
    { value: 'other_expense', label: 'Other Expense' },
];

const SECTION_SHORT_LABEL: Record<SectionType, string> = {
    revenue: 'Revenue',
    cogs: 'COGS',
    operating_expense: 'Op Ex',
    other_income: 'Other Inc',
    other_expense: 'Other Exp',
};

type Account = {
    id: number;
    account_number: string;
    description: string | null;
    account_type?: string | null;
};

type GroupRow = {
    key: string; // 'g-<id>' for saved, 'new-<n>' for unsaved
    id: number | null;
    name: string;
    account_type: AccountType;
    section_type: SectionType;
    suggested_type: AccountType | null;
};

type PageProps = {
    groups: Array<{
        id: number;
        name: string;
        sort_order: number;
        account_type: AccountType;
        section_type: SectionType;
        suggested_type: AccountType | null;
        accounts: (Account & { sort_order: number })[];
    }>;
    unassigned: Account[];
};

const UNASSIGNED = 'unassigned';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Budget Management', href: '/budget-management' },
    { title: 'GL Groups', href: '/budget-management/gl-groups' },
];

// =================================================================
// id encoding/decoding
// =================================================================
const ACC = (id: number) => `acc::${id}`;
const CNT = (key: string) => `cnt::${key}`;
const GRP = (key: string) => `grp::${key}`;

const idIsAccount = (id: string) => id.startsWith('acc::');
const idIsContainer = (id: string) => id.startsWith('cnt::');
const idIsGroup = (id: string) => id.startsWith('grp::');
const accountIdFrom = (id: string) => Number(id.slice(5));
const containerKeyFrom = (id: string) => id.slice(5);

// =================================================================
// Account row (sortable, used in both panel + groups)
// =================================================================
function AccountChip({ account, dragging }: { account: Account; dragging?: boolean }) {
    const fullText = account.description
        ? `${account.account_number} — ${account.description}`
        : account.account_number;
    return (
        <div
            title={fullText}
            className={`bg-card flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs ${
                dragging ? 'shadow-md ring-1 ring-primary/30' : 'hover:bg-muted/50'
            }`}
        >
            <GripVertical className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
            <span className="tabular-nums shrink-0">{account.account_number}</span>
            {account.description && (
                <span className="text-muted-foreground truncate">— {account.description}</span>
            )}
        </div>
    );
}

function SortableAccount({ account }: { account: Account }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: ACC(account.id),
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab touch-none active:cursor-grabbing">
            <AccountChip account={account} />
        </div>
    );
}

// =================================================================
// Droppable container — wraps a sortable list with droppable behaviour
// so empty groups can still receive a drop.
// =================================================================
function DroppableContainer({
    id,
    accountIds,
    children,
    isOver,
    placeholder,
}: {
    id: string;
    accountIds: number[];
    children: React.ReactNode;
    isOver?: boolean;
    placeholder?: React.ReactNode;
}) {
    const { setNodeRef } = useDroppable({ id: CNT(id) });
    return (
        <div
            ref={setNodeRef}
            className={`flex min-h-[40px] flex-col gap-1 rounded-md p-2 transition-colors ${
                isOver ? 'bg-primary/5 ring-1 ring-primary/40' : ''
            }`}
        >
            <SortableContext items={accountIds.map(ACC)} strategy={verticalListSortingStrategy}>
                {children}
            </SortableContext>
            {accountIds.length === 0 && placeholder}
        </div>
    );
}

// =================================================================
// Compact Revenue/Expense toggle — sits inside the group header.
// =================================================================
function GroupTypeToggle({
    value,
    suggested,
    onChange,
}: {
    value: AccountType;
    suggested: AccountType | null;
    onChange: (v: AccountType) => void;
}) {
    const mismatch = suggested !== null && suggested !== value;
    return (
        <div
            role="group"
            aria-label="Account group type"
            className="inline-flex items-center rounded-md border border-border bg-background text-[10px] leading-none"
        >
            {(['expense', 'revenue'] as const).map((t) => {
                const active = value === t;
                return (
                    <button
                        key={t}
                        type="button"
                        onClick={() => !active && onChange(t)}
                        className={
                            active
                                ? (t === 'revenue'
                                      ? 'rounded-l-[5px] last:rounded-r-[5px] bg-emerald-600 px-1.5 py-0.5 font-semibold text-white'
                                      : 'rounded-l-[5px] last:rounded-r-[5px] bg-foreground px-1.5 py-0.5 font-semibold text-background')
                                : 'rounded-l-[5px] last:rounded-r-[5px] px-1.5 py-0.5 text-muted-foreground hover:text-foreground'
                        }
                        title={t === 'revenue' ? 'Revenue (credit-natured)' : 'Expense (debit-natured)'}
                    >
                        {t === 'revenue' ? 'Rev' : 'Exp'}
                    </button>
                );
            })}
            {mismatch && (
                <span
                    className="ml-1 mr-1 text-[10px] text-amber-600 dark:text-amber-500"
                    title={`Premier accounts in this group look like ${suggested}.`}
                >
                    !
                </span>
            )}
        </div>
    );
}

// =================================================================
// Income-statement section selector — native <select> styled to fit
// inside the group header. Drives where the group renders on the P&L.
// =================================================================
function GroupSectionSelect({
    value,
    onChange,
}: {
    value: SectionType;
    onChange: (v: SectionType) => void;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as SectionType)}
            aria-label="Income statement section"
            title="Where this group appears on the income statement"
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] leading-none text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            {SECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {SECTION_SHORT_LABEL[opt.value]}
                </option>
            ))}
        </select>
    );
}

// =================================================================
// Group card — draggable header + droppable accounts body
// =================================================================
function GroupCard({
    group,
    accountIds,
    accounts,
    collapsed,
    overContainerId,
    onToggleCollapsed,
    onRename,
    onDelete,
    onSort,
    onChangeType,
    onChangeSection,
}: {
    group: GroupRow;
    accountIds: number[];
    accounts: Record<number, Account>;
    collapsed: boolean;
    overContainerId: string | null;
    onToggleCollapsed: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
    onSort: () => void;
    onChangeType: (type: AccountType) => void;
    onChangeSection: (section: SectionType) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: GRP(group.key),
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(group.name);

    return (
        <div ref={setNodeRef} style={style} className="rounded-lg border bg-card">
            {/* Header */}
            <div
                className={`group bg-muted/40 flex items-center gap-2 px-2 py-1.5 text-xs ${
                    collapsed ? 'rounded-lg' : 'rounded-t-lg border-b'
                }`}
            >
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label="Drag to reorder group"
                    className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    aria-label={collapsed ? 'Expand group' : 'Collapse group'}
                    className="text-muted-foreground hover:text-foreground"
                >
                    {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {editing ? (
                    <Input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => {
                            setEditing(false);
                            if (draft.trim() && draft !== group.name) onRename(draft.trim());
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                            if (e.key === 'Escape') {
                                setDraft(group.name);
                                setEditing(false);
                            }
                        }}
                        className="h-6 max-w-xs text-xs md:text-xs"
                    />
                ) : (
                    <button
                        type="button"
                        onDoubleClick={() => {
                            setDraft(group.name);
                            setEditing(true);
                        }}
                        className="cursor-pointer font-semibold truncate"
                        title="Double-click to rename"
                    >
                        {group.name}
                    </button>
                )}
                <span className="text-muted-foreground text-[11px]">({accountIds.length})</span>
                {!editing && (
                    <>
                        <GroupTypeToggle
                            value={group.account_type}
                            suggested={group.suggested_type}
                            onChange={onChangeType}
                        />
                        <GroupSectionSelect
                            value={group.section_type}
                            onChange={onChangeSection}
                        />
                    </>
                )}
                <span className="flex-1" />
                {!editing && (
                    <>
                        <button
                            type="button"
                            onClick={onSort}
                            disabled={accountIds.length < 2}
                            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
                            aria-label="Sort accounts by number"
                            title="Sort accounts by number (ascending)"
                        >
                            <ArrowDown01 className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDraft(group.name);
                                setEditing(true);
                            }}
                            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label="Rename group"
                            title="Rename group"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            className="text-muted-foreground hover:text-rose-600 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label="Delete group"
                            title="Delete group (accounts will return to Unassigned)"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </>
                )}
            </div>

            {/* Body */}
            {!collapsed && (
                <DroppableContainer
                    id={group.key}
                    accountIds={accountIds}
                    isOver={overContainerId === group.key}
                    placeholder={
                        <p className="text-muted-foreground py-3 text-center text-[11px]">
                            Drop accounts here
                        </p>
                    }
                >
                    {accountIds.map((id) => (
                        <SortableAccount key={id} account={accounts[id]} />
                    ))}
                </DroppableContainer>
            )}
        </div>
    );
}

// =================================================================
// Page
// =================================================================
export default function GlAccountGroupsIndex({ groups: initialGroups, unassigned: initialUnassigned }: PageProps) {
    // Metadata: ordered group rows
    const [groups, setGroups] = useState<GroupRow[]>(() =>
        initialGroups.map((g) => ({
            key: `g-${g.id}`,
            id: g.id,
            name: g.name,
            account_type: g.account_type ?? 'expense',
            section_type: g.section_type ?? 'operating_expense',
            suggested_type: g.suggested_type ?? null,
        })),
    );
    // Lookup: account id → account (built once from initial props — accounts never mutate client-side)
    const accountsById = useMemo<Record<number, Account>>(() => {
        const map: Record<number, Account> = {};
        initialUnassigned.forEach((a) => (map[a.id] = a));
        initialGroups.forEach((g) => g.accounts.forEach((a) => (map[a.id] = a)));
        return map;
    }, [initialUnassigned, initialGroups]);
    // The source of truth for membership/order: container key → ordered account ids
    const [byContainer, setByContainer] = useState<Record<string, number[]>>(() => {
        const map: Record<string, number[]> = {
            [UNASSIGNED]: initialUnassigned.map((a) => a.id),
        };
        initialGroups.forEach((g) => {
            map[`g-${g.id}`] = g.accounts.map((a) => a.id);
        });
        return map;
    });

    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const newCounterRef = useRef(0);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [overContainerKey, setOverContainerKey] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const markDirty = () => setDirty(true);

    // Resolve: given an account ID, which container is it currently in?
    const findContainerForAccount = useCallback(
        (accountId: number): string | undefined => {
            return Object.keys(byContainer).find((k) => byContainer[k].includes(accountId));
        },
        [byContainer],
    );

    // Resolve: given a dnd over/active id, derive a container key
    const containerFromDndId = useCallback(
        (dndId: string): string | undefined => {
            if (idIsContainer(dndId)) return containerKeyFrom(dndId);
            if (idIsAccount(dndId)) return findContainerForAccount(accountIdFrom(dndId));
            return undefined;
        },
        [findContainerForAccount],
    );

    // -----------------------------------------------------------------
    // Custom collision detection: prioritise account collisions, fall
    // back to container droppables so empty groups still receive drops.
    // -----------------------------------------------------------------
    const collisionDetection: CollisionDetection = useCallback((args) => {
        const pointer = pointerWithin(args);
        if (pointer.length > 0) {
            // Prefer account collisions if a pointer is over them, else container.
            const accountHit = pointer.find((c) => idIsAccount(String(c.id)));
            if (accountHit) return [accountHit];
            return pointer;
        }
        return rectIntersection(args).filter((c) => idIsContainer(String(c.id)) || idIsAccount(String(c.id))) || closestCorners(args);
    }, []);

    // -----------------------------------------------------------------
    // Drag handlers
    // -----------------------------------------------------------------
    const handleDragStart = (e: DragStartEvent) => {
        setActiveDragId(String(e.active.id));
    };

    const handleDragOver = (e: DragOverEvent) => {
        const { active, over } = e;
        if (!over) {
            setOverContainerKey(null);
            return;
        }
        const activeId = String(active.id);
        const overId = String(over.id);

        // Group reorder — no cross-container concept
        if (idIsGroup(activeId)) {
            setOverContainerKey(null);
            return;
        }

        if (!idIsAccount(activeId)) return;

        const activeAccId = accountIdFrom(activeId);
        const activeContainer = findContainerForAccount(activeAccId);
        const overContainer = containerFromDndId(overId);

        setOverContainerKey(overContainer ?? null);

        // Same container — leave reorder for dragEnd
        if (!activeContainer || !overContainer || activeContainer === overContainer) return;

        // Cross-container live move so the dragged ghost follows immediately
        setByContainer((prev) => {
            const fromList = [...prev[activeContainer]];
            const toList = [...prev[overContainer]];
            fromList.splice(fromList.indexOf(activeAccId), 1);

            // Insert position: above the over-account if hovering an account, else end of container
            let insertAt = toList.length;
            if (idIsAccount(overId)) {
                const overAccId = accountIdFrom(overId);
                const overIdx = toList.indexOf(overAccId);
                if (overIdx !== -1) {
                    // Approximate "above" — dnd-kit handles fine-grained ordering inside sortable
                    insertAt = overIdx;
                }
            }
            toList.splice(insertAt, 0, activeAccId);

            return {
                ...prev,
                [activeContainer]: fromList,
                [overContainer]: toList,
            };
        });
    };

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        setActiveDragId(null);
        setOverContainerKey(null);
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        // Group reorder
        if (idIsGroup(activeId) && idIsGroup(overId) && activeId !== overId) {
            const fromIdx = groups.findIndex((g) => GRP(g.key) === activeId);
            const toIdx = groups.findIndex((g) => GRP(g.key) === overId);
            if (fromIdx !== -1 && toIdx !== -1) {
                setGroups(arrayMove(groups, fromIdx, toIdx));
                markDirty();
            }
            return;
        }

        if (!idIsAccount(activeId)) return;

        const activeAccId = accountIdFrom(activeId);
        const activeContainer = findContainerForAccount(activeAccId);
        const overContainer = containerFromDndId(overId);
        if (!activeContainer || !overContainer) return;

        if (activeContainer === overContainer) {
            const list = byContainer[activeContainer];
            const fromIdx = list.indexOf(activeAccId);
            const overIdx = idIsAccount(overId) ? list.indexOf(accountIdFrom(overId)) : list.length - 1;
            if (fromIdx === overIdx || fromIdx === -1 || overIdx === -1) return;
            setByContainer((prev) => ({
                ...prev,
                [activeContainer]: arrayMove(prev[activeContainer], fromIdx, overIdx),
            }));
            markDirty();
            return;
        }

        // Cross-container move already happened in onDragOver — just mark dirty
        markDirty();
    };

    // -----------------------------------------------------------------
    // CRUD
    // -----------------------------------------------------------------
    const toggleCollapsed = (key: string) => {
        setCollapsedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const expandAll = () => setCollapsedKeys(new Set());
    const collapseAll = () => setCollapsedKeys(new Set(groups.map((g) => g.key)));

    const addGroup = () => {
        const name = newGroupName.trim();
        if (!name) return;
        const key = `new-${newCounterRef.current++}`;
        setGroups((prev) => [...prev, { key, id: null, name, account_type: 'expense', section_type: 'operating_expense', suggested_type: null }]);
        setByContainer((prev) => ({ ...prev, [key]: [] }));
        setNewGroupName('');
        markDirty();
    };

    const renameGroup = (key: string, name: string) => {
        setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, name } : g)));
        markDirty();
    };

    const changeGroupType = (key: string, type: AccountType) => {
        setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, account_type: type } : g)));
        markDirty();
    };

    const changeGroupSection = (key: string, section: SectionType) => {
        setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, section_type: section } : g)));
        markDirty();
    };

    const sortGroup = (key: string) => {
        setByContainer((prev) => {
            const current = prev[key] ?? [];
            if (current.length < 2) return prev;
            const sorted = [...current].sort((a, b) =>
                accountsById[a].account_number.localeCompare(accountsById[b].account_number, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }),
            );
            // Skip update if already sorted (no dirty flag)
            const same = sorted.every((id, i) => id === current[i]);
            if (same) return prev;
            return { ...prev, [key]: sorted };
        });
        // markDirty only if order actually changed — handled implicitly by setByContainer; safe to call always
        markDirty();
    };

    const deleteGroup = (key: string) => {
        const moving = byContainer[key] ?? [];
        setByContainer((prev) => {
            const next = { ...prev };
            // Move accounts to unassigned, kept in account-number order so the panel stays tidy
            const merged = [...prev[UNASSIGNED], ...moving];
            merged.sort((a, b) => accountsById[a].account_number.localeCompare(accountsById[b].account_number));
            next[UNASSIGNED] = merged;
            delete next[key];
            return next;
        });
        setGroups((prev) => prev.filter((g) => g.key !== key));
        markDirty();
    };

    // -----------------------------------------------------------------
    // Save
    // -----------------------------------------------------------------
    const save = () => {
        setSaving(true);
        router.post(
            '/budget-management/gl-groups/sync',
            {
                groups: groups.map((g) => ({
                    id: g.id,
                    name: g.name,
                    account_type: g.account_type,
                    section_type: g.section_type,
                    account_ids: byContainer[g.key] ?? [],
                })),
            },
            {
                preserveScroll: true,
                onFinish: () => {
                    setSaving(false);
                    setDirty(false);
                },
            },
        );
    };

    // -----------------------------------------------------------------
    // Search filter for Unassigned panel only
    // -----------------------------------------------------------------
    const unassignedIds = byContainer[UNASSIGNED] ?? [];
    const filteredUnassignedIds = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return unassignedIds;
        return unassignedIds.filter((id) => {
            const a = accountsById[id];
            return a.account_number.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q);
        });
    }, [unassignedIds, search, accountsById]);

    const activeAccount =
        activeDragId && idIsAccount(activeDragId) ? accountsById[accountIdFrom(activeDragId)] : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="GL Account Groups" />

            <div className="mx-auto w-full max-w-6xl p-3 lg:p-4">
                {/* Toolbar */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-muted-foreground flex-1 text-xs">
                        Drag accounts from the left into any group. Drag a group header to reorder groups; drag accounts within a group to reorder them.
                    </p>
                    <Button size="sm" onClick={save} disabled={saving || !dirty} className="h-8 gap-1.5 text-xs">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save layout
                    </Button>
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={collisionDetection}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => {
                        setActiveDragId(null);
                        setOverContainerKey(null);
                    }}
                >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
                        {/* LEFT: Unassigned */}
                        <div className="bg-card self-start rounded-lg border">
                            <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-t-lg border-b px-3 py-2 text-xs">
                                <span className="font-semibold">Unassigned</span>
                                <span className="text-muted-foreground tabular-nums text-[11px]">
                                    {search.trim()
                                        ? `${filteredUnassignedIds.length} of ${unassignedIds.length}`
                                        : `${unassignedIds.length}`}
                                </span>
                            </div>
                            <div className="border-b p-2">
                                <div className="relative">
                                    <Search
                                        aria-hidden
                                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2"
                                    />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Escape' && search && setSearch('')}
                                        placeholder="Search accounts…"
                                        aria-label="Search unassigned accounts"
                                        className="h-8 pl-7 pr-7 text-xs md:text-xs"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            aria-label="Clear search"
                                            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="max-h-[70vh] overflow-auto">
                                <DroppableContainer
                                    id={UNASSIGNED}
                                    accountIds={filteredUnassignedIds}
                                    isOver={overContainerKey === UNASSIGNED}
                                    placeholder={
                                        unassignedIds.length === 0 ? (
                                            <p className="text-muted-foreground py-6 text-center text-[11px]">
                                                Every account is in a group.
                                            </p>
                                        ) : (
                                            <div className="text-muted-foreground flex flex-col items-center gap-1.5 py-6 text-[11px]">
                                                <p>No accounts match “{search}”.</p>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[11px]"
                                                    onClick={() => setSearch('')}
                                                >
                                                    Clear search
                                                </Button>
                                            </div>
                                        )
                                    }
                                >
                                    {filteredUnassignedIds.map((id) => (
                                        <SortableAccount key={id} account={accountsById[id]} />
                                    ))}
                                </DroppableContainer>
                            </div>
                        </div>

                        {/* RIGHT: Groups */}
                        <div className="rounded-lg border bg-card self-start">
                            <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-t-lg border-b px-3 py-2 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">Groups</span>
                                    <span className="text-muted-foreground tabular-nums text-[11px]">({groups.length})</span>
                                </div>
                                {groups.length > 0 && (
                                    <div className="flex items-center gap-0.5">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={expandAll}
                                            disabled={collapsedKeys.size === 0}
                                            className="h-6 text-[11px]"
                                        >
                                            Expand all
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={collapseAll}
                                            disabled={collapsedKeys.size === groups.length}
                                            className="h-6 text-[11px]"
                                        >
                                            Collapse all
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 p-2">
                                <SortableContext
                                    items={groups.map((g) => GRP(g.key))}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {groups.map((group) => (
                                        <GroupCard
                                            key={group.key}
                                            group={group}
                                            accountIds={byContainer[group.key] ?? []}
                                            accounts={accountsById}
                                            collapsed={collapsedKeys.has(group.key)}
                                            overContainerId={overContainerKey}
                                            onToggleCollapsed={() => toggleCollapsed(group.key)}
                                            onRename={(name) => renameGroup(group.key, name)}
                                            onDelete={() => deleteGroup(group.key)}
                                            onSort={() => sortGroup(group.key)}
                                            onChangeType={(t) => changeGroupType(group.key, t)}
                                            onChangeSection={(s) => changeGroupSection(group.key, s)}
                                        />
                                    ))}
                                </SortableContext>

                                {groups.length === 0 && (
                                    <p className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-xs">
                                        No groups yet. Add one below, then drag accounts in from the left.
                                    </p>
                                )}
                            </div>

                            {/* Add group row — pinned at the bottom of the container */}
                            <div className="border-t p-2">
                                <div className="flex gap-1.5">
                                    <Input
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                                        placeholder="New group name…"
                                        className="h-8 flex-1 text-xs md:text-xs"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={addGroup}
                                        disabled={!newGroupName.trim()}
                                        className="h-8 gap-1.5 text-xs"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add group
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Drag preview */}
                    <DragOverlay>
                        {activeAccount ? (
                            <div className="w-[240px]">
                                <AccountChip account={activeAccount} dragging />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </AppLayout>
    );
}
