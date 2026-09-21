# ARCHITECTURE.md structure template

Write (or update) `ARCHITECTURE.md` following this structure. Only include sections relevant to the project; omit sections with no evidence.

- Architecture Overview: what the system is, what problem it solves, major architectural style
- 1. Project Structure: annotated directory tree with purpose of each major directory
- 2. High-Level System Diagram: Mermaid diagram of actors, services, data stores, external systems
- 3. Core Components: each major component: name, responsibility, key files, technologies, inputs/outputs
  - 3.1 Frontend / User Interface (if present)
  - 3.2 Backend / Server / API (if present)
  - 3.3 Shared Libraries / Common Code (if present)
  - 3.4 CLI / Scripts / Automation (if present)
- 4. Data Flow: request lifecycle, key user journeys, sequence diagram for main runtime flow
- 5. Data Stores: all persistent storage: type, purpose, schemas, migration approach
- 6. External Integrations / APIs: each integration: method, config location, auth, failure behavior
- 7. Key Technologies: full stack summary with architectural relevance of each
- 8. Deployment & Infrastructure: build artifacts, env config, containerization, CI/CD, hosting
- 9. Security Architecture: auth, authz, secrets, input validation, trust boundaries
- 10. Monitoring & Observability: logging, metrics, tracing, error reporting
- 11. Performance & Scalability: caching, batching, concurrency, known bottlenecks
- 12. Development Workflow: local setup, install/dev/test/build/lint commands
- 13. Testing Strategy: test frameworks, locations, coverage gates, gaps
- 14. Architectural Decisions & Rationale: key choices with evidence and tradeoffs
- 15. Constraints, Risks, and Technical Debt: tight coupling, TODOs, operational risks
- 16. Future Considerations: documented roadmap + reasonable recommendations (labeled as such)
- 17. Project Identification: name, language, type, runtime, date of review, maintainer
- 18. Glossary / Acronyms: project-specific terms an agent or new developer needs to know

Append at the very end of the file:
```
<!-- Last updated: <current ISO timestamp> -->
```

Rules:
- Be specific and concrete: include actual directories, files, modules, commands.
- Mark anything undiscoverable as "Not evident from the repository".
- Use Mermaid diagrams where helpful.
- Write as if this document will be committed and maintained over time.

## Writing rules

These rules govern the voice and shape of every section. The ARCHITECTURE.md is the primary artifact an agent reads to understand the system's invariants — it must teach constraints, not just inventory structure. These are enforced by re-reading each section after generation (see the self-check in the skill).

1. **Every section must answer "what breaks if this is violated," not just "what exists."** A section that only describes structure without stating the constraint it protects and the consequence of crossing it is reference material, not architecture. "The system has four modules" is structure; "Modules must not cross-reference each other in Domain or Application, and flow goes through port interfaces or domain events" is a constraint.

2. **Architectural decisions must carry their rationale and what they superseded.** A decision table row that says "Adopt X" is a fact; "Adopt X because Y, supersedes decision Z which assumed W" is a constraint that teaches an agent why a change would be wrong. If a decision was reached after rejecting an alternative, name the alternative and why it was rejected.

3. **State boundaries as prohibitions with consequences.** "Layering is enforced: Api → Application → Domain" is a constraint. "Api → Application → Domain" alone is a dependency list. "Only the Composition namespace in Api reaches Infrastructure" is a constraint; "Api depends on Infrastructure" is a fact. Prefer the constraint form: name the boundary, state who must not cross it, and what breaks when it is crossed.

4. **Include what was tried and rejected, not just what was chosen.** The most valuable architecture decisions are the ones where an alternative was tested and found wanting. A section that says "dynamic sessions were rejected because they accept no volumes, cost more at scale, and are blocked by policy" teaches an agent more than "the engine runs as a container app."

5. **Narrative over inventory.** Describe how the system behaves, what holds it together, and where the seams are. A reader who understands the constraints can infer the structure; a reader who only sees the structure cannot infer the constraints.

## Self-check (before writing the file)

Re-read every section you are about to write. Then:

1. **Identify inventory-only sections.** If a section describes what exists without stating what breaks when its constraints are violated, rewrite it as constraint-embedded prose or cut it.

2. **Check decision rows.** Every row in the decisions table must carry its rationale. If a decision has no "why," it is a fact, not a decision — cut it or find the rationale.

3. **Scan for bare dependency lists.** "Api depends on Application depends on Domain" is a fact. Rewrite it as: name the boundary, state who must not cross it, and what breaks when it is crossed.

4. **Verify rejected alternatives are present where they matter.** If a significant architectural choice was made, the rejected alternative and the reason for rejection should be in the document. An agent that does not know what was rejected will propose it again.
