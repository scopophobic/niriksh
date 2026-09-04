def extract_messages(body: dict) -> list[dict]:
    """Normalize Meta's nested webhook shape into transport-independent messages."""
    messages: list[dict] = []
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            contacts = {contact.get("wa_id"): contact.get("profile", {}).get("name") for contact in value.get("contacts", [])}
            for raw in value.get("messages", []):
                sender = raw.get("from")
                if not sender:
                    continue
                message = {
                    "from": sender,
                    "display_name": contacts.get(sender),
                    "id": raw.get("id"),
                    "timestamp": raw.get("timestamp"),
                    "type": raw.get("type", "unknown"),
                    "text": "",
                    "button_id": None,
                    "media": [],
                    "location": None,
                    "raw": raw,
                }
                kind = message["type"]
                if kind == "text":
                    message["text"] = raw.get("text", {}).get("body", "")
                elif kind == "interactive":
                    interactive = raw.get("interactive", {})
                    reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
                    message["button_id"] = reply.get("id")
                    message["text"] = reply.get("title", "")
                elif kind == "button":
                    message["text"] = raw.get("button", {}).get("text", "")
                elif kind in {"image", "audio", "voice", "video", "document"}:
                    media = raw.get(kind, {})
                    message["media"].append({
                        "id": media.get("id"),
                        "kind": "audio" if kind == "voice" else kind,
                        "mime_type": media.get("mime_type"),
                        "sha256": media.get("sha256"),
                        "filename": media.get("filename"),
                    })
                    message["text"] = media.get("caption", "")
                elif kind == "location":
                    location = raw.get("location", {})
                    message["location"] = {
                        "lat": location.get("latitude"),
                        "lng": location.get("longitude"),
                        "name": location.get("name", ""),
                        "address": location.get("address", ""),
                    }
                messages.append(message)
    return messages


def describe_message(message: dict) -> str:
    if message.get("text"):
        return message["text"].strip()
    if message.get("location"):
        loc = message["location"]
        name = loc.get("name") or loc.get("address") or "shared location"
        return f"Location: {name} ({loc.get('lat')}, {loc.get('lng')})"
    if message.get("media"):
        return "Attached " + ", ".join(item.get("kind", "media") for item in message["media"])
    return "Unsupported WhatsApp message"

