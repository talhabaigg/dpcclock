import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Form, Link } from '@inertiajs/react';
import { AlertCircle } from 'lucide-react';
const RequisitionHeaderTemplateEdit = ({ location }) => {
    return (
        <AppLayout>
            <Form method="put" action={`/location/${location.id}/req-header/update`} className="mx-auto my-2 min-w-96 space-y-2">
                <Alert className="max-w-96">
                    <AlertCircle />
                    <AlertTitle>Must read below</AlertTitle>
                    <AlertDescription>
                        The field Requested by and Order reference will be sent to Premier and to the supplier from Premier. Other fields are for
                        application print only.
                    </AlertDescription>
                </Alert>
                <Label>Template Name</Label>
                <Input name="name" placeholder="Requisition Header Name" defaultValue={location.header?.name || ''} />
                <Label>Delivery Contact</Label>
                <Input name="delivery_contact" placeholder="Delivery Contact" defaultValue={location.header?.delivery_contact || ''} />
                <Label>Requested By</Label>
                <Input name="requested_by" placeholder="Requested By" defaultValue={location.header?.requested_by || ''} />
                <Label>Deliver To</Label>
                <Input name="deliver_to" placeholder="Deliver To" defaultValue={location.header?.deliver_to || ''} />
                <Label>Order Reference</Label>
                <Input name="order_reference" placeholder="Order Reference" defaultValue={location.header?.order_reference || ''} />
                <div className="flex space-x-2">
                    <Button type="submit">Save</Button>
                    <Link href="/locations/">
                        <Button variant="link">Cancel</Button>
                    </Link>
                </div>
            </Form>
        </AppLayout>
    );
};

export default RequisitionHeaderTemplateEdit;
