import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterable

from app.core.config import Settings


@dataclass(frozen=True)
class StoredObject:
    key: str
    size: int
    sha256: str


class EvidenceStorage:
    async def put_stream(self, key: str, chunks: AsyncIterable[bytes], maximum: int, expected_sha256: str | None = None) -> StoredObject:
        raise NotImplementedError

    def put_bytes(self, key: str, content: bytes, maximum: int, expected_sha256: str | None = None) -> StoredObject:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def get_bytes(self, key: str, maximum: int) -> bytes:
        raise NotImplementedError

    def local_path(self, key: str) -> Path | None:
        return None

    def signed_download_url(self, key: str, filename: str, mime_type: str) -> str | None:
        return None


class LocalEvidenceStorage(EvidenceStorage):
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        target = (self.root / key).resolve()
        if self.root not in target.parents:
            raise ValueError("Storage key escapes evidence root")
        return target

    async def put_stream(self, key: str, chunks: AsyncIterable[bytes], maximum: int, expected_sha256: str | None = None) -> StoredObject:
        target = self._path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        size = 0
        try:
            with target.open("xb") as output:
                async for chunk in chunks:
                    size += len(chunk)
                    if size > maximum:
                        raise ValueError("too_large")
                    digest.update(chunk)
                    output.write(chunk)
            result = StoredObject(key=key, size=size, sha256=digest.hexdigest())
            if expected_sha256 and result.sha256 != expected_sha256:
                raise ValueError("digest_mismatch")
            return result
        except Exception:
            target.unlink(missing_ok=True)
            raise

    def put_bytes(self, key: str, content: bytes, maximum: int, expected_sha256: str | None = None) -> StoredObject:
        if len(content) > maximum:
            raise ValueError("too_large")
        target = self._path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(content).hexdigest()
        if expected_sha256 and digest != expected_sha256:
            raise ValueError("digest_mismatch")
        with target.open("xb") as output:
            output.write(content)
        return StoredObject(key=key, size=len(content), sha256=digest)

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def get_bytes(self, key: str, maximum: int) -> bytes:
        target = self._path(key)
        if target.stat().st_size > maximum:
            raise ValueError("too_large")
        return target.read_bytes()

    def local_path(self, key: str) -> Path | None:
        return self._path(key)


class S3EvidenceStorage(EvidenceStorage):
    def __init__(
        self,
        bucket: str,
        region: str,
        prefix: str,
        endpoint_url: str = "",
        access_key_id: str = "",
        secret_access_key: str = "",
        force_path_style: bool = False,
    ):
        if not bucket:
            raise ValueError("EVIDENCE_S3_BUCKET is required for S3 storage")
        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self.prefix = prefix.strip("/")
        options = {
            "region_name": region,
            "config": Config(
                signature_version="s3v4",
                s3={"addressing_style": "path" if force_path_style else "auto"},
            ),
        }
        if endpoint_url:
            options["endpoint_url"] = endpoint_url.rstrip("/")
        if access_key_id:
            options["aws_access_key_id"] = access_key_id
        if secret_access_key:
            options["aws_secret_access_key"] = secret_access_key
        self.client = boto3.client("s3", **options)

    def _key(self, key: str) -> str:
        clean = key.lstrip("/")
        return f"{self.prefix}/{clean}" if self.prefix else clean

    async def put_stream(self, key: str, chunks: AsyncIterable[bytes], maximum: int, expected_sha256: str | None = None) -> StoredObject:
        content = bytearray()
        async for chunk in chunks:
            content.extend(chunk)
            if len(content) > maximum:
                raise ValueError("too_large")
        return self.put_bytes(key, bytes(content), maximum, expected_sha256)

    def put_bytes(self, key: str, content: bytes, maximum: int, expected_sha256: str | None = None) -> StoredObject:
        if len(content) > maximum:
            raise ValueError("too_large")
        digest = hashlib.sha256(content).hexdigest()
        if expected_sha256 and digest != expected_sha256:
            raise ValueError("digest_mismatch")
        object_key = self._key(key)
        self.client.put_object(Bucket=self.bucket, Key=object_key, Body=content, Metadata={"sha256": digest})
        return StoredObject(key=object_key, size=len(content), sha256=digest)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def get_bytes(self, key: str, maximum: int) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        if response.get("ContentLength", 0) > maximum:
            response["Body"].close()
            raise ValueError("too_large")
        try:
            content = response["Body"].read(maximum + 1)
        finally:
            response["Body"].close()
        if len(content) > maximum:
            raise ValueError("too_large")
        return content

    def signed_download_url(self, key: str, filename: str, mime_type: str) -> str | None:
        safe = re.sub(r"[\r\n\"]", "", filename)
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key, "ResponseContentType": mime_type, "ResponseContentDisposition": f'attachment; filename="{safe}"'},
            ExpiresIn=60,
        )


def build_evidence_storage(settings: Settings) -> EvidenceStorage:
    if settings.evidence_storage_backend.lower() == "s3":
        return S3EvidenceStorage(
            settings.evidence_s3_bucket,
            settings.evidence_s3_region,
            settings.evidence_s3_prefix,
            settings.evidence_s3_endpoint_url,
            settings.evidence_s3_access_key_id,
            settings.evidence_s3_secret_access_key,
            settings.evidence_s3_force_path_style,
        )
    return LocalEvidenceStorage(settings.evidence_storage_path)
