import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Worker Check',
        href: '/worker-screening/search',
    },
];

interface SearchResult {
    alert: boolean;
    name: string;
}

interface Props {
    result: SearchResult | 'clear' | null;
    searched: boolean;
    query: {
        phone: string | null;
        email: string | null;
        first_name: string | null;
        surname: string | null;
        date_of_birth: string | null;
    };
}

export default function WorkerScreeningSearch({ result, searched, query }: Props) {
    const [phone, setPhone] = useState(query.phone || '');
    const [email, setEmail] = useState(query.email || '');
    const [firstName, setFirstName] = useState(query.first_name || '');
    const [surname, setSurname] = useState(query.surname || '');
    const [dob, setDob] = useState(query.date_of_birth || '');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSearching(true);

        const params: Record<string, string> = {};
        if (phone.trim()) params.phone = phone.trim();
        if (email.trim()) params.email = email.trim();
        if (firstName.trim()) params.first_name = firstName.trim();
        if (surname.trim()) params.surname = surname.trim();
        if (dob) params.date_of_birth = dob;

        router.get('/worker-screening/search', params, {
            preserveState: true,
            onFinish: () => setIsSearching(false),
        });
    };

    const hasNameOnly = (firstName.trim() || surname.trim()) && !dob && !phone.trim() && !email.trim();
    const hasAnyField = phone.trim() || email.trim() || firstName.trim() || surname.trim() || dob;
    const canSubmit = hasAnyField && !hasNameOnly;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Worker Check" />

            <div className="mx-auto flex w-full max-w-md md:min-w-xl md:max-w-xl flex-col items-center space-y-6 p-6">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2">
                            <Search className="h-5 w-5" />
                            Worker Check
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="e.g. 0412 345 678"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="e.g. john@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="first_name">First Name</Label>
                                    <Input
                                        id="first_name"
                                        placeholder="First name"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="surname">Surname</Label>
                                    <Input
                                        id="surname"
                                        placeholder="Surname"
                                        value={surname}
                                        onChange={(e) => setSurname(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="dob">Date of Birth</Label>
                                <Input
                                    id="dob"
                                    type="date"
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={!canSubmit || isSearching}
                                >
                                    {isSearching ? 'Checking...' : 'Check Worker'}
                                </Button>
                                {hasAnyField && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setPhone('');
                                            setEmail('');
                                            setFirstName('');
                                            setSurname('');
                                            setDob('');
                                            router.get('/worker-screening/search', {}, { preserveState: false });
                                        }}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {searched && result === 'clear' && (
                    <Card className="w-full border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
                        <CardContent className="flex flex-col items-center gap-3 py-8">
                            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
                            <p className="text-lg font-semibold text-green-800 dark:text-green-300">All clear</p>
                            <p className="text-sm text-green-600 dark:text-green-400">No alerts found for this person.</p>
                        </CardContent>
                    </Card>
                )}

                {searched && result && result !== 'clear' && (
                    <Card className="w-full border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
                        <CardContent className="flex flex-col items-center gap-3 py-8">
                            <AlertTriangle className="h-16 w-16 text-red-600 dark:text-red-400" />
                            <p className="text-lg font-semibold text-red-800 dark:text-red-300">Alert</p>
                            <p className="text-sm text-red-600 dark:text-red-400">
                                Contact the office before proceeding.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
