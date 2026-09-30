export type ProjectCaseStudy = {
  repository: string;
  problem: string;
  designDecisions: string[];
  architecture: string;
  constraints: string[];
  lessons: string[];
  status: string;
};

export const projectCaseStudies: ProjectCaseStudy[] = [
  {
    repository: "fetch-php",
    problem: "PHP developers often reach for powerful HTTP clients that can feel heavier than necessary for straightforward product work. Fetch PHP focuses on a familiar, low-friction request model.",
    designDecisions: [
      "Keep the public API close to the mental model developers already know from fetch-style clients.",
      "Make common JSON and response flows easy while preserving access to lower-level HTTP behavior.",
      "Treat documentation examples as part of the API surface."
    ],
    architecture: "A small PHP package that wraps request construction, execution, and response handling behind predictable developer-facing primitives.",
    constraints: [
      "Compatibility matters because package users build workflows around existing behavior.",
      "The library has to stay small enough to remain easy to understand and maintain."
    ],
    lessons: [
      "Familiar APIs create useful adoption, but they also create expectations that must be respected.",
      "Defaults, naming, and documentation are product decisions, not afterthoughts."
    ],
    status: "Actively maintained as a public developer tool."
  },
  {
    repository: "filterable",
    problem: "Filtering logic in Laravel applications can become repetitive, scattered, and difficult to test as APIs and dashboards grow.",
    designDecisions: [
      "Move filtering behavior into reusable structures that keep controllers and query surfaces clean.",
      "Support practical product query patterns without turning the package into an opaque query language.",
      "Optimize for maintainability in data-heavy application code."
    ],
    architecture: "A Laravel-focused package that organizes request-driven filtering into explicit, reusable query behavior.",
    constraints: [
      "The package needs to fit Laravel conventions rather than fight them.",
      "Flexibility has to be balanced against clear behavior and readable implementation."
    ],
    lessons: [
      "Reusable application patterns should remove repetition without hiding business intent.",
      "Framework packages succeed when they feel native to the framework's existing habits."
    ],
    status: "Maintained as a Laravel package with ongoing public usage."
  },
  {
    repository: "phpvm",
    problem: "PHP developers often need to switch versions locally without accepting a heavyweight setup for everyday project work.",
    designDecisions: [
      "Prioritize installation ergonomics and direct CLI behavior.",
      "Keep version switching explicit and understandable.",
      "Avoid adding abstractions that make local environments harder to diagnose."
    ],
    architecture: "A lightweight command-line utility oriented around practical local PHP version management.",
    constraints: [
      "Local tooling has to be predictable across developer environments.",
      "The tool should stay transparent enough for users to debug their own setup."
    ],
    lessons: [
      "Developer tools earn trust when they reduce setup friction and explain what they are doing.",
      "CLI tools benefit from boring, memorable commands."
    ],
    status: "Public open-source tooling with a focused maintenance scope."
  },
  {
    repository: "comet",
    problem: "Developer-facing workflows need enough structure to remain maintainable while still feeling quick to use and iterate on.",
    designDecisions: [
      "Use TypeScript to make the internal shape easier to reason about.",
      "Keep the project focused on clear user flows rather than broad platform ambition.",
      "Treat packaging and release quality as part of the product experience."
    ],
    architecture: "A TypeScript project organized around developer-facing workflow structure and practical release ergonomics.",
    constraints: [
      "The implementation needs to balance experimentation with maintainable internals.",
      "Public project signals should stay aligned with what the repository actually does."
    ],
    lessons: [
      "Typed project structure helps small tools stay adaptable as they grow.",
      "Product polish and engineering discipline reinforce each other."
    ],
    status: "Public repository used as evidence of TypeScript tooling and product-minded engineering."
  },
  {
    repository: "matrix",
    problem: "Asynchronous PHP can become hard to reason about when task ownership, failure behavior, and event visibility are unclear.",
    designDecisions: [
      "Model concurrency through explicit primitives rather than hidden control flow.",
      "Make failure propagation and cancellation behavior part of the API design.",
      "Keep the library composable with application-level observability and framework patterns."
    ],
    architecture: "A PHP async-oriented library exploring concurrency, task coordination, and event-driven application flows.",
    constraints: [
      "Async APIs need to stay understandable under operational pressure.",
      "The primitive should remain small enough to compose with real applications."
    ],
    lessons: [
      "Event-driven design needs visible causality, not just decoupling.",
      "Async library ergonomics are reliability work."
    ],
    status: "Maintained as a public library and architecture learning surface."
  }
];

export function getProjectCaseStudy(repository: string) {
  return projectCaseStudies.find((caseStudy) => caseStudy.repository === repository);
}
