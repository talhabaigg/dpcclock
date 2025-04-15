const ActivitySelector = ({ task, groupedLocations, index, updateTaskAllocation }) => {
    return (
        <ul className="max-h-[200px] overflow-y-auto rounded border">
            {!task.level && <li className="h-50 p-2 text-gray-500 italic">Select a level to see activities</li>}

            {task.level &&
                groupedLocations[task.level]?.map((activity) => (
                    <li
                        key={activity}
                        className={`cursor-pointer rounded-none border-b p-2 ${task.activity === activity ? 'bg-gray-200 text-black' : ''}`}
                        onClick={() => updateTaskAllocation(index, 'activity', activity)}
                    >
                        {activity.slice(4)}
                    </li>
                ))}
        </ul>
    );
};

export default ActivitySelector;
