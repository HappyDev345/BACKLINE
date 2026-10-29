# BACKLINE — Industrial Technology Multimedia Major Work

## Project overview

**BACKLINE** is a web-based community platform for people working in live events, film, music, and photography. It is designed to bring production opportunities, crew profiles, community posts, technical discussions, direct messages, and notifications together in one place.

The current project is a frontend-first React application. It can run with sample data in preview mode or connect to Supabase for authentication, database, storage, and selected realtime features. The repository also contains an earlier-style static BACKLINE site in `Simple-Backline/`; this folio describes the React project in `k3-v1-backline/`.

This folio follows the supplied template's section order. Statements about implemented features and dated changes are based on the project files. There is no user-interview report, formal usability-test record, invoice, or hour log in the repository, so the folio does not present those as completed evidence.

## Contents

- [Design](#design)
- [Statement of Intent](#statement-of-intent)
- [Research](#research)
- [Selection and Justification of Materials, Components, Processes and Other Resources](#selection-and-justification-of-materials-components-processes-and-other-resources)
- [Development of Ideas](#development-of-ideas)
- [Appropriateness of Design and Design Modification](#appropriateness-of-design-and-design-modification)
- [Project Management](#project-management)
- [Timeplan](#timeplan)
- [Finance Plan](#finance-plan)
- [Calculations](#calculations)
- [Record of Procedures](#record-of-procedures)
- [Evidence of Safe Working Practices and OH&S Issues](#evidence-of-safe-working-practices-and-ohs-issues)
- [Project Evaluation](#project-evaluation)
- [References](#references)

## Design

### Design brief

The design problem addressed by BACKLINE is how to give production workers a focused place to discover opportunities, present their professional skills, exchange information, and contact one another. The intended audience includes crew members and other people involved in production work; project creators can publish crew calls, while members can browse profiles and communicate.

The product is organised around these main activities:

| Area | Purpose in the design |
|---|---|
| Landing page | Introduces BACKLINE and the community it is intended to serve. |
| Discover | Lists production opportunities and supports searching, filtering, sorting, saving, and publishing projects. |
| People and profiles | Helps members find people by name, username, role, location, or skill and view profile information. |
| Feed | Supports member posts, likes, and comments. |
| Forum | Organises technical and career discussions into categories and supports replies. |
| Messages | Provides private conversations between members. |
| Notifications | Shows account activity and allows alerts to be marked as read. |
| Staff workspace | Provides role-restricted tools for moderation and account administration. |

### Design criteria

The design is intended to:

1. Make BACKLINE's purpose understandable from the landing page.
2. Make the main community areas easy to find using consistent navigation.
3. Allow users to locate a project and a crew profile using the available search and filters.
4. Give users clear feedback for important actions and for loading or service errors.
5. Distinguish preview/sample data from connected account data.
6. Avoid exposing private information or secret credentials in the public frontend.
7. Work across the screen sizes and browsers that are tested before presentation.

These are evaluation criteria, not claims that formal user testing has already confirmed them. A suitable final test is to give a tester the tasks of finding a project by role and location, opening a crew profile, and locating a forum discussion. Record whether each task is completed, where confusion occurs, the device/browser, and any changes made afterward.

## Statement of Intent

### What I want to achieve and how

The aim of BACKLINE is to create an interactive web platform that brings together useful community functions for people working in production. Instead of making a single promotional page, the project provides separate areas for opportunities, profiles, posts, technical discussions, messages, and notifications.

The application is built with React, HTML, CSS, and JavaScript. React components provide reusable interface elements, React Router connects the pages, and Vite runs the local development server and creates the production build. Supabase is available as the connected service for user accounts and shared data. When the Supabase URL and public anon key are not configured, the application uses sample data in preview mode.

I would evaluate the result by testing realistic tasks rather than only checking whether a page renders. The key tasks are to find a relevant production listing, find a crew member by a listed skill, and navigate to a discussion or message. Results should be recorded with screenshots or notes, including problems and subsequent modifications.

### Motivation and purpose

The project is motivated by the idea that production work depends on people finding suitable crew, communicating clearly, and sharing specialist knowledge. BACKLINE explores whether a production-focused community can make those activities easier to access by placing them within one product.

The purpose is not to guarantee work or certify a person's skills. It is to provide a prototype for discovering opportunities, presenting profile information, participating in community discussions, and starting conversations. The project makes this scope clearer through its current interactions: expressing interest in a project opens a conversation with its creator; it does not submit a formal application or confirm a job.

### Limitations

- Preview mode uses sample records held in browser memory. Preview changes are temporary and reset when the page is refreshed.
- Connected features require a correctly configured Supabase project, schema, and any applicable migrations. The codebase alone does not demonstrate that a live backend is currently configured or tested.
- A conversation started from a project is not a formal application, hiring process, or confirmed project assignment.
- `project_members` is present in the database schema as groundwork but is not used by the current interface.
- Post media fields exist in the schema, but the current application has no post-media upload flow.
- Realtime updates are selective, including open conversations and the notification count; the whole application is not a general live-updating system.
- The project does not include evidence of a complete accessibility audit, production-scale load test, or formal user research.
- A commercial release would require further decisions about privacy, moderation, verification criteria, user support, operating costs, and legal responsibilities.

These limitations make BACKLINE an interactive prototype rather than a fully validated production service.

### Considerations and research required

The project has considered the following areas in its implementation and documentation:

- **Audience and task needs:** The features target production opportunities, crew profiles, community posts, technical topics, and direct communication. Interviews or surveys with intended users are still needed to verify that these are the most useful priorities.
- **Usability:** The project uses shared navigation and reusable components. Task-based tests should check whether users can find content without guidance.
- **Accessibility:** Text readability, contrast, keyboard access, responsive navigation, form labels, and screen-reader feedback should be checked systematically. No complete accessibility audit is documented.
- **Privacy and security:** Profiles, messages, reports, and staff functions involve sensitive information. The codebase includes database access policies and restricted staff features, but a real deployment still needs configuration review and testing.
- **Preview versus connected operation:** Sample data is useful for demonstrations, but the preview banner and documentation must make its temporary nature clear.
- **Digital assets:** The source contains a BACKLINE logo and uses Google Fonts (DM Sans and Space Grotesk). The asset creator, permission, and applicable licences should be recorded before redistribution.
- **Costs and hosting:** The README describes Vercel and Supabase as a possible deployment direction. Actual plan prices, usage, and any paid services must be checked at the time of use.

### Three key goals

1. **Make core content discoverable.** A tester should be able to find a project by a role or location and open a relevant crew profile. Evidence: task instructions, completion notes, and any observed errors.
2. **Make the community areas understandable.** A tester should be able to distinguish the feed from the technical forum and locate messages or notifications using the navigation. Evidence: task observations and a note of any navigation changes.
3. **Present a responsible and honest prototype.** The interface should explain when it is using preview data, should not expose service-role credentials, and should communicate errors instead of implying a failed action succeeded. Evidence: screenshots, configuration review, and a test record.

## Research

### Research completed from the project

The project files document two operating modes. `src/lib/supabase.js` selects preview mode unless both the Supabase URL and public anon key are present. In preview mode, `src/lib/demoData.js` supplies sample profiles and projects, and `src/context/DemoContext.jsx` holds editable browser-memory data. The README explains that preview changes reset on refresh. In connected mode, application pages query Supabase tables and use the authenticated session.

The database schema supports profiles, projects, saved projects, posts, comments, likes, follows, conversations, messages, and notifications. It enables row-level security on its tables. The current status document also identifies boundaries between implemented functionality and groundwork, such as project membership and post media.

The dated changelog records design and product modifications. On 27 October 2026, version 1.0.0 established the first tracked release. On 28 October, later entries record responsive-navigation changes, improved connected-mode landing content, clearer user-facing errors, moderation/report tools, staff roles, and changes to conversation access. These entries are evidence of recorded software changes; they are not user-test results.

### Technical research and findings

| Topic | Finding relevant to BACKLINE | Design decision |
|---|---|---|
| React | The official React learning material explains components, rendering data and lists, responding to events, and sharing data. These patterns suit a multi-page interface with repeated cards and interactive controls. | Use React pages and reusable components rather than duplicating the full interface for every route. |
| Vite | The Vite guide describes a development server and a build command for production assets. The repository uses Vite scripts for `dev` and `build`. | Use Vite for local iteration and producing a deployable frontend bundle. |
| Supabase | The official getting-started documentation provides a React quickstart and describes connecting browser applications to Supabase services. The project README documents its configuration and schema setup. | Use Supabase as an optional backend so the frontend can run in sample-data preview mode as well as a connected mode. |
| Database access | The project schema enables row-level security, and connected pages use the Supabase client. | Keep data access policies in the database and use the browser's public anon key, not a service-role key. |

### Research still required

No primary research record or competitor comparison was found in the project documentation. To strengthen the design rationale, the next research should:

1. Interview or survey intended users about how they currently find crew, advertise production work, and share technical knowledge.
2. Compare relevant job boards, portfolio directories, and discussion platforms using the same criteria: audience, discovery tools, profile information, communication features, and limitations.
3. Test the prototype with representative users and record the tasks, outcomes, and changes.
4. Check accessibility using keyboard-only navigation, browser zoom, a contrast checker, and at least one screen-reader workflow.

Findings from this research should be added with the date, method, participant count (where applicable), source, and the design decision they influenced. Do not describe a proposed interview or test as if it has already occurred.

## Selection and Justification of Materials, Components, Processes and Other Resources

BACKLINE is a digital product, so its materials are software, online services, digital assets, and development equipment.

| Selection | Use in BACKLINE | Justification |
|---|---|---|
| React | Pages and reusable interface components. | Supports interactive pages and shared elements such as cards, avatars, navigation, and dialogs. |
| Vite | Local development server and production build. | The project already uses Vite scripts for development and building. |
| JavaScript, HTML, and CSS | Application logic, page structure, and visual design. | These are the web technologies used by the existing frontend. |
| React Router | Maps URLs to page components. | Supports separate routes for the landing page, discover, people, profiles, feed, forum, messages, notifications, settings, and other views. |
| Supabase JavaScript client | Optional connected authentication and data operations. | Allows connected mode to use hosted account and database services without requiring a separately written API for each frontend action. |
| Supabase Postgres and Row Level Security | Stores shared application records and controls database access. | Fits the relational links between users, projects, posts, and messages; access policies are part of the schema. |
| Preview fixtures and DemoContext | Supplies sample records and temporary interactions. | Allows the interface to be shown without a connected Supabase project. |
| BACKLINE logo and Google Fonts | Brand identity and typography. | Present in the application files and HTML. Their ownership/licence records should be retained with the project. |
| Computer, code editor, Node.js, npm, and browser | Development and checking the web application. | Required by the documented Vite/npm workflow. |

### Processes selected

The project uses a staged web-development process: define the intended audience and functions, structure the pages, implement interactions, connect data modes, then build and test. The repository documents `npm run dev` and `npm run build`; no automated test script is defined in `package.json`.

For connected development, the README recommends a separate Supabase project for testing, running the base schema, applying the migrations that apply to the project, and supplying local environment variables. This separation helps prevent test changes from affecting production data.

## Development of Ideas

### From concept to product structure

BACKLINE's idea is a focused production community rather than a general social network. The codebase divides the experience into distinct tasks: opportunity discovery, crew discovery, sharing updates, technical discussion, private communication, and activity notifications. This structure lets a user go from a project listing or crew profile into a conversation without treating the whole site as one undifferentiated feed.

The repository includes both a static site (`Simple-Backline/`) and the React app (`k3-v1-backline/`). The static site demonstrates a simpler front-end approach; the React application contains the broader page and interaction structure. The files alone do not prove the order in which these versions were designed, so no exact sketch-to-prototype chronology is claimed here.

### Main design choices

- **Separate Discover and People areas:** projects and crew require different search fields and information, so each has a purpose-built view.
- **Use the feed and forum for different content:** ordinary posts have no category, while forum threads use a category. The forum categories include lighting, audio, cameras, video, equipment, workflows, and careers.
- **Use profiles as professional summaries:** profiles can show a person's role, location, bio, skills, posts, projects, and follow information.
- **Keep preview and connected modes:** sample data makes a demonstration possible, while Supabase provides an option for shared persistent data.
- **Add staff moderation separately:** reports and moderation actions are handled in a role-gated staff workspace rather than being visible to all users.

### Alternatives and trade-offs

| Alternative | Benefit | Limitation | Decision |
|---|---|---|---|
| Static promotional site only | Simple to open and present. | Does not provide the connected community flows represented in the React project. | Retained as a separate static version; the React project is the primary interactive product. |
| A single general-purpose feed | Simple navigation and one place for updates. | Makes job listings, profiles, and technical discussions harder to distinguish. | Use separate pages for distinct tasks and content. |
| Always require a live backend | Shared persistent content and real accounts. | Makes demonstrations dependent on network and backend configuration. | Keep a preview mode with sample data, while clearly communicating that it is temporary. |
| Build a custom backend | Full control over server behaviour. | Adds development and maintenance scope beyond the frontend. | Use Supabase for the connected prototype, with documented setup and security boundaries. |

Useful evidence to include in a presentation is a screenshot of each core page, an annotated navigation map, and before/after screenshots for selected changes recorded in the changelog.

## Appropriateness of Design and Design Modification

### Appropriateness

The overall design matches its intended purpose because the main pages correspond to the production community's key tasks. Search and filters support finding projects and people; profiles present professional information; the feed and forum support different kinds of public discussion; and messages provide direct contact.

The design also communicates an important functional limitation: preview-mode records are temporary. In the connected version, database access and staff-only functions are supported by schema policies and role-gated features. These mechanisms are part of the implementation, but they do not replace deployment review, user testing, or an independent security and accessibility assessment.

### Documented modifications

The changelog records the following significant modifications:

| Date / release | Modification | Reason or benefit shown by project record |
|---|---|---|
| 27 Oct 2026 — 1.0.0 | First tracked BACKLINE release. | Established a versioned baseline. |
| 28 Oct 2026 — 1.1.0 | Improved user-facing error messages and preview sign-in; limited illustrative landing content to preview mode. | Clarified errors and avoided presenting fictional sample content as live connected records. |
| 28 Oct 2026 — 1.1.1 | Restored connected-mode landing sections and corrected follow-count/state behaviour. | Improved consistency between connected data and interface behaviour. |
| 28 Oct 2026 — 1.2.0 | Added staff roles, verified badges, private reports, moderation tools, and a role-gated staff workspace; tightened conversation creation. | Added moderation capability and clarified access boundaries for sensitive operations. |
| 28 Oct 2026 — 1.2.1 | Adjusted navigation for smaller screens. | Addressed navigation overflow by using a responsive menu. |
| 28 Oct 2026 — 1.2.2–1.2.10 | Improved message display, reporting privacy, suspended-profile visibility, anonymisation, and admin setup guidance. | Refined reliability, privacy, and moderation behaviour. |

The changelog does not provide user-test transcripts or quantitative usability results. These changes can be described as documented software modifications, but not as proven improvements in user satisfaction.

### Evaluation against design criteria

| Criterion | Evidence from implementation | Current evaluation / next test |
|---|---|---|
| Purpose and core areas are represented | Landing page and distinct Discover, People, Feed, Forum, Messages, and Notifications pages. | Present in code; ask users to explain the purpose and find each area. |
| Projects and people can be discovered | Discover has text search, type/role/location filters and sorting; People search covers name, username, role, location, and skills. | Feature is implemented; test with realistic tasks and varied sample data. |
| User actions provide feedback | Pages contain loading/action error states and the app shows a preview-mode banner. | Inspect with failed network requests and preview tasks; record actual observations. |
| Responsive navigation | Changelog records a smaller-screen navigation modification. | Verify on actual target screen sizes and record screenshots. |
| Private data is handled responsibly | Schema includes row-level security; staff tools are role-gated; README warns against exposing the service-role key. | Review deployed policies and test access using non-production accounts before claiming deployment readiness. |

## Project Management

The repository shows a versioned release history and documentation describing product scope, setup, known limitations, and migrations. This provides a record of technical decisions and changes. The repository does not include a separate task board, meeting minutes, or time-tracking sheet, so those project-management records cannot be reconstructed here.

The work can be managed as these dependent stages:

1. Define the brief, intended audience, and measurable criteria.
2. Research users, comparable services, accessibility, and implementation options.
3. Plan the navigation and page responsibilities.
4. Implement the interface and preview data.
5. Implement connected data flows and access controls where required.
6. Test the core tasks and correct the most significant problems.
7. Prepare a demonstration and evaluate against the criteria.

The changelog indicates that scope expanded to include moderation and staff controls. In a future project plan, this kind of expansion should be prioritised against the deadline and tested separately because staff tools involve sensitive data and permissions.

## Timeplan

The table below reports only dated milestones supported by the repository's changelog. It does not claim that these were the full work sessions or the original planned schedule.

| Date | Recorded milestone | Evidence |
|---|---|---|
| 27 Oct 2026 | Version 1.0.0 established the first tracked release, including authentication-aware navigation, an About page, and account benefit information. | `Documentation/CHANGELOG.md`, version 1.0.0. |
| 28 Oct 2026 | Version 1.1.0 and 1.1.1 recorded error-feedback, preview-content, connected landing-page, and follow-state changes. | `Documentation/CHANGELOG.md`, versions 1.1.0–1.1.1. |
| 28 Oct 2026 | Version 1.2.0 introduced staff roles, reporting, moderation, and stricter conversation membership handling. | `Documentation/CHANGELOG.md`, version 1.2.0. |
| 28 Oct 2026 | Versions 1.2.1–1.2.10 recorded responsive navigation, messaging, privacy, moderation, and setup refinements. | `Documentation/CHANGELOG.md`, versions 1.2.1–1.2.10. |
| Before submission | Run the final build, test the core user tasks, complete the cost/time records, and prepare evidence. | To be completed and dated by the project author. |

**Planned versus actual hours:** not recorded in the repository. Add hours from a calendar, class log, or other reliable record rather than estimating them retrospectively.

## Finance Plan

BACKLINE is software, so the main cost categories are development equipment, internet access, software, hosting, database usage, and any domain or paid digital assets. The repository does not include receipts, provider invoices, billing records, or evidence of which services were paid for. Therefore, a reliable numeric total cannot be calculated from the source files alone.

| Item | Cost status based on available evidence | Information required for final total |
|---|---|---|
| Computer and peripherals | Existing equipment is implied by the development workflow; purchase cost is not recorded. | Record whether equipment was purchased for this project or already owned, and use the value required by the course. |
| Internet access | Not recorded. | Include incremental project cost only if required by the assessment. |
| React, Vite, and other npm packages | Package dependencies are listed; project records do not state whether any subscription or paid service was used. | Check actual licences and any related subscription charges. |
| Supabase | Connected mode is supported, but no account plan or invoice is documented. | Check the account's actual billing and usage for the project period. |
| Hosting | README describes Vercel as a possible hosting direction; actual project charges are not documented. | Confirm whether deployed, plan used, billing period, and actual charge. |
| Domain name | No purchase information is present. | Record the actual amount if one was purchased. |
| Logo, fonts, and other assets | Logo and Google Fonts are present; asset costs and permission records are not included. | Record creator/source and licence; enter a cost only if actually incurred. |

**Actual total:** not established from the available project records. Add verified expenses before submitting a final finance plan. A service's free tier should not be assumed without checking the account and the provider's current terms.

## Calculations

No physical dimensions or material quantities apply to this web application. The relevant calculations are project time and verified digital-service costs.

### Project hours

For each work session:

`Session hours = finish time − start time − breaks`

Then:

`Total project hours = sum of all recorded session hours`

No session log is present in the repository, so the total is **not calculated**. Use actual class or calendar records to complete it.

### Actual project cost

`Actual project cost = equipment + software/services + hosting + domain + other verified expenses`

For a verified monthly service charge:

`Service total = monthly amount × number of billed months`

No amounts or invoices are included in the repository, so a numeric project cost would be unsupported.

### Optional labour valuation

If required by the course:

`Labour value = total recorded project hours × selected hourly rate`

State the source or reason for the hourly rate and include the working. Do not treat this estimate as money actually spent.

## Record of Procedures

The table below is reconstructed from dated release notes and project documentation. It records actions evidenced by the repository, not every step taken during development.

| Date | Procedure / change recorded | Resources / area | Evidence |
|---|---|---|---|
| 27 Oct 2026 | Established the first tracked release and added authentication-aware navigation and account information. | React application, navigation, account pages. | `Documentation/CHANGELOG.md`, 1.0.0. |
| 28 Oct 2026 | Improved user-facing error feedback and clarified the difference between sample content and connected records. | Application pages and preview mode. | `Documentation/CHANGELOG.md`, 1.1.0. |
| 28 Oct 2026 | Restored connected landing-page content and corrected follow-state/count behaviour. | Landing page and People/profile features. | `Documentation/CHANGELOG.md`, 1.1.1. |
| 28 Oct 2026 | Added role-based staff and moderation features, private reporting, and stricter conversation membership handling. | Staff workspace, database migrations, messaging. | `Documentation/CHANGELOG.md`, 1.2.0. |
| 28 Oct 2026 | Modified the navigation layout for smaller screens. | Responsive site navigation. | `Documentation/CHANGELOG.md`, 1.2.1. |
| 28 Oct 2026 | Refined message display, report privacy, suspended-account visibility, and staff-account setup guidance. | Messages, reports, profiles, staff workspace. | `Documentation/CHANGELOG.md`, 1.2.2–1.2.10. |
| [Add date] | Ran the local development app and checked the main routes. | Node.js, npm, Vite, browser. | Add the actual run result and screenshots. |
| [Add date] | Tested the project discovery, crew search, and forum tasks with users. | Browser/device and test participants. | Add real observations and resulting modifications. |
| [Add date] | Ran the production build and prepared the final demonstration. | `npm run build`, browser. | Add the actual output and date. |

The README lists the commands `npm run dev` and `npm run build`. Their presence in the documentation does not prove that they were run successfully for this folio; record the actual outcome when checking the final project.

## Evidence of Safe Working Practices and OH&S Issues

### Physical health and safety

Digital work can still create ergonomic and electrical risks. Use a comfortable chair and screen position, keep wrists and shoulders relaxed, take regular breaks from close screen work, and vary tasks where possible. Keep liquids away from electrical devices, route cables to avoid trip hazards, and report damaged equipment. Record any school-specific workstation procedure followed during project work.

### Privacy, security, and responsible data use

BACKLINE includes user profiles, direct messages, reports, and moderation records. These need more care than public sample content:

- Use sample or test accounts for demonstrations and avoid publishing real personal information without permission.
- Keep account credentials private. The README explicitly warns that a Supabase service-role key must not be placed in frontend code or committed to source control.
- Use a separate development or preview backend so experiments do not alter production data.
- Review database access policies and storage rules before connecting real users; test with accounts of different roles.
- Limit staff access to the data needed for moderation and do not disclose private report or message details in public examples.
- Obtain permission for photographs, profiles, and work belonging to other people, and record licences for fonts and other assets.
- Keep a backup in an approved storage location and do not share private configuration files.

The schema and migrations define access rules and moderation controls, but the existence of these controls is not proof that a deployed system has been independently audited. Production use would require further configuration checks and testing.

### Evidence to attach to the final folio

Add genuine, dated evidence: a workstation setup photo if required, screenshots using sample accounts, asset licence/permission records, the development environment configuration with secrets hidden, and notes showing the actual user-task or accessibility checks performed. Do not include passwords, API keys, private messages, or identifiable user information.

## Project Evaluation

### Overall evaluation

BACKLINE has progressed beyond a static promotional concept into a multi-page interactive application. Its strongest design feature is that it separates production listings, crew profiles, community posts, technical discussions, messages, and notifications into identifiable areas. The React project supports sample-data preview and a connected Supabase mode, and its changelog shows continued refinement of responsive navigation, error feedback, messaging, privacy, and moderation.

The main limitation is that implementation evidence is stronger than validation evidence. The repository documents the features and changes, but does not contain a user-research report, formal usability results, accessibility audit, project-hour log, or verified financial total. As a result, it is possible to evaluate what the application is designed to do, but not to claim that representative users have confirmed it meets their needs.

### Success against the three goals

| Goal | Evidence available | Evaluation |
|---|---|---|
| Make projects and crew discoverable | Project search/filtering and People search are implemented. | Achieved as a software feature; user success still needs task testing. |
| Make community areas understandable | Separate routes and navigation exist for the main areas. | Structure is implemented; clarity should be confirmed with users on desktop and small screens. |
| Present a responsible prototype | Preview mode is identified; the README warns against frontend service-role secrets; schema/migrations include access and moderation controls. | Responsible design measures are documented; deployment and permission checks remain necessary. |

### Future improvements

The next improvements should be chosen using user feedback. Based on documented limitations, useful candidates are a formal project application or membership workflow, post-media uploads if required, a recorded accessibility audit, more representative cross-device task testing, and verified policies for moderation and member verification. Before any real launch, test the connected Supabase configuration and review operational costs, privacy, security, and support arrangements.

## References

### Project evidence

- [Project README](../README.md) — setup, preview/connected modes, deployment direction, and security notes.
- [Current project status](./current%20status.md) — application structure, feature scope, data modes, and known limitations.
- [Project changelog](./CHANGELOG.md) — dated feature and modification record.
- [Application routes](../src/App.jsx) — routes and shared application structure.
- [Supabase client configuration](../src/lib/supabase.js) — preview versus connected mode selection.
- [Demo data](../src/lib/demoData.js) — sample profiles and project records.
- [Database schema](../supabase/schema.sql) — tables and row-level security configuration.
- [Package manifest](../package.json) — frameworks, packages, and available scripts.

### Technical sources

- React, “Quick Start,” <https://react.dev/learn>. Accessed 29 October 2026.
- Vite, “Getting Started,” <https://vite.dev/guide/>. Accessed 29 October 2026.
- Supabase, “Getting Started,” <https://supabase.com/docs/guides/getting-started>. Accessed 29 October 2026.

### Research still to cite

Add citations for any user interviews, surveys, competitor comparisons, accessibility guidance, or asset licences used in the final submission. Include the source, author or organisation, date, and access date in the citation style required by the course.
