const parseWeekEndingDate = (dateString: string): Date => {
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    return new Date(); // Fallback to current date if parsing fails
};

export { parseWeekEndingDate };
