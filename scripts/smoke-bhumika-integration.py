#!/usr/bin/env python3
"""Run a safe, fictional smoke test against the deployed Bhumika intake API."""

import argparse
import hashlib
import json
import mimetypes
import ssl
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import parse_qs, quote, urljoin, urlparse

try:
    import certifi
except ImportError:  # The platform trust store is sufficient on most systems.
    certifi = None


def secret_value(secret_arn: str, region: str) -> str:
    result = subprocess.run(
        [
            "aws",
            "secretsmanager",
            "get-secret-value",
            "--secret-id",
            secret_arn,
            "--region",
            region,
            "--query",
            "SecretString",
            "--output",
            "text",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    value = json.loads(result.stdout)
    key = value.get("BHUMIKA_INTEGRATION_KEY")
    if not key:
        raise RuntimeError("BHUMIKA_INTEGRATION_KEY is absent from the AWS secret")
    return key


def send(request: urllib.request.Request) -> tuple[int, dict]:
    context = ssl.create_default_context(cafile=certifi.where() if certifi else None)
    try:
        with urllib.request.urlopen(request, timeout=75, context=context) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        body = json.loads(error.read())
        return error.code, body


def post(url: str, key: str, payload: dict | None = None) -> tuple[int, dict]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload or {}).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Niriksh-Integration-Key": key,
        },
        method="POST",
    )
    return send(request)


def get(url: str, key: str | None = None) -> tuple[int, dict]:
    headers = {"Accept": "application/json"}
    if key:
        headers["X-Niriksh-Integration-Key"] = key
    return send(urllib.request.Request(url, headers=headers, method="GET"))


def upload(url: str, key: str, path: Path, external_evidence_id: str) -> tuple[int, dict]:
    boundary = f"niriksh-{uuid.uuid4().hex}"
    parts: list[bytes] = []
    fields = {
        "external_evidence_id": external_evidence_id,
        "evidence_type": "Screenshot",
        "purpose": "Fictional deployment media test",
        "originality": "Generated demo evidence",
        "context_note": "Synthetic screenshot used only to verify the Niriksh pipeline.",
        "expected_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )
    content = path.read_bytes()
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    parts.append(
        (
            f'--{boundary}\r\nContent-Disposition: form-data; name="evidence"; filename="{path.name}"\r\n'
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode()
        + content
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    request = urllib.request.Request(
        url,
        data=b"".join(parts),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "X-Niriksh-Integration-Key": key,
        },
        method="POST",
    )
    return send(request)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--secret-arn", required=True)
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--evidence-file", type=Path)
    args = parser.parse_args()

    key = secret_value(args.secret_arn, args.region)
    suffix = str(int(time.time()))
    payload = {
        "schema_version": "1.0",
        "submission_id": f"deployment-smoke-{suffix}",
        "conversation_id": f"fictional-conversation-{suffix}",
        "reporter": {
            "external_id": f"fictional-reporter-{suffix}",
            "display_name": "Fictional Deployment Test",
            "preferred_language": "en",
            "consent_to_process": True,
        },
        "description": (
            "Fictional deployment test only. A demo account received repeated "
            "threatening messages from an unknown profile on 4 September 2026."
        ),
        "complaint_details": {
            "incidentDate": "2026-09-04",
            "state": "Karnataka",
            "district": "Bengaluru Urban",
            "incidentStatus": "Ongoing",
            "channel": "WhatsApp",
            "accountOrUrl": "@fictional-deployment-test",
        },
        "evidence": [],
        "finalize": True,
    }

    first_status, first = post(f"{args.api_url.rstrip('/')}/integrations/bhumika/intakes", key, payload)
    second_status, second = post(f"{args.api_url.rstrip('/')}/integrations/bhumika/intakes", key, payload)
    tracking_url = first.get("tracking_url", "")
    token = parse_qs(urlparse(tracking_url).query).get("token", [""])[0]
    public_status, public = get(
        f"{args.api_url.rstrip('/')}/public/tracking/{quote(token, safe='')}"
    ) if token else (0, {})
    updates_status, updates = get(urljoin(args.api_url, first.get("updates_path", "")), key)
    supplement_status, supplement = post(
        urljoin(args.api_url, first.get("supplements_path", "")),
        key,
        {
            "schema_version": "1.0",
            "supplement_id": f"fictional-supplement-{suffix}",
            "description_addendum": "Fictional follow-up: the reporter supplied the demo account identifier.",
            "complaint_details": {"accountOrUrl": "@fictional-follow-up"},
            "evidence": [],
            "finalize": True,
        },
    )

    checks = {
        "first_status": first_status,
        "retry_status": second_status,
        "completed": first.get("processing_status") == "completed",
        "tracking_created": bool(first.get("tracking_number")),
        "tracking_link_created": tracking_url.startswith("https://niriksh.scopophobic.xyz/track?token="),
        "report_created": bool((first.get("report") or {}).get("version")),
        "retry_is_duplicate": second.get("duplicate") is True,
        "retry_same_tracking": first.get("tracking_number") == second.get("tracking_number"),
        "public_tracking_status": public_status,
        "public_tracking_matches": public.get("tracking_number") == first.get("tracking_number"),
        "public_tracking_is_safe": not ({"complaint_id", "description", "evidence", "report"} & set(public)),
        "updates_status": updates_status,
        "updates_returned": bool(updates.get("updates")),
        "supplement_status": supplement_status,
        "supplement_same_tracking": supplement.get("tracking_number") == first.get("tracking_number"),
        "supplement_report_version": (supplement.get("report") or {}).get("version"),
        "analysis_mode": (first.get("analysis") or {}).get("mode"),
    }
    print(json.dumps(checks, indent=2))
    if not (
        first_status == 201
        and second_status == 200
        and checks["completed"]
        and checks["tracking_created"]
        and checks["tracking_link_created"]
        and checks["report_created"]
        and checks["retry_is_duplicate"]
        and checks["retry_same_tracking"]
        and public_status == 200
        and checks["public_tracking_matches"]
        and checks["public_tracking_is_safe"]
        and updates_status == 200
        and checks["updates_returned"]
        and supplement_status == 201
        and checks["supplement_same_tracking"]
        and checks["supplement_report_version"] == 2
    ):
        raise SystemExit(1)

    if args.evidence_file:
        media_suffix = f"{suffix}-media"
        media_payload = {
            **payload,
            "submission_id": f"deployment-smoke-{media_suffix}",
            "conversation_id": f"fictional-conversation-{media_suffix}",
            "evidence": [
                {
                    "name": args.evidence_file.name,
                    "type": "Screenshot",
                    "size": str(args.evidence_file.stat().st_size),
                    "mimeType": mimetypes.guess_type(args.evidence_file.name)[0],
                    "contextNote": "Synthetic deployment test evidence.",
                }
            ],
            "finalize": False,
        }
        base = f"{args.api_url.rstrip('/')}/integrations/bhumika/intakes"
        intake_status, intake = post(base, key, media_payload)
        upload_url = urljoin(args.api_url, intake.get("evidence_upload_path", ""))
        upload_status, first_upload = upload(upload_url, key, args.evidence_file, f"fictional-evidence-{media_suffix}")
        retry_upload_status, retry_upload = upload(upload_url, key, args.evidence_file, f"fictional-evidence-{media_suffix}")
        finalize_url = urljoin(args.api_url, intake.get("finalize_path", ""))
        finalize_status, finalized = post(finalize_url, key)
        media_checks = {
            "intake_status": intake_status,
            "upload_status": upload_status,
            "retry_upload_status": retry_upload_status,
            "retry_upload_is_duplicate": retry_upload.get("duplicate") is True,
            "finalize_status": finalize_status,
            "completed": finalized.get("processing_status") == "completed",
            "tracking_created": bool(finalized.get("tracking_number")),
            "report_created": bool((finalized.get("report") or {}).get("version")),
            "analysis_mode": (finalized.get("analysis") or {}).get("mode"),
            "first_upload_accepted": first_upload.get("accepted") is True,
        }
        print(json.dumps({"media": media_checks}, indent=2))
        if not (
            intake_status == 201
            and upload_status == 201
            and retry_upload_status == 200
            and media_checks["retry_upload_is_duplicate"]
            and finalize_status == 200
            and media_checks["completed"]
            and media_checks["tracking_created"]
            and media_checks["report_created"]
        ):
            raise SystemExit(1)


if __name__ == "__main__":
    main()
