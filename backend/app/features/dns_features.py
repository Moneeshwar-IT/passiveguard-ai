"""
PassiveGuard AI — DNS Feature Extraction Module (Module 2)

STRICT PASSIVE CONSTRAINT:
Operates strictly on observed DNS payload metadata captured in PCAPs or NetFlow streams.
NO external DNS resolution, WHOIS queries, or domain probing is performed.
"""
import math
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator


class DNSFeatures(BaseModel):
    """
    Structured container for lexical, statistical, and n-gram DNS features.
    Maintains backward compatibility with Module 1 detector contracts.
    """
    domain_name: Optional[str] = None
    domain_length: Optional[int] = None
    shannon_entropy: Optional[float] = None
    vowel_ratio: Optional[float] = None
    consonant_ratio: Optional[float] = None
    hyphen_count: Optional[int] = None
    subdomain_count: Optional[int] = None

    dns_query_length: Optional[int] = None
    dns_label_count: Optional[int] = None
    dns_max_label_length: Optional[int] = None
    dns_digit_ratio: Optional[float] = None
    dns_alpha_ratio: Optional[float] = None
    dns_unique_character_ratio: Optional[float] = None
    dns_entropy: Optional[float] = None
    dns_query_frequency: Optional[float] = None
    dns_unique_query_count: Optional[int] = None
    dns_nxdomain_ratio: Optional[float] = None
    dns_ngrams_top_freq: Optional[Dict[str, float]] = None

    @model_validator(mode="before")
    @classmethod
    def handle_legacy_kwargs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "shannon_entropy" in data and "dns_entropy" not in data:
                data["dns_entropy"] = data["shannon_entropy"]
            if "digit_ratio" in data and "dns_digit_ratio" not in data:
                data["dns_digit_ratio"] = data["digit_ratio"]
            if "domain_length" in data and "dns_query_length" not in data:
                data["dns_query_length"] = data["domain_length"]
        return data

    @property
    def digit_ratio(self) -> float:
        return self.dns_digit_ratio if self.dns_digit_ratio is not None else 0.0

    @property
    def query_frequency(self) -> float:
        return self.dns_query_frequency if self.dns_query_frequency is not None else 0.0

    model_config = ConfigDict(extra="ignore")


def calculate_shannon_entropy(text: str) -> float:
    """
    Calculates Shannon Entropy H(X) = -sum(p(x) * log2(p(x))) of a string.
    
    Correctly handles:
    - Empty string -> 0.0
    - Single character -> 0.0
    - Repeated characters -> 0.0
    - Normal domains (e.g. google.com) -> moderate entropy (~2.5 - 3.2)
    - High entropy DGA domains (e.g. x8q1z9a7w2e.biz) -> high entropy (> 4.0)
    """
    if not text:
        return 0.0
    length = len(text)
    if length <= 1:
        return 0.0

    counts: Dict[str, int] = {}
    for char in text:
        counts[char] = counts.get(char, 0) + 1

    entropy = 0.0
    for count in counts.values():
        prob = count / length
        entropy -= prob * math.log2(prob)

    return round(entropy, 4)


def extract_ngrams(text: str, n: int = 2, top_k: int = 5) -> Dict[str, float]:
    """
    Extracts character n-grams and computes their relative frequency distribution.
    """
    if not text or len(text) < n:
        return {}

    total_ngrams = len(text) - n + 1
    ngram_counts: Dict[str, int] = {}

    for i in range(total_ngrams):
        ngram = text[i:i + n]
        ngram_counts[ngram] = ngram_counts.get(ngram, 0) + 1

    sorted_ngrams = sorted(ngram_counts.items(), key=lambda item: item[1], reverse=True)[:top_k]
    return {gram: round(count / total_ngrams, 4) for gram, count in sorted_ngrams}


def extract_dns_features(
    domain_name: Optional[str] = None,
    query_history: Optional[List[str]] = None,
    nxdomain_count: int = 0,
    time_window_sec: float = 60.0
) -> DNSFeatures:
    """
    Extracts DNS features from structured query metadata.
    If domain_name is None, returns a DNSFeatures model with explicit None fields.
    """
    if not domain_name:
        return DNSFeatures()

    clean_domain = domain_name.lower().strip(".")
    length = len(clean_domain)
    
    if length == 0:
        return DNSFeatures()

    labels = [lbl for lbl in clean_domain.split(".") if lbl]
    label_count = len(labels)
    max_label_len = max((len(lbl) for lbl in labels), default=0)

    digits = sum(c.isdigit() for c in clean_domain)
    alphas = sum(c.isalpha() for c in clean_domain)
    vowels = sum(c in "aeiou" for c in clean_domain)
    consonants = sum(c.isalpha() and c not in "aeiou" for c in clean_domain)
    hyphens = clean_domain.count("-")
    subdomains = max(clean_domain.count(".") - 1, 0)
    unique_chars = len(set(clean_domain))

    digit_ratio = digits / length
    alpha_ratio = alphas / length
    vowel_ratio = vowels / length
    consonant_ratio = consonants / length
    unique_ratio = unique_chars / length
    entropy = calculate_shannon_entropy(clean_domain)
    ngrams = extract_ngrams(clean_domain, n=2, top_k=5)

    history = query_history or [domain_name]
    unique_queries = len(set(history))
    total_queries = len(history)
    query_freq = (total_queries / (time_window_sec / 60.0)) if time_window_sec > 0 else float(total_queries)
    nxdomain_ratio = (nxdomain_count / total_queries) if total_queries > 0 else 0.0

    return DNSFeatures(
        domain_name=domain_name,
        domain_length=length,
        shannon_entropy=entropy,
        vowel_ratio=round(vowel_ratio, 4),
        consonant_ratio=round(consonant_ratio, 4),
        hyphen_count=hyphens,
        subdomain_count=subdomains,
        dns_query_length=length,
        dns_label_count=label_count,
        dns_max_label_length=max_label_len,
        dns_digit_ratio=round(digit_ratio, 4),
        dns_alpha_ratio=round(alpha_ratio, 4),
        dns_unique_character_ratio=round(unique_ratio, 4),
        dns_entropy=entropy,
        dns_query_frequency=round(query_freq, 4),
        dns_unique_query_count=unique_queries,
        dns_nxdomain_ratio=round(nxdomain_ratio, 4),
        dns_ngrams_top_freq=ngrams
    )
