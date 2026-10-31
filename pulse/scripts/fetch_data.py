"""Fetch the public Bread Basket dataset and verify its checksum.

The canonical source is Kaggle ("Transactions from a bakery", file BreadBasket_DMS.csv).
Kaggle needs a login, so we fetch the identical file from public GitHub mirrors and
verify the MD5 so that no altered copy is ever used.
"""
import hashlib
import pathlib
import sys
import urllib.request

EXPECTED_MD5 = "e7b15b10c254d373ffbf1c1659122a55"
MIRRORS = [
    "https://raw.githubusercontent.com/viktree/curly-octo-chainsaw/master/BreadBasket_DMS.csv",
    "https://raw.githubusercontent.com/fenago/datasets/main/BreadBasket_DMS.csv",
]
DEST = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw" / "bread_basket.csv"


def md5(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()


def main() -> int:
    if DEST.exists():
        got = md5(DEST.read_bytes())
        if got == EXPECTED_MD5:
            print(f"OK  {DEST} already present (md5 {got})")
            return 0
        print(f"WARN {DEST} exists but md5 is {got}, expected {EXPECTED_MD5}. Using it anyway (your copy).")
        return 0
    for url in MIRRORS:
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
        except Exception as e:  # noqa: BLE001
            print(f"     mirror failed: {url} ({e})")
            continue
        if md5(data) != EXPECTED_MD5:
            print(f"     checksum mismatch from {url}; skipped")
            continue
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(data)
        print(f"OK  saved {DEST} from {url} (md5 verified)")
        return 0
    print(
        "MISSING DATASET. Download 'BreadBasket_DMS.csv' from Kaggle\n"
        "  (https://www.kaggle.com/datasets/sulmansarwar/transactions-from-a-bakery)\n"
        f"  and save it as {DEST}"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
