import logging

import httpx
from sqlalchemy.orm import Session

from app.db.models import GeocodeCache

logger = logging.getLogger(__name__)

REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "niriksh-whatsapp-intake/1.0 (+https://github.com/scopophobic/niriksh)"


def reverse_geocode(db: Session, lat: float | None, lng: float | None) -> dict | None:
    """Best-effort WhatsApp location pin -> {"state", "district"}, using OpenStreetMap's free
    Nominatim reverse-geocoding API -- same service and approach the original umang-reimagined
    source used for this exact purpose (lib/geocode.js's reverseGeocode), which was never wired
    into the real Meta webhook there either. Cached by coordinates rounded to ~11m, since
    Nominatim's usage policy caps anonymous use at roughly 1 request/second and expects callers
    to cache results rather than re-query the same area repeatedly.

    Returns None rather than a partial guess when Nominatim can't name a state -- an absent
    state gets asked for in the normal conversation flow; a wrong one gets filed and routed to
    the wrong jurisdiction.
    """
    if lat is None or lng is None:
        return None
    try:
        lat_f, lng_f = float(lat), float(lng)
    except (TypeError, ValueError):
        return None

    key = f"{lat_f:.4f},{lng_f:.4f}"
    cached = db.get(GeocodeCache, key)
    if cached:
        return {"state": cached.state, "district": cached.district}

    try:
        response = httpx.get(
            REVERSE_ENDPOINT,
            params={"lat": lat_f, "lon": lng_f, "format": "jsonv2", "addressdetails": "1", "zoom": "10"},
            headers={"User-Agent": USER_AGENT},
            timeout=8,
        )
        response.raise_for_status()
        address = response.json().get("address", {})
    except Exception as error:
        logger.warning("[whatsapp-geocode] reverse lookup failed: %s", error)
        return None

    state = address.get("state") or address.get("ISO3166-2-lvl4")
    if not state:
        return None
    district = (
        address.get("state_district") or address.get("county")
        or address.get("city_district") or address.get("city") or address.get("town")
    )

    db.add(GeocodeCache(key=key, state=state, district=district))
    try:
        db.commit()
    except Exception:
        db.rollback()
    return {"state": state, "district": district}
