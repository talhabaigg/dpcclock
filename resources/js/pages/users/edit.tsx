import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: '/users',
    },
];

type Permission = {
    id: number;
    name: string;
};

type User = {
    id: number;
    name: string;
    email: string;
    created_at: string;
    roles: {
        permissions: Permission[];
        id: number;
        name: string;
    }[];
};

type Role = {
    id: number;
    name: string;
};

export default function UserEdit() {
    const { user, roles, flash } = usePage<{ user: User; roles: Role[]; flash: { success: string; error: string } }>().props;
    let isLoading = false;
    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        email: user.email,
        roles: user.roles[0]?.id.toString() ?? '', // assuming single role
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('users.update', user.id));
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="m-2 flex items-center gap-2">{flash.success && <div className="m-2 text-green-500">{flash.success}</div>}</div>
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <form onSubmit={handleSubmit}>
                    <input type="hidden" name="_method" value="PUT" />
                    <input type="hidden" name="id" value={user.id} />
                    <div className="mb-2">
                        <Label htmlFor="name">Name</Label>
                        <Input type="text" name="name" id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} />
                    </div>
                    <div className="mb-2">
                        <Label htmlFor="email">Email</Label>
                        <Input type="email" name="email" id="email" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                    </div>
                    <div className="mb-2">
                        <Label htmlFor="roles">Roles</Label>
                        <Select name="roles" value={data.roles} onValueChange={(value) => setData('roles', value)}>
                            <SelectTrigger className="mb-2">
                                <SelectValue placeholder="Select Role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.id.toString()}>
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button className="mb-2" type="submit" disabled={processing}>
                        {isLoading ? 'Saving...' : 'Save'}
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
