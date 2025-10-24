import { Search } from 'lucide-react';
import { Input } from './ui/input';

const InputSearch = ({ searchQuery, setSearchQuery, searchName }) => {
    return (
        <>
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
            <Input
                type="text"
                placeholder={`Search by ${searchName}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
        </>
    );
};

export default InputSearch;
