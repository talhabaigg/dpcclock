// components/SearchBar.tsx
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function EmployeeSearch({ value, onChange, placeholder = 'Search' }: SearchBarProps) {
    return (
        <div className="relative w-full">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
            <Input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-10" />
        </div>
    );
}
