import { Search } from 'lucide-react';
import { Input } from './ui/input';

type InputSearchProps = {
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    searchName: string;
};

const InputSearch = ({ searchQuery, setSearchQuery, searchName }: InputSearchProps) => {
    return (
        <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" size={18} />
            <Input
                type="text"
                placeholder={`Search by ${searchName}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
        </div>
    );
};

export default InputSearch;
