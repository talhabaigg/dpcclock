import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, Ruler } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

type SummaryRow = {
    condition_id: number;
    condition_number: number;
    condition_name: string;
    type: string;
    area_id: number | null;
    area_name: string;
    height: number | null;
    qty: number;
    unit: string;
    unit_cost: number;
    labour_cost: number;
    material_cost: number;
    total_cost: number;
};

type ConditionGroup = {
    key: string;
    conditionNumber: number;
    conditionName: string;
    type: string;
    area: string;
    height: number | null;
    qty: number;
    unit: string;
    unitCost: number;
    labourCost: number;
    materialCost: number;
    totalCost: number;
    children: SummaryRow[];
};

type AreaGroup = {
    key: string;
    areaName: string;
    labourCost: number;
    materialCost: number;
    totalCost: number;
    children: SummaryRow[];
};

const formatCurrency = (value: number) =>
    '$' + value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatQty = (qty: number, unit: string) =>
    `${qty.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;

export default function TakeoffSummary() {
    const { project, summaries } = usePage<{
        project: { id: number; name: string };
        summaries: SummaryRow[];
    }>().props;

    const [groupBy, setGroupBy] = useState<'condition' | 'area'>('condition');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: project.name, href: `/locations/${project.id}` },
        { title: 'Drawings', href: `/projects/${project.id}/drawings` },
        { title: 'Takeoff Summary', href: `/projects/${project.id}/takeoff-summary` },
    ];

    // Group by condition
    const conditionGroups = useMemo<ConditionGroup[]>(() => {
        const map = new Map<number, ConditionGroup>();

        for (const row of summaries) {
            if (!map.has(row.condition_id)) {
                map.set(row.condition_id, {
                    key: `c-${row.condition_id}`,
                    conditionNumber: row.condition_number,
                    conditionName: row.condition_name,
                    type: row.type,
                    area: '',
                    height: row.height,
                    qty: 0,
                    unit: row.unit,
                    unitCost: 0,
                    labourCost: 0,
                    materialCost: 0,
                    totalCost: 0,
                    children: [],
                });
            }

            const group = map.get(row.condition_id)!;
            group.qty += row.qty;
            group.labourCost += row.labour_cost;
            group.materialCost += row.material_cost;
            group.totalCost += row.total_cost;
            group.children.push(row);
        }

        for (const group of map.values()) {
            const uniqueAreas = [...new Set(group.children.map((c) => c.area_name))];
            group.area = uniqueAreas.length > 1 ? 'Multiple' : (uniqueAreas[0] ?? 'Unassigned');
            group.unitCost = group.qty > 0 ? group.totalCost / group.qty : 0;
        }

        return [...map.values()].sort((a, b) => a.conditionNumber - b.conditionNumber);
    }, [summaries]);

    // Group by area
    const areaGroups = useMemo<AreaGroup[]>(() => {
        const map = new Map<string, AreaGroup>();

        for (const row of summaries) {
            const areaKey = row.area_name;
            if (!map.has(areaKey)) {
                map.set(areaKey, {
                    key: `a-${areaKey}`,
                    areaName: areaKey,
                    labourCost: 0,
                    materialCost: 0,
                    totalCost: 0,
                    children: [],
                });
            }

            const group = map.get(areaKey)!;
            group.labourCost += row.labour_cost;
            group.materialCost += row.material_cost;
            group.totalCost += row.total_cost;
            group.children.push(row);
        }

        return [...map.values()];
    }, [summaries]);

    const grandTotal = useMemo(
        () =>
            summaries.reduce(
                (acc, row) => ({
                    labour: acc.labour + row.labour_cost,
                    material: acc.material + row.material_cost,
                    total: acc.total + row.total_cost,
                }),
                { labour: 0, material: 0, total: 0 },
            ),
        [summaries],
    );

    const allKeys = useMemo(() => {
        if (groupBy === 'condition') {
            return new Set(conditionGroups.map((g) => g.key));
        }
        return new Set(areaGroups.map((g) => g.key));
    }, [groupBy, conditionGroups, areaGroups]);

    const toggleExpand = (key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const expandAll = () => setExpanded(new Set(allKeys));
    const collapseAll = () => setExpanded(new Set());

    const handleExport = () => {
        window.location.href = `/projects/${project.id}/takeoff-summary/export?group_by=${groupBy}`;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Takeoff Summary — ${project.name}`} />

            <div className="flex flex-col gap-4 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Takeoff Summary</h1>
                    <div className="flex items-center gap-2">
                        <Select
                            value={groupBy}
                            onValueChange={(v) => {
                                setGroupBy(v as 'condition' | 'area');
                                setExpanded(new Set());
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="condition">Group by Condition</SelectItem>
                                <SelectItem value="area">Group by Area</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="outline" size="sm" onClick={expandAll}>
                            <ChevronsUpDown className="mr-1 h-4 w-4" />
                            Expand All
                        </Button>
                        <Button variant="outline" size="sm" onClick={collapseAll}>
                            <ChevronsDownUp className="mr-1 h-4 w-4" />
                            Collapse All
                        </Button>

                        <Button onClick={handleExport}>
                            <Download className="mr-1 h-4 w-4" />
                            Export Excel
                        </Button>
                    </div>
                </div>

                {summaries.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-16 text-center">
                        <div className="rounded-full bg-muted p-3">
                            <Ruler className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="font-semibold">No takeoff data yet</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Create measurements on your drawings to see quantities, costs, and export options here.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/projects/${project.id}/drawings`}>Go to Drawings</a>
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">#</TableHead>
                                    <TableHead>Condition Name</TableHead>
                                    <TableHead className="w-20">Type</TableHead>
                                    <TableHead>Area</TableHead>
                                    <TableHead className="w-20">Height</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Unit Cost</TableHead>
                                    <TableHead className="text-right">Labour Cost</TableHead>
                                    <TableHead className="text-right">Material Cost</TableHead>
                                    <TableHead className="text-right">Total Cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupBy === 'condition'
                                    ? conditionGroups.map((group) => (
                                          <Fragment key={group.key}>
                                              {/* Condition parent row */}
                                              <TableRow
                                                  className="bg-muted/50 hover:bg-muted cursor-pointer font-medium"
                                                  onClick={() => toggleExpand(group.key)}
                                              >
                                                  <TableCell>
                                                      <div className="flex items-center gap-1">
                                                          {group.children.length > 1 ? (
                                                              expanded.has(group.key) ? (
                                                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                                              ) : (
                                                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                                              )
                                                          ) : (
                                                              <span className="inline-block w-4" />
                                                          )}
                                                          {group.conditionNumber}
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="font-semibold">{group.conditionName}</TableCell>
                                                  <TableCell className="capitalize">{group.type}</TableCell>
                                                  <TableCell>{group.area}</TableCell>
                                                  <TableCell>{group.height ? `${group.height}m` : '—'}</TableCell>
                                                  <TableCell className="text-right font-medium">
                                                      {formatQty(group.qty, group.unit)}
                                                  </TableCell>
                                                  <TableCell className="text-right">{formatCurrency(group.unitCost)}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(group.labourCost)}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(group.materialCost)}</TableCell>
                                                  <TableCell className="text-right font-semibold">
                                                      {formatCurrency(group.totalCost)}
                                                  </TableCell>
                                              </TableRow>

                                              {/* Per-area child rows */}
                                              {expanded.has(group.key) &&
                                                  group.children.map((child, idx) => (
                                                      <TableRow key={`${group.key}-${idx}`} className="text-muted-foreground">
                                                          <TableCell />
                                                          <TableCell className="pl-10">{child.area_name}</TableCell>
                                                          <TableCell />
                                                          <TableCell />
                                                          <TableCell />
                                                          <TableCell className="text-right">
                                                              {formatQty(child.qty, child.unit)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.unit_cost)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.labour_cost)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.material_cost)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.total_cost)}
                                                          </TableCell>
                                                      </TableRow>
                                                  ))}
                                          </Fragment>
                                      ))
                                    : areaGroups.map((group) => (
                                          <Fragment key={group.key}>
                                              {/* Area parent row */}
                                              <TableRow
                                                  className="bg-muted/50 hover:bg-muted cursor-pointer font-medium"
                                                  onClick={() => toggleExpand(group.key)}
                                              >
                                                  <TableCell>
                                                      {expanded.has(group.key) ? (
                                                          <ChevronDown className="h-4 w-4" />
                                                      ) : (
                                                          <ChevronRight className="h-4 w-4" />
                                                      )}
                                                  </TableCell>
                                                  <TableCell className="font-semibold" colSpan={4}>
                                                      {group.areaName}
                                                  </TableCell>
                                                  <TableCell />
                                                  <TableCell />
                                                  <TableCell className="text-right">{formatCurrency(group.labourCost)}</TableCell>
                                                  <TableCell className="text-right">
                                                      {formatCurrency(group.materialCost)}
                                                  </TableCell>
                                                  <TableCell className="text-right font-semibold">
                                                      {formatCurrency(group.totalCost)}
                                                  </TableCell>
                                              </TableRow>

                                              {/* Condition child rows */}
                                              {expanded.has(group.key) &&
                                                  group.children.map((child, idx) => (
                                                      <TableRow key={`${group.key}-${idx}`} className="text-muted-foreground">
                                                          <TableCell className="pl-8">{child.condition_number}</TableCell>
                                                          <TableCell>{child.condition_name}</TableCell>
                                                          <TableCell className="capitalize">{child.type}</TableCell>
                                                          <TableCell />
                                                          <TableCell>{child.height ? `${child.height}m` : '—'}</TableCell>
                                                          <TableCell className="text-right">
                                                              {formatQty(child.qty, child.unit)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.unit_cost)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.labour_cost)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.material_cost)}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                              {formatCurrency(child.total_cost)}
                                                          </TableCell>
                                                      </TableRow>
                                                  ))}
                                          </Fragment>
                                      ))}

                                {/* Grand Total */}
                                <TableRow className="bg-muted border-t-2 font-bold">
                                    <TableCell colSpan={7} className="text-right">
                                        Grand Total
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(grandTotal.labour)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(grandTotal.material)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(grandTotal.total)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
