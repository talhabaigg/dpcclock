import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlaceholderCardProps {
    title: string;
}

export default function PlaceholderCard({ title }: PlaceholderCardProps) {
    return (
        <Card className="p-0 gap-0 flex flex-col">
            <CardHeader className="!p-0 border-b shrink-0">
                <div className="flex items-center justify-between w-full px-1.5 py-0.5">
                    <CardTitle className="text-[11px] font-semibold leading-none">{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-2 flex items-center justify-center flex-1">
                <span className="text-[11px] text-muted-foreground">Coming soon</span>
            </CardContent>
        </Card>
    );
}
