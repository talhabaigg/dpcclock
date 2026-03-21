import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { CheckIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';

// Mock skills data (will come from backend later)
const availableSkills = [
    { id: 1, name: 'Erecting Framework' },
    { id: 2, name: 'Concealed Grid' },
    { id: 3, name: 'Setting' },
    { id: 4, name: 'Decorative Cornice' },
    { id: 5, name: 'Set Out' },
    { id: 6, name: 'Fix Plasterboard' },
    { id: 7, name: 'Exposed Grid' },
    { id: 8, name: 'Cornice' },
];

const occupations = [
    { value: 'plasterer', label: 'Plasterer' },
    { value: 'carpenter', label: 'Carpenter' },
    { value: 'labourer', label: 'Labourer' },
    { value: 'other', label: 'Other' },
];

interface Reference {
    company_name: string;
    position: string;
    employment_period: string;
    contact_person: string;
    phone_number: string;
}

interface JobApplicationForm {
    // Personal
    surname: string;
    first_name: string;
    suburb: string;
    email: string;
    phone: string;
    date_of_birth: string;
    why_should_we_employ_you: string;
    referred_by: string;
    aboriginal_or_tsi: string;
    // Occupation
    occupation: string;
    apprentice_year: string;
    trade_qualified: string;
    occupation_other: string;
    // Project
    preferred_project_site: string;
    // Skills
    selected_skills: number[];
    custom_skills: string;
    // Licences
    safety_induction_number: string;
    ewp_below_11m: boolean;
    ewp_above_11m: boolean;
    forklift_licence_number: string;
    work_safely_at_heights: string;
    scaffold_licence_number: string;
    first_aid_completion_date: string;
    workplace_impairment_training: string;
    wit_completion_date: string;
    asbestos_awareness_training: string;
    crystalline_silica_course: string;
    gender_equity_training: string;
    quantitative_fit_test: string;
    // Medical
    workcover_claim: string;
    medical_condition: string;
    medical_condition_other: string;
    // References
    references: Reference[];
    // Acceptance
    acceptance_full_name: string;
    acceptance_email: string;
    acceptance_date: string;
    declaration_accepted: boolean;
}

const emptyReference: Reference = {
    company_name: '',
    position: '',
    employment_period: '',
    contact_person: '',
    phone_number: '',
};

const STEPS = [
    { label: 'Personal Details', shortLabel: 'Personal' },
    { label: 'Occupation & Skills', shortLabel: 'Skills' },
    { label: 'Licences & Tickets', shortLabel: 'Licences' },
    { label: 'References', shortLabel: 'References' },
    { label: 'Medical & Declaration', shortLabel: 'Medical' },
];

export default function Apply() {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<JobApplicationForm>({
        surname: '',
        first_name: '',
        suburb: '',
        email: '',
        phone: '',
        date_of_birth: '',
        why_should_we_employ_you: '',
        referred_by: '',
        aboriginal_or_tsi: '',
        occupation: '',
        apprentice_year: '',
        trade_qualified: '',
        occupation_other: '',
        preferred_project_site: '',
        selected_skills: [],
        custom_skills: '',
        safety_induction_number: '',
        ewp_below_11m: false,
        ewp_above_11m: false,
        forklift_licence_number: '',
        work_safely_at_heights: '',
        scaffold_licence_number: '',
        first_aid_completion_date: '',
        workplace_impairment_training: '',
        wit_completion_date: '',
        asbestos_awareness_training: '',
        crystalline_silica_course: '',
        gender_equity_training: '',
        quantitative_fit_test: '',
        workcover_claim: '',
        medical_condition: '',
        medical_condition_other: '',
        references: [{ ...emptyReference }, { ...emptyReference }, { ...emptyReference }, { ...emptyReference }],
        acceptance_full_name: '',
        acceptance_email: '',
        acceptance_date: '',
        declaration_accepted: false,
    });

    const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
    const [processing] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    function setData<K extends keyof JobApplicationForm>(key: K, value: JobApplicationForm[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function setReference(index: number, field: keyof Reference, value: string) {
        setForm((prev) => {
            const refs = [...prev.references];
            refs[index] = { ...refs[index], [field]: value };
            return { ...prev, references: refs };
        });
    }

    function toggleSkill(skillId: number) {
        setForm((prev) => {
            const skills = prev.selected_skills.includes(skillId)
                ? prev.selected_skills.filter((id) => id !== skillId)
                : [...prev.selected_skills, skillId];
            return { ...prev, selected_skills: skills };
        });
    }

    function validateStep(currentStep: number): boolean {
        const newErrors: Partial<Record<string, string>> = {};

        if (currentStep === 0) {
            if (!form.surname.trim()) newErrors.surname = 'Surname is required';
            if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
            if (!form.suburb.trim()) newErrors.suburb = 'Suburb is required';
            if (!form.email.trim()) newErrors.email = 'Email is required';
            if (!form.phone.trim()) newErrors.phone = 'Phone is required';
            if (!form.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
            if (!form.why_should_we_employ_you.trim()) newErrors.why_should_we_employ_you = 'This field is required';
        }

        if (currentStep === 1) {
            if (!form.occupation) newErrors.occupation = 'Occupation is required';
            if (form.occupation === 'other' && !form.occupation_other.trim()) newErrors.occupation_other = 'Please specify your occupation';
        }

        if (currentStep === 2) {
            if (!form.safety_induction_number.trim()) newErrors.safety_induction_number = 'Safety induction number is required';
            if (!form.work_safely_at_heights) newErrors.work_safely_at_heights = 'This field is required';
            if (!form.workplace_impairment_training) newErrors.workplace_impairment_training = 'This field is required';
            if (!form.asbestos_awareness_training) newErrors.asbestos_awareness_training = 'This field is required';
            if (!form.crystalline_silica_course) newErrors.crystalline_silica_course = 'This field is required';
            if (!form.gender_equity_training) newErrors.gender_equity_training = 'This field is required';
            if (!form.quantitative_fit_test) newErrors.quantitative_fit_test = 'This field is required';
        }

        if (currentStep === 3) {
            for (let i = 0; i < 2; i++) {
                const ref = form.references[i];
                if (!ref.company_name.trim()) newErrors[`ref_${i}_company`] = 'Company name is required';
                if (!ref.position.trim()) newErrors[`ref_${i}_position`] = 'Position is required';
                if (!ref.employment_period.trim()) newErrors[`ref_${i}_period`] = 'Employment period is required';
                if (!ref.contact_person.trim()) newErrors[`ref_${i}_contact`] = 'Contact person is required';
                if (!ref.phone_number.trim()) newErrors[`ref_${i}_phone`] = 'Phone number is required';
            }
        }

        if (currentStep === 4) {
            if (!form.acceptance_full_name.trim()) newErrors.acceptance_full_name = 'Full name is required';
            if (!form.acceptance_email.trim()) newErrors.acceptance_email = 'Email is required';
            if (!form.acceptance_date) newErrors.acceptance_date = 'Date is required';
            if (!form.declaration_accepted) newErrors.declaration_accepted = 'You must accept the declaration';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function goNext() {
        if (validateStep(step)) {
            setStep((s) => Math.min(s + 1, STEPS.length - 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function goBack() {
        setErrors({});
        setStep((s) => Math.max(s - 1, 0));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!validateStep(step)) return;
        // TODO: connect to backend
        console.log('Form data:', form);
        setSubmitted(true);
    }

    if (submitted) {
        return (
            <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
                <div className="flex w-full max-w-2xl flex-col items-center gap-6">
                    <Link href="/" className="flex items-center gap-2 font-medium">
                        <AppLogoIcon className="size-9 fill-current text-black dark:text-white" />
                    </Link>
                    <Card className="w-full rounded-xl">
                        <CardContent className="flex flex-col items-center gap-4 py-16">
                            <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-full">
                                <CheckIcon className="size-8" />
                            </div>
                            <h2 className="text-2xl font-semibold">Application Submitted</h2>
                            <p className="text-muted-foreground text-center">
                                Thank you for your application. We will review it and get back to you shortly.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-muted flex min-h-svh flex-col items-center p-6 md:p-10">
            <div className="flex w-full max-w-2xl flex-col gap-6">
                <Link href="/" className="flex items-center gap-2 self-center font-medium">
                    <AppLogoIcon className="size-9 fill-current text-black dark:text-white" />
                </Link>

                {/* Step Indicator */}
                <div className="flex items-center justify-between px-2">
                    {STEPS.map((s, i) => (
                        <div key={i} className="flex items-center">
                            <div className="flex flex-col items-center gap-1.5">
                                <div
                                    className={cn(
                                        'flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                                        i < step && 'bg-primary border-primary text-primary-foreground',
                                        i === step && 'border-primary text-primary',
                                        i > step && 'border-muted-foreground/30 text-muted-foreground/50',
                                    )}
                                >
                                    {i < step ? <CheckIcon className="size-4" /> : i + 1}
                                </div>
                                <span
                                    className={cn(
                                        'hidden text-center text-xs font-medium sm:block',
                                        i === step ? 'text-primary' : 'text-muted-foreground',
                                    )}
                                >
                                    {s.shortLabel}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={cn('mx-1 h-0.5 w-6 sm:w-12', i < step ? 'bg-primary' : 'bg-muted-foreground/20')} />
                            )}
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Step 1: Personal Details */}
                    {step === 0 && (
                        <Card className="rounded-xl">
                            <CardHeader>
                                <CardTitle>Personal Details</CardTitle>
                                <CardDescription>Tell us about yourself</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="surname">
                                            Surname <span className="text-destructive">*</span>
                                        </Label>
                                        <Input id="surname" value={form.surname} onChange={(e) => setData('surname', e.target.value)} />
                                        <InputError message={errors.surname} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="first_name">
                                            First Name(s) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input id="first_name" value={form.first_name} onChange={(e) => setData('first_name', e.target.value)} />
                                        <InputError message={errors.first_name} />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="suburb">
                                        Suburb <span className="text-destructive">*</span>
                                    </Label>
                                    <Input id="suburb" value={form.suburb} onChange={(e) => setData('suburb', e.target.value)} />
                                    <InputError message={errors.suburb} />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">
                                            Email <span className="text-destructive">*</span>
                                        </Label>
                                        <Input id="email" type="email" value={form.email} onChange={(e) => setData('email', e.target.value)} />
                                        <InputError message={errors.email} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="phone">
                                            Phone <span className="text-destructive">*</span>
                                        </Label>
                                        <Input id="phone" type="tel" value={form.phone} onChange={(e) => setData('phone', e.target.value)} />
                                        <InputError message={errors.phone} />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="date_of_birth">
                                        Date of Birth <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="date_of_birth"
                                        type="date"
                                        value={form.date_of_birth}
                                        onChange={(e) => setData('date_of_birth', e.target.value)}
                                    />
                                    <InputError message={errors.date_of_birth} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="why_should_we_employ_you">
                                        Why should we employ you? <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id="why_should_we_employ_you"
                                        value={form.why_should_we_employ_you}
                                        onChange={(e) => setData('why_should_we_employ_you', e.target.value)}
                                    />
                                    <InputError message={errors.why_should_we_employ_you} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="referred_by">Did someone refer you to this page?</Label>
                                    <Input id="referred_by" value={form.referred_by} onChange={(e) => setData('referred_by', e.target.value)} />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Are you of Aboriginal or Torres Strait Islander Origin?</Label>
                                    <RadioGroup value={form.aboriginal_or_tsi} onValueChange={(v) => setData('aboriginal_or_tsi', v)}>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="yes" id="atsi_yes" />
                                            <Label htmlFor="atsi_yes" className="font-normal">
                                                Yes
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="no" id="atsi_no" />
                                            <Label htmlFor="atsi_no" className="font-normal">
                                                No
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 2: Occupation & Skills */}
                    {step === 1 && (
                        <div className="flex flex-col gap-6">
                            <Card className="rounded-xl">
                                <CardHeader>
                                    <CardTitle>Occupation</CardTitle>
                                    <CardDescription>Your trade and qualifications</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label>
                                            Occupation <span className="text-destructive">*</span>
                                        </Label>
                                        <Select value={form.occupation} onValueChange={(v) => setData('occupation', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select your occupation" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {occupations.map((occ) => (
                                                    <SelectItem key={occ.value} value={occ.value}>
                                                        {occ.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.occupation} />
                                    </div>

                                    {form.occupation === 'other' && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="occupation_other">
                                                Please Specify <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="occupation_other"
                                                value={form.occupation_other}
                                                onChange={(e) => setData('occupation_other', e.target.value)}
                                            />
                                            <InputError message={errors.occupation_other} />
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label>Apprentice Year</Label>
                                        <Select value={form.apprentice_year} onValueChange={(v) => setData('apprentice_year', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Not an apprentice" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Not an apprentice</SelectItem>
                                                <SelectItem value="1">1st Year</SelectItem>
                                                <SelectItem value="2">2nd Year</SelectItem>
                                                <SelectItem value="3">3rd Year</SelectItem>
                                                <SelectItem value="4">4th Year</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Trade Qualified</Label>
                                        <RadioGroup value={form.trade_qualified} onValueChange={(v) => setData('trade_qualified', v)}>
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="yes" id="tq_yes" />
                                                <Label htmlFor="tq_yes" className="font-normal">
                                                    Yes
                                                </Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="no" id="tq_no" />
                                                <Label htmlFor="tq_no" className="font-normal">
                                                    No
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="preferred_project_site">Preferred Project/Site</Label>
                                        <Input
                                            id="preferred_project_site"
                                            value={form.preferred_project_site}
                                            onChange={(e) => setData('preferred_project_site', e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-xl">
                                <CardHeader>
                                    <CardTitle>Skills</CardTitle>
                                    <CardDescription>Select all that apply</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {availableSkills.map((skill) => (
                                            <div key={skill.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`skill_${skill.id}`}
                                                    checked={form.selected_skills.includes(skill.id)}
                                                    onCheckedChange={() => toggleSkill(skill.id)}
                                                />
                                                <Label htmlFor={`skill_${skill.id}`} className="font-normal">
                                                    {skill.name}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="custom_skills">Other Skills (please specify)</Label>
                                        <Textarea
                                            id="custom_skills"
                                            value={form.custom_skills}
                                            onChange={(e) => setData('custom_skills', e.target.value)}
                                            placeholder="Enter any additional skills..."
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Step 3: Licences & Tickets */}
                    {step === 2 && (
                        <Card className="rounded-xl">
                            <CardHeader>
                                <CardTitle>Licence & Ticket Details</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="safety_induction_number">
                                        Building Industry General Safety Induction Number <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="safety_induction_number"
                                        value={form.safety_induction_number}
                                        onChange={(e) => setData('safety_induction_number', e.target.value)}
                                    />
                                    <InputError message={errors.safety_induction_number} />
                                </div>

                                <div className="grid gap-2">
                                    <Label>EWP Operator Licence</Label>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="ewp_below_11m"
                                                checked={form.ewp_below_11m}
                                                onCheckedChange={(checked) => setData('ewp_below_11m', checked === true)}
                                            />
                                            <Label htmlFor="ewp_below_11m" className="font-normal">
                                                Below 11m
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="ewp_above_11m"
                                                checked={form.ewp_above_11m}
                                                onCheckedChange={(checked) => setData('ewp_above_11m', checked === true)}
                                            />
                                            <Label htmlFor="ewp_above_11m" className="font-normal">
                                                Above 11m (high risk)
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="forklift_licence_number">Fork Lift Licence Number</Label>
                                    <Input
                                        id="forklift_licence_number"
                                        value={form.forklift_licence_number}
                                        onChange={(e) => setData('forklift_licence_number', e.target.value)}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>
                                        Work Safely at Heights Training <span className="text-destructive">*</span>
                                    </Label>
                                    <RadioGroup value={form.work_safely_at_heights} onValueChange={(v) => setData('work_safely_at_heights', v)}>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="yes" id="heights_yes" />
                                            <Label htmlFor="heights_yes" className="font-normal">
                                                Yes
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="no" id="heights_no" />
                                            <Label htmlFor="heights_no" className="font-normal">
                                                No
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                    <InputError message={errors.work_safely_at_heights} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="scaffold_licence_number">Scaffold Licence Number</Label>
                                    <Input
                                        id="scaffold_licence_number"
                                        value={form.scaffold_licence_number}
                                        onChange={(e) => setData('scaffold_licence_number', e.target.value)}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="first_aid_completion_date">First Aid Certificate Completion Date</Label>
                                    <Input
                                        id="first_aid_completion_date"
                                        type="date"
                                        value={form.first_aid_completion_date}
                                        onChange={(e) => setData('first_aid_completion_date', e.target.value)}
                                    />
                                </div>

                                <Separator />

                                <div className="grid gap-2">
                                    <Label>
                                        Workplace Impairment Training (WIT) <span className="text-destructive">*</span>
                                    </Label>
                                    <RadioGroup
                                        value={form.workplace_impairment_training}
                                        onValueChange={(v) => setData('workplace_impairment_training', v)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="yes" id="wit_yes" />
                                            <Label htmlFor="wit_yes" className="font-normal">
                                                Yes
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="no" id="wit_no" />
                                            <Label htmlFor="wit_no" className="font-normal">
                                                No
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                    <InputError message={errors.workplace_impairment_training} />
                                </div>

                                {form.workplace_impairment_training === 'yes' && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="wit_completion_date">WIT Completion Date</Label>
                                        <Input
                                            id="wit_completion_date"
                                            type="date"
                                            value={form.wit_completion_date}
                                            onChange={(e) => setData('wit_completion_date', e.target.value)}
                                        />
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label>
                                        Asbestos Awareness Training <span className="text-destructive">*</span>
                                    </Label>
                                    <RadioGroup
                                        value={form.asbestos_awareness_training}
                                        onValueChange={(v) => setData('asbestos_awareness_training', v)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="yes" id="asbestos_yes" />
                                            <Label htmlFor="asbestos_yes" className="font-normal">
                                                Yes
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="no" id="asbestos_no" />
                                            <Label htmlFor="asbestos_no" className="font-normal">
                                                No
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                    <InputError message={errors.asbestos_awareness_training} />
                                </div>

                                <div className="grid gap-2">
                                    <Label>
                                        10830NAT Crystalline Silica Course <span className="text-destructive">*</span>
                                    </Label>
                                    <RadioGroup
                                        value={form.crystalline_silica_course}
                                        onValueChange={(v) => setData('crystalline_silica_course', v)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="yes" id="silica_yes" />
                                            <Label htmlFor="silica_yes" className="font-normal">
                                                Yes
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="no" id="silica_no" />
                                            <Label htmlFor="silica_no" className="font-normal">
                                                No
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                    <InputError message={errors.crystalline_silica_course} />
                                </div>

                                <div className="grid gap-2">
                                    <Label>
                                        Gender Equity Training <span className="text-destructive">*</span>
                                    </Label>
                                    <RadioGroup value={form.gender_equity_training} onValueChange={(v) => setData('gender_equity_training', v)}>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="yes" id="gender_yes" />
                                            <Label htmlFor="gender_yes" className="font-normal">
                                                Yes
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="no" id="gender_no" />
                                            <Label htmlFor="gender_no" className="font-normal">
                                                No
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                    <InputError message={errors.gender_equity_training} />
                                </div>

                                <div className="grid gap-2">
                                    <Label>
                                        Quantitative Fit Test <span className="text-destructive">*</span>
                                    </Label>
                                    <RadioGroup value={form.quantitative_fit_test} onValueChange={(v) => setData('quantitative_fit_test', v)}>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="quantitative" id="fit_quant" />
                                            <Label htmlFor="fit_quant" className="font-normal">
                                                Quantitative
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="no_fit_test" id="fit_none" />
                                            <Label htmlFor="fit_none" className="font-normal">
                                                No fit test completed
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                    <InputError message={errors.quantitative_fit_test} />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 4: References */}
                    {step === 3 && (
                        <Card className="rounded-xl">
                            <CardHeader>
                                <CardTitle>Employment References</CardTitle>
                                <CardDescription>Please provide at least 2 employment references</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                {form.references.map((ref, index) => (
                                    <div key={index}>
                                        {index > 0 && <Separator className="mb-6" />}
                                        <h4 className="mb-3 text-sm font-medium">
                                            Reference {index + 1} {index < 2 && <span className="text-destructive">*</span>}
                                        </h4>
                                        <div className="grid gap-3">
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor={`ref_company_${index}`}>Company Name</Label>
                                                    <Input
                                                        id={`ref_company_${index}`}
                                                        value={ref.company_name}
                                                        onChange={(e) => setReference(index, 'company_name', e.target.value)}
                                                    />
                                                    <InputError message={errors[`ref_${index}_company`]} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor={`ref_position_${index}`}>Position</Label>
                                                    <Input
                                                        id={`ref_position_${index}`}
                                                        value={ref.position}
                                                        onChange={(e) => setReference(index, 'position', e.target.value)}
                                                    />
                                                    <InputError message={errors[`ref_${index}_position`]} />
                                                </div>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor={`ref_period_${index}`}>Employment Period</Label>
                                                <Input
                                                    id={`ref_period_${index}`}
                                                    value={ref.employment_period}
                                                    onChange={(e) => setReference(index, 'employment_period', e.target.value)}
                                                />
                                                <InputError message={errors[`ref_${index}_period`]} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor={`ref_contact_${index}`}>Contact Person</Label>
                                                    <Input
                                                        id={`ref_contact_${index}`}
                                                        value={ref.contact_person}
                                                        onChange={(e) => setReference(index, 'contact_person', e.target.value)}
                                                    />
                                                    <InputError message={errors[`ref_${index}_contact`]} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor={`ref_phone_${index}`}>Phone Number</Label>
                                                    <Input
                                                        id={`ref_phone_${index}`}
                                                        type="tel"
                                                        value={ref.phone_number}
                                                        onChange={(e) => setReference(index, 'phone_number', e.target.value)}
                                                    />
                                                    <InputError message={errors[`ref_${index}_phone`]} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 5: Medical & Declaration */}
                    {step === 4 && (
                        <div className="flex flex-col gap-6">
                            <Card className="rounded-xl">
                                <CardHeader>
                                    <CardTitle>Medical History</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label>Workcover Claim (last 2 years)</Label>
                                        <RadioGroup value={form.workcover_claim} onValueChange={(v) => setData('workcover_claim', v)}>
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="yes" id="wc_yes" />
                                                <Label htmlFor="wc_yes" className="font-normal">
                                                    Yes
                                                </Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="no" id="wc_no" />
                                                <Label htmlFor="wc_no" className="font-normal">
                                                    No
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Medical or Physical Condition</Label>
                                        <Select value={form.medical_condition} onValueChange={(v) => setData('medical_condition', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select if applicable" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="back">Back condition</SelectItem>
                                                <SelectItem value="knee">Knee condition</SelectItem>
                                                <SelectItem value="shoulder">Shoulder condition</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {form.medical_condition === 'other' && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="medical_condition_other">Please specify</Label>
                                            <Input
                                                id="medical_condition_other"
                                                value={form.medical_condition_other}
                                                onChange={(e) => setData('medical_condition_other', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="rounded-xl">
                                <CardHeader>
                                    <CardTitle>Declaration & Acceptance</CardTitle>
                                    <CardDescription>
                                        I declare that the information provided in this application is true and correct. I understand that
                                        providing false or misleading information may result in termination of employment.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="acceptance_full_name">
                                                Full Name <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="acceptance_full_name"
                                                value={form.acceptance_full_name}
                                                onChange={(e) => setData('acceptance_full_name', e.target.value)}
                                            />
                                            <InputError message={errors.acceptance_full_name} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="acceptance_email">
                                                Email Address <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="acceptance_email"
                                                type="email"
                                                value={form.acceptance_email}
                                                onChange={(e) => setData('acceptance_email', e.target.value)}
                                            />
                                            <InputError message={errors.acceptance_email} />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="acceptance_date">
                                            Date <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="acceptance_date"
                                            type="date"
                                            value={form.acceptance_date}
                                            onChange={(e) => setData('acceptance_date', e.target.value)}
                                        />
                                        <InputError message={errors.acceptance_date} />
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <Checkbox
                                            id="declaration_accepted"
                                            checked={form.declaration_accepted}
                                            onCheckedChange={(checked) => setData('declaration_accepted', checked === true)}
                                        />
                                        <Label htmlFor="declaration_accepted" className="font-normal leading-snug">
                                            I confirm that the above information is true and correct to the best of my knowledge{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                    </div>
                                    <InputError message={errors.declaration_accepted} />
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-6 flex gap-3">
                        {step > 0 && (
                            <Button type="button" variant="outline" onClick={goBack} className="flex-1">
                                Back
                            </Button>
                        )}
                        {step < STEPS.length - 1 ? (
                            <Button type="button" onClick={goNext} className="flex-1">
                                Continue
                            </Button>
                        ) : (
                            <Button type="submit" className="flex-1" disabled={processing || !form.declaration_accepted}>
                                Submit Application
                            </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
