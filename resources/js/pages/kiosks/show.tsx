import KioskLayout from "./partials/layout";
import { usePage } from "@inertiajs/react";

// Static Employee Data
interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
}

export default function Kiosk() {
    const { employees } = usePage<{ employees: Employee[] }>().props;
    console.log(employees);
    return (
        <KioskLayout employees={employees}>
            <div>
                <h1 className="text-2xl">Welcome to Another Page</h1>
                <p>This content will be displayed inside the layout with the sidebar.</p>
            </div>
        </KioskLayout>
    );
}
