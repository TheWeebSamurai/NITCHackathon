# CivicSync — Hackathon Presentation

**Suggested deck:** 9 slides · 3–5 minutes  
**Tagline:** Public works, in sync  
**Presenter / team:** [Add names]  
**Important framing:** CivicSync is an independent hackathon prototype, not an official Kerala Government portal.

---

## Slide 1 — CivicSync

### Public works, in sync

One locality-first platform to discover civic works, raise community requests, and coordinate household pickup updates.

- Built for Kerala communities
- Search starts with a familiar six-digit PIN
- Residents and authorized staff use role-specific workflows

**Say:** “CivicSync helps residents see what is happening near them and gives community requests a clear path to staff review.”

**Visual:** App overview screen or a simple PIN → project → request graphic.

---

## Slide 2 — The problem

- Local information is spread across notices, department channels, and word of mouth.
- Residents often cannot quickly tell what work is happening in their locality.
- Reporting a neighbourhood concern does not always provide a clear way to follow its progress.
- Staff need a structured way to review requests and communicate updates.

**Say:** “The gap is not just information. It is connecting local information with a visible follow-up process.”

**Visual:** Scattered notices/channels converging into one locality view.

---

## Slide 3 — Our solution

### Start local. Make the next step visible.

1. Enter and verify a Kerala PIN.
2. See published projects and updates for that area.
3. Submit a community improvement petition and track its status.
4. Staff review requests and manage project information.
5. For household pickup, residents and assigned workers follow a separate status flow.

**Say:** “CivicSync brings these related civic interactions into one interface without treating a petition as an official government decision.”

**Visual:** Five-step user journey.

---

## Slide 4 — Discover what is happening nearby

- Kerala PIN lookup shows verified postal localities.
- Browse published works by locality, department, category, and status.
- Check project dates, expected disruption, timeline, and notices.
- Search and filters make a locality view easier to scan.
- Overlapping schedules can be flagged as a planning note.

**Say:** “Instead of searching a statewide list, residents can start with the place they know.”

**Visual:** Project cards, filters, and one project timeline.

---

## Slide 5 — From community voice to staff review

- A resident signs in and adds private name and date-of-birth details.
- The resident submits a request with its category, locality, PIN, and description.
- The resident can follow the request from their account.
- An Admin can review another account’s petition, but cannot review their own.
- Approval creates a linked **unpublished draft** for staff review—not a government commitment.

**Say:** “We make the handoff visible while keeping approval and publication separate.”

**Visual:** Resident submission → Admin review → unpublished draft → staff publication.

**Presenter note:** Petition phone OTP is not required by the updated workflow. The matching Supabase migration must be applied before demonstrating this behavior against the live database.

---

## Slide 6 — Household pickup workflow

- A resident can request a household waste-bag pickup with locality, address, bag count, and instructions.
- An Admin assigns the request to an account with the ASHA Worker app role.
- The worker updates the route: **Assigned → On the way → At the home → Bag picked up → Completed**.
- The resident can follow status updates in the pickup tracker.
- Pickup requests are separate from petitions.

**Say:** “This is a prototype service workflow. The ASHA Worker role is assigned in CivicSync; it does not verify employment or represent an official ASHA program.”

**Visual:** Simple delivery-style progress tracker with the five states.

---

## Slide 7 — Built with access boundaries in mind

- **Frontend:** React JSX, JavaScript, CSS, Vite
- **Backend:** Supabase Auth and PostgreSQL
- **Data access:** Row Level Security, role-aware policies, and database RPC functions
- **PIN verification:** Supabase Edge Function plus a postal lookup service
- **Quality checks:** ESLint and production build

### Privacy and security principles

- Petition details are intended for the submitting resident and authorized reviewers.
- Pickup addresses are restricted to the resident, Admins, and assigned worker.
- The browser uses a publishable key; private service-role credentials must remain server-side.

**Say:** “Sensitive access is enforced at the database layer, not just by hiding interface controls.”

---

## Slide 8 — Value, limitations, and next steps

### What is promising

- Locality-first discovery designed around Kerala PIN codes.
- One coherent journey from public information to request follow-up.
- Clear role separation for residents, staff, Admins, and pickup workers.
- A demonstrable workflow that can be extended with verified data sources.

### What is not solved yet

- No official government project-data integration; staff-entered records power project listings.
- No official waste-collection operations or worker verification.
- Resident name/date of birth are self-reported, not government identity verification.
- Production readiness still needs security, accessibility, operations, and privacy reviews.

### Next

- Validate with residents and staff.
- Establish data ownership, update, retention, and support processes.
- Explore authorized government data feeds and opt-in notifications.

**Say:** “We are presenting a workflow prototype and a foundation for collaboration—not claiming government integration.”

---

## Slide 9 — Demo and close

### 3-minute demo path

1. Enter a Kerala PIN and show the locality.
2. Open a project and show its details and timeline.
3. Sign in to a resident account, add private resident details, and submit a petition.
4. Switch to a separate Admin account and review the petition.
5. If ready, show the linked unpublished draft or an assigned pickup’s status tracker.

### Closing line

**“CivicSync makes civic information local, community requests trackable, and service workflows easier to understand.”**

**Before presenting:** Use test accounts and sample records. Never show real residents’ private details, email OTPs, phone numbers, addresses, SMTP credentials, or Supabase secrets on screen.

---

## Optional Q&A notes

- **Is this an official government portal?** No. It is an independent hackathon prototype.
- **Are project records connected to government systems?** Not currently; published records are entered in CivicSync.
- **Does petition approval mean the work will happen?** No. Approval creates an unpublished CivicSync draft for staff review.
- **Does phone OTP verify identity?** No. It only verifies access to a phone. Petition submission uses a private profile; household pickup additionally requires phone OTP.
- **Is the pickup service operated by an official ASHA program?** No. The ASHA Worker label is an application role in the prototype.
- **What must be ready for the live demo?** Apply the Supabase migrations in order, including `20261010031000_allow_petitions_without_phone_otp.sql`, deploy the PIN verification Edge Function, and use separate resident, Admin, and worker test accounts. If the migration or backend setup is incomplete, present the flow as a design/prototype rather than claiming it works live.
