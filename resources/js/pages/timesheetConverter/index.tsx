import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Timesheet Converter and Upload to Employment Hero',
        href: '/timesheets-converter',
    },
];

export default function TimesheetConverter() {
    const { flash, data } = usePage<{ flash: { success: string, message: string }, data: any }>().props;
    console.log(data);

    const uploadForm = useForm({
        file: null as File | null,
    });

    // Handle file selection
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            uploadForm.setData('file', event.target.files[0]);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheet Converter" />
            {flash.message && (
                    <p className="text-green-600 mx-4">{flash.message}</p>
                )}
            {/* {data.map((item, index) => (
                <div key={index} className="mx-4 my-2">
                    <p>{item.name}</p>
                    <p>{item.description}</p>
                </div>
            ))} */}

            <div className="m-4 flex w-full max-w-sm flex-row items-center gap-1.5">
               
                {/* File Input */}
                <Input id="file-upload" type="file" onChange={handleFileChange} accept=".csv" />

                {/* Submit Button (Only Enabled When File is Selected) */}
                <Button
                    className="mx-2 w-32"
                    variant="outline"
                    disabled={!uploadForm.data.file}
                    onClick={() => uploadForm.post('/timesheets-converter/upload')}
                >
                    {uploadForm.processing ? <Loader2 className="animate-spin" /> : 'Submit'}
                </Button>
            </div>
           
            
      
       
               
        
           
            <p className="-mt-2 ml-6 text-xs font-black">Only accepts .csv files.</p>
            <p className=" ml-6 text-xs font-black">Columns:</p>
            <ul className="ml-12 text-xs list-disc">
                <li>EMPLOYEE CODE - (Use old external ids from sage)</li>
                <li>JOB NUMBER - (use old job numbers from sage)</li>
                <li>COST CODE- (use old cost codes- for leaves enter "Annual Leave Taken")</li>
                <li>DATE</li>
                <li>PAY - (Old sage pay codes like 110, 131)</li>
                <li>HOURS</li>
                <li>Travel (add zone shift condition as per EH)</li>
                <li>Allowance (Insulation Allowance, Setout allowance etc as per EH)</li>
            </ul>
        </AppLayout>
    );
}
