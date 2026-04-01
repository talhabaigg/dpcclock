import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { useForm } from '@inertiajs/react';
import { CheckIcon } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface Skill {
    id: number;
    name: string;
}

interface Props {
    skills: Skill[];
    recaptchaSiteKey: string | null;
}

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

function SectionHeader({ title, description }: { title: string; description?: string }) {
    return (
        <div className="mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">{title}</h2>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
    );
}

/* Touch-friendly wrapper for radio/checkbox rows — 44px min tap target */
function TouchRow({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('flex min-h-[44px] items-center gap-3', className)}>{children}</div>;
}

declare global {
    interface Window {
        grecaptcha: {
            ready: (cb: () => void) => void;
            execute: (siteKey: string, options: { action: string }) => Promise<string>;
        };
    }
}

export default function Apply({ skills, recaptchaSiteKey }: Props) {
    const [step, setStep] = useState(0);
    const recaptchaLoaded = useRef(false);

    // Force light mode on public-facing form
    useEffect(() => {
        document.documentElement.classList.remove('dark');
        return () => {
            // Restore theme on unmount (in case of SPA navigation)
            const saved = localStorage.getItem('appearance') as string | null;
            if (saved === 'dark' || ((!saved || saved === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            }
        };
    }, []);

    // Load reCAPTCHA v3 script
    useEffect(() => {
        if (!recaptchaSiteKey || recaptchaLoaded.current) return;
        recaptchaLoaded.current = true;
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
        script.async = true;
        document.head.appendChild(script);
    }, [recaptchaSiteKey]);

    const { data, setData, post, processing, errors, transform } = useForm({
        // Personal
        surname: '',
        first_name: '',
        suburb: '',
        email: '',
        phone: '',
        date_of_birth: '',
        why_should_we_employ_you: '',
        referred_by: '',
        aboriginal_or_tsi: '',
        // Occupation
        occupation: '',
        apprentice_year: '',
        trade_qualified: '',
        occupation_other: '',
        // Project
        preferred_project_site: '',
        // Skills
        selected_skills: [] as number[],
        custom_skills: '',
        // Licences
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
        // Medical
        workcover_claim: '',
        medical_condition: '',
        medical_condition_other: '',
        // References
        references: [{ ...emptyReference }, { ...emptyReference }, { ...emptyReference }, { ...emptyReference }],
        // Acceptance
        acceptance_full_name: '',
        acceptance_email: '',
        acceptance_date: '',
        declaration_accepted: false,
    });

    const [clientErrors, setClientErrors] = useState<Partial<Record<string, string>>>({});

    function setReference(index: number, field: keyof Reference, value: string) {
        const refs = [...data.references];
        refs[index] = { ...refs[index], [field]: value };
        setData('references', refs);
    }

    function toggleSkill(skillId: number) {
        const skills = data.selected_skills.includes(skillId)
            ? data.selected_skills.filter((id) => id !== skillId)
            : [...data.selected_skills, skillId];
        setData('selected_skills', skills);
    }

    function validateStep(currentStep: number): boolean {
        const newErrors: Partial<Record<string, string>> = {};

        if (currentStep === 0) {
            if (!data.surname.trim()) newErrors.surname = 'Surname is required';
            if (!data.first_name.trim()) newErrors.first_name = 'First name is required';
            if (!data.suburb.trim()) newErrors.suburb = 'Suburb is required';
            if (!data.email.trim()) newErrors.email = 'Email is required';
            if (!data.phone.trim()) newErrors.phone = 'Phone is required';
            if (!data.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
            if (!data.why_should_we_employ_you.trim()) newErrors.why_should_we_employ_you = 'This field is required';
        }

        if (currentStep === 1) {
            if (!data.occupation) newErrors.occupation = 'Occupation is required';
            if (data.occupation === 'other' && !data.occupation_other.trim()) newErrors.occupation_other = 'Please specify your occupation';
        }

        if (currentStep === 2) {
            if (!data.safety_induction_number.trim()) newErrors.safety_induction_number = 'Safety induction number is required';
            if (!data.work_safely_at_heights) newErrors.work_safely_at_heights = 'This field is required';
            if (!data.workplace_impairment_training) newErrors.workplace_impairment_training = 'This field is required';
            if (!data.asbestos_awareness_training) newErrors.asbestos_awareness_training = 'This field is required';
            if (!data.crystalline_silica_course) newErrors.crystalline_silica_course = 'This field is required';
            if (!data.gender_equity_training) newErrors.gender_equity_training = 'This field is required';
            if (!data.quantitative_fit_test) newErrors.quantitative_fit_test = 'This field is required';
        }

        if (currentStep === 3) {
            for (let i = 0; i < 2; i++) {
                const ref = data.references[i];
                if (!ref.company_name.trim()) newErrors[`ref_${i}_company`] = 'Company name is required';
                if (!ref.position.trim()) newErrors[`ref_${i}_position`] = 'Position is required';
                if (!ref.employment_period.trim()) newErrors[`ref_${i}_period`] = 'Employment period is required';
                if (!ref.contact_person.trim()) newErrors[`ref_${i}_contact`] = 'Contact person is required';
                if (!ref.phone_number.trim()) newErrors[`ref_${i}_phone`] = 'Phone number is required';
            }
        }

        if (currentStep === 4) {
            if (!data.acceptance_full_name.trim()) newErrors.acceptance_full_name = 'Full name is required';
            if (!data.acceptance_email.trim()) newErrors.acceptance_email = 'Email is required';
            if (!data.acceptance_date) newErrors.acceptance_date = 'Date is required';
            if (!data.declaration_accepted) newErrors.declaration_accepted = 'You must accept the declaration';
        }

        setClientErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function goNext() {
        if (validateStep(step)) {
            setStep((s) => Math.min(s + 1, STEPS.length - 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function goBack() {
        setClientErrors({});
        setStep((s) => Math.max(s - 1, 0));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!validateStep(step)) return;

        let recaptchaToken = '';
        if (recaptchaSiteKey && window.grecaptcha) {
            try {
                recaptchaToken = await window.grecaptcha.execute(recaptchaSiteKey, { action: 'employment_application' });
            } catch {
                // If reCAPTCHA fails client-side, still submit — server will reject if required
            }
        }

        transform((d) => {
            const transformed: Record<string, unknown> = { ...d, recaptcha_token: recaptchaToken };

            // Convert "yes"/"no" radio values to real booleans for Laravel's boolean rule
            const booleanRadioFields = [
                'aboriginal_or_tsi', 'trade_qualified', 'work_safely_at_heights',
                'workplace_impairment_training', 'asbestos_awareness_training',
                'crystalline_silica_course', 'gender_equity_training', 'workcover_claim',
            ];
            for (const field of booleanRadioFields) {
                if (transformed[field] === 'yes') transformed[field] = true;
                else if (transformed[field] === 'no') transformed[field] = false;
                else if (transformed[field] === '') transformed[field] = null;
            }

            // Clean apprentice_year — "none" or empty should be null
            if (transformed.apprentice_year === '' || transformed.apprentice_year === 'none') {
                transformed.apprentice_year = null;
            }

            // Strip empty optional references (3rd & 4th) so they don't fail required sub-field validation
            transformed.references = (d.references as Reference[]).filter(
                (ref, i) => i < 2 || ref.company_name.trim() !== '' || ref.contact_person.trim() !== '',
            );

            return transformed;
        });
        post(route('employment-applications.store'));
    }

    // Merge client-side and server-side errors
    const allErrors = { ...clientErrors, ...errors };

    return (
        <div className="flex min-h-svh flex-col items-center bg-white px-3 py-6 font-[system-ui,_-apple-system,_sans-serif] sm:px-4 sm:py-8 md:px-8 md:py-12">
            <div className="flex w-full max-w-2xl flex-col gap-6 sm:gap-8">
                {/* Step Indicator */}
                <div className="flex items-center justify-between">
                    {STEPS.map((s, i) => (
                        <div key={i} className="flex items-center">
                            <div className="flex flex-col items-center gap-1.5">
                                <div
                                    className={cn(
                                        'flex size-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                                        i < step && 'border-[#2e6da4] bg-[#2e6da4] text-white',
                                        i === step && 'border-[#2e6da4] text-[#2e6da4]',
                                        i > step && 'border-gray-300 text-gray-400',
                                    )}
                                >
                                    {i < step ? <CheckIcon className="size-4" /> : i + 1}
                                </div>
                                <span
                                    className={cn(
                                        'hidden text-center text-xs font-medium sm:block',
                                        i === step ? 'text-[#2e6da4]' : 'text-gray-400',
                                    )}
                                >
                                    {s.shortLabel}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={cn('mx-1.5 h-0.5 w-8 sm:w-14', i < step ? 'bg-[#2e6da4]' : 'bg-gray-200')} />
                            )}
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Server-side validation errors that may be on other steps */}
                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4">
                            <p className="text-sm font-medium text-red-800">Please fix the following errors:</p>
                            <ul className="mt-2 list-inside list-disc text-sm text-red-700">
                                {Object.entries(errors).map(([key, message]) => (
                                    <li key={key}>{message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Step 1: Personal Details */}
                    {step === 0 && (
                        <div className="rounded-sm border border-gray-200 bg-white p-6 sm:p-8">
                            <SectionHeader title="Personal Details" description="Tell us about yourself" />

                            <div className="grid gap-5">
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="surname" className="text-sm font-medium text-gray-700">
                                            Surname <span className="text-red-500">*</span>
                                        </Label>
                                        <Input id="surname" className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm" value={data.surname} onChange={(e) => setData('surname', e.target.value)} />
                                        <InputError message={allErrors.surname} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                                            First Name(s) <span className="text-red-500">*</span>
                                        </Label>
                                        <Input id="first_name" className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm" value={data.first_name} onChange={(e) => setData('first_name', e.target.value)} />
                                        <InputError message={allErrors.first_name} />
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="suburb" className="text-sm font-medium text-gray-700">
                                        Suburb <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="suburb" className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm" value={data.suburb} onChange={(e) => setData('suburb', e.target.value)} />
                                    <InputError message={allErrors.suburb} />
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                            Email <span className="text-red-500">*</span>
                                        </Label>
                                        <Input id="email" type="email" className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                                        <InputError message={allErrors.email} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                                            Phone <span className="text-red-500">*</span>
                                        </Label>
                                        <Input id="phone" type="tel" className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm" value={data.phone} onChange={(e) => setData('phone', e.target.value)} />
                                        <InputError message={allErrors.phone} />
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="date_of_birth" className="text-sm font-medium text-gray-700">
                                        Date of Birth <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="date_of_birth"
                                        type="date"
                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                        value={data.date_of_birth}
                                        onChange={(e) => setData('date_of_birth', e.target.value)}
                                    />
                                    <InputError message={allErrors.date_of_birth} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="why_should_we_employ_you" className="text-sm font-medium text-gray-700">
                                        Why should we employ you? <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="why_should_we_employ_you"
                                        className="border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:text-sm"
                                        value={data.why_should_we_employ_you}
                                        onChange={(e) => setData('why_should_we_employ_you', e.target.value)}
                                    />
                                    <InputError message={allErrors.why_should_we_employ_you} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="referred_by" className="text-sm font-medium text-gray-700">Did someone refer you to this page?</Label>
                                    <Input id="referred_by" className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm" value={data.referred_by} onChange={(e) => setData('referred_by', e.target.value)} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Are you of Aboriginal or Torres Strait Islander Origin?</Label>
                                    <RadioGroup value={data.aboriginal_or_tsi} onValueChange={(v) => setData('aboriginal_or_tsi', v)}>
                                        <TouchRow>
                                            <RadioGroupItem value="yes" id="atsi_yes" />
                                            <Label htmlFor="atsi_yes" className="font-normal text-gray-600">Yes</Label>
                                        </TouchRow>
                                        <TouchRow>
                                            <RadioGroupItem value="no" id="atsi_no" />
                                            <Label htmlFor="atsi_no" className="font-normal text-gray-600">No</Label>
                                        </TouchRow>
                                    </RadioGroup>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Occupation & Skills */}
                    {step === 1 && (
                        <div className="flex flex-col gap-8">
                            <div className="rounded-sm border border-gray-200 bg-white p-6 sm:p-8">
                                <SectionHeader title="Occupation" description="Your trade and qualifications" />

                                <div className="grid gap-5">
                                    <div className="grid gap-1.5">
                                        <Label className="text-sm font-medium text-gray-700">
                                            Occupation <span className="text-red-500">*</span>
                                        </Label>
                                        <Select value={data.occupation} onValueChange={(v) => setData('occupation', v)}>
                                            <SelectTrigger className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm">
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
                                        <InputError message={allErrors.occupation} />
                                    </div>

                                    {data.occupation === 'other' && (
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="occupation_other" className="text-sm font-medium text-gray-700">
                                                Please Specify <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="occupation_other"
                                                className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                value={data.occupation_other}
                                                onChange={(e) => setData('occupation_other', e.target.value)}
                                            />
                                            <InputError message={allErrors.occupation_other} />
                                        </div>
                                    )}

                                    <div className="grid gap-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Apprentice Year</Label>
                                        <Select value={data.apprentice_year} onValueChange={(v) => setData('apprentice_year', v)}>
                                            <SelectTrigger className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm">
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

                                    <div className="grid gap-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Trade Qualified</Label>
                                        <RadioGroup value={data.trade_qualified} onValueChange={(v) => setData('trade_qualified', v)}>
                                            <TouchRow>
                                                <RadioGroupItem value="yes" id="tq_yes" />
                                                <Label htmlFor="tq_yes" className="font-normal text-gray-600">Yes</Label>
                                            </TouchRow>
                                            <TouchRow>
                                                <RadioGroupItem value="no" id="tq_no" />
                                                <Label htmlFor="tq_no" className="font-normal text-gray-600">No</Label>
                                            </TouchRow>
                                        </RadioGroup>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label htmlFor="preferred_project_site" className="text-sm font-medium text-gray-700">Preferred Project/Site</Label>
                                        <Input
                                            id="preferred_project_site"
                                            className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                            value={data.preferred_project_site}
                                            onChange={(e) => setData('preferred_project_site', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-sm border border-gray-200 bg-white p-6 sm:p-8">
                                <SectionHeader title="Skills" description="Select all that apply" />

                                <div className="grid gap-5">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {skills.map((skill) => (
                                            <div key={skill.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`skill_${skill.id}`}
                                                    checked={data.selected_skills.includes(skill.id)}
                                                    onCheckedChange={() => toggleSkill(skill.id)}
                                                />
                                                <Label htmlFor={`skill_${skill.id}`} className="font-normal text-gray-600">
                                                    {skill.name}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label htmlFor="custom_skills" className="text-sm font-medium text-gray-700">Other Skills (please specify)</Label>
                                        <Textarea
                                            id="custom_skills"
                                            className="border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:text-sm"
                                            value={data.custom_skills}
                                            onChange={(e) => setData('custom_skills', e.target.value)}
                                            placeholder="Enter any additional skills, separated by commas..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Licences & Tickets */}
                    {step === 2 && (
                        <div className="rounded-sm border border-gray-200 bg-white p-6 sm:p-8">
                            <SectionHeader title="Licence & Ticket Details" />

                            <div className="grid gap-5">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="safety_induction_number" className="text-sm font-medium text-gray-700">
                                        Building Industry General Safety Induction Number <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="safety_induction_number"
                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                        value={data.safety_induction_number}
                                        onChange={(e) => setData('safety_induction_number', e.target.value)}
                                    />
                                    <InputError message={allErrors.safety_induction_number} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">EWP Operator Licence</Label>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="ewp_below_11m"
                                                checked={data.ewp_below_11m}
                                                onCheckedChange={(checked) => setData('ewp_below_11m', checked === true)}
                                            />
                                            <Label htmlFor="ewp_below_11m" className="font-normal text-gray-600">Below 11m</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="ewp_above_11m"
                                                checked={data.ewp_above_11m}
                                                onCheckedChange={(checked) => setData('ewp_above_11m', checked === true)}
                                            />
                                            <Label htmlFor="ewp_above_11m" className="font-normal text-gray-600">Above 11m (high risk)</Label>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="forklift_licence_number" className="text-sm font-medium text-gray-700">Fork Lift Licence Number</Label>
                                    <Input
                                        id="forklift_licence_number"
                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                        value={data.forklift_licence_number}
                                        onChange={(e) => setData('forklift_licence_number', e.target.value)}
                                    />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Work Safely at Heights Training <span className="text-red-500">*</span>
                                    </Label>
                                    <RadioGroup value={data.work_safely_at_heights} onValueChange={(v) => setData('work_safely_at_heights', v)}>
                                        <TouchRow>
                                            <RadioGroupItem value="yes" id="heights_yes" />
                                            <Label htmlFor="heights_yes" className="font-normal text-gray-600">Yes</Label>
                                        </TouchRow>
                                        <TouchRow>
                                            <RadioGroupItem value="no" id="heights_no" />
                                            <Label htmlFor="heights_no" className="font-normal text-gray-600">No</Label>
                                        </TouchRow>
                                    </RadioGroup>
                                    <InputError message={allErrors.work_safely_at_heights} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="scaffold_licence_number" className="text-sm font-medium text-gray-700">Scaffold Licence Number</Label>
                                    <Input
                                        id="scaffold_licence_number"
                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                        value={data.scaffold_licence_number}
                                        onChange={(e) => setData('scaffold_licence_number', e.target.value)}
                                    />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="first_aid_completion_date" className="text-sm font-medium text-gray-700">First Aid Certificate Completion Date</Label>
                                    <Input
                                        id="first_aid_completion_date"
                                        type="date"
                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                        value={data.first_aid_completion_date}
                                        onChange={(e) => setData('first_aid_completion_date', e.target.value)}
                                    />
                                </div>

                                <hr className="border-gray-200" />

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Workplace Impairment Training (WIT) <span className="text-red-500">*</span>
                                    </Label>
                                    <RadioGroup
                                        value={data.workplace_impairment_training}
                                        onValueChange={(v) => setData('workplace_impairment_training', v)}
                                    >
                                        <TouchRow>
                                            <RadioGroupItem value="yes" id="wit_yes" />
                                            <Label htmlFor="wit_yes" className="font-normal text-gray-600">Yes</Label>
                                        </TouchRow>
                                        <TouchRow>
                                            <RadioGroupItem value="no" id="wit_no" />
                                            <Label htmlFor="wit_no" className="font-normal text-gray-600">No</Label>
                                        </TouchRow>
                                    </RadioGroup>
                                    <InputError message={allErrors.workplace_impairment_training} />
                                </div>

                                {data.workplace_impairment_training === 'yes' && (
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="wit_completion_date" className="text-sm font-medium text-gray-700">WIT Completion Date</Label>
                                        <Input
                                            id="wit_completion_date"
                                            type="date"
                                            className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                            value={data.wit_completion_date}
                                            onChange={(e) => setData('wit_completion_date', e.target.value)}
                                        />
                                    </div>
                                )}

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Asbestos Awareness Training <span className="text-red-500">*</span>
                                    </Label>
                                    <RadioGroup
                                        value={data.asbestos_awareness_training}
                                        onValueChange={(v) => setData('asbestos_awareness_training', v)}
                                    >
                                        <TouchRow>
                                            <RadioGroupItem value="yes" id="asbestos_yes" />
                                            <Label htmlFor="asbestos_yes" className="font-normal text-gray-600">Yes</Label>
                                        </TouchRow>
                                        <TouchRow>
                                            <RadioGroupItem value="no" id="asbestos_no" />
                                            <Label htmlFor="asbestos_no" className="font-normal text-gray-600">No</Label>
                                        </TouchRow>
                                    </RadioGroup>
                                    <InputError message={allErrors.asbestos_awareness_training} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">
                                        10830NAT Crystalline Silica Course <span className="text-red-500">*</span>
                                    </Label>
                                    <RadioGroup
                                        value={data.crystalline_silica_course}
                                        onValueChange={(v) => setData('crystalline_silica_course', v)}
                                    >
                                        <TouchRow>
                                            <RadioGroupItem value="yes" id="silica_yes" />
                                            <Label htmlFor="silica_yes" className="font-normal text-gray-600">Yes</Label>
                                        </TouchRow>
                                        <TouchRow>
                                            <RadioGroupItem value="no" id="silica_no" />
                                            <Label htmlFor="silica_no" className="font-normal text-gray-600">No</Label>
                                        </TouchRow>
                                    </RadioGroup>
                                    <InputError message={allErrors.crystalline_silica_course} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Gender Equity Training <span className="text-red-500">*</span>
                                    </Label>
                                    <RadioGroup value={data.gender_equity_training} onValueChange={(v) => setData('gender_equity_training', v)}>
                                        <TouchRow>
                                            <RadioGroupItem value="yes" id="gender_yes" />
                                            <Label htmlFor="gender_yes" className="font-normal text-gray-600">Yes</Label>
                                        </TouchRow>
                                        <TouchRow>
                                            <RadioGroupItem value="no" id="gender_no" />
                                            <Label htmlFor="gender_no" className="font-normal text-gray-600">No</Label>
                                        </TouchRow>
                                    </RadioGroup>
                                    <InputError message={allErrors.gender_equity_training} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Quantitative Fit Test <span className="text-red-500">*</span>
                                    </Label>
                                    <RadioGroup value={data.quantitative_fit_test} onValueChange={(v) => setData('quantitative_fit_test', v)}>
                                        <TouchRow>
                                            <RadioGroupItem value="quantitative" id="fit_quant" />
                                            <Label htmlFor="fit_quant" className="font-normal text-gray-600">Quantitative</Label>
                                        </TouchRow>
                                        <TouchRow>
                                            <RadioGroupItem value="no_fit_test" id="fit_none" />
                                            <Label htmlFor="fit_none" className="font-normal text-gray-600">No fit test completed</Label>
                                        </TouchRow>
                                    </RadioGroup>
                                    <InputError message={allErrors.quantitative_fit_test} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: References */}
                    {step === 3 && (
                        <div className="rounded-sm border border-gray-200 bg-white p-6 sm:p-8">
                            <SectionHeader title="Employment References" description="Please provide at least 2 employment references" />

                            <div className="grid gap-8">
                                {data.references.map((ref, index) => (
                                    <div key={index}>
                                        {index > 0 && <hr className="mb-8 border-gray-200" />}
                                        <h4 className="mb-4 text-sm font-semibold text-gray-700">
                                            Reference {index + 1} {index < 2 && <span className="text-red-500">*</span>}
                                        </h4>
                                        <div className="grid gap-4">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor={`ref_company_${index}`} className="text-sm font-medium text-gray-700">Company Name</Label>
                                                    <Input
                                                        id={`ref_company_${index}`}
                                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                        value={ref.company_name}
                                                        onChange={(e) => setReference(index, 'company_name', e.target.value)}
                                                    />
                                                    <InputError message={allErrors[`ref_${index}_company`]} />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor={`ref_position_${index}`} className="text-sm font-medium text-gray-700">Position</Label>
                                                    <Input
                                                        id={`ref_position_${index}`}
                                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                        value={ref.position}
                                                        onChange={(e) => setReference(index, 'position', e.target.value)}
                                                    />
                                                    <InputError message={allErrors[`ref_${index}_position`]} />
                                                </div>
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor={`ref_period_${index}`} className="text-sm font-medium text-gray-700">Employment Period</Label>
                                                <Input
                                                    id={`ref_period_${index}`}
                                                    className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                    value={ref.employment_period}
                                                    onChange={(e) => setReference(index, 'employment_period', e.target.value)}
                                                />
                                                <InputError message={allErrors[`ref_${index}_period`]} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor={`ref_contact_${index}`} className="text-sm font-medium text-gray-700">Contact Person</Label>
                                                    <Input
                                                        id={`ref_contact_${index}`}
                                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                        value={ref.contact_person}
                                                        onChange={(e) => setReference(index, 'contact_person', e.target.value)}
                                                    />
                                                    <InputError message={allErrors[`ref_${index}_contact`]} />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor={`ref_phone_${index}`} className="text-sm font-medium text-gray-700">Phone Number</Label>
                                                    <Input
                                                        id={`ref_phone_${index}`}
                                                        type="tel"
                                                        className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                        value={ref.phone_number}
                                                        onChange={(e) => setReference(index, 'phone_number', e.target.value)}
                                                    />
                                                    <InputError message={allErrors[`ref_${index}_phone`]} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Medical & Declaration */}
                    {step === 4 && (
                        <div className="flex flex-col gap-8">
                            <div className="rounded-sm border border-gray-200 bg-white p-6 sm:p-8">
                                <SectionHeader title="Medical History" />

                                <div className="grid gap-5">
                                    <div className="grid gap-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Workcover Claim (last 2 years)</Label>
                                        <RadioGroup value={data.workcover_claim} onValueChange={(v) => setData('workcover_claim', v)}>
                                            <TouchRow>
                                                <RadioGroupItem value="yes" id="wc_yes" />
                                                <Label htmlFor="wc_yes" className="font-normal text-gray-600">Yes</Label>
                                            </TouchRow>
                                            <TouchRow>
                                                <RadioGroupItem value="no" id="wc_no" />
                                                <Label htmlFor="wc_no" className="font-normal text-gray-600">No</Label>
                                            </TouchRow>
                                        </RadioGroup>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Medical or Physical Condition</Label>
                                        <Select value={data.medical_condition} onValueChange={(v) => setData('medical_condition', v)}>
                                            <SelectTrigger className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm">
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

                                    {data.medical_condition === 'other' && (
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="medical_condition_other" className="text-sm font-medium text-gray-700">Please specify</Label>
                                            <Input
                                                id="medical_condition_other"
                                                className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                value={data.medical_condition_other}
                                                onChange={(e) => setData('medical_condition_other', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-sm border border-gray-200 bg-white p-6 sm:p-8">
                                <SectionHeader title="Declaration & Acceptance" />
                                <p className="mb-6 text-sm leading-relaxed text-gray-600">
                                    I declare that the information provided in this application is true and correct. I understand that
                                    providing false or misleading information may result in termination of employment.
                                </p>

                                <div className="grid gap-5">
                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="acceptance_full_name" className="text-sm font-medium text-gray-700">
                                                Full Name <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="acceptance_full_name"
                                                className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                value={data.acceptance_full_name}
                                                onChange={(e) => setData('acceptance_full_name', e.target.value)}
                                            />
                                            <InputError message={allErrors.acceptance_full_name} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="acceptance_email" className="text-sm font-medium text-gray-700">
                                                Email Address <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="acceptance_email"
                                                type="email"
                                                className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                                value={data.acceptance_email}
                                                onChange={(e) => setData('acceptance_email', e.target.value)}
                                            />
                                            <InputError message={allErrors.acceptance_email} />
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label htmlFor="acceptance_date" className="text-sm font-medium text-gray-700">
                                            Date <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="acceptance_date"
                                            type="date"
                                            className="h-11 border-gray-300 text-base focus:border-[#2e6da4] focus:ring-[#2e6da4] sm:h-10 sm:text-sm"
                                            value={data.acceptance_date}
                                            onChange={(e) => setData('acceptance_date', e.target.value)}
                                        />
                                        <InputError message={allErrors.acceptance_date} />
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <Checkbox
                                            id="declaration_accepted"
                                            checked={data.declaration_accepted}
                                            onCheckedChange={(checked) => setData('declaration_accepted', checked === true)}
                                        />
                                        <Label htmlFor="declaration_accepted" className="font-normal leading-snug text-gray-600">
                                            I confirm that the above information is true and correct to the best of my knowledge, and I
                                            acknowledge the privacy notice{' '}
                                            <span className="text-red-500">*</span>
                                        </Label>
                                    </div>
                                    <InputError message={allErrors.declaration_accepted} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-6 flex gap-3 sm:mt-8">
                        {step > 0 && (
                            <button
                                type="button"
                                onClick={goBack}
                                className="flex-1 rounded border border-gray-300 bg-white px-6 py-3.5 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 sm:py-3 sm:text-sm"
                            >
                                Back
                            </button>
                        )}
                        {step < STEPS.length - 1 ? (
                            <button
                                type="button"
                                onClick={goNext}
                                className="flex-1 rounded bg-[#2e6da4] px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-[#255a87] active:bg-[#1e4d6e] sm:py-3 sm:text-sm"
                            >
                                Continue
                            </button>
                        ) : (
                            <button
                                type="submit"
                                className="flex-1 rounded bg-[#2e6da4] px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-[#255a87] active:bg-[#1e4d6e] disabled:opacity-50 sm:py-3 sm:text-sm"
                                disabled={processing || !data.declaration_accepted}
                            >
                                {processing ? 'Submitting...' : 'Submit Application'}
                            </button>
                        )}
                    </div>
                    {errors.recaptcha_token && (
                        <p className="mt-2 text-center text-sm text-red-600">{errors.recaptcha_token}</p>
                    )}
                </form>

                {/* Privacy Notice */}
                <div className="mt-4 space-y-2 text-xs leading-relaxed text-gray-400">
                    <p>
                        <span className="font-medium text-gray-500">Privacy Notice:</span> Superior Group collects personal information including
                        your name, contact details, employment history, qualifications, and medical information for the purpose of
                        assessing your suitability for employment. This information is handled in accordance with the Privacy Act 1988
                        (Cth) and the Australian Privacy Principles.
                    </p>
                    <p>
                        Sensitive information (medical history, Aboriginal or Torres Strait Islander status) is collected with your
                        consent and used solely for equal opportunity reporting and workplace safety requirements. Your information will
                        only be accessed by authorised personnel involved in the recruitment process and will not be shared with third
                        parties without your consent. If your application is unsuccessful, your data will be retained for up to 12 months
                        then securely deleted. You may request access to, correction, or deletion of your information by contacting us at{' '}
                        <span className="font-medium text-gray-500">privacy@superiorgroup.com.au</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}
