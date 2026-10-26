# Security policy

FutFox is a read-only Chrome extension: it never buys, bids, lists, moves players, saves
squads or submits SBCs. If you find a way it could change someone's account, leak data or run
code it shouldn't, please report it privately.

## Reporting a vulnerability

Report it through GitHub's private vulnerability reporting:
https://github.com/abouhilalbadr/futfox/security/advisories/new

You can also open the repository's **Security** tab and choose **Report a vulnerability**.
Please don't open a public issue, pull request or discussion for a security problem.

Include:

- what you found and what an attacker could do with it,
- the steps to reproduce it,
- the FutFox version (from `manifest.json`) and your Chrome version.

## What happens next

- You get a first reply within 7 days, confirming whether the report is a vulnerability.
- A confirmed vulnerability is fixed on `main` as soon as possible, aiming for 30 days.
- Disclosure is coordinated with you: the advisory is published once the fix is released,
  with credit to you unless you'd rather stay anonymous.

## Supported versions

Only the latest version on the `main` branch is supported. Fixes are not backported.

## Scope

In scope: the extension in this repository and the website in `store/futfox-site`.
Out of scope: EA's Web App and services, and issues that need a compromised browser or
computer.
