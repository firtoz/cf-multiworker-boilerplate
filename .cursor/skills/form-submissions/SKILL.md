---
name: form-submissions
description: Form submission patterns using useDynamicSubmitter and formAction. Use when implementing forms, handling form submissions, or processing form data in React Router routes.
---

# Form Submissions with useDynamicSubmitter

Always use `submitter.submitJson()` instead of React Router's `<Form>` component.

## Loaders use `MaybeError` too

Match actions: **loaders** should return `Promise<MaybeError<LoaderData>>` with `success` / `fail`, not a bare object. That keeps `loaderData` typed the same way as submitter/fetcher results and avoids ambiguous error shapes. See [.cursor/skills/routing/SKILL.md](../routing/SKILL.md).

## Route Setup

### 1. Define Route and Form Schema

```typescript
import { formAction, type RoutePath, useDynamicSubmitter } from "@firtoz/router-toolkit";
import { success } from "@firtoz/maybe-error";
import { z } from "zod";

export const route: RoutePath<"/admin/settings"> = "/admin/settings";

export const formSchema = z.object({
  siteName: z.string().optional(),
  siteUrl: z.string().optional(),
  // ... other fields
});
```

### 2. Wrap Action with formAction

```typescript
export const action = formAction({
  schema: formSchema,
  handler: async ({ request }, formData) => {
    // formData is typed and validated by Zod
    await updateSettings(formData);
    
    // Return success() for successful operations
    return success();
    
    // Throw for redirects
    // throw redirect("/somewhere");
  },
});
```

### 3. Component Implementation

Use controlled inputs with React state.

```typescript
export default function MyForm() {
  const submitter = useDynamicSubmitter<typeof import("./my-route")>("/my-route");
  const [field1, setField1] = useState("");
  const [field2, setField2] = useState("");

  const handleSubmit = () => {
    submitter.submitJson({
      field1,
      field2,
    });
  };

  return (
    <div>
      <Input value={field1} onChange={(e) => setField1(e.target.value)} />
      <Input value={field2} onChange={(e) => setField2(e.target.value)} />
      <Button onClick={handleSubmit} disabled={submitter.state === "submitting"}>
        {submitter.state === "submitting" ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
```

## Key Points

### Don't Use
- ❌ `<Form>` from react-router

### Do Use
- ✅ Controlled inputs with React state (`value` + `onChange`)
- ✅ `useDynamicSubmitter` for form submission
- ✅ `submitter.submitJson()` with data object
- ✅ Check `submitter.state` for loading states
- ✅ Access results via `submitter.data`
- ✅ Export `route`, `formSchema`, and wrap `action` with `formAction()`
- ✅ Return `success()` from action handlers for successful operations
- ✅ `throw` (don't return) redirects and responses

## Benefits

This approach provides:
- Full TypeScript type safety for form data
- Automatic Zod validation
- Better control over form state
- Consistent patterns across the codebase
- Access to submission state and results in one place
