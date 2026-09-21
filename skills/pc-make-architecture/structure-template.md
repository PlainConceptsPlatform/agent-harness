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
