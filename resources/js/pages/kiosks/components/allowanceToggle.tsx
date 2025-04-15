import { Checkbox } from '@/components/ui/checkbox'; // Adjust path if needed

const AllowanceToggle = ({ label, index, checked, onToggle }) => {
    const id = `${label.toLowerCase()}-${index}`;

    return (
        <div className="flex flex-row items-center space-x-2">
            <Checkbox id={id} className="h-8 w-8" checked={checked} onCheckedChange={() => onToggle(index, label.toLowerCase())} />
            <span className="text-sm">{label}</span>
        </div>
    );
};

export default AllowanceToggle;
