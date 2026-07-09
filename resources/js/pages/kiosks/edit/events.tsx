import KioskLayout, { type KioskBase } from '@/layouts/kiosk-layout';
import GenerateTimesheetsAvailableEventsCard from '../edit-partials/generate-timesheets-available-events-card';

interface Employee {
    id: number;
    name: string;
    pivot: { eh_employee_id: number | string };
}

interface TimesheetEvent {
    id: number;
    title: string;
    start: string;
    end: string;
    state?: string;
}

interface Props {
    kiosk: KioskBase;
    employees: Employee[];
    events: TimesheetEvent[];
}

export default function EditEvents({ kiosk, employees, events }: Props) {
    return (
        <KioskLayout kiosk={kiosk} activeTab="events">
            <GenerateTimesheetsAvailableEventsCard events={events} employees={employees} kioskId={Number(kiosk.eh_kiosk_id)} />
        </KioskLayout>
    );
}
