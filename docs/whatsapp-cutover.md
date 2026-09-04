# WhatsApp cutover — superseded

The earlier plan to point Meta directly at Niriksh has been superseded.

Bhumika keeps its existing Meta callback, credentials, phone number, conversation logic, and outbound replies. Niriksh exposes no direct WhatsApp webhook. Bhumika sends a curated complaint to Niriksh using the protected service contract documented in [bhumika-integration.md](./bhumika-integration.md).
