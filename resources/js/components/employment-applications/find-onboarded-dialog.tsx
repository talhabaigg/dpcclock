import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link, router } from '@inertiajs/react';
import { CircleCheck, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OnboardedMatch {
    application_id: number;
    applicant_name: string;
    status: string;
    employee_id: number;
    employee_name: string;
    already_linked: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    statuses: Record<string, string>;
    onError: (message: string) => void;
}

function linkHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
    };
}

export function FindOnboardedDialog({ open, onOpenChange, statuses, onError }: Props) {
    const [matches, setMatches] = useState<OnboardedMatch[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setMatches([]);
        (async () => {
            try {
                const res = await fetch('/employment-applications/find-onboarded');
                const data = await res.json();
                if (!cancelled) setMatches(data.matches ?? []);
            } catch {
                if (!cancelled) {
                    onError('Failed to check onboarded enquiries.');
                    onOpenChange(false);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, onError, onOpenChange]);

    const linkOne = async (match: OnboardedMatch) => {
        const res = await fetch(`/employment-applications/${match.application_id}/link-employee`, {
            method: 'POST',
            headers: linkHeaders(),
            body: JSON.stringify({ employee_id: match.employee_id }),
        });
        if (res.ok) {
            setMatches((prev) =>
                prev.map((m) =>
                    m.application_id === match.application_id ? { ...m, already_linked: true, status: 'onboarded' } : m,
                ),
            );
        }
    };

    const linkAll = async () => {
        const unlinked = matches.filter((m) => !m.already_linked);
        const results = await Promise.allSettled(
            unlinked.map((m) =>
                fetch(`/employment-applications/${m.application_id}/link-employee`, {
                    method: 'POST',
                    headers: linkHeaders(),
                    body: JSON.stringify({ employee_id: m.employee_id }),
                }).then((r) => {
                    if (!r.ok) throw new Error(r.statusText);
                    return m.application_id;
                }),
            ),
        );
        const linkedIds = results
            .filter((r) => r.status === 'fulfilled')
            .map((r) => (r as PromiseFulfilledResult<number>).value);
        setMatches((prev) =>
            prev.map((m) => (linkedIds.includes(m.application_id) ? { ...m, already_linked: true, status: 'onboarded' } : m)),
        );
    };

    const closeAndReload = () => {
        onOpenChange(false);
        router.reload();
    };

    const unlinkedCount = matches.filter((m) => !m.already_linked).length;
    const linkedCount = matches.filter((m) => m.already_linked).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] min-w-full overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Onboarded Enquiries</DialogTitle>
                    <DialogDescription>Enquiries matching existing employees by email.</DialogDescription>
                </DialogHeader>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : matches.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">No matching enquiries found.</p>
                ) : (
                    <div className="overflow-y-auto -mx-6 px-6">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Candidate</TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {matches.map((match) => (
                                    <TableRow key={match.application_id}>
                                        <TableCell>{match.applicant_name}</TableCell>
                                        <TableCell>{match.employee_name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {statuses[match.status] ?? match.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Link href={`/employment-applications/${match.application_id}`}>
                                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                                                    View
                                                </Button>
                                            </Link>
                                            {match.already_linked ? (
                                                <Badge variant="secondary" className="text-xs">
                                                    <CircleCheck className="mr-1 h-3 w-3" />
                                                    Linked
                                                </Badge>
                                            ) : (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => linkOne(match)}
                                                >
                                                    Link
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <p className="text-muted-foreground py-2 text-center text-xs">
                            {matches.length} match(es) — {linkedCount} linked
                        </p>
                    </div>
                )}
                <DialogFooter className="gap-2">
                    {!loading && unlinkedCount > 0 && (
                        <Button variant="default" size="sm" onClick={linkAll}>
                            Link All ({unlinkedCount})
                        </Button>
                    )}
                    <Button variant="outline" onClick={closeAndReload}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
