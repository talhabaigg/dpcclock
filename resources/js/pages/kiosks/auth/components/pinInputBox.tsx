// components/kiosk/PinDisplay.tsx

interface PinDisplayProps {
    pin: string;
}

export default function PinInputBox({ pin }: PinDisplayProps) {
    return (
        <>
            {Array(4)
                .fill('')
                .map((_, index) => (
                    <input
                        key={index}
                        type="password"
                        value={pin[index] || ''}
                        readOnly
                        className="h-10 w-10 rounded-lg border border-gray-300 text-center text-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        maxLength={1}
                        autoFocus={index === pin.length}
                    />
                ))}
        </>
    );
}
