# Security

## Reporting

If you find a vulnerability, please **do not open a public issue**. Use GitHub's
private reporting instead — the *Security* tab, then *Report a vulnerability* —
which reaches the maintainer without publishing anything.

Expect a first reply within a week.

## Scope

This is a static site: a browser game and a gallery page, served from a CDN,
with no accounts, no login and no server of its own. That rules out most of
what usually matters. The things that are still worth reporting:

- Anything that lets one visitor affect what another visitor sees
- A way to make the page execute content it did not author
- Something in the build or dependency chain that ships code nobody intended

## Not vulnerabilities

- **Configuration visible in the page.** The analytics id and the form links
  are downloaded by every visitor by design. They are not secrets, and they are
  not in the repository — see `.env.example`.
- **The gallery manifest being readable.** It lists public images.
- **Being able to paint anything you like.** That is the entire program.
