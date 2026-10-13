# Friction log

Problems hit while building Spotter, logged as they happened.

| # | Date | Area | Task attempted | Expected | Actual | Severity | Workaround | Suggestion |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-13 | AWS CloudShell | Open CloudShell (ap-south-1) to deploy a bootstrap CloudFormation stack | Shell opens with console credentials | "Unable to create the environment. Your account verification is in progress" on an account opened 5+ weeks earlier, with no other sign of pending verification in the console | Medium | Deployed the stack through the CloudFormation console upload instead | Show verification status (and what's pending) on the account/billing pages, not only inside CloudShell |
| 2 | 2026-10-13 | Amazon Bedrock | Submit the Anthropic use-case form (ap-south-1) to enable Claude models | Form submits, model access granted | "Your account is not authorized to perform this action. Please create a support case" after filling in every field | High (blocks the AI coach) | Opened an AWS Support case; AI coach built behind a model switch so another provider can be used meanwhile | Check eligibility before showing the form, and name the specific reason (e.g. pending account verification) in the error |
| 3 | 2026-10-13 | AWS Support | Create a case for the above | A category or form to pick | An AI chat box is the entry point; unclear whether an account case was actually opened | Low | Described the issue in full in the chat box | Show a clear "case created, ID …" confirmation |
| 4 | 2026-10-13 | npm (tooling) | Install a GitHub-hosted TypeScript package that builds in `prepare` | Silent install | npm 11 prints an install-scripts approval warning for git dependencies even though the build ran | Low | None needed | — |
