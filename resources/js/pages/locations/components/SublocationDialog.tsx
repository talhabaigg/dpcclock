import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function SublocationDialog({
    subLocations,
    locationName,
}: {
    subLocations: { id: number; name: string; eh_location_id: string; external_id: string }[];
    locationName: string;
}) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter sublocations based on the search query
    const filteredSublocations = subLocations.filter((sublocation) => sublocation.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <Dialog>
            <DialogTrigger>
                <Button variant="secondary" size="sm">
                    Open
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-h-[800px] sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Sub-locations for {locationName}</DialogTitle>
                    <DialogDescription>
                        <div className="space-y-4">
                            {/* Search Box */}

                            <div className="relative w-full sm:w-1/2">
                                <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                                <Input
                                    type="text"
                                    placeholder="Search by name"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="max-h-[500px] overflow-y-auto">
                                {/* Table displaying filtered sub-locations */}
                                {filteredSublocations.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">ID</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>External ID</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredSublocations.map((sublocation) => (
                                                <TableRow key={sublocation.id}>
                                                    <TableCell>{sublocation.eh_location_id}</TableCell>
                                                    <TableCell>{sublocation.name}</TableCell>
                                                    <TableCell>{sublocation.external_id || 'No external Id Set'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p>No sub-locations available</p>
                                )}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
