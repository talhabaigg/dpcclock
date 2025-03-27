import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
}

interface KioskLayoutProps {
    children: React.ReactNode;
    employees: Employee[];
}

export default function KioskLayout({ children, employees }: KioskLayoutProps) {
    const [search, setSearch] = useState<string>("");

    // Filtering employees based on search input
    const filteredEmployees = employees.filter((emp) =>
        emp.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-1/4 bg-gray-900 text-white p-4">
                <h2 className="text-xl font-bold mb-4">Employees</h2>
                <Input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-4"
                />
                <ul>
                    {filteredEmployees.map((emp) => (
                        <li key={emp.id} className="mb-2">
                            <Button
                                variant="ghost"
                                className="w-full text-left justify-start"
                            >
                                {emp.name}
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center">
                {/* The content passed as children will be rendered here */}
                {children}
            </div>
        </div>
    );
}
