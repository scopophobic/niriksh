# WhatsApp cutover — Niriksh is the single point of contact

This reverses the previous decision recorded here. Niriksh now owns the direct Meta/WhatsApp webhook: signature verification, conversation state, questions, language handling, media download, and replies all run inside Niriksh (`backend/app/modules/whatsapp/`, `lib/whatsapp-chat-engine.ts`). See [bhumika-integration.md](./bhumika-integration.md)'s "Ownership boundary" section for the current split.

Bhumika's curated-submission API contract (also documented in `bhumika-integration.md`) remains live in parallel — it is not what this cutover changes. If Bhumika's own Meta webhook subscription for this phone number is still active, turn it off once Niriksh's webhook is verified and receiving traffic, or both services will race to answer the same incoming messages.
