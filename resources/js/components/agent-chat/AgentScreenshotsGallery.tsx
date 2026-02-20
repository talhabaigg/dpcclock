import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bot, Camera, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Screenshot {
    path: string;
    url: string;
    label: string;
}

interface AgentScreenshotsGalleryProps {
    taskId: number;
}

export default function AgentScreenshotsGallery({ taskId }: AgentScreenshotsGalleryProps) {
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);

    useEffect(() => {
        fetch(`/agent/task/${taskId}/screenshots`)
            .then((res) => res.json())
            .then((data) => {
                setScreenshots(data.screenshots || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [taskId]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="h-4 w-4 animate-pulse" />
                Loading screenshots...
            </div>
        );
    }

    if (screenshots.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Bot className="h-4 w-4 text-emerald-600" />
                Agent Proof of Delivery ({screenshots.length} steps)
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {screenshots.map((screenshot, index) => (
                    <Dialog key={screenshot.path}>
                        <DialogTrigger asChild>
                            <button
                                className="group relative overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary hover:shadow-md"
                                onClick={() => setSelectedScreenshot(screenshot)}
                            >
                                <img
                                    src={screenshot.url}
                                    alt={screenshot.label}
                                    className="aspect-video w-full object-cover object-top"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/30">
                                    <ExternalLink className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                                <div className="px-2 py-1.5 text-xs font-medium">
                                    {index + 1}. {screenshot.label}
                                </div>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>
                                    Step {index + 1}: {screenshot.label}
                                </DialogTitle>
                            </DialogHeader>
                            <img
                                src={screenshot.url}
                                alt={screenshot.label}
                                className="w-full rounded-lg border"
                            />
                        </DialogContent>
                    </Dialog>
                ))}
            </div>
        </div>
    );
}
