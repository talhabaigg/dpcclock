---
name: use-shadcn-components
description: Enforces use of the project's Shadcn/Base UI components instead of plain HTML inputs when building React UI. Automatically applied when creating or editing React forms and pages.
autoApply: true
---

# Shadcn UI Component Usage Rules

When building or editing any React/TypeScript UI in this project, you MUST use the project's Shadcn (Base UI) components instead of plain HTML elements. Never use raw `<input>`, `<select>`, `<textarea>`, or `<button>` elements.

## Available Components and When to Use Them

### Form Inputs

| Need | Use | Import from |
|------|-----|-------------|
| Text input | `<Input>` | `@/components/ui/input` |
| Textarea | `<Textarea>` | `@/components/ui/textarea` |
| Date picker | `<DatePickerDemo>` | `@/components/date-picker` |
| Dropdown select | `<Select>` + `<SelectItem>` | `@/components/ui/select` |
| Searchable select / autocomplete | `<Combobox>` | `@/components/ui/combobox` |
| Checkbox | `<Checkbox>` | `@/components/ui/checkbox` |
| Toggle switch | `<Switch>` | `@/components/ui/switch` |
| Radio buttons | `<RadioGroup>` + `<RadioGroupItem>` | `@/components/ui/radio-group` |
| OTP / code input | `<InputOTP>` | `@/components/ui/input-otp` |
| Label | `<Label>` | `@/components/ui/label` |

### Form Layout

| Need | Use | Import from |
|------|-----|-------------|
| Field wrapper (label + input + error) | `<Field>` + `<FieldLabel>` + `<FieldError>` | `@/components/ui/field` |
| Field group | `<FieldGroup>` | `@/components/ui/field` |
| Fieldset | `<FieldSet>` + `<FieldLegend>` | `@/components/ui/field` |
| Input with addon (icon, button) | `<InputGroup>` | `@/components/ui/input-group` |

### Actions & Feedback

| Need | Use | Import from |
|------|-----|-------------|
| Button | `<Button>` | `@/components/ui/button` |
| Button group | `<ButtonGroup>` | `@/components/ui/button-group` |
| Toast notification | `toast()` from Sonner | `@/components/ui/sonner` |
| Tooltip | `<Tooltip>` | `@/components/ui/tooltip` |

### Layout & Display

| Need | Use | Import from |
|------|-----|-------------|
| Card | `<Card>` + `<CardHeader>` + `<CardContent>` | `@/components/ui/card` |
| Table | `<Table>` + `<TableHeader>` + `<TableRow>` + `<TableCell>` | `@/components/ui/table` |
| Tabs | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>` | `@/components/ui/tabs` |
| Dialog / Modal | `<Dialog>` | `@/components/ui/dialog` |
| Sheet (side panel) | `<Sheet>` | `@/components/ui/sheet` |
| Drawer (bottom panel) | `<Drawer>` | `@/components/ui/drawer` |
| Alert dialog (confirm) | `<AlertDialog>` | `@/components/ui/alert-dialog` |
| Dropdown menu | `<DropdownMenu>` | `@/components/ui/dropdown-menu` |
| Context menu | `<ContextMenu>` | `@/components/ui/context-menu` |
| Popover | `<Popover>` | `@/components/ui/popover` |
| Accordion | `<Accordion>` | `@/components/ui/accordion` |
| Collapsible | `<Collapsible>` | `@/components/ui/collapsible` |
| Badge / tag | `<Badge>` | `@/components/ui/badge` |
| Separator | `<Separator>` | `@/components/ui/separator` |
| Skeleton loader | `<Skeleton>` | `@/components/ui/skeleton` |
| Spinner | `<Spinner>` | `@/components/ui/spinner` |
| Progress bar | `<Progress>` | `@/components/ui/progress` |
| Scroll area | `<ScrollArea>` | `@/components/ui/scroll-area` |
| Avatar | `<Avatar>` | `@/components/ui/avatar` |
| Breadcrumb | `<Breadcrumb>` | `@/components/ui/breadcrumb` |
| Pagination | `<Pagination>` | `@/components/ui/pagination` |
| Hover card | `<HoverCard>` | `@/components/ui/hover-card` |
| Keyboard shortcut | `<Kbd>` | `@/components/ui/kbd` |

## Critical Rules

1. **Dates**: NEVER use `<input type="date">` or `<input type="datetime-local">`. ALWAYS use `<DatePickerDemo>` from `@/components/date-picker`. It takes `value` (Date object) and `onChange` (callback receiving Date).

2. **Selects**: NEVER use `<select>` or `<input>` for selection. Use `<Select>` for fixed option lists, `<Combobox>` for searchable/filterable lists.

3. **Booleans**: Use `<Switch>` for on/off toggles, `<Checkbox>` for multi-select or agreement checkboxes. Never use `<input type="checkbox">`.

4. **Buttons**: ALWAYS use the `<Button>` component with appropriate `variant` (`default`, `outline`, `ghost`, `destructive`, `link`) and `size` props.

5. **Form fields**: Wrap inputs in `<Field>` with `<FieldLabel>` and `<FieldError>` for consistent layout and error display. Use Inertia form errors: `<FieldError>{form.errors.fieldName}</FieldError>`.

6. **Card headers**: Use plain `<CardTitle>` and `<CardDescription>` only. No icons in card headers, no bordered chips around title text.

7. **When a component doesn't exist**: If you need a component that isn't listed above, check `resources/js/components/ui/` first. If it truly doesn't exist, install it via `npx shadcn@latest add <component-name>` before using it.
