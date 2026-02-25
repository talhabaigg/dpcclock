import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlaceholderCardProps {
    title: string;
    className?: string;
}

export default function PlaceholderCard({ title, className }: PlaceholderCardProps) {
    return (
        <Card className={`p-0 gap-0 ${className ?? ''}`}>
            <CardHeader className="!p-0 border-b">
                <div className="flex items-center justify-between w-full px-3 py-1.5">
                    <CardTitle className="text-sm font-semibold leading-none">{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-3 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Coming soon</span>
            </CardContent>
        </Card>
    );
}
