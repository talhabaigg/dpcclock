import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

const ItemCodeCellRenderer = (params) => {
    const [showArrow, setShowArrow] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowArrow(false), 10000);
        return () => clearTimeout(timer);
    }, []);

    if (params.value) return params.value;

    return (
        <span className="flex items-center gap-1 font-bold">
            Click here to select items
            {showArrow && (
                <span className="animate-bounce-right text-lg">
                    {' '}
                    <ArrowLeft className="animate-pulse" size={50} />
                </span>
            )}
        </span>
    );
};

export { ItemCodeCellRenderer };
