import KioskLayout, { type KioskBase } from '@/layouts/kiosk-layout';
import RegisteredDevicesCard from '../edit-partials/registered-devices-card';

interface KioskDevice {
    id: number;
    device_name: string | null;
    is_active: boolean;
    last_seen_at: string | null;
    created_at: string;
}

interface Props {
    kiosk: KioskBase;
    devices: KioskDevice[];
}

export default function EditDevices({ kiosk, devices }: Props) {
    return (
        <KioskLayout kiosk={kiosk} activeTab="devices">
            <RegisteredDevicesCard kioskId={kiosk.id} devices={devices} />
        </KioskLayout>
    );
}
