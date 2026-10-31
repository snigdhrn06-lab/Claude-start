"""Config loading and deterministic random streams."""
from __future__ import annotations

import functools
import pathlib
import zlib

import numpy as np
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config"
NAMES = ["settings", "engines", "scenarios", "merchant_templates", "price_list", "costs"]


@functools.lru_cache(maxsize=None)
def _load(name: str) -> dict:
    with open(CONFIG_DIR / f"{name}.yaml") as f:
        return yaml.safe_load(f)


def load_config() -> dict:
    """Return a fresh dict of all config files (callers may mutate their copy)."""
    import copy

    return {n: copy.deepcopy(_load(n)) for n in NAMES}


def rng_for(seed: int, name: str) -> np.random.Generator:
    """Independent, order-free random stream per named component."""
    return np.random.default_rng([seed, zlib.crc32(name.encode())])
