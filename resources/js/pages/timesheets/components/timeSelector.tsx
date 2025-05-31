import { useEffect, useState } from 'react';

const TimeSelector = ({ datetime, onTimeChange }) => {
    // Define the options for hours and minutes
    const hoursOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutesOptions = ['00', '15', '30', '45'];

    // Initialize state for hours and minutes
    const [selectedHours, setSelectedHours] = useState('00');
    const [selectedMinutes, setSelectedMinutes] = useState('00');

    // Check if datetime is actually received and log it
    useEffect(() => {
        console.log('datetime received in useEffect:', datetime);

        if (datetime) {
            // Replace space with T if needed (for ISO 8601)
            const safeDatetime = datetime.replace(' ', 'T');
            const date = new Date(safeDatetime);

            // Log the full Date object to check if it's being parsed correctly
            console.log('Converted Date:', date);

            if (!isNaN(date.getTime())) {
                // Only proceed if the date is valid
                console.log('Valid Date:', date);

                // Log the hour and minute values
                console.log('Extracted Hours:', date.getHours());
                console.log('Extracted Minutes:', date.getMinutes());

                // Set state with local time hours and minutes
                setSelectedHours(String(date.getHours()).padStart(2, '0'));
                setSelectedMinutes(String(date.getMinutes()).padStart(2, '0'));
            } else {
                console.error('Invalid date:', safeDatetime);
            }
        } else {
            console.log('No datetime provided');
        }
    }, [datetime]);

    const handleHoursChange = (e) => {
        const newHours = e.target.value;
        setSelectedHours(newHours);
        emitTimeChange(newHours, selectedMinutes);
    };

    const handleMinutesChange = (e) => {
        const newMinutes = e.target.value;
        setSelectedMinutes(newMinutes);
        emitTimeChange(selectedHours, newMinutes);
    };

    const emitTimeChange = (hours, minutes) => {
        const updatedTime = `${hours}:${minutes}`;
        console.log('Updated Time:', updatedTime); // Log the emitted time
        onTimeChange(updatedTime);
    };

    return (
        <div className="time-selector">
            <select value={selectedHours} onChange={handleHoursChange} className="time-selector-dropdown">
                {hoursOptions.map((hour) => (
                    <option key={hour} value={hour}>
                        {hour}
                    </option>
                ))}
            </select>

            <select value={selectedMinutes} onChange={handleMinutesChange} className="time-selector-dropdown">
                {minutesOptions.map((minute) => (
                    <option key={minute} value={minute}>
                        {minute}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default TimeSelector;
