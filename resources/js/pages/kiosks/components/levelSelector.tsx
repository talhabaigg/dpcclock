const LevelSelector = ({ levels, selectedLevel, onSelect }) => {
    return (
        <ul className="max-h-[200px] overflow-y-auto rounded border p-1">
            {levels.map((level) => (
                <li
                    key={level}
                    className={`cursor-pointer rounded-none border-b p-2 ${selectedLevel === level ? 'bg-gray-200 text-black' : ''}`}
                    onClick={() => onSelect(level)}
                >
                    {level.slice(7)}
                </li>
            ))}
        </ul>
    );
};

export default LevelSelector;
