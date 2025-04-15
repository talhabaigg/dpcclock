const HourSelector = ({ task, index, updateTaskAllocation }) => {
    const hours = [...Array(20)].map((_, i) => (i + 1) * 0.5);

    return (
        <ul className="max-h-[200px] overflow-y-auto rounded border p-2 sm:w-full">
            {hours.map((hourValue) => (
                <li
                    key={hourValue}
                    className={`cursor-pointer rounded-none border-b p-2 text-center ${task.hours === hourValue ? 'bg-gray-200' : ''}`}
                    onClick={() => updateTaskAllocation(index, 'hours', hourValue)}
                >
                    {hourValue}
                </li>
            ))}
        </ul>
    );
};

export default HourSelector;
