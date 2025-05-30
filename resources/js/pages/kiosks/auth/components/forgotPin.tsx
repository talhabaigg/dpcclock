import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';

interface ForgotPinLinkProps {
    eh_employee_id: number;
    eh_kiosk_id: string;
}
export default function ForgotPinLink({ eh_employee_id, eh_kiosk_id }: ForgotPinLinkProps) {
    return (
        <Link
            className="mt-2"
            href="#"
            onClick={(e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to reset your PIN?')) {
                    window.location.href = route('kiosk.auth.reset-pin', {
                        employeeId: eh_employee_id,
                        kiosk: eh_kiosk_id,
                    });
                }
            }}
        >
            <Button className="mt-4" variant="link">
                I forgot my PIN
            </Button>
        </Link>
    );
}
