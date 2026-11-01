# FitPath Final Manual Regression Checklist

Use a dedicated test environment only: test Clerk instance, Neon database, and
private R2 buckets. Do not use production accounts, credentials, or data.

Record **PASS** or **FAIL**, the tester, date, browser/device, and any defect
reference in the final column. Reset the dedicated test data when a test changes
a user role, assignment, application, or plan.

## Test data and baseline setup

- Signed-out browser session.
- `user`: onboarded USER with a profile, a plan, progress data, and at least
  one progress photo; assign this user to `trainer`.
- `incompleteUser`: USER without completed onboarding.
- `trainer`: approved TRAINER actively assigned to `user`.
- `unrelatedUser`: USER not assigned to `trainer`, with private plan/progress
  data and photo.
- `admin`: ADMIN account.
- At least one fresh PENDING trainer application for approve/reject tests.
- Confirm the client and API use the dedicated environment and start at the
  normal local/test URLs.

## SIGNED OUT

| Test | Setup | Action | Expected result | Result / notes |
| --- | --- | --- | --- | --- |
| Protected application unavailable | Signed out; open a private route such as `/plans`, `/progress`, or `/admin`. | Load the route and attempt browser Back/Forward navigation. | The application redirects to Sign in; no profile, plan, progress, admin, or private image data is rendered. | PASS / FAIL: |
| Sign in | Signed out; valid dedicated USER credentials available. | Open Sign in, enter valid credentials, and complete Clerk sign-in. | User reaches FitPath; authenticated navigation and account control appear. | PASS / FAIL: |
| Sign up | Signed out; unused dedicated test email available. | Open Sign up and complete Clerk registration. | A new account can enter FitPath and is directed through USER onboarding. | PASS / FAIL: |
| Google authentication | Signed out; Google provider is enabled in the dedicated Clerk instance. | Choose Google sign-in/sign-up and complete the provider flow. | Clerk returns to FitPath authenticated; first-time USER is directed through onboarding. | PASS / FAIL: |

## USER

| Test | Setup | Action | Expected result | Result / notes |
| --- | --- | --- | --- | --- |
| Onboarding | Sign in as `incompleteUser`. | Complete all onboarding steps with valid age, height, activity level, fitness goal, and weight. | Required validation is clear; one submission completes onboarding and dashboard/profile show saved values. | PASS / FAIL: |
| Profile | Sign in as onboarded `user`. | Open Profile. | Only the signed-in user's profile details are displayed with clear unavailable states where data is absent. | PASS / FAIL: |
| BMI | `user` has a profile height and weight. | Open Dashboard; change the local BMI inputs to valid and invalid values. | BMI updates for valid positive values; invalid values show helpful feedback and do not alter saved profile data. | PASS / FAIL: |
| Create own training plan | Sign in as `user`; start with no selected draft. | Open My Plans, create a valid plan with workout days/exercises, and save once. | Plan is created for the signed-in user, appears in Available plans, and duplicate clicks do not create duplicate saves. | PASS / FAIL: |
| Edit own plan | `user` owns an existing plan. | Select it, edit metadata/workouts, reorder items, and save. | Edited plan reloads with correct order and values; validation blocks invalid fields. | PASS / FAIL: |
| PDF download | `user` owns a saved plan. | Open the plan and choose Download PDF. | A readable PDF for that plan downloads; no public URL or another user's content is exposed. | PASS / FAIL: |
| Choose trainer | `trainer` is approved and available. | Open My Coach and choose `trainer`. | Selected trainer is shown as current; assignment remains after refresh. | PASS / FAIL: |
| Record progress | `user` has a completed profile with valid height. | Use the Progress measurement-entry workflow to submit a valid weight and date. | A measurement is saved with server-calculated BMI and invalid/future input is rejected clearly. | PASS / FAIL: |
| Weight history | `user` has at least two measurements. | Open Progress and inspect weight history/chart data. | Only the user's measurements appear in chronological chart/table data. | PASS / FAIL: |
| Mark workout complete | `user` owns a saved plan with an incomplete workout day. | In My Plans, choose Mark complete for one workout day. | Completion state and completed count update; refresh preserves it. | PASS / FAIL: |
| Undo completion | `user` has a completed workout day. | Choose Undo completion. | Completion state and count revert; refresh confirms removal. | PASS / FAIL: |
| Upload progress photo | `user` has a valid JPEG, PNG, or WebP smaller than 5 MB. | Open Progress, select the image, and upload once. | Upload progress is clear; photo appears in the private gallery. Invalid type/oversize input is rejected clearly. | PASS / FAIL: |
| View own progress photo | `user` has a private progress photo. | Open its gallery after refresh. | The user's image renders with date/meaningful alt text; no raw R2 URL is shown. | PASS / FAIL: |
| Delete own progress photo | `user` has a private progress photo. | Choose Delete and refresh the page. | The photo disappears and remains unavailable to the user after refresh. | PASS / FAIL: |
| Charts display | `user` has at least two weight records and completions in at least two weeks. | Open Progress at desktop and mobile widths. | Weight and completion charts render legibly, include accessible data, and do not horizontally overflow. | PASS / FAIL: |

## TRAINER

| Test | Setup | Action | Expected result | Result / notes |
| --- | --- | --- | --- | --- |
| Assigned clients | Sign in as `trainer`; `user` is actively assigned. | Open My Clients. | Assigned clients load with a loading state then list only active assigned clients. | PASS / FAIL: |
| Unrelated client excluded | `unrelatedUser` is not assigned to `trainer`. | Inspect My Clients and attempt the unrelated client ID/route through the normal client workflow. | Unrelated client is absent and access is denied/not found; no private data renders. | PASS / FAIL: |
| Create assigned-client plan | `trainer` is assigned to `user`. | Open My Plans, choose `user`, create a valid plan, and save. | Plan saves for the assigned client and is visible in the trainer's plan list. | PASS / FAIL: |
| Edit assigned-client plan | `trainer` is assigned to the plan's client. | Open that plan, modify it, and save. | Changes persist; invalid input is blocked with clear feedback. | PASS / FAIL: |
| Assigned-client progress | `user` has progress entries and is actively assigned. | Use the trainer client-progress workflow for `user`. | Only assigned client's progress history is returned/rendered. | PASS / FAIL: |
| Assigned-client progress photos | `user` has a private progress photo and is actively assigned. | Use the trainer client-progress-photo workflow for `user`. | Authorized image bytes/metadata are available only for the assigned client; no public R2 URL is exposed. | PASS / FAIL: |
| Unrelated private data denied | `unrelatedUser` has plan, progress, completions, and photo. | Attempt each corresponding trainer client endpoint/route using the unrelated user's identifier. | Every attempt is rejected; no response body, PDF, or image reveals private data. | PASS / FAIL: |

## ADMIN

| Test | Setup | Action | Expected result | Result / notes |
| --- | --- | --- | --- | --- |
| Trainer applications | Sign in as `admin`; create a fresh PENDING application. | Open Admin → Trainer Applications. | Pending applications load, including authorized certificate download control and review actions. | PASS / FAIL: |
| Approve trainer | Fresh PENDING application owned by a USER. | Download certificate if needed, then approve. | Application leaves pending list; applicant becomes TRAINER and receives a trainer profile after refresh. | PASS / FAIL: |
| Reject trainer application | Separate fresh PENDING application. | Reject it. | Application leaves pending list; applicant remains USER and may submit again. | PASS / FAIL: |
| Non-admin admin-route denial | Sign in as USER and then TRAINER. | Try `/admin`, application list, review, and certificate URLs/routes. | UI redirects or hides admin navigation; backend requests are rejected server-side. | PASS / FAIL: |

## INFRASTRUCTURE

| Test | Setup | Action | Expected result | Result / notes |
| --- | --- | --- | --- | --- |
| Neon migrations present | Dedicated Neon database access and repository checkout. | Verify migration journal/history includes `0000` through `0003` and database schema matches the committed migrations. | All four immutable migrations are present; no `drizzle-kit push` workflow is used. | PASS / FAIL: |
| Cloudflare R2 operational | Dedicated R2 credentials and private bucket configured. | Run `npm run storage:verify --workspace server` or equivalent documented verification. | Generated test object uploads, reads, deletes, and is confirmed absent; credentials/keys are not logged. | PASS / FAIL: |
| PDF endpoint | Authenticated USER with a saved plan. | Request the plan PDF through the application or authorized API client. | HTTP 200 PDF response for authorized plan; unauthorized plan access is denied. | PASS / FAIL: |
| Main CI green | Repository pushed to GitHub. | Open the latest `CI` workflow run. | Install, lint, typecheck, unit tests, and build are green. | PASS / FAIL: |
| Backup workflow manual run green | Required GitHub backup secrets and separate backup bucket configured. | Run `Scheduled Backup` manually. | Workflow succeeds without printing credentials; retention step completes. | PASS / FAIL: |
| Backup archive exists | Successful manual backup run. | Inspect the private backup bucket. | A new `backups/<backup-id>/` package contains database dump, storage copy, checksums, manifest, and retention reference. | PASS / FAIL: |
| Restore instructions exist | Repository checkout. | Review `docs/backup-and-restore.md`. | Instructions require explicit non-production confirmation, a separate restore bucket, checksum verification, and warn that database restore is destructive. | PASS / FAIL: |
| Lint | Dependencies installed. | Run `npm run lint`. | Command exits successfully. | PASS / FAIL: |
| Typecheck | Dependencies installed. | Run `npm run typecheck`. | Client and server type checks exit successfully. | PASS / FAIL: |
| Unit tests | Dependencies installed. | Run `npm run test:unit`. | All unit tests pass. | PASS / FAIL: |
| Production build | Dependencies installed. | Run `npm run build`. | Client production build and server compilation exit successfully. | PASS / FAIL: |

## Final sign-off

| Item | Tester / date | Result / notes |
| --- | --- | --- |
| All required regression tests completed in the dedicated test environment |  | PASS / FAIL: |
| Failed tests triaged with issue references or accepted risk |  | PASS / FAIL: |
| No production credentials or data used during testing |  | PASS / FAIL: |
| Submission approved |  | PASS / FAIL: |
