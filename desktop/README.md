# Nook Desktop (Phase 2 scaffold)

This directory is an intentionally non-runnable Windows-first Tauri foundation. It is not linked to the web build and is not presented as a live download.

The desktop runtime will eventually:

- pair with the web control room using a short-lived, single-use code;
- mirror durable task states without receiving provider OAuth tokens;
- expose pause, hide, mute, and emergency-stop controls;
- keep screen movement within safe monitor work areas; and
- open approvals in the web control room so a decision is consumed once.

Before enabling a build, add the Tauri CLI in a dedicated desktop package, generate signing keys outside the repository, pin allowed control-room origins, and complete the pairing and revocation API.

The current scaffold deliberately exposes no native commands, filesystem access, browser automation, updater, shell, or global-shortcut permissions.
