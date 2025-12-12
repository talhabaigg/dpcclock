export default function TokenProgressBar({ tokenUsage }) {
    const total = 1_000_000;
    const percent = Math.min((tokenUsage / total) * 100, 100);

    return (
        <div className="w-full">
            <div className="mb-1 flex justify-between text-sm">
                {/* <span>Tokens used: {tokenUsage.toLocaleString()}</span> */}
                <span>{percent.toFixed(1)}%</span>
                <span>{tokenUsage.toLocaleString()} tokens</span>
            </div>

            <div className="h-3 w-full min-w-[18rem] rounded bg-gray-200">
                <div className="h-3 rounded bg-gray-700" style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}
