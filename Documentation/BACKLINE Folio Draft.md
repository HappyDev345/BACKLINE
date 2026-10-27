# BACKLINE — Project Folio

> **Drafting note:** This draft is based on the BACKLINE project files. Replace every square-bracketed prompt with your own details and evidence. Do not claim that you conducted research, received feedback, completed a test, or paid a cost unless you can support it.

## Project details

- **Student:** [Your name]
- **Course / class:** [Course and class]
- **Teacher:** [Teacher]
- **Project start and due dates:** [Dates]
- **Final product:** BACKLINE, a web-based community platform for people working in live events, film, music, and photography.

## 1. Statement of Intent

### What I want to achieve and how

I want to create **BACKLINE**, a web-based community platform that helps people working behind the scenes in live events, film, music, and photography connect with one another and find relevant production opportunities. The site brings project listings, crew profiles, a community feed, a technical forum, private messages, and notifications together in one place.

I will achieve this by designing and developing a set of connected web pages with clear navigation and consistent presentation. I will use React, HTML, CSS, and JavaScript for the interface, and Vite to run and build the application. Sample data will allow the prototype to be demonstrated without a backend; if connected services are in scope, Supabase can provide authentication and data storage. I will test the key tasks—finding a project, locating a crew profile, and navigating between community features—and use the results to identify improvements.

The intended users are [identify the specific people you are designing for, such as freelance crew, production companies, students, or event organisers]. I plan to support use on [devices and screen sizes you will test] and in [browsers you will test].

### Motivation and purpose

My motivation for this project is [explain your personal interest in production, technology, or the problem you want to address]. I chose this idea because [describe what you have observed or experienced; distinguish personal observations from research findings].

The purpose of BACKLINE is to make it easier for members of production communities to discover opportunities, present their skills, share information, and communicate. Instead of relying on separate tools for listings, professional profiles, discussions, and messages, the project explores how these activities could be brought together in a focused platform.

### Limitations

The project has the following known limitations:

- In preview mode, sample content is used and changes are temporary; they reset when the page is refreshed.
- Connected features depend on correctly configured Supabase services and are not demonstrated as fully operational unless that setup is available and tested.
- Expressing interest in a listing starts a conversation; it is not a formal application or a confirmed assignment to a project.
- The project may not include every feature required for a production-ready service, such as comprehensive moderation, user verification, or a complete accessibility audit.
- Testing will be limited to [state the actual number/type of users, devices, browsers, and time available].

These limitations define the scope of the project and will be considered when evaluating its success. I will not claim that a feature is complete or reliable without testing it.

### Considerations and research required

Before finalising the design, I need to research:

- **User needs:** interview or survey [intended users] to find out how they currently discover work, connect with crew, and share technical knowledge.
- **Comparable platforms:** compare relevant job, portfolio, and community platforms, noting useful features and gaps.
- **Usability and accessibility:** investigate readable typography, colour contrast, keyboard navigation, form feedback, and responsive layouts.
- **Technology:** confirm how React and Vite support the interface and what Supabase requires for connected accounts and data.
- **Privacy and security:** consider what personal information profiles contain, obtain permission for any test data, and keep credentials out of frontend code and source control.
- **Assets and costs:** check licences and permissions for fonts, images, and logos, and verify any hosting or service costs that apply.

I will record the research sources, dates, findings, and design decisions in the Research and Materials sections of this folio.

### Three key goals

1. **Make the purpose and navigation clear:** users should be able to understand BACKLINE and find its main sections. I will check this by asking [number/type of testers] to identify the purpose and navigate to [named sections], then record where they hesitate or make errors.
2. **Support core discovery tasks:** users should be able to find a relevant project and view a crew profile. I will test these tasks with [testers/device/browser] and record completion, time taken, and feedback.
3. **Deliver a usable, responsible prototype:** the interface should work at [target screen sizes/browsers], communicate preview-mode limitations, and avoid exposing private information or credentials. I will check this using [specific responsive, interaction, and privacy checks].

## 2. Research

### The problem and intended users

The design is based on the need for a focused community space for production workers. BACKLINE combines opportunities, professional profiles, discussion, and communication rather than treating each as a separate task.

To support this problem statement with evidence, I will:

- **Primary research:** [Interview or survey people in the intended audience. Add the date, number and type of participants, questions, main findings, and how the findings affected the design.]
- **Secondary research:** [Compare existing platforms or services used by production workers. Record the features, strengths, weaknesses, and ideas relevant to BACKLINE.]
- **Accessibility research:** [Record what you learned about readable text, colour contrast, keyboard use, responsive layouts, and accessible forms.]

Do not present assumptions about what users need as research findings. For example, replace “users need…” with a sourced finding or identify it as a design assumption to test.

### Existing product and technology research

The project is implemented as a React application using Vite. Its connected mode uses Supabase for authentication and data services; without the required environment settings, the app uses sample data in preview mode. This lets the interface be demonstrated without a connected backend, but preview changes are temporary and reset when the page is refreshed.

The project also contains a simpler static website version. Comparing the static and React versions can help explain the difference between a visual prototype and an interactive application, if that reflects the actual development process.

### Research sources to consult and record

Use the sources below to verify technical choices, then add the specific information you used and the date you accessed each source:

- React documentation — <https://react.dev/learn>
- Vite guide — <https://vite.dev/guide/>
- Supabase documentation — <https://supabase.com/docs>
- MDN Web Docs, HTML/CSS/JavaScript learning resources — <https://developer.mozilla.org/>

**Other research sources:** [Add relevant interviews, surveys, articles, competitor websites, accessibility guidance, and their dates.]

## 3. Selection and Justification of Materials, Components, Processes, and Other Resources

This is a digital product, so its “materials” are software, digital assets, devices, and online services rather than physical construction materials.

| Selection | Purpose | Justification |
|---|---|---|
| React | Builds the interface from reusable components and pages. | Suitable for a multi-page interactive product with shared elements such as navigation, cards, and dialogs. |
| Vite | Runs the development server and builds the application. | Provides the project's local development and production build workflow. |
| HTML, CSS, and JavaScript | Structure, style, and interaction. | Core web technologies used to create the browser-based interface. |
| Supabase | Optional connected authentication, database, storage, and realtime services. | Allows the project to move beyond local sample data when configured. |
| Preview/sample data | Demonstrates interactions without a configured backend. | Makes the prototype easier to present, while the interface warns that changes are temporary. |
| Computer and web browser | Development and testing. | Required to write, run, inspect, and demonstrate the web application. |
| [Design / planning tool] | [Purpose] | [Why it was appropriate; include only if you used it.] |

### Processes used

The project process is to identify a user need, plan the information and interface, develop the pages and interactions, test the result, and modify the design based on evidence. Record the tools and actual sequence you used in the procedure log below.

### Digital assets and services

Record the origin and usage rights for any logo, photograph, icon, font, or other asset included in the final product:

| Asset or service | Source / owner | Permission or licence | Use in project |
|---|---|---|---|
| BACKLINE logo | [Add source / creator] | [Add permission or licence] | Branding |
| Google Fonts (DM Sans and Space Grotesk) | Google Fonts | [Verify current licence and record] | Typography |
| Other images or assets | [Add source] | [Add permission or licence] | [Where used] |

## 4. Development of Ideas

The central idea is a production-industry community rather than a general social network. The interface organises its core activities into separate sections:

- **Discover:** search, filter, and sort production listings.
- **People and profiles:** browse crew and view their skills and work.
- **Feed:** share updates and interact with posts.
- **Forum:** browse discussions and post or reply when signed in.
- **Messages:** communicate privately.
- **Notifications:** see activity related to the account.

The project files include both a static website and a React application. Use screenshots or saved versions to show how the idea developed from one to the other, if that was the order in which you made them.

### Ideas and alternatives considered

| Idea | Advantages | Limitations | Decision |
|---|---|---|---|
| A static promotional website | Simple to build and useful for explaining the concept. | Does not provide persistent accounts, shared content, or full community interactions. | [Explain whether this was used as an early prototype or rejected.] |
| A general social platform | Familiar pattern for users. | Could be too broad and make production opportunities and crew skills harder to find. | [Explain your decision.] |
| A focused production community with listings, profiles, discussions, and messages | Brings several relevant activities together for the intended audience. | More complex to implement and test. | Selected direction for BACKLINE. |

**Evidence to include:** [Early sketches, wireframes, navigation map, alternative layouts, screenshots of iterations, and annotations showing what changed and why.]

## 5. Appropriateness of Design and Design Modification

The design is appropriate to the project aim because its pages correspond to the main activities of the intended community: finding projects, finding people, sharing updates, discussing technical topics, and communicating. Reusable page components and shared navigation help make those activities feel like parts of one product.

The current implementation also distinguishes preview mode from connected mode. Preview mode uses sample data and tells users that changes reset after refreshing. Connected mode can use Supabase when both required environment settings are present.

### Evaluation and modifications

Complete this table from your own tests and evidence. A feature being present in the code is not the same as proving that users can use it successfully.

| Design criterion | Test or feedback evidence | Result | Modification made / next change |
|---|---|---|---|
| Users understand the purpose | [Who tested it, task, and feedback] | [Result] | [Change or “no change,” with reason] |
| Users can find a project | [Task and observed result] | [Result] | [Change] |
| Navigation is understandable | [Task and observed result] | [Result] | [Change] |
| Text and controls are usable | [Screen/browser/accessibility checks] | [Result] | [Change] |
| Preview-mode limitations are clear | [Test and observed result] | [Result] | [Change] |

Known limitations visible in the project include the temporary nature of preview-mode data, and the fact that expressing interest in a project starts a conversation rather than submitting a formal application. Include these limitations in your evaluation and explain whether they are acceptable for the project scope.

## 6. Project Management

I managed the project by dividing the work into stages and checking progress against the project deadline. Complete the status and evidence columns from your actual work rather than estimating after the fact.

| Stage | Tasks | Status | Evidence / notes |
|---|---|---|---|
| Define | Identify the problem, users, and success criteria. | [Status] | [Evidence] |
| Research | Investigate users, comparable products, and technologies. | [Status] | [Evidence] |
| Plan | Sketch the layout, navigation, and feature priorities. | [Status] | [Evidence] |
| Prototype | Create an initial layout and test the concept. | [Status] | [Evidence] |
| Develop | Implement pages, navigation, and interactions. | [Status] | [Evidence] |
| Test and modify | Check functionality, usability, and responsive behaviour; make changes. | [Status] | [Evidence] |
| Present and evaluate | Prepare the final demonstration and evaluate against criteria. | [Status] | [Evidence] |

**Challenges and responses:** [Describe a real problem, its effect on the project, what you tried, and the outcome.]

## 7. Timeplan

Fill in the dates and actual hours from your calendar, class records, or version history. Adjust the number of weeks to match your assignment.

| Week / dates | Planned work | Actual work completed | Hours | Change to plan / reason |
|---|---|---|---:|---|
| [Week 1 / dates] | Define the project and research users. | [Complete] | [ ] | [ ] |
| [Week 2 / dates] | Research comparable products and plan interface. | [Complete] | [ ] | [ ] |
| [Week 3 / dates] | Sketch and prototype the main screens. | [Complete] | [ ] | [ ] |
| [Week 4 / dates] | Build the core pages and navigation. | [Complete] | [ ] | [ ] |
| [Week 5 / dates] | Add interactions and connected/preview data behaviour. | [Complete] | [ ] | [ ] |
| [Week 6 / dates] | Test, modify, document, and present. | [Complete] | [ ] | [ ] |

**Total project hours:** [Add actual hours.]

## 8. Finance Plan

Record actual costs and distinguish purchases from free tools or services. Hosting and service providers can change their pricing and free-tier limits, so check the current terms before submitting a final estimate.

| Item | Planned cost | Actual cost | Notes |
|---|---:|---:|---|
| Computer / device | $[ ] | $[ ] | [Existing equipment or new purchase] |
| Internet access | $[ ] | $[ ] | [Incremental cost attributable to project, if any] |
| Software / development tools | $[ ] | $[ ] | [List tools and whether free, school-provided, or paid] |
| Hosting | $[ ] | $[ ] | [Provider, plan, and period] |
| Database / backend service | $[ ] | $[ ] | [Provider, plan, and period] |
| Domain name | $[ ] | $[ ] | [If purchased] |
| Other | $[ ] | $[ ] | [Describe] |
| **Total** | **$[ ]** | **$[ ]** | |

If existing equipment or free software is used, state that clearly; do not describe it as having no value if your course requires you to include the value of donated or existing resources.

## 9. Calculations

Show the working, units, and assumptions for each calculation required by your teacher. For this software project, relevant calculations may include project time and costs.

### Project time

For each activity:

`Activity hours = number of work sessions × average hours per session`

`Total project hours = sum of the hours for all activities`

**Example using my records:** [Insert your session counts, average duration, working, and total.]

### Project cost

`Total project cost = sum of actual costs for all project items`

If a service is charged monthly:

`Service cost = monthly price × number of months used`

**Example using current prices and project duration:** [Insert provider, checked price, number of months, calculation, and source/date.]

If required by your course, estimate the value of labour:

`Labour value = project hours × chosen hourly rate`

`Estimated total value = actual project costs + labour value`

State the hourly rate and why you selected it. Do not include an invented rate or price.

## 10. Record of Procedures

Use this as a contemporaneous log. Add entries as you work, with dates and evidence such as screenshots, sketches, test notes, or version history.

| Date | Procedure / task | Tools or resources used | Outcome / decision | Evidence |
|---|---|---|---|---|
| [Date] | Set up the project and reviewed the existing files. | Computer, code editor, project files. | [What you found or decided] | [Screenshot / note] |
| [Date] | Ran the local development version. | Node.js, npm, Vite, browser. | [What worked or failed] | [Screenshot / note] |
| [Date] | Developed or modified [feature/page]. | [Tools and files] | [Outcome] | [Screenshot / version history] |
| [Date] | Tested [task or feature] with [method]. | [Browser/device/test participants] | [Result and follow-up] | [Test record] |
| [Date] | Prepared final build and demonstration. | [Tools] | [Outcome; record errors as well as successes] | [Build output / screenshot] |

For a reproducible local check, the project README documents:

```text
npm install
npm run dev
npm run build
```

Record the date, environment, and actual outcome when you run these commands.

## 11. Evidence of Safe Working Practices and OH&S Issues

Although BACKLINE is a digital project, safe working practices still apply.

### Physical health and safety

- Set up the screen, chair, keyboard, and mouse to support a comfortable posture.
- Take regular breaks and vary tasks to reduce eye strain and repetitive movements.
- Keep drinks away from electrical equipment and keep cables and walkways clear.
- Use school-approved equipment and report damaged equipment to a teacher.

### Digital safety, privacy, and security

- Use sample or test data in demonstrations; do not collect or publish real personal information without permission.
- Keep passwords and private keys confidential. The project documentation specifically warns not to put a Supabase service-role key in frontend code or source control.
- Use a separate test environment for development and avoid changing real user data during testing.
- Obtain permission before using another person's profile, photograph, or work in the folio or application.
- Check the rights and licence for fonts, images, logos, and other digital assets.
- Back up project work using an approved storage location and avoid sharing private repository contents publicly.

### Evidence to attach

Add dated evidence such as [a photograph of your workstation], [a screenshot showing sample data rather than personal data], [asset permission/licence records], and [a note explaining how credentials and backups were handled]. Only include evidence that reflects what you actually did.

## Final evaluation

Overall, BACKLINE [evaluate how well the final product met each design criterion]. Its strongest feature is [reason supported by evidence]. The main limitation is [limitation and evidence]. If I had more time, I would [specific improvement] because [research or test evidence].

## References

Add the sources actually used in your research. Include author/organisation, title, URL, and access date in the citation style required by your course.

- React documentation. <https://react.dev/learn>. Accessed [date].
- Vite guide. <https://vite.dev/guide/>. Accessed [date].
- Supabase documentation. <https://supabase.com/docs>. Accessed [date].
- MDN Web Docs. <https://developer.mozilla.org/>. Accessed [date].
- [Interview, survey, competitor source, accessibility source, or other research]. [Citation and access/date details.]
