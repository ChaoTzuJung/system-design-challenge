import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

import idna

MAX_URL_LENGTH = 2048

BLOCKED_DOMAINS = {
    "evil.com",
    "malware.example.com",
    "phishing.example.com",
}

DEFAULT_PORTS = {"http": 80, "https": 443}


def is_blocked_domain(hostname: str | None) -> bool:
    if hostname is None:
        return True
    return hostname.lower() in BLOCKED_DOMAINS


def _is_unsafe_ip(ip_str: str) -> bool:
    ip = ipaddress.ip_address(ip_str)
    return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved


def _check_ssrf(hostname: str) -> None:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise ValueError(f"Cannot resolve host: {hostname}")
    for info in infos:
        ip_str = info[4][0]
        if _is_unsafe_ip(ip_str):
            raise ValueError(f"URL resolves to a blocked IP: {ip_str}")


def validate_url(url: str) -> str:
    if not url or not isinstance(url, str):
        raise ValueError("URL is required")
    if len(url) > MAX_URL_LENGTH:
        raise ValueError(f"URL exceeds max length of {MAX_URL_LENGTH} characters")

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("URL scheme must be http or https")
    if not parsed.hostname:
        raise ValueError("URL must include a hostname")

    try:
        idna_host_bytes = idna.encode(parsed.hostname)
        idna_host = idna_host_bytes.decode("ascii").lower()
    except idna.IDNAError as e:
        raise ValueError(f"Invalid hostname: {e}")

    if is_blocked_domain(idna_host):
        raise ValueError(f"Hostname is blocked: {idna_host}")

    _check_ssrf(idna_host)

    scheme = parsed.scheme.lower()
    port = parsed.port
    netloc = idna_host
    if port is not None and port != DEFAULT_PORTS.get(scheme):
        netloc = f"{idna_host}:{port}"
    if parsed.username or parsed.password:
        userinfo = parsed.username or ""
        if parsed.password:
            userinfo = f"{userinfo}:{parsed.password}"
        netloc = f"{userinfo}@{netloc}"

    path = parsed.path
    if path == "/":
        path = ""

    normalized = urlunparse((scheme, netloc, path, parsed.params, parsed.query, parsed.fragment))
    return normalized
